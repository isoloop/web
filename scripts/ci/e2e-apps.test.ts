import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { affectedApps, parseLock, type Pkg } from './e2e-apps-rule.ts';
import { workspace } from './e2e-apps.ts';

// The workspace as it is today (checked against the real one below).
const PKGS: Pkg[] = [
  { dir: 'apps/basic', name: 'basic', deps: ['ui'], e2e: true },
  { dir: 'apps/processor', name: 'processor', deps: ['compare', 'ui'], e2e: true },
  { dir: 'apps/samples', name: 'samples', deps: [], e2e: false },
  { dir: 'apps/site', name: 'site', deps: ['ui'], e2e: false },
  {
    dir: 'apps/dashboards/markets',
    name: 'markets',
    deps: ['compare', 'creator', 'ui'],
    e2e: true,
  },
  { dir: 'apps/dashboards/plant', name: 'plant', deps: ['compare', 'creator', 'ui'], e2e: true },
  { dir: 'packages/compare', name: 'compare', deps: [], e2e: false },
  { dir: 'packages/creator', name: 'creator', deps: [], e2e: true },
  { dir: 'packages/ui', name: 'ui', deps: [], e2e: false },
];
const ALL = ['basic', 'dashboards/markets', 'dashboards/plant', 'packages/creator', 'processor'];
const run = (files: string[] | null, sides?: { base: string; head: string }): string[] =>
  affectedApps({ files, pkgs: PKGS, ...(sides ? { lock: sides } : {}) }).apps;

/** A lockfile in pnpm's shape: pnpm's own document, then the workspace's. */
function lock(importers: Record<string, string>, snapshots: string[]): string {
  const imp = Object.entries(importers)
    .map(
      ([dir, dep]) =>
        `  ${dir}:\n    dependencies:\n      ${dep}:\n        specifier: 'catalog:'\n        version: 1.0.0\n`,
    )
    .join('\n');
  const snaps = snapshots.map((s) => `  ${s}\n`).join('\n');
  return `---\nlockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    configDependencies: {}\n\n---\nlockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n\ncatalogs:\n  default:\n    zod:\n      specifier: 4.6.7\n      version: 4.6.7\n\nimporters:\n\n${imp}\nsnapshots:\n\n${snaps}`;
}
const BASE_IMPORTERS = { '.': 'oxfmt', 'apps/basic': 'zod', 'apps/samples': 'vite' };
const BASE_SNAPS = [
  "'a@1.0.0': {}",
  "'b@1.0.0':\n    dependencies:\n      a: 1.0.0",
  "'c@1.0.0': {}",
];
const BASE_LOCK = lock(BASE_IMPORTERS, BASE_SNAPS);

void describe('affectedApps', () => {
  void it('runs every app with nothing to compare against (weekly.yml)', () => {
    assert.deepEqual(run(null), ALL);
  });

  void it('runs nothing for docs, Markdown, changesets or the repo scripts', () => {
    assert.deepEqual(
      run([
        'docs/adr/0005-x.md',
        'apps/basic/README.md',
        '.changeset/x.md',
        'scripts/queue/queue-model.ts',
      ]),
      [],
    );
  });

  void it("runs nothing for an app's example.json, screenshots or recorded comparison results (web#171, #180)", () => {
    const files = [
      'apps/basic/example.json',
      'apps/basic/screenshot-dark.webp',
      'apps/dashboards/plant/screenshot.webp',
      'apps/dashboards/plant/comparison/final/responsiveness/run.json',
      'apps/processor/comparison/v0.2.0/results/run.log',
    ];
    assert.deepEqual(run(files), []);
  });

  void it("runs an app for its own code, the comparison's .ts included (plant's E2E imports its types)", () => {
    assert.deepEqual(run(['apps/basic/src/main.ts']), ['basic']);
    assert.deepEqual(run(['apps/dashboards/plant/comparison/agent-cost.ts']), ['dashboards/plant']);
    // Not a screenshot at the app's root: a real input.
    assert.deepEqual(run(['apps/basic/src/screenshot-x.webp']), ['basic']);
  });

  void it('runs nothing for the site or the samples, which have no E2E here', () => {
    assert.deepEqual(run(['apps/site/src/copy.ts', 'apps/samples/src/agents.ts']), []);
  });

  void it('runs a package and every app that depends on it (web#165: packages/ui)', () => {
    const ui = ['basic', 'dashboards/markets', 'dashboards/plant', 'processor'];
    assert.deepEqual(run(['packages/ui/src/base.css']), ui);
    assert.deepEqual(run(['packages/creator/src/x.ts']), [
      'dashboards/markets',
      'dashboards/plant',
      'packages/creator',
    ]);
    assert.deepEqual(run(['packages/compare/src/pairs.ts']), [
      'dashboards/markets',
      'dashboards/plant',
      'processor',
    ]);
  });

  void it('runs every app for shared code, CI, the root config, or a file outside any package', () => {
    for (const f of [
      'shared/guard.ts',
      '.github/workflows/e2e.yml',
      'tsconfig.base.json',
      'package.json',
      '.nvmrc',
    ])
      assert.deepEqual(run([f]), ALL, f);
  });

  void it('runs every app when any change is outside a package, whatever else changed', () => {
    assert.deepEqual(run(['apps/basic/src/x.ts', 'shared/x.ts']), ALL);
  });

  void it('says why each app runs', () => {
    const { why } = affectedApps({
      files: ['packages/ui/src/a.css', 'apps/basic/src/main.ts'],
      pkgs: PKGS,
    });
    assert.deepEqual(why, [
      'packages/ui/src/a.css: basic, processor, dashboards/markets, dashboards/plant',
    ]);
  });
});

