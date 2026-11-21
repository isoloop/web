// The balancer's measuring step, told apart from a quarantine stay. A new
// isolate with no known load starts in the quarantine pool to be measured and
// leaves with a `steady` move, the same state and reason the balancer gives an
// isolate that blocked or crashed (isoloop/isoloop#346). Until the library
// reports `measuring` and `measured` itself, the pages tell the two apart from
// what they already see: an isolate has offended once it moved into a
// quarantine pool (a spike, a crash, a bisect), had a spike that quarantined
// it, or crashed. Remove this once #346 ships.

/** Whether a pool is one of the balancer's quarantines. */
export const isQuarantine = (pool: string | undefined): boolean =>
  pool?.startsWith('balancer-quarantine-') ?? false;

export class Offences {
  readonly #offended = new Set<string>();

  /**
   * A balancer move, recorded; returns the kind to log it as: `measured` for
   * a never-offended isolate's way out of the quarantine, else its reason.
   */
  move<R extends string>(e: { id: string; from: string; to: string; reason: R }): R | 'measured' {
    if (isQuarantine(e.to)) {
      this.#offended.add(e.id);
      return e.reason;
    }
    if (e.reason === 'steady' && isQuarantine(e.from) && !this.#offended.has(e.id))
      return 'measured';
    return e.reason;
  }

  /** A spike put on an isolate; one that quarantines it is an offence. */
  spike(e: { id: string; action: string }): void {
    if (e.action === 'quarantined') this.#offended.add(e.id);
  }

  /** A crash is an offence, even while it was being measured. */
  crash(id: string): void {
    this.#offended.add(id);
  }

  /** An isolate gone (stopped, or placed again from scratch): it starts over. */
  forget(id: string): void {
    this.#offended.delete(id);
  }

  /** Every isolate placed again from scratch (a change of placement). */
  clear(): void {
    this.#offended.clear();
  }

  /** Whether an isolate in `pool` is there to be measured, not for an offence. */
  measuring(id: string, pool: string | undefined): boolean {
    return isQuarantine(pool) && !this.#offended.has(id);
  }
}
