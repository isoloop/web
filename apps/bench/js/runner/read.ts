// Small readers for the runner: the bench's own JSON files and its CLI lists.
import { readFileSync } from 'node:fs';

/** Reads a JSON file the bench wrote itself (results, run.json, calibration, package.json): its shape is taken as given. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- the caller names the file's shape
export function readJson<T>(path: string): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bench's own files, written by this runner
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** A CLI value or comma list, each item one of `allowed`. */
export function oneOf<T extends string>(list: string, allowed: readonly T[], what: string): T[] {
  return list.split(',').map((x) => {
    const v = allowed.find((y) => y === x);
    if (v === undefined) throw new Error(`unknown ${what}: ${x} (one of ${allowed.join(', ')})`);
    return v;
  });
}
