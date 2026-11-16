// The harness's one source topic, as a catalog entry. No Zod: the page and
// the isolate both import it.
import type { Catalog, CatalogTopic } from '../../src/catalog';
import type { WidgetSpec } from '../../src/spec/types';

export const SOURCE: CatalogTopic = {
  name: 'test.scalars.v1',
  title: 'Test signals',
  key: { label: 'Machine', values: ['m1', 'm2'] },
  fields: [
    { name: 'ts', type: 'time' },
    { name: 'temp', type: 'number', label: 'Temperature', unit: '°C' },
  ],
  history: 120_000,
  time: 'ts',
};

export const OTHER: CatalogTopic = { ...SOURCE, name: 'test.other.v1', title: 'Other' };

export const CATALOG: Catalog = { topics: [SOURCE, OTHER] };

/** The board's starters: a line in pool 1 and a stat in pool 2. */
export const STARTERS: WidgetSpec[] = [
  {
    id: 's1',
    title: 'm1 average',
    source: { topic: SOURCE.name, key: 'm1' },
    operators: [
      { op: 'window', ms: 10_000 },
      { op: 'aggregate', fn: 'avg', field: 'temp', every: 250 },
    ],
    view: { type: 'line', size: 'm' },
    placement: { mode: 'manual', pool: 'pool-1' },
  },
  {
    id: 's2',
    title: 'm2 max',
    source: { topic: SOURCE.name, key: 'm2' },
    operators: [
      { op: 'window', ms: 10_000 },
      { op: 'aggregate', fn: 'max', field: 'temp' },
    ],
    view: { type: 'stat', size: 's' },
    placement: { mode: 'manual', pool: 'pool-2' },
  },
];
