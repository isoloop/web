// The native page's bus for the creator's topics (M3e decision 6): the
// three creator topics on the main thread, compacted (the newest record per
// key), with `creator.specs.v1` kept in localStorage so widgets survive a
// reload as they do in OPFS on the Isoloop page. Every other topic comes from
// the page's own native data (`sources`). Records are delivered in a
// microtask, as a bus would: never inside the publish or subscribe call.
import { DRAFT_TOPIC, SPECS_TOPIC, UI_TOPIC } from '../widget/records';
import type { WidgetBus } from '../widget/runner';
import type { HostBus } from './runtime';

type Rec = { readonly key?: string | undefined; readonly value: unknown };
type Fn = (r: Rec) => void;

/** A source topic of the page's own: subscribe from the oldest record it keeps; returns unsubscribe. */
export type NativeSources = (topic: string, fn: Fn) => () => void;

export type NativeBusOptions = {
  readonly sources: NativeSources;
  /**
   * Where `creator.specs.v1` lives in localStorage: `creator:<storageKey>:specs`.
   * One per page, so plant's and markets' widgets stay apart.
   */
  readonly storageKey: string;
  /** For tests; default `globalThis.localStorage` when there is one. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
};

const CREATOR = new Set([SPECS_TOPIC, DRAFT_TOPIC, UI_TOPIC]);

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export class NativeBus implements HostBus, WidgetBus {
  readonly #sources: NativeSources;
  readonly #storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  readonly #storageKey: string;
  readonly #topics = new Map<string, Map<string, unknown>>();
  readonly #subscribers = new Map<string, Set<Fn>>();

  constructor(o: NativeBusOptions) {
    this.#sources = o.sources;
    this.#storage = o.storage ?? defaultStorage();
    this.#storageKey = `creator:${o.storageKey}:specs`;
    for (const t of CREATOR) this.#topics.set(t, new Map());
    this.#load();
  }

  subscribe(topic: string, fn: Fn): () => void {
    if (!CREATOR.has(topic)) return this.#sources(topic, fn);
    let live = true;
    const subs = this.#subscribers.get(topic) ?? new Set<Fn>();
    this.#subscribers.set(topic, subs);
    const deliver: Fn = (r) => {
      if (live) fn(r);
    };
    // Replay what the topic holds, then everything published after: the
    // subscriber joins now, and each delivery is a microtask queued in order,
    // so a record published right after this call comes after the replay.
    const held = [...(this.#topics.get(topic) ?? new Map<string, unknown>()).entries()];
    subs.add(deliver);
    queueMicrotask(() => {
      for (const [key, value] of held) deliver({ key, value });
    });
    return () => {
      live = false;
      subs.delete(deliver);
    };
  }

  publish(topic: string, key: string, value: unknown): Promise<void> {
    const held = this.#topics.get(topic);
    if (!held) return Promise.reject(new Error(`NativeBus: "${topic}" isn't a creator topic`));
    // A compacted topic: the newest record per key, in the order keys arrived.
    held.delete(key);
    held.set(key, value);
    if (topic === SPECS_TOPIC) this.#save();
    const subs = [...(this.#subscribers.get(topic) ?? [])];
    return new Promise((resolve) => {
      queueMicrotask(() => {
        for (const fn of subs) fn({ key, value });
        resolve();
      });
    });
  }

  #load(): void {
    try {
      const raw = this.#storage?.getItem(this.#storageKey);
      if (!raw) return;
      const entries: unknown = JSON.parse(raw);
      if (!Array.isArray(entries)) return;
      const held = this.#topics.get(SPECS_TOPIC);
      for (const e of entries) {
        if (Array.isArray(e) && typeof e[0] === 'string') held?.set(e[0], e[1]);
      }
    } catch {
      // Unreadable or blocked storage: start empty, as a first visit.
    }
  }

  #save(): void {
    try {
      const held = this.#topics.get(SPECS_TOPIC) ?? new Map<string, unknown>();
      // The replay probe isn't kept: each load sends its own.
      const entries = [...held.entries()].filter(([k]) => !k.startsWith('$'));
      this.#storage?.setItem(this.#storageKey, JSON.stringify(entries));
    } catch {
      // Full or blocked storage: the widgets last until the page reloads.
    }
  }
}
