import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { ui } from 'ui/vite';
import { defineConfig, type Alias, type Plugin } from 'vite';
import { browserCheck } from '../../../shared/browser-check.ts';
import { indexed, unindexed } from '../../../shared/search.ts';
import { optInOutput } from '../../../shared/opt-in.ts';
import example from './example.json' with { type: 'json' };

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// One code base, seven builds (M3b tasks 15 and 16b, M3f decision 2, M3g), picked by `--mode`:
//
// | mode             | output                | framework | kernel                             |
// | ---------------- | --------------------- | --------- | ---------------------------------- |
// | (default)        | dist/isoloop          | React     | Isoloop                            |
// | `native`         | dist/native           | React     | none, main thread                  |
// | `native-workers` | dist/native-workers   | React     | none; headless jobs in own workers |
// | `native-mixed`   | dist/native-mixed     | both      | as native-workers, with parts      |
// | `native-mixed-parts` | dist/native-mixed/parts | Preact | (the parts only)               |
// | `isoloop-preact` | dist/isoloop-preact   | Preact    | Isoloop                            |
// | `native-preact`  | dist/native-preact    | Preact    | none, main thread                  |
// | `mixed`          | dist/mixed            | both      | Isoloop                            |
// | `mixed-preact`   | dist/mixed/preact     | Preact    | (isolates only)                    |
//
// Each points three aliases at its own files: `#main` (the entry), `#slot`
// (what a slot holds) and `#env` (the widgets' data and canvas hooks), plus
// `#widgets` (which module each Isoloop slot runs) and `#metrics` (the
// panel's Isoloop-only figures). `native-workers` shares the native files,
// with its own entry, which starts the headless jobs in plain workers. Native
// builds have no @isoloop/vite, so no Isoloop code at all. Widgets are written once against
// React's API; the Preact builds alias React to preact/compat, and
// @isoloop/react to @isoloop/preact. `/mixed` runs the React build's host and
// React widgets, plus the filters and the alerts panel as Preact isolates,
// built apart by `mixed-preact` (ADR 0012) and loaded by URL. `native-mixed`
// is its native counterpart: the native + workers host, with the same two
// widgets as Preact parts built apart by `native-mixed-parts` and loaded at
// run time with `import()` from their manifest (M3g decisions 1–4).
type Build =
  | 'isoloop'
  | 'native'
  | 'native-workers'
  | 'native-mixed'
  | 'native-mixed-parts'
  | 'isoloop-preact'
  | 'native-preact'
  | 'mixed'
  | 'mixed-preact';

const BUILDS: readonly Build[] = [
  'isoloop',
  'native',
  'native-workers',
  'native-mixed',
  'native-mixed-parts',
  'isoloop-preact',
  'native-preact',
  'mixed',
  'mixed-preact',
];

/** The widgets `/mixed` runs on Preact; the rest stay on React. */
export const MIXED_PREACT = {
  filters: 'src/isolates/widgets/filters.tsx',
  'alerts-panel': 'src/isolates/widgets/alerts.tsx',
} as const;

/** The Preact parts `native-mixed` loads at run time: the same two widgets. */
const PARTS = {
  filters: src('parts/filters.tsx'),
  'alerts-panel': src('parts/alerts-panel.tsx'),
};

/**
 * Writes `parts-manifest.json` next to the parts: each entry's file and CSS,
 * the way a team publishes what its build emitted (M3g decision 4).
 */
function partsManifest(): Plugin {
  return {
    name: 'parts-manifest',
    generateBundle(_options, bundle) {
      const parts: Record<string, { entry: string; css?: string[] }> = {};
      for (const c of Object.values(bundle)) {
        if (c.type !== 'chunk' || !c.isEntry) continue;
        const css = [...(c.viteMetadata?.importedCss ?? [])];
        parts[c.name] = { entry: c.fileName, ...(css.length > 0 ? { css } : {}) };
      }
      this.emitFile({
        type: 'asset',
        fileName: 'parts-manifest.json',
        source: `${JSON.stringify({ parts }, null, 2)}\n`,
      });
    },
  };
}

