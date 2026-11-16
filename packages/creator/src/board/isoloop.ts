// The board on an Isoloop page (M3e decisions 8, 9 and 13): widgets and the
// preview are widget isolates (spawnWidget), the form is the drawer isolate on
// its own worker, and the placement field's pools come from the kernel's
// snapshots. Types only from @isoloop/host: the page passes its kernel.
import type { Kernel } from '@isoloop/host';
import type { TopicRef } from '@isoloop/protocol';
import { spawnWidget } from '../widget/host';
import { DRAFT_TOPIC, SPECS_TOPIC, UI_TOPIC } from '../widget/records';
import { poolLabel, poolStatus } from './pools';
import type { BoardRuntime, HostBus } from './runtime';

type Ref = TopicRef<unknown, unknown, unknown, unknown>;
/** A topic handle by name: the kernel reads only `name`; the broker validates. */
const ref = (name: string): Ref => ({ name, schema: { '~standard': {} } });

/** The drawer isolate's id: one per page. */
export const DRAWER_ID = 'creator-drawer';

export type IsoloopRuntimeOptions = {
  readonly kernel: Pick<Kernel, 'spawn' | 'publish' | 'subscribe' | 'isolates' | 'pools'>;
  /** `import widgetSrc from 'creator/widget-isolate?isolate'`. */
  readonly widgetSrc: string;
  /** `import drawerSrc from 'creator/drawer-isolate?isolate'`. */
  readonly drawerSrc: string;
};

/** The drawer's grants: it reads the specs and the page's messages, and writes specs, drafts and messages. */
export const DRAWER_GRANTS = {
  publish: [SPECS_TOPIC, DRAFT_TOPIC, UI_TOPIC],
  subscribe: [SPECS_TOPIC, UI_TOPIC],
};

export function isoloopRuntime(o: IsoloopRuntimeOptions): BoardRuntime {
  const { kernel } = o;
  const bus: HostBus = {
    subscribe: (topic, fn) => kernel.subscribe(ref(topic), (r) => fn(r), { from: 'earliest' }),
    publish: (topic, key, value) => kernel.publish(ref(topic), { key, value }),
  };
  return {
    kind: 'isoloop',
    bus,
    mountWidget: (spec, surface, m) =>
      spawnWidget(kernel, spec, {
        src: o.widgetSrc,
        surface,
        topic: m.topic,
        mode: m.mode,
        ...(m.draftId === undefined ? {} : { draftId: m.draftId }),
      }),
    mountDrawer: (surface, config) =>
      kernel.spawn({ id: DRAWER_ID, src: o.drawerSrc, surface, config, grants: DRAWER_GRANTS }),
    pools: (specs) => poolStatus(specs, { isolates: kernel.isolates(), pools: kernel.pools() }),
    where: (spec) => poolLabel(spec.placement.pool),
  };
}
