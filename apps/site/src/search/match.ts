// The docs' search, our own and small (no library): a pure module, so the
// conformance suite (match.test.ts) can hold any other engine put behind the
// same interface to the same behaviour.
//
// - Words are lowercased and split on anything that isn't a letter, a digit
//   or one of `@ . / _ -`, so a code identifier stays one word: `kernel.spawn`,
//   `@isoloop/bus`, `busyMs`. Each such word is also indexed by its parts
//   (`kernel`, `spawn`; `isoloop`, `bus`; `busy`, `ms`), so either finds it.
// - A cheap stem drops a plural `s` (`grants` and `grant` meet).
// - Every query word must match; the last one also matches as a prefix, for
//   typing. A match in the title counts most, then the heading, then the text.

/** One entry of /docs/search.json (build/docs/search.ts). */
export interface SearchEntry {
  t: string;
  h: string;
  u: string;
  s: string;
  x: string;
  e?: 1;
}

/** Whether a parsed value is a search index: an array of entries (build/docs/search.ts). */
export function isEntries(v: unknown): v is SearchEntry[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x: unknown) =>
        typeof x === 'object' &&
        x !== null &&
        ['t', 'h', 'u', 's', 'x'].every((k) => typeof Reflect.get(x, k) === 'string'),
    )
  );
}

/** A highlight in a string: [start, end) offsets. */
export type Range = [number, number];

export interface Hit {
  entry: SearchEntry;
  score: number;
  /** A short piece of the entry's text around the first match. */
  snippet: string;
  /** The matched words in `snippet`, `heading` and `title`. */
  marks: { title: Range[]; heading: Range[]; snippet: Range[] };
}

/** What every engine behind the docs' search provides. */
export interface DocsSearch {
  search(query: string, limit?: number): Hit[];
}

const WORD = /[\p{L}\p{N}@./_-]+/gu;

/** A plural's cheap stem: `grants` → `grant`, not `class` or `bus`. */
function stem(w: string): string {
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us'))
    return w.slice(0, -1);
  return w;
}

/** A word's parts: at `@ . / _ -` and at camelCase humps (on the raw word). */
function parts(raw: string): string[] {
  return raw
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[@./_\s-]+/)
    .filter(Boolean)
    .map((p) => stem(p.toLowerCase()));
}

/** The words of a text, each whole (lowercased, stemmed) and by its parts. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WORD)) {
    const raw = m[0].replace(/^[./_-]+|[./_-]+$/g, '');
    if (!raw) continue;
    out.push(stem(raw.toLowerCase()));
    const ps = parts(raw);
    if (ps.length > 1) out.push(...ps);
  }
  return out;
}

/** The query's words, as the index has them; the last one is the prefix being typed. */
export function queryTerms(query: string): string[] {
  const out: string[] = [];
  for (const m of query.matchAll(WORD)) {
    const raw = m[0].replace(/^[./_-]+|[./_-]+$/g, '');
    if (raw) out.push(stem(raw.toLowerCase()));
  }
  return out;
}

interface Indexed {
  entry: SearchEntry;
  title: Set<string>;
  heading: Set<string>;
  text: Set<string>;
}

const WEIGHT = { title: 10, heading: 6, text: 1 } as const;

/** Where a term occurs in a string, case-insensitively, by its raw letters. */
function ranges(s: string, words: string[]): Range[] {
  const lower = s.toLowerCase();
  const out: Range[] = [];
  for (const w of words) {
    if (!w) continue;
    let at = lower.indexOf(w);
    while (at >= 0) {
      out.push([at, at + w.length]);
      at = lower.indexOf(w, at + w.length);
    }
  }
  return out
    .toSorted((a, b) => a[0] - b[0])
    .filter((r, i, all) => i === 0 || r[0] >= (all[i - 1]?.[1] ?? 0));
}

const SNIPPET = 140;

function snippetOf(text: string, words: string[]): { snippet: string; marks: Range[] } {
  const all = ranges(text, words);
  const first = all[0]?.[0] ?? 0;
  let start = Math.max(0, first - 40);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space >= 0 && space < first) start = space + 1;
  }
  let end = Math.min(text.length, start + SNIPPET);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > first) end = space;
  }
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const snippet = prefix + text.slice(start, end) + suffix;
  const shift = prefix.length - start;
  const marks = all
    .filter(([a, b]) => a >= start && b <= end)
    .map(([a, b]): Range => [a + shift, b + shift]);
  return { snippet, marks };
}

/** Our engine: an index of the entries' words, scored by where each term matches. */
export function createSearch(entries: readonly SearchEntry[]): DocsSearch {
  const index: Indexed[] = entries.map((entry) => ({
    entry,
    title: new Set(tokens(entry.t)),
    heading: new Set(tokens(entry.h)),
    text: new Set(tokens(entry.x)),
  }));

  /** The best place a term matches in an entry: its weight, a prefix match half. */
  const place = (it: Indexed, term: string, prefix: boolean): number => {
    let best = 0;
    for (const field of ['title', 'heading', 'text'] as const) {
      const set = it[field];
      let w = 0;
      if (set.has(term)) w = WEIGHT[field];
      else if (prefix)
        for (const t of set)
          if (t.startsWith(term)) {
            w = WEIGHT[field] / 2;
            break;
          }
      if (w > best) best = w;
    }
    return best;
  };

  return {
    search(query, limit = 8) {
      const terms = queryTerms(query);
      if (!terms.length) return [];
      const hits: Hit[] = [];
      for (const it of index) {
        let score = 0;
        let all = true;
        terms.forEach((term, i) => {
          if (!all) return;
          const w = place(it, term, i === terms.length - 1);
          if (w === 0) all = false;
          else score += w;
        });
        if (!all) continue;
        // A page's own entry ranks just above its sections for the same score.
        if (!it.entry.h) score += 0.5;
        // Highlight by the query's raw words (lowercased): what the reader typed.
        const words = query
          .toLowerCase()
          .split(/[^\p{L}\p{N}@./_-]+/u)
          .filter((w) => w.length > 0);
        const { snippet, marks } = snippetOf(it.entry.x, words);
        hits.push({
          entry: it.entry,
          score,
          snippet,
          marks: {
            title: ranges(it.entry.t, words),
            heading: ranges(it.entry.h, words),
            snippet: marks,
          },
        });
      }
      return hits.toSorted((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}
