// The host (apps/basic/src/app.ts, without the demo's panes and recording):
// A and B on workers of their own, C and D sharing the pool "shared".
declare const surfaces: Record<'A' | 'B' | 'C' | 'D', Element>;

// #region show
import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers';
import list from './topics';
import contractsUrl from './topics?isolate';
import counter from './counter?isolate';
import ticker from './ticker?isolate';
import primes from './primes?isolate';
import messages from './messages?isolate';

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  heartbeat: { killAfterMs: 2_000 }, // a loop busy for 2 s is restarted
});

// A and B: a worker each.
kernel.spawn({
  id: 'A',
  src: counter,
  surface: surfaces.A,
  grants: { publish: ['count.v1'], subscribe: ['count.v1'] },
});
kernel.spawn({ id: 'B', src: ticker, surface: surfaces.B });

// C and D: one pool, so one event loop.
kernel.spawn({
  id: 'C',
  src: primes,
  surface: surfaces.C,
  pool: 'shared',
  grants: { publish: ['primes.v1'], subscribe: ['count.v1'] },
});
kernel.spawn({
  id: 'D',
  src: messages,
  surface: surfaces.D,
  pool: 'shared',
  grants: { publish: ['note.v1'], subscribe: ['count.v1', 'note.v1', 'primes.v1'] },
});
// #endregion
