// The docs pages (M4c, decisions 9–11 and 29; ADR 0006): the library's guides
// and its generated API reference, fetched at the pin (build/library.ts),
// listed and ordered by content/docs.json, and rendered through renderMarkdown().
//
// A guide's slug is its file name (`pools` for docs/guide/pools.md, page
// /docs/pools/). An API page's slug is `api/` and its file name (`api/host`
// for docs/api/host.md, page /docs/api/host/). The manifest also takes links
// into a page (Kernel config → /docs/api/host/#kernelconfig), which show in
// the sidebar and on /docs/ but aren't pages.
//
// The manifest and the fetched files must match exactly: a page at the pin
// that docs.json doesn't list fails the build, and so does a listed page the
// pin doesn't have. A planned page is listed when the pin first has it, in the
// PR that moves the pin (the docs skill's "add a guide" step).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { highlight } from './highlight.ts';
import { API_PATH, GUIDES_PATH, rewriteLink, type LinkContext } from './links.ts';
import { apiPage } from './api.ts';
import { DocError, renderMarkdown, type DocHeading } from './render.ts';

const slug = z
  .string()
  .regex(
    /^(api\/)?[a-z0-9]+(-[a-z0-9]+)*$/,
    'a guide slug (getting-started) or an API page (api/host)',
  );

const pageEntry = z.strictObject({
  slug,
  /**
   * The guide was written before the one-sentence lead rule and is
   * waiting to be reshaped (isoloop/isoloop M4c task 5): its
   * description is its lead's first sentence. The build fails once
   * the guide no longer needs it, so the mark can't outstay it.
   */
  leadPending: z.literal(true).optional(),
  /** The page's feature is `@experimental`: the pill after its name (ADR 0005, decision 4). */
  experimental: z.literal(true).optional(),
});

/** A link into a page, not a page of its own (Kernel config, M4c decision 29). */
const linkEntry = z.strictObject({
  title: z.string().min(1),
  /** A site path to a docs page, with an anchor: `/docs/api/host/#kernelconfig`. */
  href: z
    .string()
    .regex(/^\/docs\/(api\/)?[a-z0-9-]+\/#[a-z0-9-]+$/, 'a docs page path with an anchor'),
  /** Its one-sentence description on /docs/. */
  description: z.string().min(1),
});

const isLink = (
  e: z.infer<typeof pageEntry> | z.infer<typeof linkEntry>,
): e is z.infer<typeof linkEntry> => 'href' in e;

export const manifestSchema = z.strictObject({
  $comment: z.string().optional(),
  sections: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        guides: z.array(z.union([pageEntry, linkEntry])).min(1),
      }),
    )
    .min(1),
});

export type DocsManifest = z.infer<typeof manifestSchema>;

/** One docs page on the site: a guide, or an API page. */
export interface Doc {
  /** `pools` for a guide, `api/host` for an API page. */
  slug: string;
  /** A hand-written guide, or a page generated from the published types. */
  kind: 'guide' | 'api';
  /** Its section in the manifest, e.g. "Build". */
  section: string;
  /** Marked `experimental` in the manifest. */
  experimental: boolean;
  /** `/docs/<slug>/`, e.g. `/docs/pools/` or `/docs/api/host/`. */
  path: string;
  title: string;
  description: string;
  html: string;
  headings: DocHeading[];
  /** The lead paragraph as inline HTML, and the page after it (renderMarkdown). */
  leadHtml: string;
  body: string;
  /** The page's path in the library: `docs/guide/pools.md`, `docs/api/host.md`. */
  source: string;
}

/** One entry of a docs section: a page, or a link into one. */
export interface NavItem {
  title: string;
  path: string;
  description: string;
  experimental: boolean;
  /** The page's slug; a link into a page has none. */
  slug?: string;
}

/** The sidebar's and /docs/'s sections, in manifest order. */
export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Where a slug's file is in the library. */
export const sourceOf = (page: string): string =>
  page.startsWith('api/') ? `${API_PATH}/${page.slice(4)}.md` : `${GUIDES_PATH}/${page}.md`;

/** Reads and validates docs.json; the error names the file and the field. */
export function readManifest(file: string): DocsManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: not valid JSON (${e instanceof Error ? e.message : String(e)})`, {
      cause: e,
    });
  }
  const r = manifestSchema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`${file}: ${issue?.path.join('.') || '(root)'}: ${issue?.message}`);
  }
  const seen = new Set<string>();
  for (const g of r.data.sections.flatMap((s) => s.guides)) {
    if (isLink(g)) continue;
    if (seen.has(g.slug)) throw new Error(`${file}: "${g.slug}" is listed twice`);
    seen.add(g.slug);
  }
  for (const g of r.data.sections.flatMap((s) => s.guides)) {
    if (!isLink(g)) continue;
    const to = /^\/docs\/(.+)\/#/.exec(g.href)?.[1] ?? '';
    if (!seen.has(to))
      throw new Error(`${file}: the link "${g.title}" points at "${to}", which it doesn't list`);
  }
  return r.data;
}

