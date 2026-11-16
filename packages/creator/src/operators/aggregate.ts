// The aggregate operator's functions, over the records a window holds.
import { samplesOf, type CatalogTopic, type Rec } from '../catalog';
import type { AggregateFn } from '../spec/types';
import { fieldValue } from './filter';

/** The p-th percentile (0–100) of sorted values, interpolated between ranks. */
export function percentile(sorted: ArrayLike<number>, p: number): number | null {
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

/**
 * One aggregate over the samples records carry (a catalog topic with
 * `samples`): every finite sample of every record counts, read from the
 * records' arrays. Percentile copies them into one Float64Array and sorts it;
 * nothing allocates per sample. `count` counts every sample, as `count`
 * counts every record.
 */
export function aggregateSamples(
  fn: AggregateFn,
  recs: readonly Rec[],
  topic: CatalogTopic,
  p = 50,
): number | null {
  let n = 0;
  if (fn === 'count') {
    for (const r of recs) n += samplesOf(topic, r).length;
    return n;
  }
  if (fn === 'percentile') {
    let total = 0;
    for (const r of recs) total += samplesOf(topic, r).length;
    const all = new Float64Array(total);
    for (const r of recs) {
      const xs = samplesOf(topic, r);
      for (let i = 0; i < xs.length; i++) {
        const v = xs[i] ?? Number.NaN;
        if (Number.isFinite(v)) all[n++] = v;
      }
    }
    if (n === 0) return null;
    // Sorting in place: `all` is this call's own copy.
    // oxlint-disable-next-line unicorn/no-array-sort -- a fresh typed array; toSorted would copy it again
    const sorted = all.subarray(0, n).sort();
    return percentile(sorted, p);
  }
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let last: number | null = null;
  for (const r of recs) {
    const xs = samplesOf(topic, r);
    for (let i = 0; i < xs.length; i++) {
      const v = xs[i] ?? Number.NaN;
      if (!Number.isFinite(v)) continue;
      n++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
      last = v;
    }
  }
  if (n === 0) return null;
  if (fn === 'sum') return sum;
  if (fn === 'avg') return sum / n;
  if (fn === 'min') return min;
  if (fn === 'max') return max;
  return last;
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
