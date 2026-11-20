// ensureLibrary against a local repo standing in for isoloop/isoloop: the
// pinned LIBRARY_PATHS (diagrams, guides and API pages) land on disk, and only those.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  apiDir,
  ensureLibrary,
  guidesDir,
  LIBRARY_PATHS,
  libraryDir,
  libraryVersion,
} from './library.ts';

const root = mkdtempSync(join(tmpdir(), 'site-library-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.test',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.test',
    },
  }).trim();

function write(dir: string, path: string, text: string): void {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
}

/** A repo with main holding the given files; returns its path and head sha. */
function library(files: Record<string, string>): { url: string; sha: string } {
  const dir = mkdtempSync(join(root, 'lib-'));
  git(dir, 'init', '--quiet', '--initial-branch=main');
  for (const [p, t] of Object.entries(files)) write(dir, p, t);
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'lib');
  return { url: dir, sha: git(dir, 'rev-parse', 'HEAD') };
}

function site(pin: string): string {
  const dir = mkdtempSync(join(root, 'site-'));
  writeFileSync(join(dir, 'library.lock'), `${pin}\n`);
  return dir;
}

/** A pin with only host's package.json. */
const read = (path: string): string | undefined =>
  path === 'packages/host/package.json'
    ? '{"name":"@isoloop/host","version":"0.1.0-next.7"}'
    : undefined;

describe('libraryVersion', () => {
  it("reads the version every package shares from host's package.json", () => {
    expect(libraryVersion({ read })).toBe('0.1.0-next.7');
  });

  it('fails when the pin has no such file or no version', () => {
    expect(() => libraryVersion({ read: () => undefined })).toThrow(/no packages\/host/);
    expect(() => libraryVersion({ read: () => '{}' })).toThrow(/no version/);
  });
});

describe('ensureLibrary', () => {
  it('checks out the diagrams, the guides and the API pages at the pin, and nothing else', () => {
    expect(LIBRARY_PATHS).toEqual(['docs/diagrams', 'docs/guide', 'docs/api']);
    const lib = library({
      'docs/diagrams/a.json': '{}',
      'docs/guide/hosting.md': '# Hosting\n',
      'docs/api/host.md': '# @isoloop/host\n',
      'docs/adr/0001.md': '# ADR\n',
      'packages/host/package.json': '{}',
    });
    const s = site(lib.sha);
    const diagrams = ensureLibrary(s, lib.url);
    expect(diagrams).toBe(join(libraryDir(s), 'docs', 'diagrams'));
    expect(existsSync(join(diagrams, 'a.json'))).toBe(true);
    expect(existsSync(join(guidesDir(s), 'hosting.md'))).toBe(true);
    expect(existsSync(join(apiDir(s), 'host.md'))).toBe(true);
    expect(existsSync(join(libraryDir(s), 'docs', 'adr'))).toBe(false);
    expect(existsSync(join(libraryDir(s), 'packages'))).toBe(false);
  });

  it('fetches again when a stamped checkout from before the guides or the API pages lacks them', () => {
    const lib = library({
      'docs/diagrams/a.json': '{}',
      'docs/guide/pools.md': '# Pools\n',
      'docs/api/host.md': '# @isoloop/host\n',
    });
    const s = site(lib.sha);
    ensureLibrary(s, lib.url);
    rmSync(guidesDir(s), { recursive: true });
    rmSync(apiDir(s), { recursive: true });
    ensureLibrary(s, lib.url);
    expect(existsSync(join(guidesDir(s), 'pools.md'))).toBe(true);
    expect(existsSync(join(apiDir(s), 'host.md'))).toBe(true);
  });

  it('fails a pin whose commit has no API pages', () => {
    const lib = library({ 'docs/diagrams/a.json': '{}', 'docs/guide/x.md': '# X\n' });
    expect(() => ensureLibrary(site(lib.sha), lib.url)).toThrow();
  });

  it('fails a pin whose commit has no guides', () => {
    const lib = library({ 'docs/diagrams/a.json': '{}' });
    expect(() => ensureLibrary(site(lib.sha), lib.url)).toThrow();
  });

  it("fails a pin that isn't on main", () => {
    const lib = library({ 'docs/diagrams/a.json': '{}', 'docs/guide/x.md': '# X\n' });
    git(lib.url, 'checkout', '--quiet', '-b', 'side');
    write(lib.url, 'docs/guide/y.md', '# Y\n');
    git(lib.url, 'add', '-A');
    git(lib.url, 'commit', '--quiet', '-m', 'side');
    const side = git(lib.url, 'rev-parse', 'HEAD');
    git(lib.url, 'checkout', '--quiet', 'main');
    expect(() => ensureLibrary(site(side), lib.url)).toThrow("isn't on isoloop/isoloop's main");
  });
});
