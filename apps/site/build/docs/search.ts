// The docs' search index (/docs/search.json), built from the pages the site
// renders (build/docs/pages.ts): one entry per page (its title and lead) and
// one per section (each h2 and h3, with the text up to the next heading of
// either level), markup stripped. src/search/match.ts searches it in the page;
// src/demos/search.ts loads it on first use.
import type { Doc } from './pages.ts';

/** One searchable entry. Short keys keep the file small. */
export interface SearchEntry {
  /** The page's title. */
  t: string;
  /** The section's heading; empty for the page's own entry. */
  h: string;
  /** The URL: the page, or the page with the heading's #id. */
  u: string;
  /** The page's section in the docs, e.g. "Build". */
  s: string;
  /** Text, markup stripped. */
  x: string;
  /** Marked experimental. */
  e?: 1;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

/** HTML to plain text: tags dropped, entities decoded, whitespace folded. */
export function plain(html: string): string {
  return (
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      // A block ends a word; an inline tag (code's highlighting) doesn't.
      .replace(/<\/?(p|li|ul|ol|h[1-6]|pre|div|br|tr|td|th|table|blockquote|dt|dd)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
        const k = e.toLowerCase();
        if (k in ENTITIES) return ENTITIES[k] ?? m;
        if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
        if (k.startsWith('#')) return String.fromCodePoint(Number(k.slice(1)));
        return m;
      })
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** The code blocks' toolbar (language label, Copy) isn't text a reader searches for. */
const stripToolbars = (html: string): string =>
  html.replace(/<div class="doc-code-bar">[\s\S]*?<\/div>/g, ' ');

/** The guides and API pages, after `extra` (the /docs/ page itself, whose text is the site's). */
export function searchIndex(
  docs: readonly Doc[],
  extra: readonly SearchEntry[] = [],
): SearchEntry[] {
  const out: SearchEntry[] = [...extra];
  for (const d of docs) {
    const base = {
      t: d.title,
      u: d.path,
      s: d.section,
      ...(d.experimental ? { e: 1 as const } : {}),
    };
    out.push({ ...base, h: '', x: plain(d.leadHtml) || d.description });
    const body = stripToolbars(d.body);
    // Each h2 or h3 with an id opens a section that runs to the next one.
    const re = /<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
    const marks = [...body.matchAll(re)];
    marks.forEach((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = marks[i + 1]?.index ?? body.length;
      out.push({
        ...base,
        h: plain(m[3] ?? ''),
        u: `${d.path}#${m[2] ?? ''}`,
        x: plain(body.slice(start, end)),
      });
    });
  }
  return out;
}
