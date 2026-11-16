// The interactive page's starter widgets (M3e decision 4): specs like any the
// user adds, so they can be edited or deleted. All five views, in two pools.
// starters.test.ts checks each against the catalog.
import type { WidgetSpec } from 'creator';
import { ALARMS, FLEET, HEALTH, SCALARS, SPECTRUM } from './catalog';

const pool = (n: 1 | 2) => ({ mode: 'manual' as const, pool: `pool-${n}` });

export const STARTERS: WidgetSpec[] = [
  {
    // The heaviest: a 95th percentile per machine over 2 minutes, every second.
    id: 'bearing-p95',
    title: 'Bearing temp p95 by machine (2 min)',
    source: { topic: SCALARS.name },
    operators: [
      { op: 'window', ms: 120_000 },
      {
        op: 'aggregate',
        fn: 'percentile',
        p: 95,
        field: 'bearingTemp',
        every: 1_000,
        groupBy: '$key',
      },
    ],
    view: { type: 'line', size: 'l' },
    placement: pool(1),
  },
  {
    id: 'vib-heatmap',
    title: 'Vibration RMS by machine',
    source: { topic: SPECTRUM.name },
    operators: [
      { op: 'window', ms: 30_000 },
      { op: 'aggregate', fn: 'avg', field: 'rms', every: 1_000, groupBy: '$key' },
    ],
    view: { type: 'heatmap', size: 'm' },
    placement: pool(2),
  },
  {
    id: 'plant-power',
    title: 'Plant power',
    source: { topic: FLEET.name },
    operators: [
      { op: 'window', ms: 60_000 },
      { op: 'aggregate', fn: 'last', field: 'totalPower', every: 2_000 },
    ],
    view: { type: 'bar', size: 'm' },
    placement: pool(1),
  },
  {
    id: 't1-exhaust',
    title: 'T1 exhaust temp, max over 30 s',
    source: { topic: SCALARS.name, key: 'T1' },
    operators: [
      { op: 'filter', where: { field: 'speed', op: '>', value: 0 } },
      { op: 'window', ms: 30_000 },
      { op: 'aggregate', fn: 'max', field: 'exhaustTemp' },
    ],
    view: { type: 'stat', size: 's', options: { gaugeMin: 0, gaugeMax: 600 } },
    placement: pool(2),
  },
  {
    id: 'health-scores',
    title: 'Health score by machine',
    source: { topic: HEALTH.name },
    operators: [
      { op: 'window', ms: 10_000 },
      { op: 'aggregate', fn: 'last', field: 'score', groupBy: '$key' },
    ],
    view: { type: 'table', size: 's' },
    placement: pool(2),
  },
  {
    id: 'active-alarms',
    title: 'Active alarms',
    source: { topic: ALARMS.name },
    operators: [{ op: 'filter', where: { field: 'state', op: '==', value: 'active' } }],
    view: { type: 'table', size: 'm', options: { limit: 20 } },
    placement: pool(1),
  },
];
