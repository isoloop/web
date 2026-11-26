import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers';
import bootRsbuild from './boot-rsbuild?isolate';
import bootVite from './boot-vite?isolate';
import plain from './plain?isolate';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') === 'isolate' ? 'isolate' : 'main';
const which = q.get('remote') === 'rsbuild' ? 'rsbuild' : q.get('remote') === 'plain' ? 'plain' : 'vite';
const slot = document.getElementById('slot')!;
const status = document.getElementById('status')!;
const t0 = performance.now();

const done = (msg: string) => {
  status.textContent = msg;
  status.dataset.done = '1';
};

if (mode === 'main') {
  try {
    const [{ federation, REMOTES }, { createElement }, { createRoot }] = await Promise.all([
      import('./federation'),
      import('react'),
      import('react-dom/client'),
    ]);
    const mf = federation(which as 'vite' | 'rsbuild');
    const mod = await mf.loadRemote<{ default: () => unknown }>(`${REMOTES[which as 'vite' | 'rsbuild'].name}/Hello`);
    if (!mod) throw new Error('loadRemote returned nothing');
    createRoot(slot).render(createElement(mod.default as never));
    done(`main ok ${(performance.now() - t0).toFixed(0)} ms`);
  } catch (e) {
    done(`main error: ${e instanceof Error ? e.message : String(e)}`);
  }
} else {
  const kernel = createKernel({ workers: { isolateBootstrap: workers.isolateBootstrap }, routing: false });
  (window as unknown as { kernel: unknown }).kernel = kernel;
  kernel.on('isolate:ready', () => done(`isolate ready ${(performance.now() - t0).toFixed(0)} ms`));
  kernel.on('isolate:crash', (e) => {
    status.dataset.crash = `${e.reason}: ${e.message}`;
    done(`isolate crash ${e.reason}: ${e.message}`);
  });
  kernel.spawn({ id: 'hello', src: q.get('src') ?? (which === 'vite' ? bootVite : which === 'plain' ? plain : bootRsbuild), surface: slot });
}
