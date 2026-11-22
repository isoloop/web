// What a search engine reads first: robots.txt and sitemap.xml at the site's
// root, emitted by the `site` plugin (build/plugin.ts). The sitemap lists the
// site's own pages and every deployed example, from the same lists the build
// renders and assembles, so a new page or example can't be left out.
import type { Example } from './examples.ts';

/** The site's origin; ui's Head uses the same for canonical URLs. */
export const ORIGIN = 'https://isoloop.dev';

/** robots.txt: every crawler may read every page; where the sitemap is. */
export function robots(origin = ORIGIN): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/**
 * sitemap.xml: the site's pages (their own paths, the 404 left out), then each
 * deployed example's page, the pages it runs in the hub and its architecture
 * page; drafts aren't deployed.
 * Paths sorted and each listed once.
 */
export function sitemap(
  pagePaths: string[],
  examples: (Pick<Example, 'links' | 'draft'> & { embeds?: { src: string }[] | undefined })[],
  origin = ORIGIN,
): string {
  const paths = new Set(pagePaths.filter((p) => p.endsWith('/')));
  for (const e of examples) {
    if (e.draft) continue;
    paths.add(e.links.live);
    // An app with a second page (the processor's files/) names it among its embeds.
    for (const { src } of e.embeds ?? []) paths.add(src.split(/[?#]/)[0] ?? src);
    if (e.links.architecture) paths.add(e.links.architecture);
  }
  const urls = [...paths]
    .toSorted()
    .map((p) => `  <url><loc>${escape(origin + p)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escape(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
