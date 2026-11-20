// The docs' Markdown → HTML, at build time (M4c, decisions 7 and 9; isoloop/web
// ADR 0006). This is the only file that imports markdown-it: everything else
// uses renderMarkdown() and its result, and render.test.ts is the conformance
// suite any engine swapped in here has to pass (ADR 0002, decision 12).
import MarkdownIt, { type Env, type Token } from 'markdown-it';

/** A heading below the title, for the table of contents and anchors. */
export interface DocHeading {
  /** 2 for `##`, 3 for `###`, and so on. */
  depth: number;
  /** The heading as plain text. */
  text: string;
  /** Its anchor, the way GitHub makes one, so `#…` links work on both. */
  id: string;
}

/** A link or image in the page, as written in the source. */
export interface DocLink {
  kind: 'link' | 'image';
  /** The target as written, before any rewriting. */
  href: string;
  /** The 1-based source line of the block it's in. */
  line: number;
}

export interface RenderedDoc {
  html: string;
  /** The `# h1`, as plain text. */
  title: string;
  /** The first paragraph after the title, as plain text: one sentence, at most 200 characters. */
  description: string;
  /** Every heading below the h1, in order. */
  headings: DocHeading[];
  /** Every link and image, in order. */
  links: DocLink[];
}

export interface RenderOptions {
  /**
   * A fenced block's code as highlighted HTML (escaped, spans only), or
   * `null` to show it plain. `lang` is the fence's first word (` ```ts nocheck `
   * gives `ts`), empty when there is none.
   */
  highlight?: (code: string, lang: string) => string | null;
  /** Rewrites a link or image target; the default keeps it. */
  rewrite?: (href: string, kind: DocLink['kind']) => string;
  /** Names the source in errors, for example `docs/guide/bus.md`. */
  file?: string;
}

/** A page that breaks the docs' rules; the message names the file and the line. */
export class DocError extends Error {
  override name = 'DocError';
}

export const MAX_DESCRIPTION = 200;

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

type Highlight = NonNullable<RenderOptions['highlight']>;

/** Each render call's highlighter, keyed by the env object markdown-it hands the fence rule. */
const highlighters = new WeakMap<Env, Highlight>();

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const block = (body: string, lang: string): string =>
  `<pre class="ui-code" tabindex="0"><code${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>${body}</code></pre>\n`;

// Code as the site's code block (pre.ui-code, reachable by keyboard), through
// the injected highlighter: rendered here rather than through markdown-it's
// `highlight` option, so the markup doesn't depend on the engine.
md.renderer.rules.fence = (ts, idx, _opts, env) => {
  const t = ts[idx]!;
  const lang = t.info.trim().split(/\s+/)[0] ?? '';
  const h = env ? highlighters.get(env) : undefined;
  return block(h?.(t.content, lang) ?? escapeHtml(t.content), lang);
};
md.renderer.rules.code_block = (ts, idx) => block(escapeHtml(ts[idx]!.content), '');

/** The plain text of an inline token: text and code spans, without markup. */
function plain(t: Token | undefined): string {
  if (!t?.children) return t?.content ?? '';
  return t.children
    .map((c) =>
      c.type === 'text' || c.type === 'code_inline' ? c.content : c.type === 'softbreak' ? ' ' : '',
    )
    .join('');
}

/** GitHub's anchor: lower case, punctuation dropped, spaces to hyphens. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** More than one sentence: an end mark followed by a space and a capital or a code span. */
const SENTENCE_BREAK = /[.!?]["')\]]?\s+(?=[\p{Lu}`])/u;

/** Renders one docs page and checks its title and description. Throws `DocError` when a rule fails. */
export function renderMarkdown(src: string, o: RenderOptions = {}): RenderedDoc {
  const where = (line: number): string => `${o.file ?? 'docs page'}:${line}`;
  const tokens = md.parse(src, {});

  // The title: the first block, the only h1.
  const first = tokens[0];
  if (first?.type !== 'heading_open' || first.tag !== 'h1') {
    throw new DocError(`${where(1)}: a page starts with its title, a "# " heading`);
  }
  const title = plain(tokens[1]).trim();

  // The description: the paragraph right after the title.
  const after = tokens[3];
  if (after?.type !== 'paragraph_open') {
    throw new DocError(
      `${where((first.map?.[1] ?? 0) + 1)}: the title is followed by a one-sentence description`,
    );
  }
  const description = plain(tokens[4]).replace(/\s+/g, ' ').trim();
  const descLine = (after.map?.[0] ?? 0) + 1;
  if (!/[.!?]["')\]]?$/.test(description)) {
    throw new DocError(`${where(descLine)}: the description ends with a full stop`);
  }
  if (SENTENCE_BREAK.test(description)) {
    throw new DocError(`${where(descLine)}: the description is one sentence`);
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new DocError(
      `${where(descLine)}: the description is ${description.length} characters; at most ${MAX_DESCRIPTION}`,
    );
  }

  const headings: DocHeading[] = [];
  const links: DocLink[] = [];
  const seen = new Map<string, number>();
  let line = 1;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.map) line = t.map[0] + 1;

    if (t.type === 'heading_open') {
      if (t.tag === 'h1' && i !== 0)
        throw new DocError(`${where(line)}: a page has one "# " title`);
      if (t.tag !== 'h1') {
        const text = plain(tokens[i + 1]).trim();
        const base = slug(text);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        t.attrSet('id', id);
        headings.push({ depth: Number(t.tag.slice(1)), text, id });
      }
    }

    // Aligned table cells: a class, not markdown-it's inline style, which the CSP blocks.
    if (t.type === 'th_open' || t.type === 'td_open') {
      const align = /text-align:(left|center|right)/.exec(String(t.attrGet('style') ?? ''))?.[1];
      if (t.attrs) t.attrs = t.attrs.filter(([k]) => k !== 'style');
      if (align) t.attrJoin('class', `align-${align}`);
    }

    if (t.type === 'inline' && t.children) {
      for (const c of t.children) {
        const kind = c.type === 'link_open' ? 'link' : c.type === 'image' ? 'image' : null;
        if (!kind) continue;
        const attr = kind === 'link' ? 'href' : 'src';
        const href = String(c.attrGet(attr) ?? '');
        links.push({ kind, href, line });
        if (o.rewrite) c.attrSet(attr, o.rewrite(href, kind));
      }
    }
  }

  const env: Env = {};
  if (o.highlight) highlighters.set(env, o.highlight);
  return { html: md.renderer.render(tokens, md.options, env), title, description, headings, links };
}
