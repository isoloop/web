import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig } from 'vite';
import { browserCheck } from '../../../shared/browser-check.ts';
import { indexed, unindexed } from '../../../shared/search.ts';
import { optInOutput } from '../../../shared/opt-in.ts';
import example from './example.json' with { type: 'json' };

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// One code base, three React builds (M3d decision 7), picked by `--mode`:
//
// | mode             | output               | data and engines            | widgets     |
// | ---------------- | -------------------- | --------------------------- | ----------- |
// | (default)        | dist/isoloop         | headless isolates           | isolates    |
// | `native`         | dist/native          | main thread                 | main thread |
// | `native-workers` | dist/native-workers  | a worker per machine, fleet | main thread |
//
// Each points aliases at its own files: `#main` (the entry), `#slot` (what a
// slot holds), `#env` (the widgets' data and canvas hooks), `#metrics` (the
// panel's build-specific figures) and `#host` (the page's own source). The native builds have no
// @isoloop/vite, so no Isoloop code at all; both use the main-thread store,
// and differ only in where the feeds and engines run.
type Build = 'isoloop' | 'native' | 'native-workers';

const BUILDS: readonly Build[] = ['isoloop', 'native', 'native-workers'];

/** Only the Isoloop build is indexed (shared/search.ts). */
const meta = (build: Build) =>
  build === 'isoloop'
    ? indexed(
        'Plant example: a live telemetry dashboard',
        'A live telemetry dashboard for a fictional plant: 8 machines and 72 widgets, on Isoloop in six placements, with native builds to compare.',
        example.links.live,
      )
    : unindexed(`Plant example (${build === 'native' ? 'native' : 'native + workers'})`);

export default defineConfig(({ mode }) => {
  const build: Build = BUILDS.find((b) => b === mode) ?? 'isoloop';
  const kind = build === 'isoloop' ? 'isoloop' : 'native';
  return {
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    define: {
      'import.meta.env.PLANT_BUILD': JSON.stringify(build),
      // `PLANT_AGENT_COST=1` (M4a task 13): the agent-call cost's ping topic,
      // isolate and runner. A constant, so every other build drops them.
      'import.meta.env.PLANT_AGENT_COST': JSON.stringify(process.env['PLANT_AGENT_COST'] === '1'),
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
      // `PLANT_COI=1` makes the preview and dev servers cross-origin isolated
      // (COOP/COEP), so `?inspect=1` also measures memory per isolate (M4b
      // task 6). Off by default; the deployed pages never get these headers.
      ...(kind === 'isoloop'
        ? [isoloop({ crossOriginIsolated: process.env['PLANT_COI'] === '1' })]
        : []),
      // The thin bar back to the site, fixed dark (ADR 0003, decision 7).
      ui({ bar: true, meta: () => meta(build) }),
    ],
    base: './',
    worker: { format: 'es' },
    build: {
      outDir: `dist/${build}`,
      emptyOutDir: true,
      // The devtools panel, loaded only with `?devtools=1`, as `opt-in-*`.
      rolldownOptions: { output: optInOutput },
    },
  };
});