const PREACT: Alias[] = [
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
  { find: /^react$/, replacement: 'preact/compat' },
  { find: /^@isoloop\/react$/, replacement: '@isoloop/preact' },
];

/** The builds left out of search, by what their titles call them. */
const COMPARED: Partial<Record<Build, string>> = {
  native: 'native',
  'native-workers': 'native + workers',
  'native-mixed': 'native + workers, React and Preact',
  'isoloop-preact': 'Isoloop, Preact',
  'native-preact': 'native, Preact',
  mixed: 'Isoloop, React and Preact',
};

/** Only the Isoloop React build is indexed (shared/search.ts). */
const meta = (build: Build) =>
  build === 'isoloop'
    ? indexed(
        'Markets example: a live trading-data dashboard',
        'A live markets dashboard on public exchange feeds, with trades, prices and alerts, built on Isoloop and native, in React and Preact.',
        example.links.live,
      )
    : unindexed(`Markets example (${COMPARED[build] ?? build})`);

export default defineConfig(({ mode }) => {
  const build: Build = BUILDS.find((b) => b === mode) ?? 'isoloop';
  if (build === 'native-mixed-parts') return partsBuild();
  const native =
    build === 'native' ||
    build === 'native-workers' ||
    build === 'native-mixed' ||
    build === 'native-preact';
  const workers = build === 'native-workers' || build === 'native-mixed';
  const preact =
    build === 'isoloop-preact' || build === 'native-preact' || build === 'mixed-preact';
  const kind = native ? 'native' : 'isoloop';
  const plugins =
    build === 'mixed-preact'
      ? [isoloop({ isolates: MIXED_PREACT, library: true })]
      : native
        ? []
        : [isoloop()];
  return {
    oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
    define: {
      'import.meta.env.MARKETS_BUILD': JSON.stringify(build === 'mixed-preact' ? 'mixed' : build),
    },
    resolve: {
      alias: [
        {
          find: '#main',
          replacement: src(workers ? 'main.native-workers.tsx' : `main.${kind}.tsx`),
        },
        {
          find: '#slot',
          replacement: src(build === 'native-mixed' ? 'slot/native-mixed.tsx' : `slot/${kind}.tsx`),
        },
        { find: '#env', replacement: src(`env/${kind}.ts`) },
        { find: '#metrics', replacement: src(`metrics/${kind}.ts`) },
        {
          find: '#widgets',
          replacement: src(build === 'mixed' ? 'isoloop/widgets.mixed.ts' : 'isoloop/widgets.ts'),
        },
        ...(preact ? PREACT : []),
      ],
    },
    // The thin bar back to the site, fixed dark (ADR 0003, decision 7).
    plugins: [
      browserCheck(workers ? 'native-workers' : native ? 'native' : 'isoloop'),
      ...plugins,
      ui({ bar: true, meta: () => meta(build) }),
    ],
    base: './',
    // The native + workers build's module workers (src/native/workers.ts).
    ...(workers ? { worker: { format: 'es' as const } } : {}),
    build: {
      outDir: build === 'mixed-preact' ? 'dist/mixed/preact' : `dist/${build}`,
      emptyOutDir: true,
      // The devtools panel and WebMCP, loaded only when asked for, as `opt-in-*`.
      rolldownOptions: { output: optInOutput },
    },
  };
});

/**
 * `native-mixed-parts`: the two Preact parts, built apart as another team's
 * bundle, with its own Preact and nothing shared with the host (M3g
 * decision 3). Each part's entry exports `mount` (src/parts/contract.ts).
 */
function partsBuild() {
  return {
    oxc: { jsx: { runtime: 'automatic' as const, importSource: 'react' } },
    define: { 'import.meta.env.MARKETS_BUILD': JSON.stringify('native-mixed') },
    resolve: { alias: [{ find: '#env', replacement: src('parts/env.ts') }, ...PREACT] },
    plugins: [partsManifest()],
    base: './',
    build: {
      outDir: 'dist/native-mixed/parts',
      emptyOutDir: true,
      rolldownOptions: {
        input: PARTS,
        preserveEntrySignatures: 'exports-only' as const,
        output: { entryFileNames: '[name]-[hash].js' },
      },
    },
  };
}
