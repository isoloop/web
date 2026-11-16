import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig } from 'vite';
import { browserCheck } from '../../shared/browser-check.ts';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// processor (M3h): background work as headless isolates. Two pages: the
// playground (index.html), where tasks with a CPU dial show the balancer's
// automatic placement, and the file processor (files/), to come.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  plugins: [
    browserCheck('isoloop'),
    isoloop(),
    ui({ header: { current: 'examples' }, footer: true }),
  ],
  base: './',
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      input: { playground: here('./index.html'), files: here('./files/index.html') },
    },
  },
});
