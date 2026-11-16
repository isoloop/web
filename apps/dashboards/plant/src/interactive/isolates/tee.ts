// An isolate's source that also publishes to the merged topics (merged.ts).
import type { TopicRef } from '@isoloop/protocol';
import type { Source } from '../../core/streams';
import type { BusLike } from '../../isoloop/source';
import { teeSource } from '../merged';

type Ref = TopicRef<unknown, unknown, unknown, unknown>;
const refs = new Map<string, Ref>();
/** A topic handle by name: the bus client reads only `name`; the broker validates. */
function ref(name: string): Ref {
  let r = refs.get(name);
  if (!r) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus client reads only `name`
    r = { name, schema: { '~standard': {} } } as unknown as Ref;
    refs.set(name, r);
  }
  return r;
}

export function teeOf(bus: BusLike, src: Source): Source {
  return teeSource(src, (topic, key, value) => {
    void bus.publish(ref(topic), { key, value });
  });
}
