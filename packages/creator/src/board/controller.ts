// The page's side of the interactive board (M3e decisions 8 and 10–13, 20):
// it reads `creator.specs.v1` and keeps one widget running per spec in the
// surface the grid gives it, respawning one whose source topic or placement
// changed; it seeds the starter widgets on a first visit and resets to them;
// and it runs the drawer: the form, opened to add or edit, and the preview,
// which follows the form's draft. Pure logic over a BoardRuntime, so the
// Isoloop and native pages share it, and tests run it on a fake one.
import { topicOf, type Catalog } from '../catalog';
import type { WidgetSpec } from '../spec/types';
import { applyKind } from '../widget/apply';
import {
  DRAFT_TOPIC,
  SPECS_TOPIC,
  TOMBSTONE,
  UI_TOPIC,
  addedOf,
  isWidgetKey,
  specOf,
  specRecord,
} from '../widget/records';
import type { BoardRuntime, Mounted } from './runtime';
import { UI_KEY, doneOf, type UiRecord } from './ui';

/** Most widgets a page holds, the preview not counted (decision 20). */
export const WIDGET_CAP = 24;
/** How often the page tells the drawer about its pools. */
export const POOLS_EVERY_MS = 1_000;
/** The replay probe's key in `creator.specs.v1`. */
export const SYNC_KEY = '$sync';

export type BoardWidget = {
  readonly id: string;
  readonly spec: WidgetSpec;
  /** When it was first added; the grid's order. */
  readonly added: number;
};

export type DrawerState =
  | { readonly open: false }
  | {
      readonly open: true;
      readonly mode: 'add' | 'edit';
      /** For `edit`. */
      readonly id?: string;
      readonly draftId: string;
    };

export type BoardState = {
  /** False until the specs topic has replayed (and the starters are seeded on a first visit). */
  readonly ready: boolean;
  /** In add order, at most `cap`. */
  readonly widgets: readonly BoardWidget[];
  /** The page holds `cap` widgets: Add is off. */
  readonly full: boolean;
  readonly drawer: DrawerState;
};

export type BoardOptions = {
  readonly runtime: BoardRuntime;
  readonly catalog: Catalog;
  /** The page's starter widgets, seeded on a first visit and by "Reset to starter". */
  readonly starters: readonly WidgetSpec[];
  readonly cap?: number;
  readonly now?: () => number;
  /** Random text for the replay probe and draft ids. */
  readonly random?: () => string;
  readonly poolsEveryMs?: number;
};

type Entry = { spec: WidgetSpec; added: number; seq: number };
type Slot = { surface: Element; mounted: Mounted | undefined; spec: WidgetSpec | undefined };
/**
 * The running preview. `mounted` settles once it has started: a preview for a
 * new topic waits for the old one's `stop()`, since both have the draft's id.
 */
type Preview = { mounted: Promise<Mounted | undefined>; topic: string };

const randomText = (): string => Math.random().toString(36).slice(2, 10);

export class BoardController {
  readonly #rt: BoardRuntime;
  readonly #catalog: Catalog;
  readonly #starters: readonly WidgetSpec[];
  readonly #cap: number;
  readonly #now: () => number;
  readonly #random: () => string;
  readonly #poolsEveryMs: number;

  readonly #entries = new Map<string, Entry>();
  readonly #slots = new Map<string, Slot>();
  readonly #listeners = new Set<(s: BoardState) => void>();
  #seen = false;
  #ready = false;
  #seq = 0;
  #probe = '';
  #unsubscribe: (() => void)[] = [];
  #timer: ReturnType<typeof setInterval> | undefined;
  #state: BoardState;

  #n = 0;
  #drawer: DrawerState = { open: false };
  #form: Element | undefined;
  #previewSurface: Element | undefined;
  #formMounted: Mounted | undefined;
  #preview: Preview | undefined;

  constructor(o: BoardOptions) {
    this.#rt = o.runtime;
    this.#catalog = o.catalog;
    this.#starters = o.starters;
    this.#cap = o.cap ?? WIDGET_CAP;
    this.#now = o.now ?? Date.now;
    this.#random = o.random ?? randomText;
    this.#poolsEveryMs = o.poolsEveryMs ?? POOLS_EVERY_MS;
    this.#state = this.#compute();
  }

  get state(): BoardState {
    return this.#state;
  }

  get cap(): number {
    return this.#cap;
  }

