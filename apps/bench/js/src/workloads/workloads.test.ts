import { describe, expect, it } from 'vitest';
import { WORKLOADS } from './index.ts';

const inputs = (s: unknown): string =>
  JSON.stringify(s, (_k, v: unknown) =>
    v instanceof Map
      ? [...v]
      : v instanceof Set
        ? [...v]
        : ArrayBuffer.isView(v)
          ? Array.from(v as Float64Array)
          : v,
  );

describe.each(WORKLOADS.map((w) => [w.id, w] as const))('%s', (_id, w) => {
  it('gives the same first result from the same seed', () => {
    expect(w.op(w.setup(7), 0)).toBe(w.op(w.setup(7), 0));
  });

  it('returns a finite number', () => {
    expect(Number.isFinite(w.op(w.setup(1), 3))).toBe(true);
  });

  if (w.id.startsWith('sort-') || w.id.startsWith('structured-clone') || w.id.startsWith('json-')) {
    it('leaves its inputs untouched', () => {
      const s = w.setup(3);
      const before = inputs(s);
      w.op(s, 1);
      expect(inputs(s)).toBe(before);
    });
  }
});

it('has unique ids', () => {
  expect(new Set(WORKLOADS.map((w) => w.id)).size).toBe(WORKLOADS.length);
});
