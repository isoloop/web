import { describe, expect, it } from 'vitest';
import { CATALOG, spec } from '../test-fixtures';
import { validateSpec, type SpecResult } from './validate';

/** The error paths of a result, with their messages for failure output. */
function errors(result: SpecResult): Record<string, string> {
  if (result.ok) return {};
  return Object.fromEntries(result.errors.map((e) => [e.path, e.message]));
}

function paths(input: unknown): string[] {
  return Object.keys(errors(validateSpec(input, CATALOG)));
}

/** The default spec with one operator replaced. */
function withOp(i: number, op: unknown): unknown {
  const s = spec();
  return { ...s, operators: s.operators.map((o, j) => (j === i ? op : o)) };
}

describe('validateSpec accepts', () => {
  it('automatic placement (M3h)', () => {
    expect(errors(validateSpec({ ...spec(), placement: { mode: 'auto' } }, CATALOG))).toEqual({});
  });

  it('burn with ?chaos, as a block or a steady load, anywhere in the list', () => {
    const s = spec();
    const chaos = { chaos: true };
    const block = { op: 'burn', everyMs: 10_000, forMs: 500 };
    const load = { op: 'burn', loadPct: 40 };
    expect(
      errors(validateSpec({ ...s, operators: [block, ...s.operators] }, CATALOG, chaos)),
    ).toEqual({});
    expect(
      errors(validateSpec({ ...s, operators: [...s.operators, load] }, CATALOG, chaos)),
    ).toEqual({});
  });

  it('the plan example shape, trimming the title', () => {
    const result = validateSpec({ ...spec(), title: '  Pump 1  ' }, CATALOG);
    expect(result).toMatchObject({ ok: true, spec: { title: 'Pump 1' } });
  });

  it('a table of raw records with nested conditions on an unkeyed topic', () => {
    const result = validateSpec(
      spec({
        source: { topic: 'plant.events.v1' },
        operators: [
          {
            op: 'filter',
            where: {
              or: [
                { field: 'kind', op: 'in', value: ['alarm', 'trip'] },
                { not: { field: 'level', op: '<', value: 3 } },
              ],
            },
          },
          { op: 'window', n: 50 },
        ],
        view: { type: 'table', size: 'l', options: { limit: 20 } },
      }),
      CATALOG,
    );
    expect(errors(result)).toEqual({});
  });

  it('grouping by the record key', () => {
    const s = spec({
      source: { topic: 'plant.scalars.v1' },
      operators: [
        { op: 'window', ms: 120_000 },
        { op: 'aggregate', fn: 'avg', field: 'speed', groupBy: '$key', every: 5000 },
      ],
      view: { type: 'heatmap', size: 'l' },
    });
    expect(errors(validateSpec(s, CATALOG))).toEqual({});
  });
});

