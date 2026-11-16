// A small catalog for the tests, shaped like plant's slow signals.
import type { Catalog, CatalogTopic, Rec } from './catalog';
import type { WidgetSpec } from './spec/types';

export const SCALARS: CatalogTopic = {
  name: 'plant.scalars.v1',
  title: 'Slow signals',
  key: { label: 'Machine', values: ['pump-1', 'pump-2', 'press-1'] },
  fields: [
    { name: 'machine', type: 'string', label: 'Machine' },
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'speed', type: 'number', label: 'Speed', unit: 'rpm' },
    { name: 'bearingTemp', type: 'number', label: 'Bearing temperature', unit: '°C' },
  ],
  history: 120_000,
  time: 'ts',
};

export const EVENTS: CatalogTopic = {
  name: 'plant.events.v1',
  title: 'Events',
  fields: [
    { name: 'kind', type: 'string' },
    { name: 'level', type: 'number' },
  ],
  history: 60_000,
};

export const CATALOG: Catalog = { topics: [SCALARS, EVENTS] };

export function rec(t: number, key: string, value: Record<string, unknown>): Rec {
  return { key, t, value };
}

export function spec(over: Partial<WidgetSpec> = {}): WidgetSpec {
  return {
    id: 'w1',
    title: 'Pump 1 bearing p95',
    source: { topic: 'plant.scalars.v1', key: 'pump-1' },
    operators: [
      { op: 'filter', where: { field: 'speed', op: '>', value: 0 } },
      { op: 'window', ms: 60_000 },
      { op: 'aggregate', fn: 'percentile', p: 95, field: 'bearingTemp', every: 1000 },
    ],
    view: { type: 'line', size: 'm' },
    placement: { mode: 'manual', pool: 'pool-1' },
    ...over,
  };
}
