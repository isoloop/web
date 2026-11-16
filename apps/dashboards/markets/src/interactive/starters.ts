// The interactive page's starter widgets (M3e decision 4): specs like any the
// user adds, so they can be edited or deleted. All five views, in two pools.
// starters.test.ts checks each against the catalog.
import type { WidgetSpec } from 'creator';
import { AGGREGATES, PRICES, STATS, TRADES } from './catalog';

const pool = (n: 1 | 2) => ({ mode: 'manual' as const, pool: `pool-${n}` });

export const STARTERS: WidgetSpec[] = [
  {
    // The heaviest: every trade of every symbol, counted per exchange each second.
    id: 'trades-by-exchange',
    title: 'Trades per 30 s by exchange',
    source: { topic: TRADES.name },
    operators: [
      { op: 'window', ms: 30_000 },
      { op: 'aggregate', fn: 'count', every: 1_000, groupBy: 'exchange' },
    ],
    view: { type: 'line', size: 'l' },
    placement: pool(1),
  },
  {
    id: 'volatility-heatmap',
    title: 'Volatility by symbol',
    source: { topic: STATS.name },
    operators: [
      { op: 'window', ms: 60_000 },
      { op: 'aggregate', fn: 'last', field: 'volatility', every: 2_000, groupBy: 'symbol' },
    ],
    view: { type: 'heatmap', size: 'm' },
    placement: pool(2),
  },
  {
    id: 'btc-volume',
    title: 'BTC volume',
    source: { topic: AGGREGATES.name },
    operators: [
      { op: 'filter', where: { field: 'symbol', op: '==', value: 'BTC-USD' } },
      { op: 'window', ms: 60_000 },
      { op: 'aggregate', fn: 'last', field: 'volume', every: 2_000 },
    ],
    view: { type: 'bar', size: 'm' },
    placement: pool(1),
  },
  {
    id: 'btc-coinbase-high',
    title: 'BTC on Coinbase, high over 30 s',
    source: { topic: PRICES.name, key: 'coinbase:BTC-USD' },
    operators: [
      { op: 'window', ms: 30_000 },
      { op: 'aggregate', fn: 'max', field: 'last' },
    ],
    view: { type: 'stat', size: 's' },
    placement: pool(2),
  },
  {
    id: 'vwap-by-symbol',
    title: 'VWAP by symbol',
    source: { topic: AGGREGATES.name },
    operators: [
      { op: 'window', ms: 10_000 },
      { op: 'aggregate', fn: 'last', field: 'vwap', groupBy: 'symbol' },
    ],
    view: { type: 'table', size: 's' },
    placement: pool(2),
  },
  {
    id: 'btc-trades',
    title: 'BTC trades',
    source: { topic: TRADES.name },
    operators: [{ op: 'filter', where: { field: 'symbol', op: '==', value: 'BTC-USD' } }],
    view: { type: 'table', size: 'm', options: { limit: 20 } },
    placement: pool(1),
  },
];
