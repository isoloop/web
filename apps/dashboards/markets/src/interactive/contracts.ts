// The interactive page's topics (M3e decision 3): what its replay, aggregator
// and stats engine use, and the creator's three. The offered topics keep a
// time window here (catalog.ts, KEEP_MS), not a count as on markets' page, so
// a widget's window means the same at every size. No alerts: the page runs no
// rules, and markets' page keeps its alerts in OPFS, which this page, on the
// same origin, doesn't write to.
import { contracts, topic } from '@isoloop/bus';
import { creatorTopics } from 'creator/topics';
import type { z } from 'zod';
import * as s from '../core/schemas';
import { AGGREGATES, KEEP_MS, PRICES, STATS, TRADES } from './catalog';

const time = (ms: number) => ({ retention: { kind: 'time' as const, ms } });

export default contracts(
  topic(TRADES.name, { schema: s.trade, ...time(KEEP_MS.trades) }),
  topic('book.v1', { schema: s.book, retention: { kind: 'last-n', n: 200 } }),
  /** Keyed `exchange:symbol`; the aggregator reads it from the start. */
  topic(PRICES.name, { schema: s.quote, ...time(KEEP_MS.prices) }),
  topic(AGGREGATES.name, { schema: s.aggregate, ...time(KEEP_MS.aggregates) }),
  topic(STATS.name, { schema: s.stats, ...time(KEEP_MS.stats) }),
  /** Keyed `current`; the aggregator reads its window. */
  topic('filters.v1', { schema: s.filters, retention: { kind: 'compacted' } }),
  /** The stats engine's time (engineMeter). */
  topic('timings.v1', { schema: s.timing, retention: { kind: 'last-n', n: 600 } }),
  ...creatorTopics(),
);

/** For the catalog test: the schema behind each topic the catalog offers. */
export const OFFERED: Record<string, z.ZodObject> = {
  [TRADES.name]: s.trade,
  [PRICES.name]: s.quote,
  [AGGREGATES.name]: s.aggregate,
  [STATS.name]: s.stats,
};
