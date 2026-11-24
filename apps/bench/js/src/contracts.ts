// The bench's topics. Memory topics, unchecked: the bench publishes them
// itself, and validating would add work that isn't the workload's.
import { contracts, topic, unchecked } from '@isoloop/bus';
import type { BenchWindow, CopyResult } from './harness.ts';

/** The shared measuring window, key `window`. Read from `earliest`, so a moved isolate finds it. */
export const windowTopic = topic('jsbench.window.v1', {
  schema: unchecked<BenchWindow>(),
  retention: { kind: 'compacted' },
});

/**
 * Each copy's running count, keyed by its id, once a second. `life` tells a
 * restarted copy its own records from those of its life before a move.
 */
export const counts = topic('jsbench.counts.v1', {
  schema: unchecked<{ life: string; lives: number; ops: number; index: number }>(),
  retention: { kind: 'compacted' },
});

/** A copy has its inputs ready (after every start, a move's too). */
export const ready = topic('jsbench.ready.v1', {
  schema: unchecked<{ id: string; life: string; checksum: number }>(),
  retention: { kind: 'last-n', n: 500 },
});

/** A copy's result at the window's end. */
export const results = topic('jsbench.results.v1', {
  schema: unchecked<{ id: string; life: string; lives: number; result: CopyResult }>(),
  retention: { kind: 'last-n', n: 500 },
});

export const TOPIC_NAMES = [windowTopic.name, counts.name, ready.name, results.name];

export default contracts(windowTopic, counts, ready, results);
