import { describe, expect, it } from 'vitest';
import { CATALOG, spec } from '../test-fixtures';
import { validateSpec } from '../spec/validate';
import { drawerConfig } from './config';
import {
  autoTitle,
  emptyForm,
  fieldOfPath,
  fitView,
  formOfSpec,
  kindOf,
  operatorsOf,
  specOfForm,
  viewsFor,
  withTopic,
  type FormState,
} from './form';

const form = (over: Partial<FormState> = {}): FormState => ({
  ...emptyForm(CATALOG, 'w1', 'pool-1'),
  ...over,
});

const valid = (f: FormState) => validateSpec(specOfForm(f, CATALOG), CATALOG);

describe('the drawer form', () => {
  it('starts valid: the first topic’s records in a table', () => {
    const f = form();
    const r = valid(f);
    expect(r.ok).toBe(true);
    expect(specOfForm(f, CATALOG)).toMatchObject({
      id: 'w1',
      title: 'Slow signals',
      source: { topic: 'plant.scalars.v1' },
      operators: [],
      view: { type: 'table', size: 'm' },
      placement: { mode: 'manual', pool: 'pool-1' },
    });
  });

  it('builds the operators in validateSpec’s order, with seconds as ms', () => {
    const f = form({
      filters: [
        { field: 'speed', op: '>', value: '0', not: false },
        { field: '$key', op: 'in', value: 'pump-1, pump-2', not: true },
      ],
      join: 'or',
      windowBy: 'seconds',
      windowValue: '30',
      fn: 'percentile',
      field: 'bearingTemp',
      p: '95',
      every: '1',
      groupBy: 'machine',
    });
    expect(operatorsOf(f, CATALOG)).toEqual([
      {
        op: 'filter',
        where: {
          or: [
            { field: 'speed', op: '>', value: 0 },
            { not: { field: '$key', op: 'in', value: ['pump-1', 'pump-2'] } },
          ],
        },
      },
      { op: 'window', ms: 30_000 },
      {
        op: 'aggregate',
        fn: 'percentile',
        field: 'bearingTemp',
        p: 95,
        every: 1000,
        groupBy: 'machine',
      },
    ]);
    expect(kindOf(f, CATALOG)).toBe('grid');
    expect(valid(fitView(f, CATALOG)).ok).toBe(true);
  });

  it('round-trips a spec: edit opens what was saved', () => {
    const s = spec();
    const f = formOfSpec(s, CATALOG);
    expect(specOfForm(f, CATALOG)).toEqual(s);
    const counted = spec({
      operators: [
        { op: 'window', n: 100 },
        { op: 'aggregate', fn: 'count' },
      ],
      view: { type: 'stat', size: 's', options: { gaugeMin: 0, gaugeMax: 100 } },
    });
    expect(specOfForm(formOfSpec(counted, CATALOG), CATALOG)).toEqual(counted);
  });

  it('offers only the views that draw the output, and keeps a chosen one that does', () => {
    expect(viewsFor('scalar')).toEqual(['stat']);
    expect(viewsFor('series')).toEqual(['line', 'bar', 'stat']);
    const f = fitView(form({ windowBy: 'seconds', fn: 'avg' }), CATALOG);
    expect(f.view).toBe('stat');
    const g = fitView({ ...f, every: '1', view: 'bar' }, CATALOG);
    expect(g.view).toBe('bar');
  });

  it('a new topic keeps what still fits and drops what doesn’t', () => {
    const f = form({
      key: 'pump-1',
      filters: [{ field: 'speed', op: '>', value: '0', not: false }],
      groupBy: 'machine',
    });
    const g = withTopic(f, CATALOG, 'plant.events.v1');
    expect(g).toMatchObject({
      topic: 'plant.events.v1',
      key: '',
      filters: [],
      groupBy: '',
      field: 'level',
    });
  });

  it('makes a title from the choices when none is given', () => {
    expect(
      autoTitle(form({ fn: 'percentile', p: '95', field: 'bearingTemp', key: 'pump-1' }), CATALOG),
    ).toBe('p95 Bearing temperature · pump-1');
    expect(autoTitle(form({ fn: 'count', groupBy: '$key' }), CATALOG)).toBe('count · by Machine');
    expect(specOfForm(form({ title: '  Mine ' }), CATALOG).title).toBe('Mine');
  });

  it('puts each validateSpec error on its field', () => {
    const f = form({
      filters: [
        { field: 'speed', op: '>', value: '0', not: false },
        { field: 'machine', op: '>', value: 'x', not: false },
      ],
      windowBy: 'seconds',
      windowValue: '999',
      fn: 'percentile',
      p: '95',
      view: 'stat',
      gaugeMin: '5',
    });
    const r = valid(f);
    if (r.ok) throw new Error('expected errors');
    const fields = new Set(r.errors.map((e) => fieldOfPath(e.path, f)));
    expect(fields).toEqual(new Set(['row-1', 'window', 'gauge']));
    // A shape error (p out of range) comes on its own, before the catalog checks.
    const bad = { ...f, p: '0' };
    const r2 = valid(bad);
    if (r2.ok) throw new Error('expected errors');
    expect(new Set(r2.errors.map((e) => fieldOfPath(e.path, bad)))).toEqual(new Set(['p']));
  });

  it('maps paths whatever operators the form has', () => {
    const none = form({ fn: 'avg' });
    expect(fieldOfPath('operators[0]', none)).toBe('window');
    expect(fieldOfPath('operators[0].field', none)).toBe('field');
    const windowed = form({ windowBy: 'count', fn: 'avg' });
    expect(fieldOfPath('operators[0].n', windowed)).toBe('window');
    expect(fieldOfPath('operators[1].every', windowed)).toBe('every');
    const one = form({ filters: [{ field: 'speed', op: '>', value: 'x', not: true }] });
    expect(fieldOfPath('operators[0].where.not.value', one)).toBe('row-0');
    expect(fieldOfPath('title', one)).toBe('title');
    expect(fieldOfPath('source.key', one)).toBe('key');
    expect(fieldOfPath('view.type', one)).toBe('view');
    expect(fieldOfPath('placement.pool', one)).toBe('pool');
    expect(fieldOfPath('id', one)).toBe('form');
  });
});

describe('drawerConfig', () => {
  it('takes a catalog, native and a cap, and names what’s wrong', () => {
    expect(drawerConfig({ catalog: CATALOG, native: true, cap: 24 })).toEqual({
      catalog: CATALOG,
      native: true,
      cap: 24,
    });
    expect(() => drawerConfig({ catalog: CATALOG, native: 'no', cap: 24 })).toThrow(/native/);
    expect(() => drawerConfig({ catalog: {}, native: true, cap: 24 })).toThrow(/catalog/);
    expect(() => drawerConfig({ catalog: CATALOG, native: true, cap: 0 })).toThrow(/cap/);
  });
});
