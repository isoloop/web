// The interactive page's headless isolates: the replay source at the page's
// size, the aggregator and the rolling-stats engine, the three the catalog's
// topics come from. Each in its own worker, as on markets' page. No live
// feeds, alerts, correlations or depth: the page offers nothing they make.
import type { Grants } from '@isoloop/protocol';
import type { ReplayConfig } from '../core/services';
import aggregator from '../isolates/aggregator?isolate';
import stats from '../isolates/engines/stats?isolate';
import replay from '../isolates/replay?isolate';

export interface Job {
  id: string;
  src: string;
  grants: Grants;
  config?: unknown;
}

export function jobs(config: ReplayConfig): Job[] {
  return [
    {
      id: 'replay',
      src: replay,
      config,
      grants: { publish: ['trades.v1', 'book.v1', 'prices.v1'], subscribe: [] },
    },
    {
      id: 'aggregator',
      src: aggregator,
      grants: { publish: ['aggregates.v1'], subscribe: ['trades.v1', 'prices.v1', 'filters.v1'] },
    },
    {
      id: 'engine-stats',
      src: stats,
      grants: { publish: ['stats.v1', 'timings.v1'], subscribe: ['trades.v1'] },
    },
  ];
}
