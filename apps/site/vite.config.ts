import { fileURLToPath } from 'node:url';
import { ui } from 'ui/vite';
import { defineConfig } from 'vite';
import { loadChangelog } from './build/changelog.ts';
import { readDiagrams } from './build/diagrams.ts';
import { loadExamples } from './build/examples.ts';
import { loadFeatures } from './build/features.ts';
import { buildLlms } from './build/docs/llms.ts';
import { loadDocs } from './build/docs/pages.ts';
import { ensureLibrary, guidesDir, libraryReader, readPin } from './build/library.ts';
import { loadSamples } from './build/samples.ts';
import { docInputs, site } from './build/plugin.ts';
import { PAGES } from './src/pages/index.ts';

// isoloop.dev's own pages (ADR 0002, as amended): the landing page, the
// features, how it works, the examples hub, the changelog, the docs pages and the 404. Each index.html is a one-line stub that the `site`
// plugin renders from a Preact page; `ui` adds the header, footer, tokens and
// theme script (ADR 0003). The dashboards and basic are built on their own and
// put next to this build by scripts/assemble-site.sh.
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const siteDir = here('.');
const diagramsDir = ensureLibrary(siteDir);
const library = libraryReader(siteDir);
// The docs pages, from the guides at the pin (build/docs/pages.ts).
const pin = readPin(siteDir);
const kind = (path: string): 'file' | 'dir' | undefined =>
  library.has(path) ? (library.list(path).some((f) => f !== path) ? 'dir' : 'file') : undefined;
const docs = loadDocs({
  manifest: here('content/docs.json'),
  guidesDir: guidesDir(siteDir),
  pin,
  kind,
});
// The same guides for agents: llms.txt, llms-full.txt, a .md copy each (build/docs/llms.ts).
const llms = buildLlms({ docs, guidesDir: guidesDir(siteDir), pin, kind });

export default defineConfig({
  plugins: [
    site({
      pages: PAGES,
      pagesModule: '/src/pages/index.ts',
      diagramsDir,
      docs,
      llms,
      data: {
        examples: loadExamples(here('../..')),
        features: loadFeatures(here('content/features'), library, here('../..')),
        diagrams: readDiagrams(diagramsDir),
        pin: readPin(siteDir),
        changelog: loadChangelog(library, readPin(siteDir), here('../..')),
        samples: loadSamples(here('../samples/src')),
      },
    }),
    ui({ header: true, footer: true }),
  ],
  base: '/',
  build: {
    // No data: URLs: every asset is a same-origin file (ADR 0002, decision 8).
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        home: here('index.html'),
        features: here('features/index.html'),
        'how-it-works': here('how-it-works/index.html'),
        examples: here('examples/index.html'),
        changelog: here('changelog/index.html'),
        'not-found': here('404.html'),
        ...docInputs(siteDir.replace(/\/$/, ''), docs),
      },
    },
  },
});
