// The dashboard's topics (ADR 0003). The bus worker imports this module by URL
// to validate; the host imports it for `contracts.list`; isolates import it for
// the topic refs. The schemas themselves are shared with the native build.
import { contracts, topic } from '@isoloop/bus';
import * as s from '../core/schemas';

export const trades = topic('trades.v1', {
  schema: s.trade,
  retention: { kind: 'last-n', n: 20_000 },
});

export const book = topic('book.v1', {
  schema: s.book,
  retention: { kind: 'last-n', n: 200 },
});

/** Keyed `exchange:symbol`. */
export const prices = topic('prices.v1', {
  schema: s.quote,
  retention: { kind: 'compacted' },
});

export const aggregates = topic('aggregates.v1', {
  schema: s.aggregate,
  retention: { kind: 'last-n', n: 2_000 },
});

/** Keyed by rule id; persistent, so rules survive a reload (M2b). */
export const alertRules = topic('alert-rules.v1', {
  schema: s.alertRule,
  retention: { kind: 'compacted' },
  durability: 'persistent',
});

export const alerts = topic('alerts.v1', {
  schema: s.alert,
  retention: { kind: 'last-n', n: 500 },
  durability: 'persistent',
});

/** Keyed `current`. */
export const filters = topic('filters.v1', {
  schema: s.filters,
  retention: { kind: 'compacted' },
});

/** The stress controls' flood: memory, the last 100. */
export const noise = topic('noise.v1', {
  schema: s.noise,
  retention: { kind: 'last-n', n: 100 },
});

/** The rolling-stats engine's output (M3c task 3): 20 symbols a second. */
export const stats = topic('stats.v1', {
  schema: s.stats,
  retention: { kind: 'last-n', n: 2_000 },
});

/** The correlations engine's output (M3c task 4): a matrix per horizon, once a second. */
export const correlations = topic('correlations.v1', {
  schema: s.correlations,
  retention: { kind: 'last-n', n: 30 },
});

/** The depth engine's output (M3c task 5): one record per symbol a second. */
export const depth = topic('depth.v1', {
  schema: s.depth,
  retention: { kind: 'last-n', n: 2_400 },
});

/** Time per widget and engine, once a second each (M3c task 10). */
export const timings = topic('timings.v1', {
  schema: s.timing,
  retention: { kind: 'last-n', n: 600 },
});

/**
 * Tools for agents (M4a, ADR 0018): requestable topics the kernel exposes
 * (`agents.expose` in kernel.ts) to the dev MCP and, later, WebMCP. The tool's
 * name is the topic's name.
 */
export const quoteTool = topic('markets.quote.v1', {
  schema: s.quoteRequest,
  reply: s.quoteReply,
  retention: { kind: 'last-n', n: 100 },
  tool: {
    title: 'Quote',
    description:
      "The latest figures for one symbol: VWAP, cross-market spread and volume over the dashboard's window (null with no trades in it), and each exchange's last, bid and ask.",
    readOnly: true,
  },
});

export const createAlertTool = topic('markets.alerts.create.v1', {
  schema: s.alertCreate,
  reply: s.alertCreated,
  retention: { kind: 'last-n', n: 100 },
  tool: {
    title: 'Create an alert',
    description:
      "Adds an alert rule: fire when the symbol's metric (price, vwap or spread) goes above or below the threshold, or at once if it's already past it. price is any exchange's last trade: the rule fires once, and again only after no exchange has been past the threshold for 10 s. vwap and spread are cross-market, and fire on each crossing. The rule shows in the alerts panel and is kept across reloads. Returns the rule's id.",
    readOnly: false,
    consequential: true,
  },
});

/** The tools agents may call (`agents.expose` in kernel.ts): the aggregator's quote and the alerts isolate's create. */
export const EXPOSED = [quoteTool.name, createAlertTool.name];

export default contracts(
  trades,
  book,
  prices,
  aggregates,
  alertRules,
  alerts,
  filters,
  noise,
  stats,
  correlations,
  depth,
  timings,
  quoteTool,
  createAlertTool,
);
