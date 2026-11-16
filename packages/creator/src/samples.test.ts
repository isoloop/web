// Topics whose records carry many samples (catalog.ts `samples`): the same
// answers as one record per sample, read straight from the arrays.
import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogTopic, Rec } from './catalog';
import { aggregateSamples } from './operators/aggregate';
import { pipeline } from './pipeline';
import { validateSpec } from './spec/validate';
import type { AggregateFn, WidgetSpec } from './spec/types';

const CHUNKED: CatalogTopic = {
  name: 'plant.vib',
  title: 'Raw vibration',
  key: { label: 'Machine', values: ['T1', 'T2'] },
  fields: [
    { name: 't0', type: 'time' },
    { name: 'machine', type: 'string' },
    { name: 'value', type: 'number', unit: 'mm/s' },
  ],
  history: 30_000,
  time: 't0',
  samples: { field: 'values', value: 'value' },
};

/** The same signal, one record per sample. */
const SINGLE: CatalogTopic = {
  name: 'plant.vib.single',
  title: 'Raw vibration, one per sample',
  key: { label: 'Machine', values: ['T1', 'T2'] },
  fields: CHUNKED.fields,
  history: 30_000,
  time: 't0',
};

const CATALOG: Catalog = { topics: [CHUNKED, SINGLE] };

/** 40 chunks of 50 samples per machine, 50 ms apart, with some NaNs. */
function chunks(): Rec[] {
  const out: Rec[] = [];
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  for (let c = 0; c < 40; c++) {
    for (const machine of ['T1', 'T2']) {
      const values = new Float32Array(50);
      for (let i = 0; i < 50; i++) values[i] = i === 13 && c % 7 === 0 ? Number.NaN : rnd() * 10;
      out.push({ key: machine, t: 1_000 + c * 50, value: { t0: 1_000 + c * 50, machine, values } });
    }
  }
  return out;
}

/** Each chunk as one record per sample, at the chunk's time. */
function single(recs: readonly Rec[]): Rec[] {
  return recs.flatMap((r) => {
    const values = r.value['values'];
    if (!(values instanceof Float32Array)) return [];
    return [...values].map((value) => ({ key: r.key, t: r.t, value: { ...r.value, value } }));
  });
}

function spec(topic: string, fn: AggregateFn, over: Partial<WidgetSpec> = {}): WidgetSpec {
  return {
    id: 'w',
    title: 'Vibration',
    source: { topic },
    operators: [
      { op: 'window', ms: 1_000 },
      {
        op: 'aggregate',
        fn,
        ...(fn === 'count' ? {} : { field: 'value' }),
        ...(fn === 'percentile' ? { p: 99 } : {}),
        every: 500,
        groupBy: '$key',
      },
    ],
    view: { type: 'line', size: 'm' },
    placement: { mode: 'manual', pool: 'pool-1' },
    ...over,
  };
}

function errorsOf(s: WidgetSpec): string[] {
  const r = validateSpec(s, CATALOG);
  return r.ok ? [] : r.errors.map((e) => e.path);
}

describe('sample topics', () => {
  const recs = chunks();
  const now = 1_000 + 40 * 50;

  for (const fn of ['count', 'sum', 'avg', 'min', 'max', 'last', 'percentile'] as const) {
    it(`${fn}: the same grid as one record per sample`, () => {
      const a = pipeline(spec(CHUNKED.name, fn), CHUNKED);
      const b = pipeline(spec(SINGLE.name, fn), SINGLE);
      for (const r of recs) a.push(r);
      for (const r of single(recs)) b.push(r);
      const x = a.read(now);
      const y = b.read(now);
      expect(x.kind).toBe('grid');
      if (x.kind !== 'grid' || y.kind !== 'grid') return;
      expect(x.groups).toEqual(y.groups);
      expect(x.times).toEqual(y.times);
      x.values.forEach((row, g) => {
        row.forEach((v, i) => {
          const w = y.values[g]?.[i];
          if (v === null || w === null || w === undefined) expect(v).toBe(w ?? null);
          else expect(v).toBeCloseTo(w, 3);
        });
      });
    });
  }

  it('keeps one record per chunk, not one per sample', () => {
    const p = pipeline(
      spec(CHUNKED.name, 'avg', {
        operators: [
          { op: 'window', ms: 30_000 },
          { op: 'aggregate', fn: 'avg', field: 'value' },
        ],
      }),
      CHUNKED,
    );
    // A chunk pushed many times: the window holds references to the same records.
    const big: Rec = {
      key: 'T1',
      t: 1_000,
      value: { t0: 1_000, machine: 'T1', values: new Float32Array(250).fill(2) },
    };
    for (let i = 0; i < 1_000; i++) p.push({ ...big, t: 1_000 + i });
    const out = p.read(2_000);
    expect(out.kind).toBe('scalar');
    if (out.kind === 'scalar') expect(out.value).toBe(2);
  });

  it("reads plain arrays too, and skips what isn't a number", () => {
    const mixed: Rec[] = [{ key: 'T1', t: 1, value: { values: [1, 'x', 3, Number.NaN] } }];
    expect(aggregateSamples('count', mixed, CHUNKED)).toBe(3);
    expect(aggregateSamples('avg', mixed, CHUNKED)).toBe(2);
    expect(aggregateSamples('max', [], CHUNKED)).toBeNull();
  });

  it('accepts an aggregate over a time window', () => {
    expect(validateSpec(spec(CHUNKED.name, 'percentile'), CATALOG).ok).toBe(true);
  });

  it('needs an aggregate, a time window and no filter on the samples', () => {
    expect(
      errorsOf(spec(CHUNKED.name, 'avg', { operators: [], view: { type: 'table', size: 'm' } })),
    ).toContain('operators');
    expect(
      errorsOf(
        spec(CHUNKED.name, 'avg', {
          operators: [
            { op: 'window', n: 10 },
            { op: 'aggregate', fn: 'avg', field: 'value', every: 500, groupBy: '$key' },
          ],
        }),
      ),
    ).toContain('operators[0].n');
    expect(
      errorsOf(
        spec(CHUNKED.name, 'avg', {
          operators: [
            { op: 'filter', where: { not: { field: 'value', op: '>', value: 3 } } },
            { op: 'window', ms: 1_000 },
            { op: 'aggregate', fn: 'avg', field: 'value', every: 500, groupBy: '$key' },
          ],
        }),
      ),
    ).toContain('operators[0].where');
    // A filter on the record's other fields is fine.
    expect(
      errorsOf(
        spec(CHUNKED.name, 'avg', {
          operators: [
            { op: 'filter', where: { field: 'machine', op: '==', value: 'T1' } },
            { op: 'window', ms: 1_000 },
            { op: 'aggregate', fn: 'avg', field: 'value', every: 500, groupBy: '$key' },
          ],
        }),
      ),
    ).toEqual([]);
  });
});
