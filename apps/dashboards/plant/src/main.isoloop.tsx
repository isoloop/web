import { createRoot } from 'react-dom/client';
import { headlessJobs } from './isoloop/headless';
import { kernel } from './isoloop/kernel';
import './isoloop/devtools';
import './isoloop/inspect';
import { poolOf } from './isoloop/placement';
import { Page } from './page';
import { SETTINGS } from './url';
import './page.css';

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
  }
}
window.kernel = kernel;

// `PLANT_AGENT_COST=1` builds (M4a task 13) add the agent-call cost's ping
// isolate and runner; `?agent=idle` there starts only the kernel, the bus and
// that isolate, as the idle page. Other builds drop both: the flag is a
// build-time constant.
if (import.meta.env.PLANT_AGENT_COST) void import('./isoloop/agent-cost');
const idle = import.meta.env.PLANT_AGENT_COST
  ? new URLSearchParams(location.search).get('agent') === 'idle'
  : false;

// The feeds and engines as headless isolates (M3d tasks 2 and 3), in the
// placement's pools (decision 6).
for (const j of idle ? [] : headlessJobs(SETTINGS.seed, SETTINGS.rate)) {
  const pool = poolOf(SETTINGS.placement, {
    kind: j.kind,
    ...(j.machine ? { machine: j.machine } : {}),
  });
  kernel.spawn({
    id: j.id,
    src: j.src,
    grants: j.grants,
    ...(j.config === undefined ? {} : { config: j.config }),
    ...(pool === undefined ? {} : { pool }),
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
if (!idle) createRoot(root).render(<Page />);
