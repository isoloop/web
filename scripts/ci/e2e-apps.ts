// CI (check.yml): the apps whose E2E a pull request runs, from what it
// changes (e2e-apps-rule.ts). `BASE` is the pull request's base commit; without
// one (weekly.yml), every app runs. Writes `apps=<json>` to GITHUB_OUTPUT.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { affectedApps, type Change, type Pkg } from './e2e-apps-rule.ts';

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' });

/**
 * The workspace's packages, from pnpm-workspace.yaml's `packages:` globs (one
 * `*` at the end, as it uses them). An app has E2E when it has a
 * playwright.config.ts, except the site, whose smoke test is site.yml's.
 */
export function workspace(root = '.'): Pkg[] {
  const yaml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
  const list = /^packages:\n((?:\s+(?:-.*|#.*)\n)+)/m.exec(yaml)?.[1] ?? '';
  const globs = [...list.matchAll(/^\s+-\s+(\S+)/gm)].map((m) => m[1] ?? '');
  const dirs = globs.flatMap((g) => {
    const parent = g.replace(/\/\*$/, '');
    if (!existsSync(join(root, parent))) return [];
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, parent, d.name, 'package.json')))
      .map((d) => `${parent}/${d.name}`);
  });
  return dirs.map((dir) => {
    const json: unknown = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    const field = (k: string): Record<string, string> => {
      const v: unknown =
        typeof json === 'object' && json !== null ? Reflect.get(json, k) : undefined;
      return typeof v === 'object' && v !== null ? Object.fromEntries(Object.entries(v)) : {};
    };
    const deps = Object.entries({ ...field('dependencies'), ...field('devDependencies') })
      .filter(([, v]) => v.startsWith('workspace:'))
      .map(([k]) => k);
    const name: unknown =
      typeof json === 'object' && json !== null ? Reflect.get(json, 'name') : '';
    return {
      dir,
      name: typeof name === 'string' ? name : dir,
      deps,
      e2e: dir !== 'apps/site' && existsSync(join(root, dir, 'playwright.config.ts')),
    };
  });
}

function change(base: string | undefined): Change {
  const pkgs = workspace();
  if (!base) return { files: null, pkgs };
  try {
    git('cat-file', '-e', `${base}^{commit}`);
  } catch {
    return { files: null, pkgs };
  }
  // --no-renames: a file moved out of an app still counts for that app.
  const files = git('diff', '--name-only', '--no-renames', base, 'HEAD')
    .split('\n')
    .filter(Boolean);
  if (!files.includes('pnpm-lock.yaml')) return { files, pkgs };
  const lock = {
    base: existsInBase(base) ? git('show', `${base}:pnpm-lock.yaml`) : '',
    head: readFileSync('pnpm-lock.yaml', 'utf8'),
  };
  return { files, pkgs, lock };
}

function existsInBase(base: string): boolean {
  try {
    git('cat-file', '-e', `${base}:pnpm-lock.yaml`);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const { apps, why } = affectedApps(change(process.env['BASE']));
  console.log(`E2E: ${apps.join(', ') || 'none'}`);
  for (const line of why) console.log(`  ${line}`);
  const out = process.env['GITHUB_OUTPUT'];
  if (out) appendFileSync(out, `apps=${JSON.stringify(apps)}\n`);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) {
    const lines = why.map((w) => `- ${w}`).join('\n');
    appendFileSync(summary, `**E2E:** ${apps.join(', ') || 'none'}\n\n${lines}\n`);
  }
}