  /** Calls `fn` on every change; returns the unsubscribe function. */
  subscribe(fn: (s: BoardState) => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  /**
   * Reads the specs (then probes: once the probe comes back, the replay is
   * done, and an empty topic gets the starters), the drafts and the
   * drawer's messages.
   */
  start(): void {
    const { bus } = this.#rt;
    this.#probe = this.#random();
    this.#unsubscribe.push(
      bus.subscribe(SPECS_TOPIC, (r) => this.#onSpec(r.key, r.value)),
      bus.subscribe(DRAFT_TOPIC, (r) => this.#onDraft(r.key, r.value)),
      bus.subscribe(UI_TOPIC, (r) => {
        if (r.key === UI_KEY.done) this.#onDone(r.value);
      }),
    );
    void bus.publish(SPECS_TOPIC, SYNC_KEY, { sync: this.#probe });
    if (this.#rt.pools) {
      this.#timer = setInterval(() => this.#publishPools(), this.#poolsEveryMs);
    }
  }

  /** Stops every widget, the preview and the form, and unsubscribes. */
  stop(): void {
    for (const u of this.#unsubscribe.splice(0)) u();
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
    for (const slot of this.#slots.values()) {
      void slot.mounted?.stop();
      slot.mounted = undefined;
    }
    void this.#stopPreview();
    void this.#formMounted?.stop();
    this.#formMounted = undefined;
  }

  /** The grid rendered `id`'s slot: its widget runs in `surface`. */
  attach(id: string, surface: Element): void {
    const old = this.#slots.get(id);
    if (old?.surface === surface) return;
    if (old) this.detach(id);
    this.#slots.set(id, { surface, mounted: undefined, spec: undefined });
    const entry = this.#entries.get(id);
    if (entry) this.#mount(id, entry.spec);
  }

  /** The grid removed `id`'s slot: its widget stops. */
  detach(id: string): void {
    const slot = this.#slots.get(id);
    if (!slot) return;
    void slot.mounted?.stop();
    this.#slots.delete(id);
  }

  /** The drawer frame's two slots. The form starts the first time the drawer opens. */
  attachDrawer(form: Element, preview: Element): void {
    this.#form = form;
    this.#previewSurface = preview;
  }

  openAdd(): void {
    if (this.#state.full) return;
    this.#open('add');
  }

  openEdit(id: string): void {
    if (!this.#entries.has(id)) return;
    this.#open('edit', id);
  }

  /** Closes the drawer from the page (its × button): the preview stops, the draft goes. */
  closeDrawer(): void {
    const d = this.#drawer;
    if (!d.open) return;
    this.#drawer = { open: false };
    void this.#stopPreview();
    void this.#rt.bus.publish(DRAFT_TOPIC, d.draftId, TOMBSTONE);
    this.#emit();
  }

  remove(id: string): Promise<void> {
    return this.#rt.bus.publish(SPECS_TOPIC, id, TOMBSTONE);
  }

  /** Tombstones every widget that isn't a starter and publishes the starters again. */
  async reset(): Promise<void> {
    const starters = new Set(this.#starters.map((s) => s.id));
    const gone = [...this.#entries.keys()].filter((id) => !starters.has(id));
    await Promise.all([
      ...gone.map((id) => this.#rt.bus.publish(SPECS_TOPIC, id, TOMBSTONE)),
      ...this.#seed(),
    ]);
  }

  #seed(): Promise<void>[] {
    const now = this.#now();
    return this.#starters.map((s, i) =>
      this.#rt.bus.publish(SPECS_TOPIC, s.id, specRecord(s, now + i)),
    );
  }

  #onSpec(key: string | undefined, value: unknown): void {
    if (key === SYNC_KEY) {
      if (!this.#ready && typeof value === 'object' && value !== null) {
        if (Reflect.get(value, 'sync') === this.#probe) {
          this.#ready = true;
          if (!this.#seen) void Promise.all(this.#seed());
          this.#emit();
          this.#publishPools();
        }
      }
      return;
    }
    if (!isWidgetKey(key)) return;
    this.#seen = true;
    const spec = specOf(value);
    if (spec === null) {
      this.#entries.delete(key);
      const slot = this.#slots.get(key);
      if (slot?.mounted) {
        void slot.mounted.stop();
        slot.mounted = undefined;
        slot.spec = undefined;
      }
      if (this.#drawer.open && this.#drawer.id === key) this.closeDrawer();
    } else {
      const prev = this.#entries.get(key);
      this.#entries.set(key, {
        spec,
        added: addedOf(value) ?? prev?.added ?? this.#now(),
        seq: prev?.seq ?? ++this.#seq,
      });
      this.#mount(key, spec);
    }
    this.#emit();
    this.#publishPools();
  }

  /** Starts, keeps or respawns `id`'s widget for `spec`, if the grid gave it a slot. */
  #mount(id: string, spec: WidgetSpec): void {
    const slot = this.#slots.get(id);
    if (!slot) return;
    const topic = topicOf(this.#catalog, spec.source.topic);
    if (!topic) return;
    if (slot.mounted && slot.spec) {
      const kind = applyKind(slot.spec, spec);
      if (kind !== 'respawn') {
        // The widget reads its own record and reconfigures itself.
        slot.spec = spec;
        return;
      }
      const old = slot.mounted;
      slot.spec = spec;
      slot.mounted = undefined;
      void old.stop().then(() => {
        if (this.#slots.get(id) !== slot || slot.mounted) return;
        slot.mounted = this.#rt.mountWidget(slot.spec ?? spec, slot.surface, {
          mode: 'spec',
          topic,
        });
      });
      return;
    }
    slot.spec = spec;
    slot.mounted = this.#rt.mountWidget(spec, slot.surface, { mode: 'spec', topic });
  }

  #open(mode: 'add' | 'edit', id?: string): void {
    const prev = this.#drawer;
    if (prev.open) {
      void this.#stopPreview();
      void this.#rt.bus.publish(DRAFT_TOPIC, prev.draftId, TOMBSTONE);
    }
    const n = ++this.#n;
    const draftId = `d${n}-${this.#random()}`;
    this.#drawer = { open: true, mode, draftId, ...(id === undefined ? {} : { id }) };
    if (!this.#formMounted && this.#form) {
      this.#formMounted = this.#rt.mountDrawer(this.#form, {
        catalog: this.#catalog,
        native: this.#rt.kind === 'native',
        cap: this.#cap,
      });
    }
    const open: UiRecord = { open: { n, mode, draftId, ...(id === undefined ? {} : { id }) } };
    void this.#rt.bus.publish(UI_TOPIC, UI_KEY.open, open);
    this.#emit();
  }

  /** The preview follows the open drawer's draft: started on the first, respawned on a new topic. */
  #onDraft(key: string | undefined, value: unknown): void {
    const d = this.#drawer;
    if (!d.open || key !== d.draftId || !this.#previewSurface) return;
    const spec = specOf(value);
    if (spec === null) return;
    const topic = topicOf(this.#catalog, spec.source.topic);
    if (!topic) return;
    if (this.#preview?.topic === topic.name) return;
    const stopped = this.#stopPreview();
    const surface = this.#previewSurface;
    const draftId = d.draftId;
    const entry: Preview = {
      topic: topic.name,
      // Spawned once the old preview, with the same id, has stopped; not at
      // all if the drawer closed or moved to another topic meanwhile.
      mounted: stopped.then(() =>
        this.#preview === entry && this.#drawer.open && this.#drawer.draftId === draftId
          ? this.#rt.mountWidget(spec, surface, { mode: 'draft', topic, draftId })
          : undefined,
      ),
    };
    this.#preview = entry;
  }

  #onDone(value: unknown): void {
    const done = doneOf(value);
    if (!done || done.n !== this.#n) return;
    this.closeDrawer();
  }

  #stopPreview(): Promise<void> {
    const p = this.#preview;
    this.#preview = undefined;
    if (!p) return Promise.resolve();
    return p.mounted.then((m) => m?.stop()).catch(() => {});
  }

  #publishPools(): void {
    if (!this.#rt.pools || !this.#ready) return;
    const pools = this.#rt.pools(this.#state.widgets.map((w) => w.spec));
    void this.#rt.bus.publish(UI_TOPIC, UI_KEY.pools, { pools } satisfies UiRecord).catch(() => {});
  }

  #compute(): BoardState {
    const widgets = [...this.#entries.entries()]
      .toSorted(([, a], [, b]) => a.added - b.added || a.seq - b.seq)
      .slice(0, this.#cap)
      .map(([id, e]) => ({ id, spec: e.spec, added: e.added }));
    return {
      ready: this.#ready,
      widgets,
      full: widgets.length >= this.#cap,
      drawer: this.#drawer,
    };
  }

  #emit(): void {
    this.#state = this.#compute();
    for (const fn of this.#listeners) fn(this.#state);
  }
}
