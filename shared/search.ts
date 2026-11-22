// The examples' titles and what search engines read (ADR 0002, decision 9, as
// amended): one indexable build per page, whose canonical is the URL its
// example.json, and so the sitemap, names. Every other build says noindex.
// Each app's vite.config.ts passes one of these to ui's `meta`.

/** The link-preview card, served at the site's root (apps/site/build/plugin.ts). */
const IMAGE = '/og-1200x630.png';

interface Indexed {
  title: string;
  description: string;
  path: string;
  image: string;
}
interface Unindexed {
  title: string;
  robots: string;
}

/** A page to index. `path` is its URL on the site. */
export function indexed(title: string, description: string, path: string): Indexed {
  return { title: `${title} · Isoloop`, description, path, image: IMAGE };
}

/** A comparison build or an interactive mode: open to visitors, left out of search. */
export function unindexed(title: string): Unindexed {
  return { title: `${title} · Isoloop`, robots: 'noindex' };
}
