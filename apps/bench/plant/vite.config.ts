import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { defineConfig } from 'vite';
import { browserCheck } from './lib/shared/browser-check.ts';
import { optInOutput } from './lib/shared/opt-in.ts';

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// plant's three React builds, as at plant-v0.4.2 (README.md), picked by `--mode`:
//
// | mode             | output               | data and engines            | widgets     |
// | ---------------- | -------------------- | --------------------------- | ----------- |
// | (default)        | dist/isoloop         | headless isolates           | isolates    |
// | `native`         | dist/native          | main thread                 | main thread |
// | `native-workers` | dist/native-workers  | a worker per machine, fleet | main thread |
//
// The aliases are plant's: `#main` (the entry), `#slot` (what a slot holds),
// `#env` (the widgets' data and canvas hooks), `#metrics` (the panel's
// build-specific figures) and `#host` (the page's own source). The native
// builds have no @isoloop/vite, so no Isoloop code at all.
//
// Adapted from plant (README.md): no site bar and no search tags
// (packages/ui), since the bench is never deployed, and so no devtools switch.
type Build = 'isoloop' | 'native' | 'native-workers';

const BUILDS: readonly Build[] = ['isoloop', 'native', 'native-workers'];

export default defineConfig(({ mode }) => {
  const build: Build = BUILDS.find((b) => b === mode) ?? 'isoloop';
  const kind = build === 'isoloop' ? 'isoloop' : 'native';
  return {
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    define: {
      'import.meta.env.PLANT_BUILD': JSON.stringify(build),
      // plant's agent-call build flag, always off: the bench measures the
      // matrix only, and the flag compiles that code out.
      'import.meta.env.PLANT_AGENT_COST': 'false',
    },
    resolve: {
      alias: [
        { find: '#main', replacement: src(`main.${build}.tsx`) },
        { find: '#slot', replacement: src(`slot/${kind}.tsx`) },
        { find: '#env', replacement: src(`env/${kind}.ts`) },
        { find: '#metrics', replacement: src(`metrics/${kind}.ts`) },
        { find: '#host', replacement: src(`host/${kind}.ts`) },
      ],
    },
    plugins: [
      browserCheck(build === 'isoloop' ? 'isoloop' : build),
      ...(kind === 'isoloop' ? [isoloop()] : []),
    ],
    base: './',
    worker: { format: 'es' },
    build: {
      outDir: `dist/${build}`,
      emptyOutDir: true,
      rolldownOptions: { output: optInOutput },
    },
  };
});
