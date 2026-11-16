// A minimal Isoloop page for the widget isolate's E2E test (M3e task 4): a
// kernel with the creator topics and a source topic fed from the host, and
// window.harness for the test to drive. With `?board=isoloop` it also mounts
// the interactive board (task 5); `?board=native` is the native page, with
// no kernel at all (board-native.tsx).
import { createKernel, type IsolateHandle } from '@isoloop/host';
import { CreatorBoard, isoloopRuntime, type BoardController } from '../../src/board';
import drawerSrc from '../../src/drawer/isolate.tsx?isolate';
import type { TopicRef } from '@isoloop/protocol';
import { createRoot } from 'react-dom/client';
import workers from 'virtual:isoloop/workers';
import type { WidgetSpec } from '../../src/spec/types';
import {
  isolateBus,
  NativeWidget,
  spawnWidget,
  specRecord,
  TOMBSTONE,
  type WidgetMode,
} from '../../src/widget';
import widgetSrc from '../../src/widget/isolate.tsx?isolate';
import { CATALOG, OTHER, SOURCE, STARTERS } from './catalog';
import list from './contracts';
import contractsUrl from './contracts?isolate';

const kernel = createKernel({ contracts: { url: contractsUrl, list }, workers });

type Ref = TopicRef<unknown, unknown, unknown, unknown>;
/** A topic handle by name: the kernel reads only `name`; the broker validates. */
const ref = (name: string): Ref => ({ name, schema: { '~standard': {} } });
const topicOf = (name: string) => (name === OTHER.name ? OTHER : SOURCE);

// Both source topics get a reading per machine every 50 ms.
let n = 0;
setInterval(() => {
  n++;
  const ts = Date.now();
  for (const name of [SOURCE.name, OTHER.name]) {
    for (const key of ['m1', 'm2']) {
      void kernel.publish(ref(name), { key, value: { ts, temp: key === 'm1' ? n % 50 : 100 } });
    }
  }
}, 50);

const handles = new Map<string, IsolateHandle>();
const mainBus = isolateBus(kernel);

const harness = {
  publish(spec: WidgetSpec, mode: WidgetMode = 'spec', key = spec.id): Promise<void> {
    const topic = mode === 'spec' ? 'creator.specs.v1' : 'creator.draft.v1';
    return kernel.publish(ref(topic), { key, value: specRecord(spec) });
  },
  tombstone(id: string): Promise<void> {
    return kernel.publish(ref('creator.specs.v1'), { key: id, value: TOMBSTONE });
  },
  spawn(spec: WidgetSpec, mode: WidgetMode = 'spec'): string {
    const surface = document.createElement('div');
    surface.className = 'slot';
    document.getElementById('slots')?.append(surface);
    const handle = spawnWidget(kernel, spec, {
      src: widgetSrc,
      surface,
      topic: topicOf(spec.source.topic),
      mode,
    });
    surface.dataset['isolate'] = handle.id;
    handles.set(handle.id, handle);
    return handle.id;
  },
  /** The native widget: the same code on the main thread, over the kernel's bus. */
  native(spec: WidgetSpec): void {
    const surface = document.createElement('div');
    surface.className = 'slot';
    surface.dataset['native'] = spec.id;
    document.getElementById('slots')?.append(surface);
    const config = { id: spec.id, mode: 'spec' as const, topic: topicOf(spec.source.topic) };
    createRoot(surface).render(<NativeWidget bus={mainBus} config={config} />);
  },
  stop(id: string): Promise<void> {
    return handles.get(id)?.stop() ?? Promise.resolve();
  },
  isolates: () =>
    kernel
      .isolates()
      .map((i) => ({ id: i.id, state: i.state, pool: i.pool, restarts: i.restarts })),
};

let board: BoardController | undefined;
const boardApi = {
  controller: () => board,
  /** Publishes widget specs straight to the specs topic (e.g. to fill the page). */
  publishSpecs(specs: WidgetSpec[]): Promise<void> {
    return Promise.all(
      specs.map((s, i) =>
        kernel.publish(ref('creator.specs.v1'), {
          key: s.id,
          value: specRecord(s, Date.now() + 1000 + i),
        }),
      ),
    ).then(() => {});
  },
  /**
   * Resolves once every earlier spec publish is on disk: a persistent topic
   * acknowledges a publish once its batch is written (ADR 0007), in order,
   * so the ack of a probe publish follows them.
   */
  flushSpecs: (): Promise<void> =>
    kernel
      .publish(ref('creator.specs.v1'), { key: '$sync', value: { sync: 'flushed' } })
      .then(() => {}),
  restart: (id: string) => kernel.restart(id),
  crashBus: () => kernel.debug.crashBus(),
  isolates: harness.isolates,
  busReady: 0,
};
kernel.on('bus:ready', () => {
  boardApi.busReady++;
});

Object.assign(window, { harness, board: boardApi });
if (new URLSearchParams(location.search).get('board') === 'isoloop') {
  const runtime = isoloopRuntime({ kernel, widgetSrc, drawerSrc });
  const el = document.createElement('div');
  document.body.append(el);
  createRoot(el).render(
    <CreatorBoard
      runtime={runtime}
      catalog={CATALOG}
      starters={STARTERS}
      onController={(c) => {
        board = c;
      }}
    />,
  );
}
document.body.dataset['ready'] = 'true';
