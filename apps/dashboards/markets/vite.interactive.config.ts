import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig } from 'vite';
import { browserCheck } from '../../../shared/browser-check.ts';
import { optInOutput } from '../../../shared/opt-in.ts';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

// The interactive page (M3e decision 3), two builds of one source, picked by
// `--mode`: `isoloop` (the default) into dist/interactive/isoloop, and
// `native` into dist/interactive/native, deployed next to markets' builds at
// /dashboards/markets/interactive/. Markets' own builds (vite.config.ts)
// don't change. `#interactive` is the entry; the native build has no
// @isoloop/vite.
type Kind = 'isoloop' | 'native';

export default defineConfig(({ mode }) => {
  const kind: Kind = mode === 'native' ? 'native' : 'isoloop';
  return {
    root: here('./interactive'),
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    define: { 'import.meta.env.MARKETS_BUILD': JSON.stringify(kind) },
    resolve: {
      alias: [{ find: '#interactive', replacement: here(`./src/interactive/main.${kind}.tsx`) }],
    },
    plugins: [browserCheck(kind), ...(kind === 'isoloop' ? [isoloop()] : []), ui({ bar: true })],
    base: './',
    worker: { format: 'es' },
    build: {
      outDir: here(`./dist/interactive/${kind}`),
      emptyOutDir: true,
      // The devtools panel, loaded only with `?devtools=1`, as `opt-in-*`.
      rolldownOptions: { output: optInOutput },
    },
  };
});
