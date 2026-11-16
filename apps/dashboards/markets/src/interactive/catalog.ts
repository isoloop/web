// The markets topics the interactive page offers to the widgets users create
// (M3e decision 18), written by hand. No Zod: the page and the isolates both
// import it; catalog.test.ts checks it against the schemas and the page's
// retention (contracts.ts).
//
// Every topic already carries all symbols and exchanges, so none is merged:
// a widget filters or groups by `symbol` or `exchange`. Prices are keyed
// `exchange:symbol`, so a widget may also pick one market (`source.key`).
// The arrays (books, depth, correlation matrices, volume profiles) are left
// out: they aren't fields.
import type { Catalog, CatalogTopic } from 'creator';
import { EXCHANGES, SYMBOLS } from '../core/symbols';

/** How long the page keeps each offered topic, in ms (its retention in contracts.ts). */
export const KEEP_MS = {
  trades: 30_000,
  prices: 60_000,
  aggregates: 120_000,
  stats: 120_000,
} as const;

export const TRADES: CatalogTopic = {
  name: 'trades.v1',
  title: 'Trades (every exchange and symbol)',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'exchange', type: 'string', label: 'Exchange' },
    { name: 'symbol', type: 'string', label: 'Symbol' },
    { name: 'price', type: 'number', label: 'Price', unit: 'USD' },
    { name: 'size', type: 'number', label: 'Size' },
    { name: 'side', type: 'string', label: 'Side' },
  ],
  history: KEEP_MS.trades,
  time: 'ts',
};

export const PRICES: CatalogTopic = {
  name: 'prices.v1',
  title: 'Prices (top of book, per exchange and symbol)',
  key: {
    label: 'Market',
    values: EXCHANGES.flatMap((e) => SYMBOLS.map((s) => `${e}:${s}`)),
  },
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'exchange', type: 'string', label: 'Exchange' },
    { name: 'symbol', type: 'string', label: 'Symbol' },
    { name: 'last', type: 'number', label: 'Last price', unit: 'USD' },
    { name: 'bid', type: 'number', label: 'Bid', unit: 'USD' },
    { name: 'ask', type: 'number', label: 'Ask', unit: 'USD' },
  ],
  history: KEEP_MS.prices,
  time: 'ts',
};

export const AGGREGATES: CatalogTopic = {
  name: 'aggregates.v1',
  title: 'Cross-market figures (per symbol, every second)',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'symbol', type: 'string', label: 'Symbol' },
    { name: 'vwap', type: 'number', label: 'VWAP', unit: 'USD' },
    { name: 'spread', type: 'number', label: 'Spread', unit: 'USD' },
    { name: 'volume', type: 'number', label: 'Volume' },
  ],
  history: KEEP_MS.aggregates,
  time: 'ts',
};

export const STATS: CatalogTopic = {
  name: 'stats.v1',
  title: 'Rolling stats (per symbol, every second)',
  fields: [
    { name: 'ts', type: 'time', label: 'Time' },
    { name: 'symbol', type: 'string', label: 'Symbol' },
    { name: 'vwap', type: 'number', label: 'VWAP', unit: 'USD' },
    { name: 'volatility', type: 'number', label: 'Volatility' },
    { name: 'volume', type: 'number', label: 'Volume' },
    { name: 'trades', type: 'number', label: 'Trades' },
    { name: 'lo', type: 'number', label: 'Low', unit: 'USD' },
    { name: 'hi', type: 'number', label: 'High', unit: 'USD' },
  ],
  history: KEEP_MS.stats,
  time: 'ts',
};

export const CATALOG: Catalog = { topics: [TRADES, PRICES, AGGREGATES, STATS] };
