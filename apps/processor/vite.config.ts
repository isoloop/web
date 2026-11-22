import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig } from 'vite';
import { browserCheck } from '../../shared/browser-check.ts';
import { indexed } from '../../shared/search.ts';
import example from './example.json' with { type: 'json' };

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// processor (M3h): background work as headless isolates. Two pages: the
// playground (index.html), where tasks with a CPU dial show the balancer's
// automatic placement, and the file processor (files/), to come.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  plugins: [
    browserCheck('isoloop'),
    isoloop(),
    ui({
      header: { current: 'examples' },
      footer: true,
      meta: (page) =>
        page.startsWith('/files/')
          ? indexed(
              'File processor example: consumer groups in workers',
              'A simulated file processor on Isoloop: groups of headless isolates process a stream of files, placed by the balancer.',
              `${example.links.live}files/`,
            )
          : indexed(
              'Balancer playground: automatic worker placement',
              "Spawn background tasks, turn their CPU dial, and watch Isoloop's balancer move them between worker pools.",
              example.links.live,
            ),
    }),
  ],
  base: './',
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      input: { playground: here('./index.html'), files: here('./files/index.html') },
    },
  },
});
