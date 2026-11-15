// The page's side of the native + workers build (M3f decision 2): every
// headless job in a plain worker of its own, on the same `core/` code as the
// Isoloop build's isolates, and the widgets on the main thread. The page's
// store is the hub: each worker's records go into it, and the streams a job
// reads are relayed to its worker. A worker that errors is replaced, and its
// `earliest` streams are relayed again from the store.
import type { EngineName } from '../core/engines';
import type { Exchange } from '../core/schemas';
import type { ReplayConfig } from '../core/services';
import type { StreamName, Streams } from '../core/streams';
import type { FromWorker, Start, ToWorker } from './protocol';
import { running } from './running';
import { store } from './store';

/** Vite bundles a worker only from `new Worker(new URL(...))` written out in full. */
const MAKE = {
  replay: (name: string) =>
    new Worker(new URL('./replay.worker.ts', import.meta.url), { type: 'module', name }),
  feed: (name: string) =>
    new Worker(new URL('./feed.worker.ts', import.meta.url), { type: 'module', name }),
  aggregator: (name: string) =>
    new Worker(new URL('./aggregator.worker.ts', import.meta.url), { type: 'module', name }),
  alerts: (name: string) =>
    new Worker(new URL('./alerts.worker.ts', import.meta.url), { type: 'module', name }),
  engine: (name: string) =>
    new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name }),
};

type Input = [stream: StreamName, from: 'earliest' | 'latest'];

/** What each job reads, as `core/services.ts` and `core/engines` subscribe. */
const INPUTS: Record<Start['job'], readonly Input[]> = {
  replay: [],
  feed: [],
  aggregator: [
    ['trades', 'latest'],
    ['prices', 'earliest'],
    ['filters', 'earliest'],
  ],
  alerts: [
    ['alertRules', 'earliest'],
    ['alerts', 'earliest'],
    ['prices', 'latest'],
    ['aggregates', 'latest'],
  ],
  engine: [],
};
const ENGINE_INPUTS: Record<EngineName, readonly Input[]> = {
  stats: [['trades', 'latest']],
  correlations: [['trades', 'latest']],
  depth: [['book', 'latest']],
};

/** The worker whose record the store is publishing now, so it isn't relayed back to it. */
let from: string | undefined;

function start(name: string, msg: Start): void {
  const w = MAKE[msg.job](name);
  const inputs = msg.job === 'engine' ? ENGINE_INPUTS[msg.engine] : INPUTS[msg.job];
  w.addEventListener('message', (e: MessageEvent<FromWorker>) => {
    const { stream, key, value } = e.data;
    from = name;
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the worker publishes `stream`'s records
      store.publish(stream, value as Streams[StreamName], key);
    } finally {
      from = undefined;
    }
  });
  const first: ToWorker = msg;
  w.postMessage(first);
  const relays = inputs.map(([stream, at]) =>
    store.subscribe(
      stream,
      (r) => {
        if (from === name) return;
        const m: ToWorker =
          r.key === undefined
            ? { type: 'record', stream, value: r.value }
            : { type: 'record', stream, key: r.key, value: r.value };
        w.postMessage(m);
      },
      at,
    ),
  );
  w.addEventListener('error', () => {
    for (const off of relays) off();
    w.terminate();
    running.delete(name);
    setTimeout(() => {
      start(name, msg);
    }, 250);
  });
  running.set(name, w);
}

export interface Jobs {
  /** The live feeds' exchanges, or the replay's settings. */
  source: { live: readonly Exchange[] } | { replay: ReplayConfig };
  engines: readonly EngineName[];
}

/** Starts every job in its own worker: the sources, the aggregator, the alerts, the engines. */
export function startWorkers(j: Jobs): void {
  if ('live' in j.source) {
    for (const exchange of j.source.live) {
      start(`feed-${exchange}`, { type: 'start', job: 'feed', exchange });
    }
  } else {
    start('replay', { type: 'start', job: 'replay', config: j.source.replay });
  }
  start('aggregator', { type: 'start', job: 'aggregator' });
  start('alerts', { type: 'start', job: 'alerts' });
  for (const engine of j.engines) {
    start(`engine-${engine}`, { type: 'start', job: 'engine', engine });
  }
}
