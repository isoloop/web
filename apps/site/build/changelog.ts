// /changelog/ (ADR 0004, decision 1): every library package's CHANGELOG.md at
// the library pin, and every app's CHANGELOG.md in this checkout, as written by
// Changesets. Parsed here, with no Markdown library: version sections, change
// kinds, and bullets whose indented lines continue them. Relative links are
// resolved to GitHub, so the page links nowhere that isn't served.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { LibraryReader } from './library.ts';

/** A block of an entry: a paragraph, or a list of items. Text is inline Markdown. */
export type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

export interface Release {
  version: string;
  /** Changesets' kinds, e.g. "Minor Changes", each with its entries. */
  groups: { kind: string; entries: Block[][] }[];
}

/** Parses a Changesets CHANGELOG.md: the `## <version>` sections, newest first as written. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let group: Release['groups'][number] | undefined;
  let entry: string[] | undefined;
  const close = (): void => {
    if (entry && group) group.entries.push(toBlocks(entry));
    entry = undefined;
  };
  for (const line of md.split('\n')) {
    const h2 = /^## (.+?)\s*$/.exec(line);
    if (h2) {
      close();
      group = undefined;
      const version = h2[1] ?? '';
      release = /^\d+\.\d+\.\d+/.test(version) ? { version, groups: [] } : undefined;
      if (release) releases.push(release);
      continue;
    }
    if (!release) continue;
    const h3 = /^### (.+?)\s*$/.exec(line);
    if (h3) {
      close();
      group = { kind: h3[1] ?? '', entries: [] };
      release.groups.push(group);
      continue;
    }
    const bullet = /^- (?:[0-9a-f]{7,40}: )?(.*)$/.exec(line);
    if (bullet) {
      close();
      if (!group) {
        group = { kind: '', entries: [] };
        release.groups.push(group);
      }
      entry = [bullet[1] ?? ''];
      continue;
    }
    if (entry) entry.push(line.replace(/^ {2}/, ''));
  }
  close();
  return releases;
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
  return releases.map((r) => ({
    ...r,
    groups: r.groups.map((g) => ({
      ...g,
      entries: g.entries.map((blocks) =>
        blocks.map((b) =>
          b.kind === 'p'
            ? { kind: 'p', text: fix(b.text) }
            : { kind: 'ul', items: b.items.map(fix) },
        ),
      ),
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

export interface Entry {
  /** The package or app it belongs to. */
  source: string;
  kind: string;
  blocks: Block[];
}

export interface Changelog {
  /** The library's releases, one per shared version (the fixed group), newest first. */
  library: { version: string; entries: Entry[] }[];
  /** Library packages with no released version yet. */
  libraryUnreleased: string[];
  /** The apps' releases, one per tag, newest first by when the tag was made. */
  apps: { tag: string; source: string; version: string; date?: string; entries: Entry[] }[];
  /** Apps with no version in their changelog yet. */
  appsUnreleased: string[];
}

const LIBRARY_BLOB = 'https://github.com/isoloop/isoloop/blob';
const WEB_BLOB = 'https://github.com/isoloop/web/blob/main';

/**
 * When a tag was made: the tag's own date for an annotated tag, its commit's
 * for a lightweight one. `date` is shown; `at` (UTC ms) orders tags made the
 * same day.
 */
