// `ctx.bus` as a WidgetBus: topics by name, every subscription from
// `earliest`, so a widget replays what its topics keep.
import type { TopicRef } from '@isoloop/protocol';
import type { WidgetBus } from './runner';

type Ref = TopicRef<unknown, unknown, unknown, unknown>;

/** What isolateBus needs from `ctx.bus` (or a kernel). */
export interface BusLike {
  subscribe(
    topic: Ref,
    fn: (r: { key?: string | undefined; value: unknown }) => void,
    opts: { from: 'earliest' },
  ): () => void;
}

/** A topic handle by name: the bus client reads only `name`; the broker validates. */
function ref(name: string): Ref {
  return { name, schema: { '~standard': {} } };
}

export function isolateBus(bus: BusLike): WidgetBus {
  return {
    subscribe: (topic, fn) => bus.subscribe(ref(topic), (r) => fn(r), { from: 'earliest' }),
  };
}
