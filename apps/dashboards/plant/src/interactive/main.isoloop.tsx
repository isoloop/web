// The interactive page on Isoloop: the plant's feeds and engines as headless
// isolates, and the board, whose widgets and drawer are isolates too. One
// balancer places the `auto` widgets (M3h), from loads kept in
// `creator.placement.v1`.
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import { hostBus, isoloopRuntime, placementLoads } from 'creator/board';
import drawerSrc from 'creator/drawer-isolate?isolate';
import widgetSrc from 'creator/widget-isolate?isolate';
import { createRoot } from 'react-dom/client';
import workers from 'virtual:isoloop/workers';
import list from './contracts';
import contractsUrl from './contracts?isolate';
import { jobs } from './jobs';
import { InteractivePage } from './page';
import { SETTINGS } from './url';
import '../page.css';
import './interactive.css';

/** As on plant's page (isoloop/kernel.ts): a loop busy this long is killed and restarted. */
const KILL_AFTER_MS = 2_000;

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  heartbeat: { killAfterMs: KILL_AFTER_MS },
});

const loads = placementLoads(hostBus(kernel));
const balancer = createBalancer(kernel, { loads });

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
    /** For the E2E suite and the comparison (M3h). */
    balancer: typeof balancer;
  }
}
window.kernel = kernel;
window.balancer = balancer;

for (const j of jobs(SETTINGS.seed, SETTINGS.rate)) {
  kernel.spawn({
    id: j.id,
    src: j.src,
    grants: j.grants,
    ...(j.config === undefined ? {} : { config: j.config }),
    ...(j.pool === undefined ? {} : { pool: j.pool }),
  });
}

const runtime = isoloopRuntime({
  kernel,
  widgetSrc,
  drawerSrc,
  auto: { balancer, loads },
  chaos: SETTINGS.chaos,
});
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
