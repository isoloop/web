// The site preview (ADR 0007): the same build, deployed to next.isoloop.dev
// with ISOLOOP_PREVIEW=1. Each page then carries a banner back to the stable
// site and says noindex; the stable build carries a "Preview" link instead.
// Everything is decided at build time; no page checks anything live.

/** The stable site, isoloop.dev. */
export const STABLE_ORIGIN = 'https://isoloop.dev';
/** The preview site (ADR 0007, decision 2). */
export const PREVIEW_ORIGIN = 'https://next.isoloop.dev';

/** Whether this build is the preview's: deploy.yml sets ISOLOOP_PREVIEW=1 for it. */
export function isPreview(env: Record<string, string | undefined> = process.env): boolean {
  return env['ISOLOOP_PREVIEW'] === '1';
}

/** `0.2.0-next.0` → `0.2`; anything else as it is. */
export function minorOf(version: string): string {
  const m = /^(\d+)\.(\d+)\./.exec(version);
  return m ? `${m[1]}.${m[2]}` : version;
}

/**
 * A page's path on the site, for the link to the same page on the other site:
 * `/docs/bus/index.html` → `/docs/bus/`, the 404 → `/`. A page whose path isn't known (an
 * example built under a relative base) links to the other site's examples.
 */
export function sitePath(pagePath: string | undefined): string {
  if (pagePath === undefined) return '/examples/';
  // A page that isn't a directory index (the 404) links to the other site's home.
  return pagePath.endsWith('/index.html')
    ? pagePath.slice(0, -'index.html'.length)
    : pagePath.endsWith('.html')
      ? '/'
      : pagePath;
}

/**
 * The preview says noindex on every page (ADR 0007, decision 10): any robots
 * meta becomes `noindex`, one is added where there's none, and the canonical
 * goes, so a page doesn't point search engines elsewhere while asking them to
 * stay out.
 */
export function unindex(html: string): string {
  const cleaned = html
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, '');
  // Before </head>, or after the charset on a page that leaves <head> implicit.
  const end = cleaned.search(/<\/head>/i);
  const charset = /<meta\s+charset[^>]*>/i.exec(cleaned);
  const at = end >= 0 ? end : charset ? charset.index + charset[0].length : -1;
  if (at < 0) return cleaned;
  const tag =
    end >= 0
      ? '<meta name="robots" content="noindex">\n'
      : '\n<meta name="robots" content="noindex">';
  return `${cleaned.slice(0, at)}${tag}${cleaned.slice(at)}`;
}
