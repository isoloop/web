import { describe, expect, it } from 'vitest';
import { SERIES_POINTS, VIEW_INPUTS, type Output, type OutputKind, type ViewType } from './outputs';
import { outputKind, pipeline } from './pipeline';
import type { Operator } from './spec/types';
import { validateSpec } from './spec/validate';
import { CATALOG, rec, SCALARS, spec } from './test-fixtures';

const win = { op: 'window', ms: 10_000 } as const;

/** The output, checked to be of `kind`. */
function of<K extends OutputKind>(out: Output, kind: K): Extract<Output, { kind: K }> {
  if (!isKind(out, kind)) throw new Error(`expected ${kind}, got ${out.kind}`);
  return out;
}

function isKind<K extends OutputKind>(out: Output, kind: K): out is Extract<Output, { kind: K }> {
  return out.kind === kind;
}

describe('rows', () => {
  it('keeps the chosen key and the records that pass, newest first', () => {
    const p = pipeline(
      spec({ operators: [{ op: 'filter', where: { field: 'speed', op: '>', value: 0 } }] }),
      SCALARS,
    );
    p.push(rec(1, 'pump-1', { speed: 5, bearingTemp: 40 }));
    p.push(rec(2, 'pump-2', { speed: 5, bearingTemp: 41 }));
    p.push(rec(3, 'pump-1', { speed: 0, bearingTemp: 42 }));
    p.push(rec(4, 'pump-1', { speed: 7, bearingTemp: 43, machine: 'pump-1' }));
    const out = of(p.read(10), 'rows');
    expect(out.kind).toBe('rows');
    expect(out.columns.map((c) => c.name)).toEqual([
      '$key',
      'machine',
      'ts',
      'speed',
      'bearingTemp',
    ]);
    expect(out.rows.map((r) => r.t)).toEqual([4, 1]);
    expect(out.rows[0]?.cells).toEqual(['pump-1', 'pump-1', null, 7, 43]);
  });

  it('applies a window', () => {
    const p = pipeline(spec({ operators: [{ op: 'window', n: 2 }] }), SCALARS);
    for (const t of [1, 2, 3]) p.push(rec(t, 'pump-1', {}));
    expect(of(p.read(10), 'rows').rows.map((r) => r.t)).toEqual([3, 2]);
  });
});

describe('scalar', () => {
  it('is the aggregate over the window now, with the field unit', () => {
    const p = pipeline(
      spec({
        operators: [win, { op: 'aggregate', fn: 'avg', field: 'bearingTemp' }],
        view: { type: 'stat', size: 's' },
      }),
      SCALARS,
    );
    p.push(rec(0, 'pump-1', { bearingTemp: 10 }));
    p.push(rec(5000, 'pump-1', { bearingTemp: 20 }));
    p.push(rec(12_000, 'pump-1', { bearingTemp: 30 }));
    expect(p.read(12_000)).toEqual({
      kind: 'scalar',
      label: 'avg Bearing temperature',
      unit: '°C',
      t: 12_000,
      value: 25,
    });
    expect(p.read(30_000)).toMatchObject({ value: null });
  });

  it('labels count without a unit', () => {
    const p = pipeline(
      spec({
        operators: [win, { op: 'aggregate', fn: 'count' }],
        view: { type: 'stat', size: 's' },
      }),
      SCALARS,
    );
    p.push(rec(0, 'pump-1', {}));
    expect(p.read(1)).toEqual({ kind: 'scalar', label: 'count', t: 1, value: 1 });
  });
});

