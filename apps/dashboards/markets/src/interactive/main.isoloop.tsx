// The interactive page on Isoloop: the replay, the aggregator and the stats
// engine as headless isolates, and the board, whose widgets and drawer are
// isolates too.
import { createKernel } from '@isoloop/host';
import { isoloopRuntime } from 'creator/board';
import drawerSrc from 'creator/drawer-isolate?isolate';
import widgetSrc from 'creator/widget-isolate?isolate';
import { createRoot } from 'react-dom/client';
import workers from 'virtual:isoloop/workers';
import list from './contracts';
import contractsUrl from './contracts?isolate';
import { jobs } from './jobs';
import { InteractivePage } from './page';
import { REPLAY } from './url';
import '../page.css';
import './interactive.css';

const kernel = createKernel({ contracts: { url: contractsUrl, list }, workers });

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
  }
}
window.kernel = kernel;

for (const j of jobs(REPLAY)) {
  kernel.spawn({
    id: j.id,
    src: j.src,
    grants: j.grants,
    ...(j.config === undefined ? {} : { config: j.config }),
  });
}

const runtime = isoloopRuntime({ kernel, widgetSrc, drawerSrc });
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
