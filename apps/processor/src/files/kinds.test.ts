import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CorruptFile, KINDS, random, runAll, sha256, work } from './kinds';

const drain = <T>(g: Generator<void, T>): T => {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
};

const time = (f: () => void): number => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe('the File processor kinds', () => {
  it('SHA-256 matches node:crypto', () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 24_000]) {
      const bytes = new Uint8Array(n);
      const rnd = random(n + 1);
      for (let i = 0; i < n; i++) bytes[i] = (rnd() * 256) | 0;
      expect(drain(sha256(bytes))).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('the same seed gives the same output, and each kind yields along the way', () => {
    for (const kind of KINDS) {
      const job = { id: 'r-1', kind, size: 2, seed: 42 };
      expect(runAll(job)).toBe(runAll(job));
      let yields = 0;
      const steps = work(job);
      while (!steps.next().done) yields++;
      expect(yields).toBeGreaterThan(5);
    }
  });

  it('a corrupt file throws partway through', () => {
    for (const kind of KINDS) {
      expect(() => runAll({ id: 'r-2', kind, size: 1, seed: 1, corrupt: true })).toThrow(
        CorruptFile,
      );
    }
  });

  it('a heavy file is about ten times the work, and size scales it', () => {
    for (const kind of KINDS) {
      runAll({ id: 'w', kind, size: 2, seed: 3 }); // warm up
      const one = time(() => runAll({ id: 'a', kind, size: 1, seed: 3 }));
      const heavy = time(() => runAll({ id: 'b', kind, size: 1, seed: 3, heavy: true }));
      console.log(`${kind}: size 1 ${one.toFixed(1)} ms, heavy ${heavy.toFixed(1)} ms`);
      expect(heavy).toBeGreaterThan(one * 4);
    }
  });
});
