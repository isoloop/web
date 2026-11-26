// How many restarts each isolate has used in the kernel's current window: the
// crash-loop guard's own count. The supervisor allows 3 restarts within 60 s
// (the kernel's default; basic doesn't change it), and the next crash in that
// window leaves the isolate failed.
//
// It's derived from public API only: each isolate:crash adds a timestamp, ones
// older than 60 s drop out (so the count goes down on its own), and a restart
// by hand (kernel.restart, seen as `restarting` that didn't follow a crash)
// starts the count over, as the supervisor does. A pool member is counted on
// its own: when a pool's worker goes down, every member gets its own crash.
import type { Kernel } from '@isoloop/host';
import { budget } from './contracts';

export const MAX_RESTARTS = 3;
export const WITHIN_MS = 60_000;

type Listener = (id: string, used: number, cause: 'crash' | 'expired' | 'restart') => void;

export class Budget {
  readonly #crashes = new Map<string, number[]>();
  readonly #used = new Map<string, number>();
  readonly #listeners = new Set<Listener>();
  readonly #kernel: Kernel;

  constructor(kernel: Kernel, ids: readonly string[]) {
    this.#kernel = kernel;
    for (const id of ids) {
      this.#used.set(id, 0);
      this.#tell(id);
    }
    kernel.on('isolate:crash', (e) => {
      const list = this.#crashes.get(e.id) ?? [];
      list.push(performance.now());
      this.#crashes.set(e.id, list);
      this.#update(e.id, 'crash');
    });
    kernel.on('isolate:state', (e) => {
      if (e.state === 'restarting' && e.prev !== 'crashed') {
        this.#crashes.set(e.id, []);
        this.#update(e.id, 'restart');
      }
    });
    setInterval(() => {
      for (const id of this.#used.keys()) this.#update(id, 'expired');
    }, 1_000);
  }

  /** Restarts used in the current window, at most MAX_RESTARTS. */
  used(id: string): number {
    return this.#used.get(id) ?? 0;
  }

  on(fn: Listener): void {
    this.#listeners.add(fn);
  }

  #update(id: string, cause: 'crash' | 'expired' | 'restart'): void {
    const cutoff = performance.now() - WITHIN_MS;
    const list = (this.#crashes.get(id) ?? []).filter((t) => t > cutoff);
    this.#crashes.set(id, list);
    const used = Math.min(list.length, MAX_RESTARTS);
    if (used === this.#used.get(id)) return;
    this.#used.set(id, used);
    this.#tell(id);
    for (const fn of this.#listeners) fn(id, used, cause);
  }

  #tell(id: string): void {
    void this.#kernel.publish(budget, { used: this.used(id) }, { key: id }).catch(() => undefined);
  }
}
