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
import { FileProcessor } from './model';
import { FilesPage } from './Page';
import '../../../../shared/booted.ts';

const kernel = createKernel({
  contracts: { url: contractsUrl, list },
  workers,
  // A poison file holds a processor's loop for 2 s; the kernel kills a loop only after 10 s.
  heartbeat: { killAfterMs: 10_000 },
  routing: false,
});

/** The balancer's own allowance of pools: its default, made visible on the page. */
const maxWorkers = Math.max(2, (navigator.hardwareConcurrency || 4) - 2);
const balancer = createBalancer(kernel, { maxWorkers });
const model = new FileProcessor({ kernel, balancer, processorSrc, generatorSrc, maxWorkers });

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
