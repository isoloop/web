// The interactive page on Isoloop: the plant's feeds and engines as headless
// isolates, and the board, whose widgets and drawer are isolates too.
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

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
  }
}
window.kernel = kernel;

for (const j of jobs(SETTINGS.seed, SETTINGS.rate)) {
  kernel.spawn({
    id: j.id,
    src: j.src,
    grants: j.grants,
    ...(j.config === undefined ? {} : { config: j.config }),
    ...(j.pool === undefined ? {} : { pool: j.pool }),
  });
}

const runtime = isoloopRuntime({ kernel, widgetSrc, drawerSrc });
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<InteractivePage runtime={runtime} />);