describe('series', () => {
  const ops: Operator[] = [win, { op: 'aggregate', fn: 'max', field: 'speed', every: 1000 }];

  it('fills the history on the first read, then adds the ticks since', () => {
    const p = pipeline(spec({ operators: ops }), SCALARS);
    for (let t = 0; t <= 5000; t += 500) p.push(rec(t, 'pump-1', { speed: t }));
    let out = of(p.read(5200), 'series');
    expect(out.points.map((x) => x.t)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    expect(out.points.map((x) => x.v)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    p.push(rec(5500, 'pump-1', { speed: 9000 }));
    out = of(p.read(7100), 'series');
    expect(out.points.slice(-2)).toEqual([
      { t: 6000, v: 9000 },
      { t: 7000, v: 9000 },
    ]);
    expect(p.read(7900).kind).toBe('series');
    expect(of(p.read(7900), 'series').points).toHaveLength(8);
  });

  it(`keeps at most ${SERIES_POINTS} points`, () => {
    const p = pipeline(spec({ operators: ops }), SCALARS);
    p.read(0);
    expect(of(p.read(1000 * (SERIES_POINTS + 50)), 'series').points).toHaveLength(SERIES_POINTS);
  });
});

describe('grid', () => {
  it('without every: one column now, one row per group, sorted', () => {
    const p = pipeline(
      spec({
        source: { topic: 'plant.scalars.v1' },
        operators: [win, { op: 'aggregate', fn: 'last', field: 'speed', groupBy: '$key' }],
        view: { type: 'bar', size: 'm' },
      }),
      SCALARS,
    );
    p.push(rec(1, 'pump-2', { speed: 2 }));
    p.push(rec(2, 'pump-1', { speed: 1 }));
    p.push(rec(3, 'pump-2', { speed: 3 }));
    expect(p.read(5)).toEqual({
      kind: 'grid',
      label: 'last Speed',
      unit: 'rpm',
      groupLabel: 'Machine',
      groups: ['pump-1', 'pump-2'],
      times: [5],
      values: [[1], [3]],
    });
  });

  it('with every: a column per tick, null where a group had nothing', () => {
    const p = pipeline(
      spec({
        source: { topic: 'plant.scalars.v1' },
        operators: [
          { op: 'window', ms: 1000 },
          { op: 'aggregate', fn: 'count', every: 1000, groupBy: '$key' },
        ],
        view: { type: 'heatmap', size: 'l' },
      }),
      SCALARS,
    );
    p.push(rec(500, 'pump-1', {}));
    p.push(rec(1500, 'pump-2', {}));
    p.push(rec(1600, 'pump-2', {}));
    const out = of(p.read(2000), 'grid');
    expect(out.times).toEqual([1000, 2000]);
    expect(out.groups).toEqual(['pump-1', 'pump-2']);
    expect(out.values).toEqual([
      [1, null],
      [null, 2],
    ]);
  });
});

const VIEWS: readonly ViewType[] = ['line', 'bar', 'heatmap', 'table', 'stat'];

describe('output kinds', () => {
  const cases: [Operator[], OutputKind][] = [
    [[], 'rows'],
    [[win], 'rows'],
    [[win, { op: 'aggregate', fn: 'count' }], 'scalar'],
    [[win, { op: 'aggregate', fn: 'count', every: 1000 }], 'series'],
    [[win, { op: 'aggregate', fn: 'count', groupBy: '$key' }], 'grid'],
    [[win, { op: 'aggregate', fn: 'count', every: 1000, groupBy: 'machine' }], 'grid'],
  ];

  it.each(cases)('%j gives %s, and the pipeline reads that kind', (operators, kind) => {
    expect(outputKind(operators)).toBe(kind);
    const p = pipeline(spec({ source: { topic: 'plant.scalars.v1' }, operators }), SCALARS);
    expect(p.kind).toBe(kind);
    expect(p.read(1000).kind).toBe(kind);
  });

  it('validateSpec accepts a view exactly when it draws the kind the pipeline gives', () => {
    for (const [operators, kind] of cases) {
      for (const type of VIEWS) {
        const s = spec({
          source: { topic: 'plant.scalars.v1' },
          operators,
          view: { type, size: 'm' },
        });
        expect(validateSpec(s, CATALOG).ok, `${type} on ${kind}`).toBe(
          VIEW_INPUTS[type].includes(kind),
        );
      }
    }
  });
});
