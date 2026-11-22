// Where a docs page's links go on the site (M4c, decision 10; ADR 0006). Pages
// are written for GitHub, with links relative to their folder in isoloop/isoloop
// (`docs/guide/` for guides, `docs/api/` for the generated API pages):
// - another docs page on the site → its page: a guide's `/docs/<slug>/`, an
//   API page's `/docs/api/<name>/`;
// - anything else in the library (ADRs, plans, investigations, source, benches)
//   → GitHub at the pinned sha, so the link shows what the page was built from;
// - a relative link to nothing at the pin → a build failure naming the file
//   and the link.
// Absolute URLs and `#anchors` are kept as written.
import { posix } from 'node:path';
import { DocError, type DocLink } from './render.ts';

export const LIBRARY_GITHUB = 'https://github.com/isoloop/isoloop';

/** Where the guides live in the library. */
export const GUIDES_PATH = 'docs/guide';

/** Where the generated API pages live in the library. */
export const API_PATH = 'docs/api';

/** The docs page a library path is, by slug (`pools`, `api/host`), or undefined. */
export function pageSlugOf(target: string): string | undefined {
  const guide = new RegExp(`^${GUIDES_PATH}/([a-z0-9-]+)\\.md$`).exec(target)?.[1];
  if (guide) return guide;
  const api = new RegExp(`^${API_PATH}/([a-z0-9-]+)\\.md$`).exec(target)?.[1];
  return api ? `api/${api}` : undefined;
}

export interface LinkContext {
  /** The page's path in the library, e.g. `docs/guide/pools.md`; links resolve from its folder. */
  file: string;
  /** The pinned sha the guides were fetched at. */
  pin: string;
  /** The slugs that have a page on the site (docs.json): `pools`, `api/host`. */
  guides: ReadonlySet<string>;
  /** What's at a library path at the pin: a file, a folder, or nothing. */
  kind: (path: string) => 'file' | 'dir' | undefined;
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;

/** The site path or URL for one link or image target in a guide. Throws `DocError` for a dead relative link. */
export function rewriteLink(href: string, kind: DocLink['kind'], c: LinkContext): string {
  if (!href || href.startsWith('#') || ABSOLUTE.test(href) || href.startsWith('//')) return href;
  if (href.startsWith('/')) {
    throw new DocError(
      `${c.file}: "${href}" is root-absolute; link relative to the guide, as GitHub resolves it`,
    );
  }
  const at = href.search(/[?#]/);
  const path = at < 0 ? href : href.slice(0, at);
  const rest = at < 0 ? '' : href.slice(at);
  const target = posix.normalize(posix.join(posix.dirname(c.file), decodeURI(path)));
  if (target.startsWith('../')) {
    throw new DocError(`${c.file}: "${href}" points outside isoloop/isoloop`);
  }

  const page = pageSlugOf(target);
  if (kind === 'link' && page && c.guides.has(page)) return `/docs/${page}/${rest}`;

  const found = c.kind(target.replace(/\/$/, ''));
  if (!found) {
    throw new DocError(
      `${c.file}: "${href}" resolves to ${target}, which isn't in isoloop/isoloop at ${c.pin.slice(0, 7)}`,
    );
  }
  if (kind === 'image') {
    // The CSP (default-src 'self') blocks images from other origins, and the
    // site doesn't copy the library's images yet.
    throw new DocError(
      `${c.file}: the image "${href}" would load from GitHub, which the CSP blocks; guides can't show library images yet`,
    );
  }
  const view = found === 'dir' ? 'tree' : 'blob';
  return `${LIBRARY_GITHUB}/${view}/${c.pin}/${target.replace(/\/$/, '')}${rest}`;
}
