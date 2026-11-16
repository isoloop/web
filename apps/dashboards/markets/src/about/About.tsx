// "About this demo" (M3b task 19): what runs where, drawn with each isolate's
// live state on Isoloop (and each data worker on native + workers), and what
// a backend-less app can't do.
import { BUILD } from '#env';
import { buildMetrics } from '#metrics';
import { CURRENT } from '../builds';
import { placementFrom } from '../url';
import { useEffect, useState } from 'react';

type Node = { id: string; label: string };

const cores: number | null =
  typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;

const SOURCES: Node[] = [
  { id: 'replay', label: 'Replay (recorded ticks)' },
  { id: 'feed-coinbase', label: 'Coinbase' },
  { id: 'feed-kraken', label: 'Kraken' },
  { id: 'feed-bitstamp', label: 'Bitstamp' },
  { id: 'feed-okx', label: 'OKX' },
];
const SERVICES: Node[] = [
  { id: 'aggregator', label: 'Aggregator: VWAP, spreads, volume' },
  { id: 'alerts', label: 'Alerts: rules against prices' },
];
const WIDGETS: Node[] = [
  { id: 'filters', label: 'Filters' },
  { id: 'price', label: 'Price chart' },
  { id: 'spread', label: 'Spread chart' },
  { id: 'volume', label: 'Volume chart' },
  { id: 'trades', label: 'Trades table' },
  { id: 'alerts-panel', label: 'Alerts panel' },
];
const TOPICS = [
  'trades.v1',
  'book.v1',
  'prices.v1',
  'aggregates.v1',
  'alert-rules.v1',
  'alerts.v1',
  'filters.v1',
];

function Column({
  title,
  nodes,
  states,
}: {
  title: string;
  nodes: Node[];
  states: Record<string, string> | null;
}) {
  return (
    <div className="about-col">
      <h3>{title}</h3>
      <ul>
        {nodes
          .filter((n) => states === null || n.id in states || !n.id.startsWith('feed-'))
          .map((n) => {
            // On native + workers, what isn't in a worker is on the main thread.
            const state =
              states === null
                ? 'main thread'
                : (states[n.id] ?? (BUILD === 'native' ? 'main thread' : 'not started'));
            return (
              <li key={n.id} data-node={n.id}>
                {n.label}{' '}
                <span className="state" data-state={state}>
                  {state}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

const placement = placementFrom(new URLSearchParams(location.search));

/** What this build runs where, in a sentence. */
const INTRO =
  CURRENT === 'native-workers'
    ? 'In this build the sources, the services and the engines each run in a worker of their own, and the widgets on the main thread; they talk through the page.'
    : CURRENT === 'native-mixed'
      ? 'In this build the sources, the services and the engines each run in a worker of their own, and the widgets on the main thread; the filters and the alerts panel are another team’s Preact part, loaded at run time.'
      : BUILD === 'native'
        ? 'In this build everything shares the main thread.'
        : placement === 'own'
          ? 'In this build each box below is an isolate with its own event loop, talking over topics.'
          : placement === 'matched'
            ? 'In this build each box below is an isolate talking over topics; the sources, services and engines each have a worker of their own, and the widgets share one pool’s event loop.'
            : 'In this build each box below is an isolate talking over topics; all of them share one pool’s event loop.';

export function About() {
  const [states, setStates] = useState(() => buildMetrics.states());
  useEffect(() => {
    const id = setInterval(() => setStates(buildMetrics.states()), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <details className="about">
      <summary>About this demo</summary>
      <p>
        Everything runs in your tab, served as static files: no backend. The feeds are public
        exchange WebSockets (or a recording, by default), and the aggregates and alerts are computed
        here. {INTRO}
      </p>
      <div className="about-pipeline">
        <Column title="Sources" nodes={SOURCES} states={states} />
        <div className="about-col">
          <h3>Topics</h3>
          <ul>
            {TOPICS.map((t) => (
              <li key={t}>
                <code>{t}</code>
              </li>
            ))}
          </ul>
        </div>
        <Column title="Services" nodes={SERVICES} states={states} />
        <Column title="Widgets" nodes={WIDGETS} states={states} />
      </div>
      <h3>What this approach can't do</h3>
      <ul>
        <li>No keys of your own: only public, unauthenticated APIs.</li>
        <li>Upstream APIs must allow calls from a browser (CORS, WebSocket origins).</li>
        <li>Alerts fire only while a tab is open.</li>
        <li>Each tab opens its own set of connections; tabs don't share feeds.</li>
      </ul>
      <h3>Threads and limits</h3>
      <ul>
        <li data-about="cores">
          This device reports {cores ?? 'an unknown number of'} logical cores.
          {cores !== null && cores < 4
            ? ' With fewer than 4, Isoloop has little room to move work off the main thread.'
            : ''}
        </li>
        <li>
          Heavy runs 30 isolates. On a worker each (<code>?placement=own</code>) that is within the
          soft budget of 32 workers (ADR 0001); <code>?placement=matched</code> pools the widgets
          into one worker, and <code>?placement=one</code> puts every isolate in one.
        </li>
      </ul>
    </details>
  );
}
