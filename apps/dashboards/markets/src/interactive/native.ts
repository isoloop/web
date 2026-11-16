// The native page's sources for the board: each catalog topic read from
// markets' store, the oldest kept records first, then live ones. The store
// keeps a count per stream, so this keeps its own log per offered topic over
// the same time window as the Isoloop page's bus (catalog.ts, KEEP_MS), and
// a widget's history means the same on both kernels.
import type { NativeSources } from 'creator/board';
import type { Rec, Source, StreamName } from '../core/streams';
import { AGGREGATES, CATALOG, PRICES, STATS, TRADES } from './catalog';

type AnyRec = Rec<unknown>;
type Fn = (r: AnyRec) => void;

const STREAMS: Record<string, StreamName> = {
  [TRADES.name]: 'trades',
  [PRICES.name]: 'prices',
  [AGGREGATES.name]: 'aggregates',
  [STATS.name]: 'stats',
};

const tsOf = (r: AnyRec): number => {
  const v = r.value;
  const ts: unknown = typeof v === 'object' && v !== null ? Reflect.get(v, 'ts') : undefined;
  return typeof ts === 'number' ? ts : Date.now();
};

/** One topic's records within its history, oldest first. */
class TimeLog {
  readonly #keepMs: number;
  #recs: AnyRec[] = [];
  #head = 0;
  readonly subs = new Set<Fn>();

  constructor(keepMs: number) {
    this.#keepMs = keepMs;
  }

  push(r: AnyRec): void {
    this.#recs.push(r);
    const cutoff = tsOf(r) - this.#keepMs;
    while (this.#head < this.#recs.length) {
      const first = this.#recs[this.#head];
      if (first === undefined || tsOf(first) >= cutoff) break;
      this.#head++;
    }
    // Drop the expired prefix now and then, not on every record.
    if (this.#head > 1_024 && this.#head * 2 > this.#recs.length) {
      this.#recs = this.#recs.slice(this.#head);
      this.#head = 0;
    }
    for (const fn of this.subs) fn(r);
  }

  replay(fn: Fn): void {
    for (let i = this.#head; i < this.#recs.length; i++) {
      const r = this.#recs[i];
      if (r !== undefined) fn(r);
    }
  }
}

/** Starts keeping the offered topics from `store` now; the sources read from these logs. */
export function nativeSources(store: Source): NativeSources {
  const logs = new Map<string, TimeLog>();
  for (const t of CATALOG.topics) {
    const stream = STREAMS[t.name];
    if (stream === undefined) continue;
    const log = new TimeLog(t.history);
    logs.set(t.name, log);
    store.subscribe(
      stream,
      (r) => {
        log.push(r);
      },
      'earliest',
    );
  }
  return (topic, fn) => {
    const log = logs.get(topic);
    if (!log) return () => {};
    log.replay(fn);
    log.subs.add(fn);
    return () => {
      log.subs.delete(fn);
    };
  };
}