/** A pull request that changes the lockfile (and the catalogs) to `head`. */
const withLock = (head: string): string[] =>
  run(['pnpm-lock.yaml', 'pnpm-workspace.yaml'], { base: BASE_LOCK, head });

void describe('the lockfile', () => {
  void it('attributes a dependency added to apps/samples to the samples alone (web#180)', () => {
    const head = lock(
      {
        ...BASE_IMPORTERS,
        'apps/samples': 'vite:\n        specifier: x\n        version: 1\n      webmcp',
      },
      [...BASE_SNAPS.slice(0, 2), "'b2@1.0.0': {}", BASE_SNAPS[2] ?? ''],
    ).replace('    zod:\n', '    webmcp:\n      specifier: 1\n      version: 1\n    zod:\n');
    assert.deepEqual(withLock(head), []);
  });

  void it('runs the apps whose importer changed, and their dependents', () => {
    assert.deepEqual(withLock(lock({ ...BASE_IMPORTERS, 'apps/basic': 'valibot' }, BASE_SNAPS)), [
      'basic',
    ]);
  });

  void it('runs every app when an existing resolution changes (a shared transitive bump)', () => {
    const snaps = [
      BASE_SNAPS[0] ?? '',
      "'b@1.0.0':\n    dependencies:\n      a: 1.0.1",
      BASE_SNAPS[2] ?? '',
    ];
    assert.deepEqual(withLock(lock({ ...BASE_IMPORTERS, 'apps/samples': 'x' }, snaps)), ALL);
  });

  void it('runs every app when the root importer, the settings or pnpm itself change', () => {
    assert.deepEqual(withLock(lock({ ...BASE_IMPORTERS, '.': 'oxlint' }, BASE_SNAPS)), ALL);
    assert.deepEqual(
      withLock(BASE_LOCK.replace('autoInstallPeers: true', 'autoInstallPeers: false')),
      ALL,
    );
    assert.deepEqual(
      withLock(BASE_LOCK.replace('configDependencies: {}', 'configDependencies: {x: 1}')),
      ALL,
    );
  });

  void it('runs every app when packages are added but no importer changed', () => {
    assert.deepEqual(withLock(lock(BASE_IMPORTERS, [...BASE_SNAPS, "'d@1.0.0': {}"])), ALL);
  });

  void it('runs every app for pnpm-workspace.yaml on its own (no lockfile to say which)', () => {
    assert.deepEqual(run(['pnpm-workspace.yaml']), ALL);
  });

  void it('keys an entry written inline, so one added beside it leaves it unchanged', () => {
    const before = parseLock(lock(BASE_IMPORTERS, BASE_SNAPS));
    const after = parseLock(
      lock(BASE_IMPORTERS, ["'a@1.0.0': {}", "'a2@1.0.0': {}", ...BASE_SNAPS.slice(1)]),
    );
    const key = '1\0snapshots\0a@1.0.0';
    assert.ok(before.has(key));
    assert.equal(after.get(key), before.get(key));
  });
});

const sorted = (ps: Pkg[]): Pkg[] =>
  ps.map((p) => ({ ...p, deps: p.deps.toSorted() })).toSorted((a, b) => a.dir.localeCompare(b.dir));

void describe('workspace', () => {
  void it("reads this repo's packages as the tests above assume", () => {
    const real = workspace(new URL('../..', import.meta.url).pathname);
    assert.deepEqual(sorted(real), sorted(PKGS));
  });
});
