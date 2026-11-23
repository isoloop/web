// CI (check.yml): every changeset in .changeset/ can be versioned. Changesets
// refuses a changeset that names a package in config.json's `ignore` (the
// shared packages and samples) beside one it versions: `changeset version`
// and `changeset status` stop with "Found mixed changeset". A changeset that
// names only ignored packages is versioned by nothing and stays: a warning.
// .changeset/README.md says where such a change is logged instead.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Finding {
  file: string;
  ignored: string[];
  /** The packages it names that Changesets versions. */
  versioned: string[];
}

/** The package names in a changeset's front matter, or null when it has none. */
export function packagesOf(text: string): string[] | null {
  const front = /^---\r?\n([\s\S]*?)^---/m.exec(text)?.[1];
  if (front === undefined) return null;
  return [...front.matchAll(/^\s*(?:'([^']+)'|"([^"]+)"|([^\s:'"]+))\s*:/gm)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? '',
  );
}

export function findings(files: { file: string; text: string }[], ignore: string[]): Finding[] {
  return files.flatMap(({ file, text }) => {
    const names = packagesOf(text) ?? [];
    const ignored = names.filter((n) => ignore.includes(n));
    if (ignored.length === 0) return [];
    return [{ file, ignored, versioned: names.filter((n) => !ignore.includes(n)) }];
  });
}

/** `ignore` from .changeset/config.json's parsed JSON: the names that are strings. */
export function ignoreList(config: unknown): string[] {
  if (typeof config !== 'object' || config === null || !('ignore' in config)) return [];
  const { ignore } = config;
  return Array.isArray(ignore) ? ignore.filter((x): x is string => typeof x === 'string') : [];
}

/** The changesets in `dir`, README.md left out. */
export function readChangesets(dir = '.changeset'): { file: string; text: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .toSorted()
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(dir, f), 'utf8') }));
}

if (import.meta.main) {
  const ignore = ignoreList(JSON.parse(readFileSync('.changeset/config.json', 'utf8')));
  let failed = false;
  for (const f of findings(readChangesets(), ignore)) {
    const names = f.ignored.join(', ');
    if (f.versioned.length > 0) {
      failed = true;
      console.log(
        `::error file=${f.file}::${f.file} names ${names}, which changesets ignores, beside ${f.versioned.join(', ')}: \`changeset version\` refuses that mix. Remove the ${names} line and log the change under the apps it shows in (.changeset/README.md).`,
      );
    } else {
      console.log(
        `::warning file=${f.file}::${f.file} names only ${names}, which changesets ignores, so no release ever uses it. Log the change under the apps it shows in (.changeset/README.md).`,
      );
    }
  }
  if (failed) process.exit(1);
  console.log('Every changeset can be versioned.');
}
