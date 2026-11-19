// Which apps' E2E a pull request runs: the ones whose runtime inputs it
// changes, and no others. Pure, so e2e-apps.test.ts can replay real PRs;
// e2e-apps.ts feeds it from git.

/** A workspace package, from its package.json. */
export interface Pkg {
  /** Its folder, e.g. `apps/dashboards/markets`. */
  dir: string;
  name: string;
  /** The workspace packages it depends on, by name. */
  deps: string[];
  /** Whether CI runs its Playwright suite (e2e.yml). */
  e2e: boolean;
}

export interface Change {
  /** Changed paths, or null when there's nothing to compare against. */
  files: string[] | null;
  pkgs: Pkg[];
  /** Both sides of pnpm-lock.yaml, when it changed. */
  lock?: { base: string; head: string };
}

export interface Affected {
  /** E2E ids: an app's path below apps/, a package's own path. */
  apps: string[];
  /** Why each app runs, one line per cause, for the job summary. */
  why: string[];
}

/** E2E id: `basic`, `dashboards/markets`, `packages/creator`. */
export const idOf = (dir: string): string => dir.replace(/^apps\//, '');

/**
 * Files in an app's folder that no build, page or E2E test reads, so changing
 * them runs nothing: the site's metadata and screenshots (example.json, read
 * by apps/site), and the comparison's recorded results (data, logs, videos).
 * The comparison's .ts stays an input: plant's E2E imports its types.
 */
const NOT_RUNTIME = [
  /^example\.json$/,
  /^screenshot[^/]*\.webp$/,
  /^comparison\/.*\.(json|log|webm)$/,
];

/** Outside any package and not run by any app: docs, Markdown, changesets, repo scripts. */
const NOWHERE = /^(docs|\.changeset|scripts)\/|\.md$/;

type Cause = { all: string } | { dirs: Set<string>; why: string };

export function affectedApps({ files, pkgs, lock }: Change): Affected {
  const all = pkgs
    .filter((p) => p.e2e)
    .map((p) => idOf(p.dir))
    .toSorted();
  if (files === null) return { apps: all, why: ['no base to compare against: every app'] };

  const byDir = pkgs.toSorted((a, b) => b.dir.length - a.dir.length);
  const owner = (file: string): Pkg | undefined => byDir.find((p) => file.startsWith(`${p.dir}/`));
  const lockChanged = files.includes('pnpm-lock.yaml');

  const causes: Cause[] = [];
  for (const file of files) {
    if (NOWHERE.test(file)) continue;
    if (file === 'pnpm-lock.yaml' && lock) {
      causes.push(lockCause(lock.base, lock.head, pkgs));
      continue;
    }
    // Its catalogs reach the apps through the lockfile, which says which ones.
    if (file === 'pnpm-workspace.yaml' && lockChanged && lock) continue;
    const pkg = owner(file);
    if (!pkg) {
      causes.push({ all: file });
      continue;
    }
    const inner = file.slice(pkg.dir.length + 1);
    if (NOT_RUNTIME.some((re) => re.test(inner))) continue;
    causes.push({ dirs: new Set([pkg.dir]), why: file });
  }

  const everything = causes.find((c): c is { all: string } => 'all' in c);
  if (everything) return { apps: all, why: [`${everything.all}: every app`] };

  const apps = new Set<string>();
  const why: string[] = [];
  for (const c of causes) {
    if (!('dirs' in c)) continue;
    const hit = withDependents(c.dirs, pkgs)
      .filter((p) => p.e2e)
      .map((p) => idOf(p.dir));
    const fresh = hit.filter((a) => !apps.has(a));
    for (const a of hit) apps.add(a);
    if (fresh.length) why.push(`${c.why}: ${fresh.join(', ')}`);
  }
  return { apps: [...apps].toSorted(), why };
}

/** The packages in `dirs` and every package that depends on one, at any depth. */
function withDependents(dirs: Set<string>, pkgs: Pkg[]): Pkg[] {
  const hit = new Set(pkgs.filter((p) => dirs.has(p.dir)));
  for (let grew = true; grew;) {
    grew = false;
    for (const p of pkgs) {
      if (!hit.has(p) && p.deps.some((d) => [...hit].some((h) => h.name === d))) {
        hit.add(p);
        grew = true;
      }
    }
  }
  return [...hit];
}

/**
 * A lockfile change, attributed to the packages whose `importers` entry
 * changed. Every app runs when that can't be done safely: pnpm's own
 * document, `settings` or the root importer (the shared dev tools) changed,
 * an existing package's resolution changed or went, or packages changed
 * while no importer did. New packages alone change nothing already installed.
 */
export function lockCause(base: string, head: string, pkgs: Pkg[]): Cause {
  const b = parseLock(base);
  const h = parseLock(head);
  const keys = new Set([...b.keys(), ...h.keys()]);
  const importers = new Set<string>();
  let added = false;
  for (const key of keys) {
    if (b.get(key) === h.get(key)) continue;
    const [doc, section, entry] = key.split('\0');
    if (section === 'catalogs') continue; // reflected in each importer that uses it
    if (doc !== '1' || entry === undefined) return { all: `pnpm-lock.yaml (${section})` };
    if (section === 'importers') {
      if (entry === '.') return { all: 'pnpm-lock.yaml (the root importer)' };
      importers.add(entry);
    } else if (b.has(key)) {
      return { all: `pnpm-lock.yaml (${entry} changed)` };
    } else {
      added = true;
    }
  }
  if (!importers.size)
    return added ? { all: 'pnpm-lock.yaml (packages, no importer)' } : { dirs: new Set(), why: '' };
  const unknown = [...importers].find((dir) => !pkgs.some((p) => p.dir === dir));
  if (unknown) return { all: `pnpm-lock.yaml (${unknown})` };
  return { dirs: importers, why: `pnpm-lock.yaml (${[...importers].join(', ')})` };
}

/**
 * pnpm-lock.yaml's text, keyed by document, top-level section and, in the
 * sections that list entries (importers, packages, snapshots, catalogs), by
 * entry: `1\0importers\0apps/basic`. Its YAML is regular enough to split by
 * indent: sections at column 0, entries at 2.
 */
export function parseLock(text: string): Map<string, string> {
  const out = new Map<string, string>();
  text
    .split(/^---$/m)
    .filter((d) => d.trim())
    .forEach((doc, i) => {
      let section = '';
      let entry: string | undefined;
      for (const line of doc.split('\n')) {
        const top = /^([^\s#][^:]*):/.exec(line);
        // An entry's key, quoted or bare, then its block or an inline `{}`.
        const sub = /^ {2}('[^']*'|[^\s'#][^:]*):(?:\s|$)/.exec(line);
        if (top) {
          section = top[1] ?? '';
          entry = undefined;
        } else if (sub) {
          entry = (sub[1] ?? '').replace(/^'(.*)'$/, '$1');
        }
        const key = entry === undefined ? `${i}\0${section}` : `${i}\0${section}\0${entry}`;
        out.set(key, `${out.get(key) ?? ''}${line}\n`);
      }
    });
  return out;
}
