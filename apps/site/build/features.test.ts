import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkProof, exportsSymbol, loadFeatures } from './features.ts';

const entry = {
  id: 'bus',
  order: 30,
  part: 'bus',
  name: 'The message bus.',
  line: 'Typed topics.',
  text: ['The bus runs in a worker.'],
  demo: 'bus',
  since: 'site-v0.1.0',
  proof: [{ repo: 'isoloop', path: 'packages/bus/src/broker.ts', symbol: 'Broker' }],
};

function dirWith(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'features-'));
  for (const [name, json] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(json));
  }
  return dir;
}

const library = (files: Record<string, string>) => ({
  read: (p: string): string | undefined => files[p],
  has: (p: string): boolean => p in files,
});

describe('exportsSymbol', () => {
  it('finds declarations and export lists', () => {
    expect(exportsSymbol('export class Broker {}', 'Broker')).toBe(true);
    expect(exportsSymbol('export const DEFAULT = 1', 'DEFAULT')).toBe(true);
    expect(exportsSymbol('export type StartPosition = 1', 'StartPosition')).toBe(true);
    expect(exportsSymbol('export async function go() {}', 'go')).toBe(true);
    expect(exportsSymbol('export { a, Broker as B }', 'Broker')).toBe(true);
    expect(exportsSymbol('class Broker {}', 'Broker')).toBe(false);
    expect(exportsSymbol('export class BrokerX {}', 'Broker')).toBe(false);
  });
});

describe('checkProof', () => {
  const lib = library({ 'a.ts': "export function step() {}\ntest('it works', () => {})" });
  it('holds for an existing path, symbol or test', () => {
    expect(checkProof({ repo: 'isoloop', path: 'a.ts' }, lib.read, lib.has)).toBeUndefined();
    expect(
      checkProof({ repo: 'isoloop', path: 'a.ts', symbol: 'step' }, lib.read, lib.has),
    ).toBeUndefined();
    expect(
      checkProof({ repo: 'isoloop', path: 'a.ts', test: 'it works' }, lib.read, lib.has),
    ).toBeUndefined();
  });
  it('names what broke', () => {
    expect(checkProof({ repo: 'isoloop', path: 'gone.ts' }, lib.read, lib.has)).toBe(
      "gone.ts doesn't exist",
    );
    expect(checkProof({ repo: 'isoloop', path: 'a.ts', symbol: 'other' }, lib.read, lib.has)).toBe(
      "a.ts doesn't export other",
    );
    expect(checkProof({ repo: 'isoloop', path: 'a.ts', test: 'nope' }, lib.read, lib.has)).toBe(
      'a.ts has no test "nope"',
    );
  });
});

describe('loadFeatures', () => {
  it('loads valid entries in order', () => {
    const dir = dirWith({
      'bus.json': entry,
      'containment.json': { ...entry, id: 'containment', order: 10, proof: [entry.proof[0]] },
    });
    const lib = library({ 'packages/bus/src/broker.ts': 'export class Broker {}' });
    expect(loadFeatures(dir, lib, '.').map((f) => f.id)).toEqual(['containment', 'bus']);
  });

  it('fails the build on a proof that drifted, naming the entry and the path', () => {
    const dir = dirWith({ 'bus.json': entry });
    const lib = library({ 'packages/bus/src/broker.ts': 'export class Bus {}' });
    expect(() => loadFeatures(dir, lib, '.')).toThrow(
      "apps/site/content/features/bus.json: proof in isoloop/isoloop at the library pin: packages/bus/src/broker.ts doesn't export Broker",
    );
  });

  it('checks web proofs in the web checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'web-'));
    mkdirSync(join(root, 'apps'), { recursive: true });
    writeFileSync(join(root, 'apps', 'README.md'), '# results');
    const ok = dirWith({
      'cost.json': { ...entry, id: 'cost', proof: [{ repo: 'web', path: 'apps/README.md' }] },
    });
    expect(loadFeatures(ok, library({}), root)).toHaveLength(1);
    const broken = dirWith({
      'cost.json': { ...entry, id: 'cost', proof: [{ repo: 'web', path: 'apps/gone.md' }] },
    });
    expect(() => loadFeatures(broken, library({}), root)).toThrow(
      "proof in isoloop/web: apps/gone.md doesn't exist",
    );
  });

  it('reports invalid fields and a file name that disagrees with the id', () => {
    const dir = dirWith({
      'bus.json': { ...entry, name: 'No stop', demo: 'nope' },
      'x.json': entry,
    });
    const err = (() => {
      try {
        loadFeatures(dir, library({ 'packages/bus/src/broker.ts': 'export class Broker {}' }), '.');
      } catch (e) {
        return String(e);
      }
      return '';
    })();
    expect(err).toContain('bus.json: name: ends with a full stop');
    expect(err).toContain('bus.json: demo:');
    expect(err).toContain('x.json: id "bus" doesn\'t match the file name');
  });

  it('accepts every entry the site ships, without checking proofs', () => {
    const dir = fileURLToPath(new URL('../content/features', import.meta.url));
    const features = loadFeatures(dir, library({}), '.', { proofs: false });
    expect(features.map((f) => f.id)).toEqual([
      'containment',
      'restart',
      'bus',
      'replay',
      'durable',
      'placement',
      'balancer',
      'agents',
      'frameworks',
      'safety',
      'cost',
    ]);
  });
});
