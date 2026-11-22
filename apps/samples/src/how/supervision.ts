// /how-it-works/, "The supervisor": the defaults spelled out, and the events.
import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers';

// #region show
const kernel = createKernel({
  workers,
  heartbeat: { everyMs: 100, blockedAfterMs: 400, killAfterMs: 10_000 },
  supervisor: {
    maxRestarts: 3,
    withinMs: 60_000,
    backoff: { initialMs: 250, factor: 2, maxMs: 4_000 },
  },
});

kernel.on('isolate:state', (e) => console.log(`${e.id}: ${e.prev} → ${e.state}`));
kernel.on('isolate:failed', (e) => console.warn(`${e.id} gave up: ${e.reason}`));
// #endregion
