// The File processor page's entry. It loads only where the page's browser
// check passed (shared/browser-check.ts).
import '../../../../shared/guard.ts';
import '../page.css';
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { manualStart, whenStarted } from '../../../../shared/manual-start.ts';
import workers from 'virtual:isoloop/workers';
import list from '../contracts';
import contractsUrl from '../contracts?isolate';
import generatorSrc from '../isolates/generator?isolate';
import processorSrc from '../isolates/processor?isolate';
import { FileProcessor, type Dials, type Mode } from './model';
import { FilesPage } from './Page';
import { connectDevtoolsIfAsked } from '../devtools';
import { restartsFrom } from '../restarts';
import '../../../../shared/booted.ts';

/**
 * The page's settings from the URL, for links and the comparison
 * (comparison/run.ts): `placement` balancer (the default), own, one, or
 * one-off (one pool and no balancer at all: the baseline for its own cost);
 * the generator's `rate`, `poison`, `heavy`, `corrupt` and `seed`; the
 * balancer's `maxWorkers`; and `start=1` to start at once.
 */
const params = new URLSearchParams(location.search);
const num = (key: string): number | undefined => {
  const v = params.get(key);
  const n = v === null ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const placement = params.get('placement') ?? 'balancer';
const mode: Mode = placement === 'own' ? 'own' : placement.startsWith('one') ? 'one' : 'balancer';
const dials: Partial<Dials> = { running: params.get('start') === '1' };
for (const key of ['rate', 'poison', 'heavy', 'corrupt', 'seed'] as const) {
  const v = num(key);
  if (v !== undefined) dials[key] = v;
}

/**
 * The balancer's own allowance of pools: its default, made visible on the
 * page, or `maxWorkers` from the URL. The comparison sets 2, what the default
 * gives a 4-core machine, since a container can report the host's threads.
 */
const maxWorkers = num('maxWorkers') ?? Math.max(2, (navigator.hardwareConcurrency || 4) - 2);

// The page draws from the model at once. With ?start=manual (the site's
// examples hub) that's the idle view, and the kernel, the balancer and every
// worker wait for Start (shared/manual-start.ts); without it, they start now.
/** The kernel's restart limit, from `?restarts=` (the Restarts control); the host's defaults without it. */
const restarts = restartsFrom(location.search);
const model = new FileProcessor({
  processorSrc,
  generatorSrc,
  maxWorkers,
  mode,
  dials,
  restartLimit: restarts.limit,
});
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
const view = createRoot(root);
// Drawn at once, so a Start control of the page's own lands after it.
flushSync(() => view.render(<FilesPage model={model} />));
await whenStarted(
  root,
  'Nothing runs yet. Start creates the kernel, the generator and the processors; then start the generator.',
  'append',
);

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  // A poison file holds a processor's loop for 2 s; the kernel kills a loop only after 10 s.
  heartbeat: { killAfterMs: 10_000 },
  routing: false,
  ...(restarts.supervisor ? { supervisor: restarts.supervisor } : {}),
});
const balancer = placement === 'one-off' ? undefined : createBalancer(kernel, { maxWorkers });
model.attach(kernel, balancer);
// Started from the examples hub (?start=manual), its Start is the run's too:
// the generator starts with the kernel, as the page's own Start would.
if (manualStart) model.setDials({ running: true });
// The devtools panel, with ?devtools=1: after the kernel, so never before Start.
connectDevtoolsIfAsked(kernel);

declare global {
  interface Window {
    /** For the E2E tests, the comparison and the curious. */
    files: FileProcessor;
  }
}
Object.assign(window, { kernel, balancer, files: model });
