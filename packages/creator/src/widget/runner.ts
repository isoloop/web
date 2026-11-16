// A widget's life without React or a DOM (M3e decisions 9 and 10): it reads
// its spec record and its source topic, keeps the raw records, runs the
// pipeline and hands each read to the view. The isolate and the native build
// both run it, over their own bus.
import { toRec, type CatalogTopic } from '../catalog';
import type { Output } from '../outputs';
import { pipeline, type Pipeline } from '../pipeline';
import type { WidgetSpec } from '../spec/types';
import { applyKind } from './apply';
import { RawBuffer } from './buffer';
import { specOf, specTopicOf, type WidgetMode } from './records';

/**
 * What a widget subscribes through, by topic name, from `earliest`: an
 * isolate's `ctx.bus` (isolate.tsx) or the native page's own store.
 * Returns the unsubscribe function.
 */
export interface WidgetBus {
  subscribe(
    topic: string,
    fn: (r: { readonly key?: string | undefined; readonly value: unknown }) => void,
    opts?: SubscribeHooks,
  ): () => void;
}

export type SubscribeHooks = {
  /**
   * A bus restart lost this memory topic (isoloop ADR 0007): clear what was
   * built from it; records from the new bus follow.
   */
  readonly onReset?: () => void;
};

/** What a widget is told when it starts: `manifest.config` in an isolate. */
export type WidgetConfig = {
  /** The widget id (its key in `creator.specs.v1`), or the draft id for a preview. */
  readonly id: string;
  readonly mode: WidgetMode;
  /** The source topic's catalog entry. Its name is the one topic the widget may read. */
  readonly topic: CatalogTopic;
  /**
   * On the grid, the `placement.pool` it was spawned in. A spec naming
   * another pool needs a new isolate. Replay delivers a key's older records
   * first, so the widget compares each with where it runs, not with the
   * record before it.
   */
  readonly pool?: string;
};

/**
 * - `waiting`: no spec record yet.
 * - `deleted`: a tombstone; the widget draws nothing and the host stops it.
 * - `live`: drawing `spec`.
 * - `respawn`: the newest spec needs another source topic or placement, which
 *   this widget can't take; it keeps drawing the last spec it applied (if
 *   any) until the host spawns its replacement.
 */
export type WidgetState =
  | { readonly status: 'waiting' }
  | { readonly status: 'deleted' }
  | { readonly status: 'live'; readonly spec: WidgetSpec; readonly output: Output | undefined }
  | {
      readonly status: 'respawn';
      readonly spec: WidgetSpec | undefined;
      readonly output: Output | undefined;
    };

/** A source record's value: the bus checked it against the topic's schema; the catalog names its fields. */
function isRecord(v: unknown): v is Readonly<Record<string, unknown>> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A preview rebuilds its pipeline this long after the draft last changed. */
export const DRAFT_DELAY_MS = 300;
/** How often a widget reads its pipeline for the view. */
export const READ_EVERY_MS = 100;

export class WidgetRunner {
  readonly #bus: WidgetBus;
  readonly #config: WidgetConfig;
  readonly #now: () => number;
  readonly #onChange: (s: WidgetState) => void;
  readonly #buffer: RawBuffer;
  #applied: WidgetSpec | undefined;
  #pipeline: Pipeline | undefined;
  #output: Output | undefined;
  #state: WidgetState = { status: 'waiting' };
  #pending: ReturnType<typeof setTimeout> | undefined;
  #unsubscribe: (() => void)[] = [];

  constructor(
    bus: WidgetBus,
    config: WidgetConfig,
    o: { now?: () => number; onChange?: (s: WidgetState) => void } = {},
  ) {
    this.#bus = bus;
    this.#config = config;
    this.#now = o.now ?? Date.now;
    this.#onChange = o.onChange ?? (() => {});
    this.#buffer = new RawBuffer(config.topic.history);
  }

  get state(): WidgetState {
    return this.#state;
  }

  /** Subscribes to the source topic, then to the spec record. */
  start(): void {
    const { topic, mode, id } = this.#config;
    this.#unsubscribe.push(
      this.#bus.subscribe(
        topic.name,
        (r) => {
          if (!isRecord(r.value)) return;
          const rec = toRec(topic, { key: r.key, value: r.value }, this.#now());
          this.#buffer.push(rec);
          this.#pipeline?.push(rec);
        },
        { onReset: () => this.#onSourceReset() },
      ),
      this.#bus.subscribe(specTopicOf(mode), (r) => {
        if (r.key === id) this.#onSpec(specOf(r.value));
      }),
    );
  }

  stop(): void {
    for (const u of this.#unsubscribe.splice(0)) u();
    if (this.#pending !== undefined) clearTimeout(this.#pending);
    this.#pending = undefined;
  }

  /** Reads the pipeline at `now`, for the view; the state carries the output. */
  tick(): WidgetState {
    const now = this.#now();
    this.#buffer.evict(now);
    if (this.#pipeline) {
      this.#output = this.#pipeline.read(now);
      const s = this.#state;
      if (s.status === 'live' || s.status === 'respawn')
        this.#state = { ...s, output: this.#output };
    }
    return this.#state;
  }

  #onSpec(spec: WidgetSpec | null): void {
    if (this.#pending !== undefined) clearTimeout(this.#pending);
    this.#pending = undefined;
    if (spec === null) {
      this.#applied = undefined;
      this.#pipeline = undefined;
      this.#output = undefined;
      this.#set({ status: 'deleted' });
      return;
    }
    const { mode, topic, pool } = this.#config;
    // Grants and placement are fixed at spawn: a spec for another source
    // topic, or (on the grid) another pool, waits for the host to respawn.
    const elsewhere =
      spec.source.topic !== topic.name ||
      (mode === 'spec' && pool !== undefined && spec.placement.pool !== pool);
    if (elsewhere) {
      this.#set({ status: 'respawn', spec: this.#applied, output: this.#output });
      return;
    }
    const old = this.#applied;
    if (old === undefined) {
      this.#apply(spec);
      return;
    }
    const kind = applyKind(old, spec, mode);
    if (kind === 'respawn') {
      // Without a pool in the config: a placement change, as applyKind says.
      this.#set({ status: 'respawn', spec: old, output: this.#output });
    } else if (kind === 'reconfigure') {
      if (mode === 'draft') this.#pending = setTimeout(() => this.#apply(spec), DRAFT_DELAY_MS);
      else this.#apply(spec);
    } else if (this.#state.status === 'respawn') {
      // Back to the spec it runs: nothing to respawn after all.
      this.#set({ status: 'live', spec: old, output: this.#output });
    }
  }

  /**
   * The bus restarted and lost the source topic: what the widget kept came
   * from it, so it starts again empty, on the spec it runs. A lost draft
   * keeps the preview on its last spec until the drawer publishes it again.
   */
  #onSourceReset(): void {
    this.#buffer.clear();
    if (this.#applied === undefined) return;
    this.#pipeline = pipeline(this.#applied, this.#config.topic);
    this.#output = undefined;
    const s = this.#state;
    if (s.status === 'live' || s.status === 'respawn') this.#set({ ...s, output: undefined });
  }

  #apply(spec: WidgetSpec): void {
    this.#pending = undefined;
    const p = pipeline(spec, this.#config.topic);
    this.#buffer.refill(p);
    this.#applied = spec;
    this.#pipeline = p;
    this.#output = undefined;
    this.#set({ status: 'live', spec, output: undefined });
  }

  #set(s: WidgetState): void {
    this.#state = s;
    this.#onChange(s);
  }
}
