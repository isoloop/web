// The entry. It loads only where the page's browser check passed
// (shared/browser-check.ts); otherwise the page's notice names what's missing.
import '../../../shared/guard.ts';
import './page.css';
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { whenStarted } from '../../../shared/manual-start.ts';
import workers from 'virtual:isoloop/workers';
import list from './contracts';
import contractsUrl from './contracts?isolate';
import taskSrc from './isolates/task?isolate';
import { Playground } from './playground/model';
import { PlaygroundPage } from './playground/Page';
import { connectDevtoolsIfAsked } from './devtools';
import '../../../shared/booted.ts';

/** The balancer's own allowance of pools: its default, made visible on the page. */
const maxWorkers = Math.max(2, (navigator.hardwareConcurrency || 4) - 2);
/** Measured loads, kept for the page's life: the balancer reads and writes them. */
const loads = new Map<string, number>();
// The page draws from the model at once. With ?start=manual (the site's
// examples hub) that's the idle view, and the kernel, the balancer and every
// worker wait for Start (shared/manual-start.ts); without it, they start now.
const playground = new Playground({ taskSrc, maxWorkers, loads });
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
const view = createRoot(root);
// Drawn at once, so a Start control of the page's own lands after it.
flushSync(() => view.render(<PlaygroundPage playground={playground} />));
await whenStarted(
  root,
  'Nothing runs yet. Start creates the kernel and the bus; then add tasks.',
  'append',
);

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  // Block holds a task's loop for 2 s; the kernel kills a loop only after 10 s.
  heartbeat: { killAfterMs: 10_000 },
  routing: false,
});
const balancer = createBalancer(kernel, {
  maxWorkers,
  loads: { get: (id) => loads.get(id), set: (id, pct) => void loads.set(id, pct) },
});
playground.attach(kernel, balancer);
// The devtools panel, with ?devtools=1: after the kernel, so never before Start.
connectDevtoolsIfAsked(kernel);

declare global {
  interface Window {
    /** For the E2E tests and the curious. */
    kernel: typeof kernel;
    balancer: typeof balancer;
    playground: Playground;
  }
}
Object.assign(window, { kernel, balancer, playground });
