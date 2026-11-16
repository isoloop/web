// The entry. It loads only where the page's browser check passed
// (shared/browser-check.ts); otherwise the page's notice names what's missing.
import '../../../shared/guard.ts';
import './page.css';
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import { createRoot } from 'react-dom/client';
import workers from 'virtual:isoloop/workers';
import list from './contracts';
import contractsUrl from './contracts?isolate';
import taskSrc from './isolates/task?isolate';
import { Playground } from './playground/model';
import { PlaygroundPage } from './playground/Page';
import '../../../shared/booted.ts';

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  // Block holds a task's loop for 2 s; the kernel kills a loop only after 10 s.
  heartbeat: { killAfterMs: 10_000 },
  routing: false,
});

/** The balancer's worker cap: its default, made visible on the page. */
const maxWorkers = Math.max(2, (navigator.hardwareConcurrency || 4) - 2);
/** Measured loads, kept for the page's life: the balancer reads and writes them. */
const loads = new Map<string, number>();
const balancer = createBalancer(kernel, {
  maxWorkers,
  loads: { get: (id) => loads.get(id), set: (id, pct) => void loads.set(id, pct) },
});

const playground = new Playground({ kernel, balancer, taskSrc, maxWorkers, loads });

declare global {
  interface Window {
    /** For the E2E tests and the curious. */
    kernel: typeof kernel;
    balancer: typeof balancer;
    playground: Playground;
  }
}
Object.assign(window, { kernel, balancer, playground });

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<PlaygroundPage playground={playground} />);
