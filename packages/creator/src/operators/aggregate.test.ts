import { describe, expect, it } from 'vitest';
import { rec } from '../test-fixtures';
import { aggregate, groupBy, percentile } from './aggregate';

const recs = [1, 4, 2, 3].map((v, i) =>
  rec(i, i % 2 ? 'a' : 'b', { v, g: i % 2 ? 'odd' : 'even' }),
);

describe('aggregate', () => {
  it('takes each function over a field', () => {
    expect(aggregate('count', recs)).toBe(4);
    expect(aggregate('sum', recs, 'v')).toBe(10);
    expect(aggregate('avg', recs, 'v')).toBe(2.5);
    expect(aggregate('min', recs, 'v')).toBe(1);
    expect(aggregate('max', recs, 'v')).toBe(4);
    expect(aggregate('last', recs, 'v')).toBe(3);
    expect(aggregate('percentile', recs, 'v', 50)).toBe(2.5);
  });

  it('skips values that are not finite numbers, and gives null when none are left', () => {
    const mixed = [rec(0, 'k', { v: 'x' }), rec(1, 'k', { v: Number.NaN }), rec(2, 'k', { v: 7 })];
    expect(aggregate('avg', mixed, 'v')).toBe(7);
    expect(aggregate('max', [rec(0, 'k', { v: 'x' })], 'v')).toBeNull();
    expect(aggregate('count', [])).toBe(0);
    expect(aggregate('sum', [], 'v')).toBeNull();
  });

  it('handles a large window without spreading arguments', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => rec(i, 'k', { v: i }));
    expect(aggregate('max', many, 'v')).toBe(199_999);
    expect(aggregate('min', many, 'v')).toBe(0);
  });
});

describe('percentile', () => {
  it('interpolates between ranks', () => {
    expect(percentile([10, 20, 30, 40, 50], 95)).toBeCloseTo(48);
    expect(percentile([5], 99)).toBe(5);
    expect(percentile([], 50)).toBeNull();
  });
});

describe('groupBy', () => {
  it('splits by a field or the key, up to a limit of groups', () => {
    expect([...groupBy(recs, 'g', 10).keys()]).toEqual(['even', 'odd']);
    expect(groupBy(recs, '$key', 10).get('a')?.length).toBe(2);
    expect([...groupBy(recs, 'g', 1).keys()]).toEqual(['even']);
  });
});
