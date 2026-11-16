// The window operator: which records an aggregate or a table sees.
import type { Rec } from '../catalog';

/** Most records a window buffer holds, whatever its length; older ones are dropped. */
export const BUFFER_LIMIT = 100_000;

export type WindowShape = { readonly ms: number } | { readonly n: number } | null;

/**
 * Records in arrival order, with the window applied when read. Reads take a
 * time so that a pipeline can take the window as it was at a past tick.
 */
export class RecordWindow {
  readonly #shape: WindowShape;
  readonly #limit: number;
  #recs: Rec[] = [];

  /** `limit` bounds a window with no shape (every record is in it): the newest `limit` are kept. */
  constructor(shape: WindowShape, limit = BUFFER_LIMIT) {
    this.#shape = shape;
    this.#limit = Math.min(limit, BUFFER_LIMIT);
  }

  push(rec: Rec): void {
    this.#recs.push(rec);
    if (this.#recs.length > this.#limit) this.#recs.splice(0, this.#recs.length - this.#limit);
  }

  /** The oldest record's time, or undefined when empty. */
  oldest(): number | undefined {
    let min: number | undefined;
    for (const r of this.#recs) if (min === undefined || r.t < min) min = r.t;
    return min;
  }

  /** The records in the window that ends at `at`: none newer than `at`. */
  at(at: number): Rec[] {
    const upTo = this.#recs.filter((r) => r.t <= at);
    const shape = this.#shape;
    if (shape === null) return upTo;
    if ('ms' in shape) return upTo.filter((r) => r.t > at - shape.ms);
    return upTo.slice(-shape.n);
  }

  /** Drops what no window ending at `from` or later can see. */
  evict(from: number): void {
    const shape = this.#shape;
    if (shape === null) return;
    if ('ms' in shape) {
      this.#recs = this.#recs.filter((r) => r.t > from - shape.ms);
      return;
    }
    const older = this.#recs.filter((r) => r.t <= from);
    if (older.length <= shape.n) return;
    const keep = new Set(older.slice(-shape.n));
    this.#recs = this.#recs.filter((r) => r.t > from || keep.has(r));
  }
}
