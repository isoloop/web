// The native builds have no isolates and no bus: those figures are "n/a".
// Widgets' timings come from the page's store; their work is all on the main
// thread. The native + workers build counts its data workers, and the About
// panel shows which jobs run in one.
import { running } from '../native/running';
import { store } from '../native/store';
import type { BuildMetricsSource } from './types';

export const buildMetrics: BuildMetricsSource = {
  read: () => ({ workerLagMs: null, busRecordsPerSec: null, workers: running.size }),
  states: () =>
    running.size === 0 ? null : Object.fromEntries([...running.keys()].map((n) => [n, 'worker'])),
  timings: (fn) =>
    store.subscribe(
      'timings',
      (r) => {
        fn(r.value);
      },
      'latest',
    ),
  applyMs: () => null,
};
