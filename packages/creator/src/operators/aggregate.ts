// The aggregate operator's functions, over the records a window holds.
import type { Rec } from '../catalog';
import type { AggregateFn } from '../spec/types';
import { fieldValue } from './filter';

/** The p-th percentile (0–100) of sorted values, interpolated between ranks. */
export function percentile(sorted: readonly number[], p: number): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const r = (p / 100) * (n - 1);
  const lo = Math.floor(r);
  const hi = Math.ceil(r);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? 0;
  return a + (b - a) * (r - lo);
}

/**
 * One aggregate over records. `count` counts records; the others read
 * `field` and skip records where it isn't a finite number. Null when nothing
 * was left to aggregate (`count` gives 0).
 */
export function aggregate(
  fn: AggregateFn,
  recs: readonly Rec[],
  field?: string,
  p = 50,
): number | null {
  if (fn === 'count') return recs.length;
  const values: number[] = [];
  if (field !== undefined) {
    for (const r of recs) {
      const v = fieldValue(r, field);
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
    }
  }
  if (values.length === 0) return null;
  if (fn === 'sum') return values.reduce((a, b) => a + b, 0);
  if (fn === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (fn === 'min') return values.reduce((a, b) => (b < a ? b : a));
  if (fn === 'max') return values.reduce((a, b) => (b > a ? b : a));
  if (fn === 'last') return values.at(-1) ?? null;
  return percentile(
    values.toSorted((a, b) => a - b),
    p,
  );
}

/** Records split by a field's value (`$key` included); records without a string or number value there are left out. */
export function groupBy(recs: readonly Rec[], field: string, limit: number): Map<string, Rec[]> {
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    const v = fieldValue(r, field);
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const g = String(v);
    let list = groups.get(g);
    if (!list) {
      if (groups.size >= limit) continue;
      list = [];
      groups.set(g, list);
    }
    list.push(r);
  }
  return groups;
}
