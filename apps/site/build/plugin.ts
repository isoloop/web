// The site's build-time code (ADR 0002, decision 1, as amended by ADR 0003):
// pages are Preact components, rendered to static HTML through ui's render().
// No framework code reaches the browser.
//
// - Pages: each `index.html` stub holds `<!-- page:<name> -->`; it becomes a
//   whole document (head tags, header and footer markers for ui/vite, the page)
//   before Vite processes it, so CSS bundling and hashing work as usual.
// - The hub's screenshots: copied to /examples/img/ (build/examples.ts).
// - The diagrams: the pinned library pages, rewritten for the policy, under
//   /how-it-works/diagrams/ (build/diagrams.ts).
// - The docs: one page per pinned guide at /docs/<slug>/ (build/docs/pages.ts).
//   They have no index.html stubs on disk: `docInputs` names one per guide,
//   and this plugin resolves and loads it as `<!-- doc:<slug> -->`.
// In dev, pages are loaded fresh on each request and a change reloads the page.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { h } from 'preact';
import { Head, type HeadProps } from 'ui/components';
import { render } from 'ui/render';
import { uiAssets } from 'ui/vite';
import type { Plugin, ViteDevServer } from 'vite';
import { buildDiagramFiles, DIAGRAMS_PATH, type EmittedFile } from './diagrams.ts';
import { imagesOf } from './examples.ts';
import type { Page, SiteData } from '../src/pages/index.ts';
import { robots, sitemap } from './crawl.ts';
import type { Doc } from './docs/pages.ts';
import { docPage } from '../src/pages/doc.tsx';
import { PAGE_MARK } from '../src/pages/intro.tsx';

/** Every page's policy (ADR 0002, decision 8). */
export const CSP = "default-src 'self'";

/** The link-preview card (docs/brand.md), served at the site's root for og:image. */
export const PREVIEW = '/og-1200x630.png';
const previewFile = (): string =>
  fileURLToPath(new URL('../../../packages/ui/brand/social/og-1200x630.png', import.meta.url));

/** The expressive mark the inner pages open with (src/pages/intro.tsx), by served path. */
const MARKS: Record<string, string> = Object.fromEntries(
  Object.values(PAGE_MARK).map((path) => [
    path,
    fileURLToPath(new URL(`../../../packages/ui${path}`, import.meta.url)),
  ]),
);

const STUB = /^\s*<!--\s*page:([a-z0-9-]+)\s*-->\s*$/;
const DOC_STUB = /^\s*<!--\s*doc:([a-z0-9-]+)\s*-->\s*$/;
/** A docs page's input id, as `docInputs` names it, and its slug. */
const DOC_INPUT = /\/docs\/([a-z0-9-]+)\/index\.html$/;

/** The build inputs for the docs pages: one virtual `docs/<slug>/index.html` each, under `siteDir`. */
export function docInputs(siteDir: string, docs: readonly Doc[]): Record<string, string> {
  return Object.fromEntries(
    docs.map((d) => [`docs/${d.slug}`, `${siteDir}/docs/${d.slug}/index.html`]),
  );
}

/** The whole document for a page. `csp` is left out in dev, where Vite injects inline styles. */
export function renderDocument(page: Page, data: SiteData, opts: { csp?: string }): string {
  const head = render(
    h(Head, {
      ...page.head,
      path: page.path,
      ...(existsSync(previewFile()) ? { image: PREVIEW } : {}),
      ...(opts.csp ? { csp: opts.csp } : {}),
    } satisfies HeadProps),
  );
  const marker = page.section ? `<!-- ui:header:${page.section} -->` : '<!-- ui:header -->';
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    head +
    '\n<link rel="stylesheet" href="/src/site.css">\n</head>\n<body>\n' +
    marker +
    '\n' +
    render(page.render(data)) +
    '\n<!-- ui:footer -->\n' +
    (page.scripts ?? []).map((src) => `<script type="module" src="${src}"></script>\n`).join('') +
    '</body>\n</html>\n'
  );
}

/** The PAGES export of a freshly loaded pages module (dev). */
function pagesOf(mod: Record<string, unknown>): Record<string, Page> {
  const pages = mod['PAGES'];
  if (typeof pages !== 'object' || pages === null)
    throw new Error('the pages module exports no PAGES');
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the same module the build imports, typed there
  return pages as Record<string, Page>;
}

