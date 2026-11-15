// The Isoloop-only figures: loop lag per worker from the isolates' heartbeats,
// bus throughput from `bus:metrics`, and the workers running (an own worker or
// a pool each count once).
import type { IsolateSnapshot, PoolSnapshot } from '@isoloop/host';
import { timings } from '../isoloop/contracts';
import { kernel } from '../isoloop/kernel';
import type { BuildMetricsSource } from './types';

let busRecordsPerSec = 0;
kernel.on('bus:metrics', (m) => {
  busRecordsPerSec = m.topics.reduce((n, t) => n + t.recordsPerSec, 0);
});

// Main-thread time applying each surface's DOM changes: the compositor
// reports the last frame's apply time per surface; a frame that applied a
// batch adds it.
const applied = new Map<string, number>();
const seen = new Map<string, number>();
const sample = (): void => {
  for (const i of kernel.isolates()) {
    const s = i.surface;
    if (!s) continue;
    if (s.applied !== seen.get(i.id)) {
      seen.set(i.id, s.applied);
      applied.set(i.id, (applied.get(i.id) ?? 0) + s.lastFrameMs);
    }
  }
  requestAnimationFrame(sample);
};
requestAnimationFrame(sample);

/** Workers running now: each pool once, each isolate outside a pool once. */
export function workerCount(
  isolates: readonly IsolateSnapshot[] = kernel.isolates(),
  pools: readonly PoolSnapshot[] = kernel.pools(),
): number {
  const own = isolates.filter((i) => i.pool === undefined && i.state !== 'stopped').length;
  return own + pools.filter((p) => p.running).length;
}

export const buildMetrics: BuildMetricsSource = {
  read: () => {
    const isolates = kernel.isolates();
    return {
      workerLagMs: Math.max(0, ...isolates.map((i) => i.lagMs)),
      busRecordsPerSec,
      workers: workerCount(isolates),
    };
  },
  states: () => Object.fromEntries(kernel.isolates().map((i) => [i.id, i.state])),
  timings: (fn) =>
    kernel.subscribe(
      timings,
      (r) => {
        fn(r.value);
      },
      { from: 'latest' },
    ),
  applyMs: () => applied,
};
