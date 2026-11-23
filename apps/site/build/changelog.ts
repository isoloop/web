// /changelog/ (ADR 0004, decision 1, as amended 2026-11-23): every library
// package's CHANGELOG.md at the library pin, as written by Changesets, one
// section per package. The apps' release notes stay in their own CHANGELOG.md
// and GitHub Releases. Parsed here, with no Markdown library: version sections, change
// kinds, and bullets whose indented lines continue them. Relative links are
// resolved to GitHub, so the page links nowhere that isn't served.
import { posix } from 'node:path';
import type { LibraryReader } from './library.ts';

/** A block of an entry: a paragraph, or a list of items. Text is inline Markdown. */
export type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

export interface Release {
  version: string;
  /** Text written under the version with no change kinds, such as 0.1.0's summary. */
  intro: Block[];
  /** Changesets' kinds, e.g. "Minor Changes", each with its entries. */
  groups: { kind: string; entries: Block[][] }[];
}

/**
 * An entry that only says which dependencies moved: "Updated dependencies [sha]",
 * or a bare `@isoloop/x@version`. The fixed group bumps every package together,
 * so these say nothing a reader can use.
 */
export function isDependencyOnly(blocks: Block[]): boolean {
  const first = blocks[0];
  return (
    first?.kind === 'p' &&
    (/^Updated dependencies\b/.test(first.text) || /^@?[\w./-]+@\d\S*$/.test(first.text))
  );
}

/**
 * Parses a Changesets CHANGELOG.md: the `## <version>` sections, newest first as
 * written. A section with no `###` kinds keeps its text as `intro`. Entries that
 * only update dependencies are left out, and so is a section left with nothing.
 */
export function parseChangelog(md: string): Release[] {
  const sections: { version: string; lines: string[] }[] = [];
  let current: { version: string; lines: string[] } | undefined;
  for (const line of md.split('\n')) {
    const h2 = /^## (.+?)\s*$/.exec(line);
    if (h2) {
      const version = h2[1] ?? '';
      current = /^\d+\.\d+\.\d+/.test(version) ? { version, lines: [] } : undefined;
      if (current) sections.push(current);
      continue;
    }
    current?.lines.push(line);
  }
  return sections
    .map(({ version, lines }) =>
      lines.some((l) => l.startsWith('### '))
        ? { version, intro: [], groups: parseGroups(lines) }
        : { version, intro: toBlocks(lines), groups: [] },
    )
    .filter((r) => r.intro.length > 0 || r.groups.length > 0);
}

/** A section's `###` kinds and their bullets, whose indented lines continue them. */
function parseGroups(lines: string[]): Release['groups'] {
  const groups: Release['groups'] = [];
  let group: Release['groups'][number] | undefined;
  let entry: string[] | undefined;
  const close = (): void => {
    if (entry && group) {
      const blocks = toBlocks(entry);
      if (!isDependencyOnly(blocks)) group.entries.push(blocks);
    }
    entry = undefined;
  };
  for (const line of lines) {
    const h3 = /^### (.+?)\s*$/.exec(line);
    if (h3) {
      close();
      group = { kind: h3[1] ?? '', entries: [] };
      groups.push(group);
      continue;
    }
    if (!group) continue;
    const bullet = /^- (?:[0-9a-f]{7,40}: )?(.*)$/.exec(line);
    if (bullet) {
      close();
      entry = [bullet[1] ?? ''];
      continue;
    }
    if (entry) entry.push(line.replace(/^ {2}/, ''));
  }
  close();
  return groups.filter((g) => g.entries.length > 0);
}

/** An entry's lines as paragraphs and lists. */
function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | undefined;
  const flush = (): void => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ').trim() });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const item = /^\s*[-*] (.*)$/.exec(line);
    if (item) {
      flush();
      if (!list) {
        list = [];
        blocks.push({ kind: 'ul', items: list });
      }
      list.push(item[1] ?? '');
      continue;
    }
    if (line.trim() === '') {
      flush();
      list = undefined;
      continue;
    }
    if (list) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks.filter((b) => b.kind === 'ul' || b.text !== '');
}

/** Rewrites relative Markdown links to GitHub URLs, resolved from the changelog's folder. */
export function absoluteLinks(text: string, base: string, folder: string): string {
  return text.replace(/\]\(([^)\s]+)\)/g, (whole, href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) return whole;
    return `](${base}/${posix.normalize(posix.join(folder, href))})`;
  });
}