export interface SiteOptions {
  pages: Record<string, Page>;
  data: SiteData;
  /** The pinned diagrams' folder (build/library.ts). */
  diagramsDir: string;
  /** In dev: the module that exports PAGES, loaded fresh on each request. */
  pagesModule: string;
  /** The docs pages (build/docs/pages.ts), in manifest order. */
  docs?: readonly Doc[];
}

function diagramFiles(dir: string): EmittedFile[] {
  const theme = uiAssets({ header: true }).theme;
  if (!theme) throw new Error('ui/vite emits no theme script');
  return buildDiagramFiles(dir, { csp: CSP, themeSrc: `/${theme.fileName}` });
}

const TYPES: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  woff: 'font/woff',
  webp: 'image/webp',
};

export function site(opts: SiteOptions): Plugin {
  let server: ViteDevServer | undefined;
  let devDiagrams: Map<string, EmittedFile> | undefined;
  const docs = new Map((opts.docs ?? []).map((d) => [d.slug, d]));
  const docOf = (id: string): Doc | undefined => docs.get(DOC_INPUT.exec(id)?.[1] ?? '');
  return {
    name: 'site',
    resolveId(id) {
      return docOf(id) && !existsSync(id) ? id : undefined;
    },
    load(id) {
      const doc = docOf(id);
      return doc && !existsSync(id) ? `<!-- doc:${doc.slug} -->\n` : undefined;
    },
    configureServer(s) {
      server = s;
      s.watcher.on('change', (file) => {
        if (/\/apps\/site\/src\/|\/packages\/ui\/src\/components\//.test(file)) {
          s.ws.send({ type: 'full-reload' });
        }
      });
      s.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const doc = docs.get(/^\/docs\/([a-z0-9-]+)\/?$/.exec(path)?.[1] ?? '');
        if (doc) {
          s.transformIndexHtml(path, renderDocument(docPage(doc), opts.data, {}))
            .then((html) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(html);
            })
            .catch(next);
          return;
        }
        let file: { source: string | Uint8Array; type: string } | undefined;
        if (path.startsWith(`/${DIAGRAMS_PATH}`)) {
          devDiagrams ??= new Map(diagramFiles(opts.diagramsDir).map((f) => [f.fileName, f]));
          const hit = devDiagrams.get(path.slice(DIAGRAMS_PATH.length + 1));
          if (hit)
            file = { source: hit.source, type: TYPES[hit.fileName.split('.').pop() ?? ''] ?? '' };
        } else if (MARKS[path]) {
          file = { source: readFileSync(MARKS[path]), type: 'image/svg+xml' };
        } else if (path === PREVIEW && existsSync(previewFile())) {
          file = { source: readFileSync(previewFile()), type: 'image/png' };
        } else {
          const shot = opts.data.examples.flatMap((e) => imagesOf(e)).find((i) => i.src === path);
          if (shot) file = { source: readFileSync(shot.file), type: 'image/webp' };
        }
        if (!file) {
          next();
          return;
        }
        res.setHeader('Content-Type', file.type);
        res.end(file.source);
      });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const d = DOC_STUB.exec(html);
        if (d) {
          const doc = docs.get(d[1] ?? '');
          if (!doc) throw new Error(`no docs page "${d[1]}" (content/docs.json)`);
          return renderDocument(docPage(doc), opts.data, server ? {} : { csp: CSP });
        }
        const m = STUB.exec(html);
        if (!m) return html;
        const name = m[1] ?? '';
        const pages = server ? pagesOf(await server.ssrLoadModule(opts.pagesModule)) : opts.pages;
        const page = pages[name];
        if (!page) throw new Error(`no page named "${name}" (apps/site/src/pages/index.ts)`);
        return renderDocument(page, opts.data, server ? {} : { csp: CSP });
      },
    },
    generateBundle() {
      // For search engines (build/crawl.ts).
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemap(
          Object.values(opts.pages).map((p) => p.path),
          opts.data.examples,
        ),
      });
      if (existsSync(previewFile()))
        this.emitFile({
          type: 'asset',
          fileName: PREVIEW.slice(1),
          source: readFileSync(previewFile()),
        });
      for (const [path, source] of Object.entries(MARKS)) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: readFileSync(source) });
      }
      for (const i of opts.data.examples.flatMap((e) => imagesOf(e))) {
        this.emitFile({ type: 'asset', fileName: i.src.slice(1), source: readFileSync(i.file) });
      }
      for (const f of diagramFiles(opts.diagramsDir)) {
        this.emitFile({ type: 'asset', fileName: DIAGRAMS_PATH + f.fileName, source: f.source });
      }
    },
  };
}
