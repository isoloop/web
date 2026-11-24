// pnpm set-isoloop <version>: point every @isoloop/* dependency of js-bench at
// one exact version (a release or a prerelease such as 0.2.0-next.3) and
// install it. The workspace's pnpm-workspace.yaml already lets @isoloop/*
// through on the day it's published. A bump is for a run's branch only and is
// never merged (README.md, "Before every release").
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './build.ts';
import { readJson } from './read.ts';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version))
  throw new Error('usage: pnpm set-isoloop <version>, e.g. 0.1.1 or 0.2.0-next.3');

const pkgPath = resolve(ROOT, 'package.json');
const pkg = readJson<Record<string, Record<string, string>>>(pkgPath);
for (const field of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(pkg[field] ?? {}))
    if (name.startsWith('@isoloop/')) pkg[field]![name] = version;
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
execSync('pnpm install --filter js-bench', { cwd: ROOT, stdio: 'inherit' });
console.log(
  `@isoloop/* now ${version}. Results of the next run go to results/${version}/<profile>/.`,
);
