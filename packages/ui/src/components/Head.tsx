/** @jsxImportSource preact */
import type { VNode } from 'preact';
import { ORIGIN, PageMeta } from './PageMeta.tsx';

export interface HeadProps {
  /** The page's own title; " · Isoloop" is added unless it's the home page. */
  title: string;
  /** In `title`'s place, in <title> and the link preview's title only (ADR 0006, as amended). */
  searchTitle?: string;
  description: string;
  /** The page's path on the site, e.g. `/how-it-works/`, for the canonical and og:url. */
  path: string;
  /** The site's origin. */
  origin?: string;
  /** A 1200×630 preview image, root-absolute; none until the design pick (ADR 0002, decision 9). */
  image?: string;
  /** The page's CSP (ADR 0002, decision 8). Left out in dev, where Vite injects inline styles. */
  csp?: string;
  home?: boolean;
  /** e.g. `noindex`: then no canonical and no preview tags. */
  robots?: string;
}

/**
 * Everything a page's <head> holds besides the CSS and theme.js that ui/vite
 * injects: charset, viewport, the CSP meta, the title, and the description and
 * link-preview tags (ADR 0002, decision 9). Rendered to static HTML at build
 * time, like every component.
 */
export function Head({
  title,
  searchTitle,
  description,
  path,
  origin = ORIGIN,
  image,
  csp,
  home = false,
  robots,
}: HeadProps): VNode {
  const full = home ? title : `${searchTitle ?? title} · Isoloop`;
  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {csp ? <meta http-equiv="Content-Security-Policy" content={csp} /> : null}
      {robots === undefined ? (
        <PageMeta
          title={full}
          description={description}
          path={path}
          origin={origin}
          {...(image ? { image } : {})}
        />
      ) : (
        <PageMeta title={full} description={description} robots={robots} />
      )}
    </>
  );
}
