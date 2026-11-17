// The File processor page's entry. It loads only where the page's browser
// check passed (shared/browser-check.ts).
import '../../../../shared/guard.ts';
import '../page.css';
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import { createRoot } from 'react-dom/client';
import workers from 'virtual:isoloop/workers';
import list from '../contracts';
import contractsUrl from '../contracts?isolate';
import generatorSrc from '../isolates/generator?isolate';
import processorSrc from '../isolates/processor?isolate';
import { FileProcessor, type Dials, type Mode } from './model';
import { FilesPage } from './Page';
import '../../../../shared/booted.ts';

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  // A poison file holds a processor's loop for 2 s; the kernel kills a loop only after 10 s.
  heartbeat: { killAfterMs: 10_000 },
  routing: false,
});

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
const balancer = placement === 'one-off' ? undefined : createBalancer(kernel, { maxWorkers });
const model = new FileProcessor({
  kernel,
  balancer,
  processorSrc,
  generatorSrc,
  maxWorkers,
  mode,
  dials,
});

declare global {
  interface Window {
    /** For the E2E tests, the comparison and the curious. */
    files: FileProcessor;
  }
}
Object.assign(window, { kernel, balancer, files: model });

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<FilesPage model={model} />);
