// The harness's one source topic, as a catalog entry. No Zod: the page and
// the isolate both import it.
import type { CatalogTopic } from '../../src/catalog';

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
