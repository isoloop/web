// The board on an Isoloop page (M3e decisions 8, 9 and 13; M3h decisions 19
// and 20): widgets and the preview are widget isolates (widgetManifest), the
// form is the drawer isolate on its own worker, and the placement field's
// pools come from the kernel's snapshots. With a balancer, `auto` widgets go
// where it puts them; without one, each gets a worker of its own. Types only
// from @isoloop/host: the page passes its kernel.
import type { Kernel } from '@isoloop/host';
import type { TopicRef } from '@isoloop/protocol';
import { spawnWidget, widgetManifest } from '../widget/host';
import { DRAFT_TOPIC, SPECS_TOPIC, UI_TOPIC } from '../widget/records';
import { autoPlacer, type BalancerLike } from './auto';
import type { PlacementLoads } from './loads';
import { poolLabel, poolStatus } from './pools';
import type { BoardRuntime, HostBus, Mounted } from './runtime';

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
  /**
   * The page's balancer and its load store (M3h): `auto` widgets go through
   * it, and the drawer offers "Automatic". Without it, an `auto` widget runs
   * on a worker of its own.
   */
  readonly auto?: { readonly balancer: BalancerLike; readonly loads: PlacementLoads };
  /** The page runs with `?chaos`: the drawer offers the test-only `burn` (M3h decision 21). */
  readonly chaos?: boolean;
};

/** The drawer's grants: it reads the specs and the page's messages, and writes specs, drafts and messages. */
export const DRAWER_GRANTS = {
  publish: [SPECS_TOPIC, DRAFT_TOPIC, UI_TOPIC],
  subscribe: [SPECS_TOPIC, UI_TOPIC],
};

/** The creator's topics by name over the kernel: every subscription from `earliest`. */
export function hostBus(kernel: Pick<Kernel, 'publish' | 'subscribe'>): HostBus {
  return {
    subscribe: (topic, fn) => kernel.subscribe(ref(topic), (r) => fn(r), { from: 'earliest' }),
    publish: (topic, key, value) => kernel.publish(ref(topic), { key, value }),
  };
}

/**
 * An `auto` widget, spawned once the loads have replayed: until then the
 * balancer couldn't tell a measured widget from a new one.
 */
function deferred(ready: Promise<void>, start: () => Mounted): Mounted {
  let stopped = false;
  let started: Mounted | undefined;
  void ready.then(() => {
    if (!stopped) started = start();
  });
  return {
    // Stopped before it started: it never will.
    stop: () => {
      stopped = true;
      return started?.stop() ?? Promise.resolve();
    },
  };
}

export function isoloopRuntime(o: IsoloopRuntimeOptions): BoardRuntime {
  const { kernel } = o;
  const bus = hostBus(kernel);
  const auto = o.auto ? autoPlacer(o.auto.balancer, o.auto.loads) : undefined;
  const ready = o.auto?.loads.ready ?? Promise.resolve();
  return {
    kind: 'isoloop',
    bus,
    chaos: o.chaos === true,
    mountWidget: (spec, surface, m) => {
      const w = {
        src: o.widgetSrc,
        surface,
        topic: m.topic,
        mode: m.mode,
        ...(m.draftId === undefined ? {} : { draftId: m.draftId }),
      };
      if (m.mode === 'spec' && spec.placement.mode === 'auto' && auto) {
        const manifest = widgetManifest(spec, w);
        return deferred(ready, () => auto.spawn(manifest));
      }
      return spawnWidget(kernel, spec, w);
    },
    mountDrawer: (surface, config) =>
      kernel.spawn({ id: DRAWER_ID, src: o.drawerSrc, surface, config, grants: DRAWER_GRANTS }),
    pools: (specs) => poolStatus(specs, { isolates: kernel.isolates(), pools: kernel.pools() }),
    where: (spec) =>
      spec.placement.mode === 'manual' ? poolLabel(spec.placement.pool) : 'Automatic',
    ...(auto ? { auto } : {}),
  };
}