function absolutise(releases: Release[], base: string, folder: string): Release[] {
  const fix = (t: string): string => absoluteLinks(t, base, folder);
  const blocks = (list: Block[]): Block[] =>
    list.map((b) =>
      b.kind === 'p' ? { kind: 'p', text: fix(b.text) } : { kind: 'ul', items: b.items.map(fix) },
    );
  return releases.map((r) => ({
    ...r,
    intro: blocks(r.intro),
    groups: r.groups.map((g) => ({
      ...g,
      entries: g.entries.map(blocks),
    })),
  }));
}

function parseVersion(v: string): { core: number[]; pre: (string | number)[] } {
  const [core = '', pre] = v.split('-', 2);
  return {
    core: core.split('.').map(Number),
    pre: pre === undefined ? [] : pre.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)),
  };
}

/** Compares two versions, newest first; prerelease parts compare after the release. */
export function newestFirst(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const d = (y.core[i] ?? 0) - (x.core[i] ?? 0);
    if (d) return d;
  }
  if (!x.pre.length || !y.pre.length) return x.pre.length - y.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return 1;
    if (q === undefined) return -1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return q - p;
    return String(q).localeCompare(String(p));
  }
  return 0;
}

/** One package's changelog. */
export interface PackageLog {
  name: string;
  /** Its anchor on /changelog/: the name without the `@isoloop/` scope. */
  id: string;
  /** It ships a command (a `bin` in its package.json), marked "CLI" on the page. */
  cli: boolean;
  /** Newest first. */
  releases: Release[];
}

export interface Changelog {
  /** Every published library package that isn't internal, in PACKAGE_ORDER, with its own releases. */
  packages: PackageLog[];
}

const LIBRARY_BLOB = 'https://github.com/isoloop/isoloop/blob';

/**
 * The order of the packages on /changelog/: what an app installs first, then
 * the tooling and the experimental packages. A package not listed here goes
 * after them, by name.
 */
export const PACKAGE_ORDER = [
  '@isoloop/host',
  '@isoloop/runtime',
  '@isoloop/bus',
  '@isoloop/react',
  '@isoloop/preact',
  '@isoloop/vite',
  'isoloop',
  '@isoloop/devtools',
  '@isoloop/balancer',
  '@isoloop/webmcp',
];

function rank(name: string): number {
  const i = PACKAGE_ORDER.indexOf(name);
  return i < 0 ? PACKAGE_ORDER.length : i;
}

/** Orders package names by PACKAGE_ORDER, then by name. */
export function byPackageOrder(a: string, b: string): number {
  return rank(a) - rank(b) || a.localeCompare(b);
}

/**
 * A package the library marks as internal: its npm description starts with
 * "Internal" (codec, dom, protocol). App code doesn't import it, so its
 * changelog isn't on /changelog/.
 */
export function isInternal(description: string | undefined): boolean {
  return /^Internal\b/.test(description ?? '');
}

function nameOf(pkgJson: string | undefined): {
  name?: string;
  private?: boolean;
  description?: string;
  bin?: boolean;
} {
  if (!pkgJson) return {};
  try {
    const parsed: unknown = JSON.parse(pkgJson);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const {
      name,
      private: priv,
      description,
      bin,
    } = parsed as { name?: unknown; private?: unknown; description?: unknown; bin?: unknown };
    return {
      ...(typeof name === 'string' ? { name } : {}),
      ...(priv === true ? { private: true } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      ...(bin !== undefined && bin !== null ? { bin: true } : {}),
    };
  } catch {
    return {};
  }
}

export function loadChangelog(
  library: Pick<LibraryReader, 'read' | 'list'>,
  pin: string,
): Changelog {
  const pkgDirs = [
    ...new Set(
      library
        .list('packages')
        .map((p) => /^packages\/([^/]+)\/package\.json$/.exec(p)?.[1])
        .filter((d): d is string => d !== undefined),
    ),
  ];
  const packages: PackageLog[] = [];
  for (const dir of pkgDirs) {
    const pkg = nameOf(library.read(`packages/${dir}/package.json`));
    if (!pkg.name || pkg.private || isInternal(pkg.description)) continue;
    const md = library.read(`packages/${dir}/CHANGELOG.md`);
    const releases = md
      ? absolutise(parseChangelog(md), `${LIBRARY_BLOB}/${pin}`, `packages/${dir}`)
      : [];
    packages.push({
      name: pkg.name,
      cli: pkg.bin === true,
      id: pkg.name.replace(/^@isoloop\//, ''),
      releases: releases.toSorted((a, b) => newestFirst(a.version, b.version)),
    });
  }
  packages.sort((a, b) => byPackageOrder(a.name, b.name));
  return { packages };
}