/** The slugs of the manifest's pages, in order (links left out). */
export function pageSlugs(manifest: DocsManifest): string[] {
  return manifest.sections.flatMap((s) => s.guides.flatMap((g) => (isLink(g) ? [] : [g.slug])));
}

/** Checks the manifest against the pages at the pin, both ways (`fetched`: guide slugs and `api/…` slugs). */
export function matchGuides(
  manifest: DocsManifest,
  fetched: readonly string[],
  file: string,
): void {
  const listed = new Set(pageSlugs(manifest));
  const have = new Set(fetched);
  const unlisted = [...have].filter((s) => !listed.has(s));
  const missing = [...listed].filter((s) => !have.has(s));
  const problems = [
    ...unlisted.map((s) => `${sourceOf(s)} is at the pin but not in ${file}; add it to a section`),
    ...missing.map((s) => `${file} lists "${s}", but the pin has no ${sourceOf(s)}`),
  ];
  if (problems.length) throw new Error(problems.join('\n'));
}

export interface LoadDocsOptions {
  /** content/docs.json. */
  manifest: string;
  /** The pinned docs/guide folder (guidesDir in build/library.ts). */
  guidesDir: string;
  /** The pinned docs/api folder (apiDir in build/library.ts); without one, no API pages. */
  apiDir?: string;
  pin: string;
  /** What's at a library path at the pin (for links to ADRs, source and the rest). */
  kind: LinkContext['kind'];
}

/** The `.md` files in a folder, by name; none when the folder doesn't exist. */
function mdFiles(dir: string | undefined): string[] {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
}

/** A page's Markdown as the site uses it: LF line ends, and an API page without its "generated" note. */
export function readPage(page: string, o: Pick<LoadDocsOptions, 'guidesDir' | 'apiDir'>): string {
  const api = page.startsWith('api/');
  const dir = api ? o.apiDir : o.guidesDir;
  if (!dir) throw new Error(`no docs/api folder for "${page}"`);
  // Pages checked out on a machine with core.autocrlf may have CRLF ends.
  const src = readFileSync(join(dir, `${api ? page.slice(4) : page}.md`), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
  return api ? apiPage.source(src) : src;
}

/** Every docs page, in manifest order. Throws on any rule the docs break. */
export function loadDocs(o: LoadDocsOptions): Doc[] {
  const manifest = readManifest(o.manifest);
  const fetched = [...mdFiles(o.guidesDir), ...mdFiles(o.apiDir).map((f) => `api/${f}`)];
  const file = relative(process.cwd(), o.manifest) || o.manifest;
  matchGuides(manifest, fetched, file);
  const pages = new Set(fetched);

  return manifest.sections.flatMap((section) =>
    section.guides.flatMap((g): Doc[] => {
      if (isLink(g)) return [];
      const kind = g.slug.startsWith('api/') ? 'api' : 'guide';
      const source = sourceOf(g.slug);
      const src = readPage(g.slug, o);
      const ctx: LinkContext = { file: source, pin: o.pin, guides: pages, kind: o.kind };
      const doc = renderMarkdown(src, {
        file: source,
        highlight,
        rewrite: (href, k) => rewriteLink(href, k, ctx),
        lead: g.leadPending ? 'first-sentence' : 'strict',
      });
      if (g.leadPending) {
        let strict = true;
        try {
          renderMarkdown(src, { file: source });
        } catch (e) {
          if (!(e instanceof DocError)) throw e;
          strict = false;
        }
        if (strict) {
          throw new Error(
            `${file}: "${g.slug}" is marked leadPending, but its lead is one sentence now; remove the mark`,
          );
        }
      }
      const body = kind === 'api' ? apiPage.html(doc.body) : doc.body;
      return [
        {
          slug: g.slug,
          kind,
          section: section.title,
          experimental: g.experimental === true,
          path: `/docs/${g.slug}/`,
          title: doc.title,
          description: doc.description,
          html: kind === 'api' ? apiPage.html(doc.html) : doc.html,
          headings: doc.headings,
          leadHtml: doc.leadHtml,
          body,
          source,
        },
      ];
    }),
  );
}

/** The sections for the sidebar and /docs/: each page, and each link into one, in manifest order. */
export function docsNav(manifestFile: string, docs: readonly Doc[]): NavSection[] {
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  return readManifest(manifestFile).sections.map((s) => ({
    title: s.title,
    items: s.guides.map((g): NavItem => {
      if (isLink(g)) {
        return { title: g.title, path: g.href, description: g.description, experimental: false };
      }
      const d = bySlug.get(g.slug);
      if (!d) throw new Error(`docs.json lists "${g.slug}", which has no page`);
      return {
        title: d.title,
        path: d.path,
        description: d.description,
        experimental: d.experimental,
        slug: d.slug,
      };
    }),
  }));
}
