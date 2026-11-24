// The library's diagrams and guides, fetched at the sha pinned in library.lock
// (ADR 0002, decision 6; ADR 0006). One mechanism for CI and for local builds:
// a blob-less clone of isoloop/isoloop's main and its `release/*` branches in
// apps/site/.library/, then only LIBRARY_PATHS at the pin. The pin must be
// reachable from main or from a `release/0.N` branch (a patch is versioned there
// and never merged back), so only diagrams that passed the drift test on a
// protected branch reach the site; that it is also a
// published version is checked apart, in CI (build/pin.ts). Once a pin has been
// fetched and checked, a stamp file lets later builds (and offline ones) reuse
// it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const LIBRARY_REPO = 'https://github.com/isoloop/isoloop.git';

/** The folders checked out at the pin: the core diagrams, the guides and the generated API pages. */
export const LIBRARY_PATHS = ['docs/diagrams', 'docs/guide', 'docs/api'] as const;

/** The pinned checkout's folder in `.library/`; `ensureLibrary` fills it. */
export function libraryDir(siteDir: string): string {
  return join(siteDir, '.library', readPin(siteDir));
}

/** The pinned `docs/guide`; call `ensureLibrary` first. */
export function guidesDir(siteDir: string): string {
  return join(libraryDir(siteDir), 'docs', 'guide');
}

/** The pinned `docs/api`, the generated API pages; call `ensureLibrary` first. */
export function apiDir(siteDir: string): string {
  return join(libraryDir(siteDir), 'docs', 'api');
}

/** The pinned sha, checked for shape. */
export function readPin(siteDir: string): string {
  const pin = readFileSync(join(siteDir, 'library.lock'), 'utf8').trim();
  if (!/^[0-9a-f]{40}$/.test(pin)) {
    throw new Error(`library.lock must hold one full 40-character sha, not "${pin}"`);
  }
  return pin;
}

// Auto-gc off: each blob read on demand adds a promisor pack, and past
// gc.autoPackLimit (50) a lazy fetch would repack the blob-less clone and
// leave it unable to fetch further blobs.
// autocrlf off: the guides are read as written, whatever the machine's git config says.
const GIT_CONFIG = ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'core.autocrlf=false'];

function git(args: string[], cwd?: string): string {
  return execFileSync('git', [...GIT_CONFIG, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

/** Is `sha` an ancestor of (or equal to) `ref` in the repo at `repo`? */
export function isAncestor(repo: string, sha: string, ref: string): boolean {
  try {
    git(['merge-base', '--is-ancestor', sha, ref], repo);
    return true;
  } catch {
    return false;
  }
}

/** The clone's main and `release/*` branches, the refs a pin may be on. */
function protectedRefs(repo: string): string[] {
  const out = git(
    [
      'for-each-ref',
      '--format=%(refname)',
      'refs/remotes/origin/main',
      'refs/remotes/origin/release/',
    ],
    repo,
  );
  return out.split('\n').filter(Boolean);
}

/**
 * Makes sure the pinned LIBRARY_PATHS are on disk and returns the diagrams'
 * folder (the guides are at `guidesDir`). Throws if the pin isn't on the
 * library's main or a `release/*` branch, or if one of the paths is missing at the pin.
 */
export function ensureLibrary(siteDir: string, repoUrl: string = LIBRARY_REPO): string {
  const pin = readPin(siteDir);
  const cache = join(siteDir, '.library');
  const out = join(cache, pin);
  const diagrams = join(out, 'docs', 'diagrams');
  const stamp = join(cache, `${pin}.ok`);
  const onDisk = (): boolean => LIBRARY_PATHS.every((p) => existsSync(join(out, p)));
  // A stamp from before docs/guide or docs/api was fetched doesn't count, since its folder lacks them.
  if (existsSync(stamp) && onDisk()) return diagrams;

  mkdirSync(cache, { recursive: true });
  const repo = join(cache, 'repo');
  if (!existsSync(join(repo, '.git'))) {
    rmSync(repo, { recursive: true, force: true });
    git([
      'clone',
      '--quiet',
      '--filter=blob:none',
      '--no-checkout',
      '--single-branch',
      '--branch',
      'main',
      repoUrl,
      repo,
    ]);
  }
  git(
    [
      'fetch',
      '--quiet',
      '--filter=blob:none',
      'origin',
      '+refs/heads/main:refs/remotes/origin/main',
      '+refs/heads/release/*:refs/remotes/origin/release/*',
    ],
    repo,
  );
  if (!protectedRefs(repo).some((ref) => isAncestor(repo, pin, ref))) {
    throw new Error(
      `library.lock pins ${pin}, which isn't on isoloop/isoloop's main or a release/* branch. ` +
        'Pin a commit that has merged, so its diagrams passed the drift test (ADR 0002, decision 6).',
    );
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // Only LIBRARY_PATHS, written to its own folder; the clone's blobs come on demand.
  git(['--work-tree', out, 'checkout', pin, '--', ...LIBRARY_PATHS], repo);
  writeFileSync(stamp, `${new Date().toISOString()}\n`);
  return diagrams;
}

/**
 * Reads files of isoloop/isoloop at the pin, beyond the diagrams: the feature
 * entries' proofs (build/features.ts) and the package changelogs
 * (build/changelog.ts). Uses the clone `ensureLibrary` keeps, so call that
 * first; its blobs come on demand and are cached there.
 */
export interface LibraryReader {
  /** The file's text at the pin, or undefined if there's no such file. */
  read(path: string): string | undefined;
  /** Is there a file or folder at this path at the pin? */
  has(path: string): boolean;
  /** Every file path at the pin under `dir` (no trailing slash). */
  list(dir: string): string[];
}

export function libraryReader(siteDir: string): LibraryReader {
  const pin = readPin(siteDir);
  const repo = join(siteDir, '.library', 'repo');
  if (!existsSync(join(repo, '.git'))) {
    throw new Error('the library clone is missing: run ensureLibrary first (build/library.ts)');
  }
  // Existence comes from the trees, which the blob-less clone holds, so it needs
  // no fetch and can't be confused with a network failure. Reading a file
  // fetches its blob on demand; a failure there throws instead of reading as
  // "no such file".
  const typeOf = (path: string): string | undefined => {
    const clean = path.replace(/\/$/, '');
    const line = git(['ls-tree', pin, '--', clean], repo).trim();
    const m = /^\d+ (blob|tree) [0-9a-f]+\t(.+)$/.exec(line);
    return m && m[2] === clean ? m[1] : undefined;
  };
  return {
    has: (path) => typeOf(path) !== undefined,
    read: (path) => (typeOf(path) === 'blob' ? git(['show', `${pin}:${path}`], repo) : undefined),
    list: (dir) =>
      git(['ls-tree', '-r', '--name-only', pin, '--', dir], repo).split('\n').filter(Boolean),
  };
}

/**
 * The `@isoloop/*` version at the pin, the one the docs describe: every
 * package shares it (the fixed group), so host's stands for all of them.
 */
export function libraryVersion(library: Pick<LibraryReader, 'read'>): string {
  const raw = library.read('packages/host/package.json');
  if (raw === undefined) throw new Error('the pin has no packages/host/package.json');
  const pkg: unknown = JSON.parse(raw);
  const version =
    typeof pkg === 'object' && pkg !== null && 'version' in pkg ? pkg.version : undefined;
  if (typeof version !== 'string' || !version)
    throw new Error('packages/host/package.json at the pin has no version');
  return version;
}
