// The raw records a widget keeps, so a reconfigured pipeline starts full
// (M3e decision 10): every record of the source topic, any key, for as long
// as the topic keeps them, capped by count.
import type { Rec } from '../catalog';
import type { Pipeline } from '../pipeline';

/** Most raw records a widget keeps, whatever the topic's history (as the window's cap). */
export const RAW_BUFFER_LIMIT = 100_000;

export class RawBuffer {
  readonly #history: number;
  readonly #limit: number;
  #recs: Rec[] = [];
  #head = 0;

  /** `history`: how far back the topic keeps records, in ms (its catalog entry). */
  constructor(history: number, limit = RAW_BUFFER_LIMIT) {
    this.#history = history;
    this.#limit = limit;
  }

  push(rec: Rec): void {
    this.#recs.push(rec);
    if (this.#recs.length - this.#head > this.#limit) this.#head = this.#recs.length - this.#limit;
    this.#compact();
  }

  /** Drops what's older than the topic keeps, as of `now`. */
  evict(now: number): void {
    const from = now - this.#history;
    while (this.#head < this.#recs.length && (this.#recs[this.#head]?.t ?? from) < from)
      this.#head++;
    this.#compact();
  }

  /** Forgets every record (the source topic was lost in a bus restart). */
  clear(): void {
    this.#recs = [];
    this.#head = 0;
  }

  get size(): number {
    return this.#recs.length - this.#head;
  }

  /** Pushes every kept record into `p`, oldest first. */
  refill(p: Pipeline): void {
    for (let i = this.#head; i < this.#recs.length; i++) {
      const r = this.#recs[i];
      if (r) p.push(r);
    }
  }

  #compact(): void {
    if (this.#head > 4096 && this.#head * 2 > this.#recs.length) {
      this.#recs = this.#recs.slice(this.#head);
      this.#head = 0;
    }
  }
}
