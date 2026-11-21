// The interactive page on Isoloop: the replay, the aggregator and the stats
// engine as headless isolates, and the board, whose widgets and drawer are
// isolates too. One balancer places the `auto` widgets (M3h), from loads kept
// in `creator.placement.v1`.
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
import { CHAOS, REPLAY } from './url';
import { devtoolsRequested, mountDevtoolsSwitch } from '../../../../../shared/devtools-switch.ts';
import '../page.css';
import './interactive.css';

const kernel = createKernel({ contracts: { url: contractsUrl, list }, workers });
const loads = placementLoads(hostBus(kernel));
const balancer = createBalancer(kernel, { loads });

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
    /** For the E2E suite (M3h). */
    balancer: typeof balancer;
  }
}
window.kernel = kernel;
window.balancer = balancer;

// The Devtools switch on the bar, and with ?devtools=1 the panel, imported
// lazily as on the dashboard's Isoloop build (src/isoloop/devtools.ts).
mountDevtoolsSwitch(document.querySelector('.ui-bar'));
if (devtoolsRequested())
  void import('@isoloop/devtools').then(({ connectDevtools }) => connectDevtools(kernel));

for (const j of jobs(REPLAY)) {
  kernel.spawn({
    id: j.id,
    src: j.src,
    grants: j.grants,
    ...(j.config === undefined ? {} : { config: j.config }),
  });
}

const runtime = isoloopRuntime({
  kernel,
  widgetSrc,
  drawerSrc,
  auto: { balancer, loads },
  chaos: CHAOS,
});
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
