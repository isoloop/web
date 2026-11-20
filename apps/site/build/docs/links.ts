// Where a guide's links go on the site (M4c, decision 10; ADR 0006). Guides are
// written for GitHub, with links relative to `docs/guide/` in isoloop/isoloop:
// - another guide on the site → its page, `/docs/<slug>/`;
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

export interface LinkContext {
  /** The guide's path in the library, e.g. `docs/guide/pools.md`; links resolve from its folder. */
  file: string;
  /** The pinned sha the guides were fetched at. */
  pin: string;
  /** The slugs that have a page on the site (docs.json). */
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

  const guide = new RegExp(`^${GUIDES_PATH}/([a-z0-9-]+)\\.md$`).exec(target)?.[1];
  if (kind === 'link' && guide && c.guides.has(guide)) return `/docs/${guide}/${rest}`;

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
