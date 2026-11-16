import { describe, expect, it } from 'vitest';
import { rec } from '../test-fixtures';
import { compileFilters, compileWhere } from './filter';

const r = rec(0, 'pump-1', { speed: 1200, machine: 'pump-1', note: 'ok' });

describe('compileWhere', () => {
  it('compares numbers with every ordering op', () => {
    expect(compileWhere({ field: 'speed', op: '>', value: 1000 })(r)).toBe(true);
    expect(compileWhere({ field: 'speed', op: '>=', value: 1200 })(r)).toBe(true);
    expect(compileWhere({ field: 'speed', op: '<', value: 1200 })(r)).toBe(false);
    expect(compileWhere({ field: 'speed', op: '<=', value: 1200 })(r)).toBe(true);
  });

  it('tests equality on strings and numbers', () => {
    expect(compileWhere({ field: 'machine', op: '==', value: 'pump-1' })(r)).toBe(true);
    expect(compileWhere({ field: 'machine', op: '!=', value: 'pump-1' })(r)).toBe(false);
    expect(compileWhere({ field: 'speed', op: '==', value: 1200 })(r)).toBe(true);
  });

  it('reads the record key as $key', () => {
    expect(compileWhere({ field: '$key', op: '==', value: 'pump-1' })(r)).toBe(true);
    expect(compileWhere({ field: '$key', op: 'in', value: ['press-1', 'pump-2'] })(r)).toBe(false);
  });

  it('tests membership with in', () => {
    expect(compileWhere({ field: 'note', op: 'in', value: ['ok', 'warn'] })(r)).toBe(true);
  });

  it('fails an ordering on a missing or non-number value', () => {
    expect(compileWhere({ field: 'missing', op: '<', value: 5 })(r)).toBe(false);
    expect(compileWhere({ field: 'machine', op: '>', value: 5 })(r)).toBe(false);
  });

  it('combines with and, or and not', () => {
    const fast = { field: 'speed', op: '>', value: 1000 } as const;
    const other = { field: 'machine', op: '==', value: 'press-1' } as const;
    expect(compileWhere({ and: [fast, other] })(r)).toBe(false);
    expect(compileWhere({ or: [fast, other] })(r)).toBe(true);
    expect(compileWhere({ not: other })(r)).toBe(true);
    expect(compileWhere({ not: { or: [fast, other] } })(r)).toBe(false);
  });
});

describe('compileFilters', () => {
  it('passes a record only when every filter passes, and everything with none', () => {
    expect(compileFilters([])(r)).toBe(true);
    expect(
      compileFilters([
        { field: 'speed', op: '>', value: 0 },
        { field: 'note', op: '==', value: 'no' },
      ])(r),
    ).toBe(false);
  });
});