describe('validateSpec rejects, with the path of the error', () => {
  it('a value that is not an object', () => {
    expect(validateSpec(null, CATALOG).ok).toBe(false);
  });

  it('unknown keys and a bad id', () => {
    expect(paths({ ...spec(), colour: 'red' })).toEqual(['']);
    expect(paths({ ...spec(), id: 'no spaces' })).toEqual(['id']);
    expect(paths({ ...spec(), title: '   ' })).toEqual(['title']);
  });

  it('an unknown operator', () => {
    expect(paths(withOp(1, { op: 'combine', with: 'x' }))).toEqual(['operators[1].op']);
  });

  it('a placement that is neither manual with a pool nor auto alone', () => {
    expect(paths({ ...spec(), placement: { mode: 'manual' } })).toEqual(['placement.pool']);
    expect(paths({ ...spec(), placement: { mode: 'auto', pool: 'pool-1' } })).toEqual([
      'placement',
    ]);
    expect(paths({ ...spec(), placement: { mode: 'somewhere' } })).toEqual(['placement.mode']);
  });

  it('burn without ?chaos, wherever it is', () => {
    const s = spec();
    const burn = { op: 'burn', everyMs: 10_000, forMs: 500 };
    expect(paths({ ...s, operators: [burn, ...s.operators] })).toEqual(['operators[0]']);
    expect(paths({ ...s, operators: [...s.operators, burn] })).toEqual(['operators[3]']);
  });

  it('a topic or key the catalog doesn’t have', () => {
    expect(paths(spec({ source: { topic: 'plant.nope.v1' } }))).toEqual(['source.topic']);
    expect(paths(spec({ source: { topic: 'plant.scalars.v1', key: 'pump-9' } }))).toEqual([
      'source.key',
    ]);
    expect(
      paths(
        spec({
          source: { topic: 'plant.events.v1', key: 'x' },
          operators: [],
          view: { type: 'table', size: 'm' },
        }),
      ),
    ).toEqual(['source.key']);
  });

  it('a window longer than the topic keeps, or with both or neither of ms and n', () => {
    expect(
      errors(validateSpec(withOp(1, { op: 'window', ms: 180_000 }), CATALOG))['operators[1].ms'],
    ).toMatch(/120000 ms/);
    expect(paths(withOp(1, { op: 'window', ms: 1000, n: 5 }))).toEqual(['operators[1]']);
    expect(paths(withOp(1, { op: 'window' }))).toEqual(['operators[1]']);
    expect(paths(withOp(1, { op: 'window', ms: -1 }))).toEqual(['operators[1].ms']);
  });

  it('conditions on unknown fields, with the wrong type or a malformed shape', () => {
    expect(
      paths(withOp(0, { op: 'filter', where: { field: 'colour', op: '==', value: 'red' } })),
    ).toEqual(['operators[0].where.field']);
    expect(
      paths(withOp(0, { op: 'filter', where: { field: 'speed', op: '>', value: 'fast' } })),
    ).toEqual(['operators[0].where.value']);
    expect(
      paths(withOp(0, { op: 'filter', where: { field: 'machine', op: '<', value: 'm' } })),
    ).toEqual(['operators[0].where.op']);
    expect(
      paths(
        withOp(0, {
          op: 'filter',
          where: {
            and: [
              { field: 'speed', op: '>', value: 1 },
              { field: 'speed', op: 'in', value: [1, 'two'] },
            ],
          },
        }),
      ),
    ).toEqual(['operators[0].where.and[1].value[1]']);
    expect(paths(withOp(0, { op: 'filter', where: { and: [] } }))).toEqual([
      'operators[0].where.and',
    ]);
    expect(paths(withOp(0, { op: 'filter', where: 'speed > 1' }))).toEqual(['operators[0].where']);
    expect(
      paths(withOp(0, { op: 'filter', where: { field: 'speed', op: '~', value: 1 } })),
    ).toEqual(['operators[0].where.op']);
  });

  it('operators out of order', () => {
    const s = spec();
    const [filter, window, agg] = s.operators;
    expect(paths({ ...s, operators: [window, filter, agg] })).toEqual(['operators[1]']);
    expect(paths({ ...s, operators: [filter, window, window, agg] })).toEqual(['operators[2]']);
    expect(paths({ ...s, operators: [filter, window, agg, filter] })).toEqual(['operators[3]']);
    expect(paths({ ...s, operators: [filter, agg] })).toEqual(['operators[1]']);
  });

  it('an aggregate whose field, p or groupBy doesn’t fit', () => {
    expect(paths(withOp(2, { op: 'aggregate', fn: 'avg', every: 1000 }))).toEqual([
      'operators[2].field',
    ]);
    expect(paths(withOp(2, { op: 'aggregate', fn: 'avg', field: 'machine', every: 1000 }))).toEqual(
      ['operators[2].field'],
    );
    expect(paths(withOp(2, { op: 'aggregate', fn: 'count', field: 'speed', every: 1000 }))).toEqual(
      ['operators[2].field'],
    );
    expect(
      paths(withOp(2, { op: 'aggregate', fn: 'percentile', field: 'speed', every: 1000 })),
    ).toEqual(['operators[2].p']);
    expect(
      paths(withOp(2, { op: 'aggregate', fn: 'max', p: 5, field: 'speed', every: 1000 })),
    ).toEqual(['operators[2].p']);
    expect(
      paths(
        withOp(2, { op: 'aggregate', fn: 'max', field: 'speed', every: 1000, groupBy: 'speed' }),
      ),
    ).toEqual(['operators[2].groupBy']);
    expect(paths(withOp(2, { op: 'aggregate', fn: 'max', field: 'speed', every: 10 }))).toEqual([
      'operators[2].every',
    ]);
  });

  it('a view that doesn’t draw what the pipeline gives', () => {
    const result = validateSpec(spec({ view: { type: 'heatmap', size: 'm' } }), CATALOG);
    expect(errors(result)['view.type']).toMatch(
      /heatmap view draws grid; this pipeline gives series/,
    );
  });

  it('view options the view doesn’t read, or that don’t fit', () => {
    const line = validateSpec(
      spec({ view: { type: 'line', size: 'm', options: { limit: 5 } } }),
      CATALOG,
    );
    expect(errors(line)['view.options.limit']).toMatch(/line view has no option "limit"/);
    const stat = validateSpec(
      spec({ view: { type: 'stat', size: 's', options: { gaugeMin: 10, gaugeMax: 5 } } }),
      CATALOG,
    );
    expect(errors(stat)['view.options.gaugeMax']).toMatch(/above gaugeMin/);
    const ok = validateSpec(
      spec({ view: { type: 'stat', size: 's', options: { gaugeMin: 0, gaugeMax: 120 } } }),
      CATALOG,
    );
    expect(ok.ok).toBe(true);
  });

  it('reports every error at once', () => {
    const s = spec();
    const result = validateSpec(
      {
        ...s,
        source: { topic: 'plant.scalars.v1', key: 'pump-9' },
        operators: [s.operators[0], { op: 'window', ms: 999_999 }, s.operators[2]],
        view: { type: 'table', size: 'm' },
      },
      CATALOG,
    );
    expect(Object.keys(errors(result)).toSorted()).toEqual([
      'operators[1].ms',
      'source.key',
      'view.type',
    ]);
  });
});

/** The error paths of the default spec with `burn` added last, on a `?chaos` page. */
function chaosPaths(burn: unknown): string[] {
  const s = spec();
  return Object.keys(
    errors(validateSpec({ ...s, operators: [...s.operators, burn] }, CATALOG, { chaos: true })),
  );
}

describe('burn, with ?chaos', () => {
  it('is a block or a load, not both and not neither', () => {
    expect(chaosPaths({ op: 'burn' })).toEqual(['operators[3]']);
    expect(chaosPaths({ op: 'burn', everyMs: 1000, forMs: 10, loadPct: 5 })).toEqual([
      'operators[3]',
    ]);
  });

  it('needs both halves of a block, shorter than its period', () => {
    expect(chaosPaths({ op: 'burn', everyMs: 1000 })).toEqual(['operators[3].forMs']);
    expect(chaosPaths({ op: 'burn', forMs: 100 })).toEqual(['operators[3].everyMs']);
    expect(chaosPaths({ op: 'burn', everyMs: 500, forMs: 500 })).toEqual(['operators[3].forMs']);
  });

  it('stays under the kill and a sane load', () => {
    expect(chaosPaths({ op: 'burn', everyMs: 10_000, forMs: 1_501 })).toEqual([
      'operators[3].forMs',
    ]);
    expect(chaosPaths({ op: 'burn', loadPct: 95 })).toEqual(['operators[3].loadPct']);
  });
});