function tagDate(webRoot: string, tag: string): { date: string; at: number } | undefined {
  try {
    const out = execFileSync(
      'git',
      ['for-each-ref', '--format=%(creatordate:iso-strict)', `refs/tags/${tag}`],
      { cwd: webRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const at = Date.parse(out);
    return /^\d{4}-\d{2}-\d{2}T/.test(out) && !Number.isNaN(at)
      ? { date: out.slice(0, 10), at }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The apps with a CHANGELOG.md: apps/<name>/ and apps/<group>/<name>/. */
function appFolders(webRoot: string): string[] {
  const apps = join(webRoot, 'apps');
  const out: string[] = [];
  for (const name of readdirSync(apps)) {
    const dir = join('apps', name);
    if (existsSync(join(webRoot, dir, 'CHANGELOG.md'))) out.push(dir);
    else if (!existsSync(join(webRoot, dir, 'package.json'))) {
      for (const sub of readdirSync(join(webRoot, dir))) {
        if (existsSync(join(webRoot, dir, sub, 'CHANGELOG.md'))) out.push(join(dir, sub));
      }
    }
  }
  return out.toSorted();
}

function nameOf(pkgJson: string | undefined): { name?: string; private?: boolean } {
  if (!pkgJson) return {};
  try {
    const parsed: unknown = JSON.parse(pkgJson);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const { name, private: priv } = parsed as { name?: unknown; private?: unknown };
    return {
      ...(typeof name === 'string' ? { name } : {}),
      ...(priv === true ? { private: true } : {}),
    };
  } catch {
    return {};
  }
}

export function loadChangelog(
  library: Pick<LibraryReader, 'read' | 'list'>,
  pin: string,
  webRoot: string,
): Changelog {
  // The library: published packages only, grouped by their shared version.
  const byVersion = new Map<string, Entry[]>();
  const libraryUnreleased: string[] = [];
  const pkgDirs = [
    ...new Set(
      library
        .list('packages')
        .map((p) => /^packages\/([^/]+)\/package\.json$/.exec(p)?.[1])
        .filter((d): d is string => d !== undefined),
    ),
  ].toSorted();
  for (const dir of pkgDirs) {
    const pkg = nameOf(library.read(`packages/${dir}/package.json`));
    if (!pkg.name || pkg.private) continue;
    const md = library.read(`packages/${dir}/CHANGELOG.md`);
    const releases = md
      ? absolutise(parseChangelog(md), `${LIBRARY_BLOB}/${pin}`, `packages/${dir}`)
      : [];
    if (releases.length === 0) libraryUnreleased.push(pkg.name);
    for (const r of releases) {
      const list = byVersion.get(r.version) ?? [];
      for (const g of r.groups) {
        for (const blocks of g.entries) list.push({ source: pkg.name, kind: g.kind, blocks });
      }
      byVersion.set(r.version, list);
    }
  }
  const libraryReleases = [...byVersion.entries()]
    .toSorted(([a], [b]) => newestFirst(a, b))
    .map(([version, entries]) => ({ version, entries }));

  // The apps: one release per tag, dated by the tag.
  const apps: Changelog['apps'] = [];
  const tagAt = new Map<string, number>();
  const appsUnreleased: string[] = [];
  for (const dir of appFolders(webRoot)) {
    const name = nameOf(readFileSync(join(webRoot, dir, 'package.json'), 'utf8')).name ?? dir;
    const md = readFileSync(join(webRoot, dir, 'CHANGELOG.md'), 'utf8');
    const releases = absolutise(parseChangelog(md), WEB_BLOB, dir);
    if (releases.length === 0) appsUnreleased.push(name);
    for (const r of releases) {
      const tag = `${name}-v${r.version}`;
      const made = tagDate(webRoot, tag);
      if (made) tagAt.set(tag, made.at);
      apps.push({
        tag,
        source: name,
        version: r.version,
        ...(made ? { date: made.date } : {}),
        entries: r.groups.flatMap((g) =>
          g.entries.map((blocks) => ({ source: name, kind: g.kind, blocks })),
        ),
      });
    }
  }
  const appReleases = apps.toSorted(byTagMade(tagAt));
  return { library: libraryReleases, libraryUnreleased, apps: appReleases, appsUnreleased };
}

/**
 * Orders app releases newest first by when their tag was made (`tagAt`, UTC ms
 * by tag). Releases without a tag time go after those with one, newest version
 * first within an app, apps by name.
 */
export function byTagMade(
  tagAt: ReadonlyMap<string, number>,
): (
  a: { tag: string; source: string; version: string },
  b: { tag: string; source: string; version: string },
) => number {
  return (a, b) => {
    const x = tagAt.get(a.tag);
    const y = tagAt.get(b.tag);
    if (x !== undefined && y !== undefined) return y - x;
    if (x !== undefined) return -1;
    if (y !== undefined) return 1;
    return a.source === b.source
      ? newestFirst(a.version, b.version)
      : a.source.localeCompare(b.source);
  };
}
