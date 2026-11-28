// The drawer isolate (M3e decision 8): the form, in its own worker, never
// pooled. A page imports its URL with the Vite `?isolate` query:
//
//   import drawerSrc from 'creator/drawer-isolate?isolate';
//
// and the board's Isoloop runtime spawns it (board/isoloop.ts).
import { defineIsolate, useIsolate } from '@isoloop/react';
import type { TopicRef } from '@isoloop/protocol';
import { useEffect, useMemo } from 'react';
import css from '../styles.css?inline';
import { drawerConfig } from './config';
import { Drawer, type DrawerBus } from './Drawer';

type Ref = TopicRef<unknown, unknown, unknown, unknown>;
/** A topic handle by name: the bus client reads only `name`; the broker validates. */
const ref = (name: string): Ref => ({ name, schema: { '~standard': {} } });

function DrawerIsolate({ config }: { config: unknown }) {
  const ctx = useIsolate();
  const cfg = useMemo(() => drawerConfig(config), [config]);
  useEffect(() => ctx.styles(css), [ctx]);
  const bus = useMemo<DrawerBus>(
    () => ({
      subscribe: (topic, fn, opts) =>
        ctx.bus.subscribe(ref(topic), (r) => fn(r), {
          from: 'earliest',
          ...(opts?.onReset ? { onReset: opts.onReset } : {}),
        }),
      publish: (topic, key, value) => ctx.bus.publish(ref(topic), value, { key }),
    }),
    [ctx],
  );
  return <Drawer bus={bus} config={cfg} />;
}

export default defineIsolate(DrawerIsolate);
