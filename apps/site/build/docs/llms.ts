// The docs for agents (M4c, decision 16; ADR 0006, section 4), written by the
// same build as the pages, so they can't go stale:
// - /llms.txt: the llmstxt.org index, one line per docs page with its
//   description, linking each page's Markdown copy;
// - /docs/<slug>.md: the page as fetched at the pin, its links made absolute
//   (a guide's /docs/pools.md, an API page's /docs/api/host.md);
// - /llms-full.txt: every page in nav order, each under its title and URL.
// Links in the copies: another docs page → its Markdown copy on the site; anything
// else in the library → GitHub at the pin (the same rules as the pages,
// links.ts).
import { site } from '../../src/copy.ts';
import { ORIGIN } from '../crawl.ts';
import { LIBRARY_GITHUB, rewriteLink, type LinkContext } from './links.ts';
import { readPage, type Doc } from './pages.ts';
import { renderMarkdown } from './render.ts';

/** A file the build emits at the site's root. */
export interface LlmsFile {
  /** Relative to the site's root, e.g. `docs/pools.md`. */
  fileName: string;
  source: string;
}

export interface LlmsOptions {
  /** The docs pages, in manifest order (loadDocs). */
  docs: readonly Doc[];
  /** The pinned docs/guide folder. */
  guidesDir: string;
  /** The pinned docs/api folder, for the API pages. */
  apiDir?: string;
  pin: string;
  kind: LinkContext['kind'];
  /** Default `https://isoloop.dev`. */
  origin?: string;
}

/** A page's Markdown copy on the site. */
export const mdPath = (slug: string): string => `/docs/${slug}.md`;

/** What links in a Markdown copy point at: absolute URLs only. */
export function absoluteLink(href: string, ctx: LinkContext, origin = ORIGIN): string {
  if (href.startsWith('#')) return href;
  const to = rewriteLink(href, 'link', ctx);
  const guide = /^\/docs\/((?:api\/)?[a-z0-9-]+)\/(.*)$/.exec(to);
  if (guide) return `${origin}${mdPath(guide[1] ?? '')}${guide[2] ?? ''}`;
  return to.startsWith('/') ? origin + to : to;
}

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

/**
 * The guide's Markdown with each link target made absolute. The targets come
 * from renderMarkdown()'s own parse, so code blocks and code spans are left
 * alone. Each is replaced in the block it was found in (from the block's first
 * line to the next blank line) in its `](…)` form, or in its reference
 * definition (`[label]: …`). The copy is parsed again at the end, and a
 * relative link left in it fails the build.
 */
export function markdownCopy(src: string, ctx: LinkContext, origin = ORIGIN): string {
  const parse = (s: string) => renderMarkdown(s, { file: ctx.file, lead: 'first-sentence' }).links;
  const lines = src.split('\n');
  for (const l of parse(src)) {
    if (l.kind !== 'link') continue;
    const to = absoluteLink(l.href, ctx, origin);
    if (to === l.href) continue;
    const inline = `](${l.href}`;
    let done = false;
    for (let i = l.line - 1; i < lines.length && lines[i]?.trim(); i++) {
      if (lines[i]?.includes(inline)) {
        lines[i] = (lines[i] ?? '').replaceAll(inline, `](${to}`);
        done = true;
      }
    }
    if (done) continue;
    const ref = new RegExp(`^(\\s{0,3}\\[[^\\]]+\\]:\\s*<?)${escapeRe(l.href)}(?=>|\\s|$)`);
    for (let i = 0; i < lines.length; i++) {
      if (ref.test(lines[i] ?? '')) lines[i] = (lines[i] ?? '').replace(ref, `$1${to}`);
    }
  }
  const out = lines.join('\n');
  const left = parse(out).filter((l) => l.kind === 'link' && !ABSOLUTE.test(l.href));
  if (left.length) {
    throw new Error(
      `${ctx.file}: the Markdown copy still has relative links: ${left.map((l) => `"${l.href}" (line ${l.line})`).join(', ')}`,
    );
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The "build with Isoloop" skill in the library (M4a task 12), linked from /llms.txt. */
export const SKILL = 'skills/build-with-isoloop/SKILL.md';

/** /llms.txt, in the llmstxt.org format: the docs by section, the skill, then the optional links. */
export function llmsTxt(docs: readonly Doc[], pin: string, origin = ORIGIN): string {
  const sections: string[] = [];
  for (const d of docs) if (!sections.includes(d.section)) sections.push(d.section);
  const out = ['# Isoloop', '', `> ${site.description}`, ''];
  for (const s of sections) {
    out.push(`## ${s}`, '');
    for (const d of docs.filter((x) => x.section === s)) {
      out.push(`- [${d.title}](${origin}${mdPath(d.slug)}): ${d.description}`);
    }
    out.push('');
  }
  out.push(
    '## Agent skill',
    '',
    `- [Build with Isoloop](${LIBRARY_GITHUB}/blob/${pin}/${SKILL}): the agent skill for building an app with Isoloop, at the version these docs were built from; \`npx isoloop skill add\` installs it into a project`,
    '',
    '## Optional',
    '',
    `- [Examples](${origin}/examples/): the example apps, each with its measured results`,
    `- [README](${LIBRARY_GITHUB}/blob/${pin}/README.md): the library's README, at the version these docs were built from`,
    '',
  );
  return out.join('\n');
}

/** /llms-full.txt: every guide's Markdown copy in nav order, under its title and URL. */
export function llmsFullTxt(
  docs: readonly Doc[],
  copies: ReadonlyMap<string, string>,
  origin = ORIGIN,
): string {
  const parts = [`# Isoloop docs\n\n> ${site.description}\n`];
  for (const d of docs) {
    const md = copies.get(d.slug);
    if (md === undefined) throw new Error(`no Markdown copy for "${d.slug}"`);
    parts.push(`---\n\nSource: ${origin}${mdPath(d.slug)}\n\n${md.trimEnd()}\n`);
  }
  return parts.join('\n');
}

/** Every file for agents, for the `site` plugin to emit. */
export function buildLlms(o: LlmsOptions): LlmsFile[] {
  const origin = o.origin ?? ORIGIN;
  const guides = new Set(o.docs.map((d) => d.slug));
  const copies = new Map<string, string>();
  for (const d of o.docs) {
    const src = readPage(d.slug, o);
    copies.set(
      d.slug,
      markdownCopy(src, { file: d.source, pin: o.pin, guides, kind: o.kind }, origin),
    );
  }
  return [
    { fileName: 'llms.txt', source: llmsTxt(o.docs, o.pin, origin) },
    { fileName: 'llms-full.txt', source: llmsFullTxt(o.docs, copies, origin) },
    ...o.docs.map((d) => ({ fileName: mdPath(d.slug).slice(1), source: copies.get(d.slug) ?? '' })),
  ];
}
