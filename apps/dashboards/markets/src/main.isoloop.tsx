import { createRoot } from 'react-dom/client';
import aggregator from './isolates/aggregator?isolate';
import alertsIsolate from './isolates/alerts?isolate';
import bitstamp from './isolates/feeds/bitstamp?isolate';
import coinbase from './isolates/feeds/coinbase?isolate';
import kraken from './isolates/feeds/kraken?isolate';
import okx from './isolates/feeds/okx?isolate';
import replay from './isolates/replay?isolate';
import { filters as filtersTopic } from './isoloop/contracts';
import { ENGINE_ISOLATES } from './isoloop/engines';
import { kernel } from './isoloop/kernel';
import { poolOf } from './placement';
import { Page } from './page';
import { replayFor, specFrom } from './sizes/sizes';
import { filtersFrom, placementFrom, startReplayClock, writeFilters } from './url';
import './page.css';

declare global {
  interface Window {
    /** For the E2E suite. */
    kernel: typeof kernel;
  }
}
window.kernel = kernel;

// The headless pipeline: a feed isolate per exchange (`?source=live`) or the
// replay source (`?speed=10` for 10×), then the aggregator and the alerts, in
// the placement's pools (M3f decision 3).
const params = new URLSearchParams(location.search);
const pool = poolOf(placementFrom(params), 'data');
const placed = pool === undefined ? {} : { pool };
const feedGrants = { publish: ['trades.v1', 'book.v1', 'prices.v1'], subscribe: [] };
if (params.get('source') === 'live') {
  for (const [name, src] of Object.entries({ coinbase, kraken, bitstamp, okx })) {
    kernel.spawn({ id: `feed-${name}`, src, grants: feedGrants, ...placed });
  }
} else {
  const config = replayFor(params);
  kernel.spawn({ id: 'replay', src: replay, config, grants: feedGrants, ...placed });
  startReplayClock(config);
}
// Filters from the URL (after a switch), and back into it as they change.
const initial = filtersFrom(params);
if (initial) void kernel.publish(filtersTopic, { key: 'current', value: initial });
kernel.subscribe(
  filtersTopic,
  (r) => {
    writeFilters(r.value);
  },
  { from: 'latest' },
);
// Both also answer the page's agent tools (`tools: true`, M4a).
kernel.spawn({
  id: 'aggregator',
  src: aggregator,
  config: { tools: true },
  grants: {
    publish: ['aggregates.v1'],
    subscribe: ['trades.v1', 'prices.v1', 'filters.v1', 'markets.quote.v1'],
  },
  ...placed,
});
kernel.spawn({
  id: 'alerts',
  src: alertsIsolate,
  config: { tools: true },
  grants: {
    publish: ['alerts.v1', 'alert-rules.v1'],
    subscribe: [
      'alert-rules.v1',
      'alerts.v1',
      'prices.v1',
      'aggregates.v1',
      'markets.alerts.create.v1',
    ],
  },
  ...placed,
});

// In development only, the page pairs with `isoloop mcp`, so a coding agent
// can see the isolates and call the tools above (M4a, ADR 0018 decision 8).
// @isoloop/vite fails a production build that still contains it.
if (import.meta.env.DEV) {
  const token = import.meta.env.VITE_ISOLOOP_MCP_TOKEN;
  const url = import.meta.env.VITE_ISOLOOP_MCP_URL;
  if (token) {
    void import('@isoloop/host/dev-mcp').then(({ connectDevMCP }) => {
      connectDevMCP(kernel, { token, title: 'markets', ...(url ? { url } : {}) });
    });
  }
}

// The size's shared engines, as headless isolates (M3c decision 6).
for (const name of specFrom(params).engines) {
  const { src, grants } = ENGINE_ISOLATES[name];
  kernel.spawn({ id: `engine-${name}`, src, grants, ...placed });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(<Page />);
