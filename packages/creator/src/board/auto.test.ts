import type { IsolateManifest } from '@isoloop/host';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogTopic } from '../catalog';
import type { WidgetSpec } from '../spec/types';
import { SCALARS, spec } from '../test-fixtures';
import { placementRecordSchema, uiRecordSchema } from '../topics';
import { PLACEMENT_TOPIC, SPECS_TOPIC, TOMBSTONE, UI_TOPIC, specRecord } from '../widget/records';
import {
  autoPlacer,
  autoWhere,
  balancerLabel,
  moveText,
  type BalancerLike,
  type MoveReason,
} from './auto';
import { BoardController, MOVE_BADGE_MS, SYNC_KEY } from './controller';
import { isoloopRuntime } from './isoloop';
import { LOADS_SYNC_KEY, placementLoads, type PlacementLoads } from './loads';
import type { BoardRuntime, HostBus } from './runtime';
import { UI_KEY } from './ui';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- no DOM here; surfaces are only passed on
const el = (): Element => ({}) as Element;

/** A bus that keeps every topic compacted and delivers in a microtask. */
function memoryBus(): HostBus & { held: Map<string, Map<string, unknown>> } {
  const held = new Map<string, Map<string, unknown>>();
  const subs = new Map<string, Set<(r: { key?: string; value: unknown }) => void>>();
  return {
    held,
    subscribe: (topic, fn) => {
      const set = subs.get(topic) ?? new Set();
      subs.set(topic, set);
      const replay = [...(held.get(topic) ?? new Map<string, unknown>())];
      set.add(fn);
      queueMicrotask(() => {
        for (const [key, value] of replay) fn({ key, value });
      });
      return () => set.delete(fn);
    },
    publish: (topic, key, value) => {
      const t = held.get(topic) ?? new Map<string, unknown>();
      held.set(topic, t);
      t.delete(key);
      t.set(key, value);
      const now = [...(subs.get(topic) ?? [])];
      return new Promise((resolve) =>
        queueMicrotask(() => {
          for (const fn of now) fn({ key, value });
          resolve();
        }),
      );
    },
  };
}

type Move = { id: string; from: string; to: string; reason: MoveReason };

function fakeBalancer() {
  const spawned: IsolateManifest[] = [];
  const stopped: string[] = [];
  const held = new Set<string>();
  const moves = new Set<(e: Move) => void>();
  let placements: ReturnType<BalancerLike['placements']> = [];
  const measures = new Map<string, number>();
  const balancer: BalancerLike = {
    spawn: (m) => {
      spawned.push(m);
      return {};
    },
    stop: (id) => {
      stopped.push(id);
      return Promise.resolve();
    },
    placements: () => placements,
    measure: (id) => measures.get(id),
    hold: (id) => {
      held.add(id);
      return () => held.delete(id);
    },
    on: (_event, fn) => {
      moves.add(fn);
      return () => moves.delete(fn);
    },
  };
  return {
    balancer,
    spawned,
    stopped,
    held,
    measures,
    setPlacements: (p: typeof placements) => {
      placements = p;
    },
    move: (e: Move) => {
      for (const fn of moves) fn(e);
    },
  };
}

function fakeLoads(): PlacementLoads & { data: Map<string, number> } {
  const data = new Map<string, number>();
  return {
    data,
    ready: Promise.resolve(),
    get: (id) => data.get(id),
    set: (id, pct) => void data.set(id, pct),
    delete: (id) => void data.delete(id),
    close: () => {},
  };
}

describe('balancer labels and badges', () => {
  it('names its pools as the page shows them', () => {
    expect(balancerLabel('balancer-2')).toBe('Auto 2');
    expect(balancerLabel('balancer-quarantine-1')).toBe('Quarantine');
    expect(balancerLabel('balancer-quarantine-3')).toBe('Quarantine 3');
    expect(balancerLabel('creator-pool-1')).toBe('creator-pool-1');
  });

  it('says why a widget moved', () => {
    expect(moveText({ from: 'Auto 1', to: 'Auto 2', reason: 'sustained' })).toBe(
      'moved: Auto 1 was over budget',
    );
    expect(moveText({ from: 'Auto 1', to: 'Auto 2', reason: 'full' })).toBe(
      'moved: Auto 1 was full',
    );
    expect(moveText({ from: 'Auto 1', to: 'Quarantine', reason: 'spike' })).toMatch(/Quarantine/);
    expect(moveText({ from: 'Quarantine', to: 'Auto 1', reason: 'steady' })).toBe(
      'back in Auto 1: steady',
    );
  });
});

describe('autoWhere', () => {
  it('says where an automatic widget is, and why when it is kept apart, over budget or stopped', () => {
    const p = { id: 'w1', pool: 'balancer-2', label: 'Auto 2', state: 'placed' } as const;
    expect(autoWhere(undefined)).toBe('Automatic');
    expect(autoWhere(p)).toBe('Auto 2');
    expect(autoWhere({ ...p, atCap: true })).toBe('Auto 2 · over budget, at worker cap');
    expect(autoWhere({ ...p, label: 'Quarantine', state: 'kept-apart' })).toBe(
      'Quarantine · kept apart: repeated blocking',
    );
    expect(autoWhere({ ...p, state: 'failed' })).toBe('Auto 2 · stopped: crashed too often');
  });
});

describe('autoPlacer', () => {
  it('maps isolates to widgets, holds by widget, and stores a preview’s load as the widget’s', async () => {
    const b = fakeBalancer();
    const loads = fakeLoads();
    const placer = autoPlacer(b.balancer, loads, () => 7);
    b.setPlacements([
      { id: 'widget-w1', pool: 'balancer-1', state: 'placed' },
      { id: 'preview-d1', pool: 'x', state: 'placed' },
      { id: 'widget-w2', pool: 'balancer-quarantine-1', state: 'kept-apart', atCap: true },
      { id: 'widget-w3', pool: 'balancer-2', state: 'failed' },
    ]);
    expect([...placer.placements().values()]).toEqual([
      { id: 'w1', pool: 'balancer-1', label: 'Auto 1', state: 'placed' },
      {
        id: 'w2',
        pool: 'balancer-quarantine-1',
        label: 'Quarantine',
        state: 'kept-apart',
        atCap: true,
      },
      { id: 'w3', pool: 'balancer-2', label: 'Auto 2', state: 'failed' },
    ]);
    const release = placer.hold('w1');
    expect([...b.held]).toEqual(['widget-w1']);
    release();
    expect(b.held.size).toBe(0);

    placer.measured('w1', 'd1');
    expect(loads.data.size).toBe(0);
    b.measures.set('preview-d1', 12.5);
    placer.measured('w1', 'd1');
    expect(loads.data.get('widget-w1')).toBe(12.5);
    placer.forget('w1');
    expect(loads.data.size).toBe(0);

    const got: unknown[] = [];
    placer.onMove((m) => got.push(m));
    b.move({ id: 'widget-w1', from: 'balancer-1', to: 'balancer-quarantine-1', reason: 'spike' });
    b.move({ id: 'preview-d1', from: 'a', to: 'b', reason: 'spike' });
    expect(got).toEqual([{ id: 'w1', from: 'Auto 1', to: 'Quarantine', reason: 'spike', at: 7 }]);

    const handle = placer.spawn({ id: 'widget-w1', src: 'w.js' });
    await handle.stop();
    expect(b.stopped).toEqual(['widget-w1']);
  });
});

describe('placementLoads', () => {
  it('replays the topic, then says it is ready; set and delete publish', async () => {
    const bus = memoryBus();
    await bus.publish(PLACEMENT_TOPIC, 'widget-a', { loadPct: 30 });
    await bus.publish(PLACEMENT_TOPIC, 'widget-b', { loadPct: 5 });
    await bus.publish(PLACEMENT_TOPIC, 'widget-b', TOMBSTONE);
    const loads = placementLoads(bus, () => 'p1');
    let ready = false;
    void loads.ready.then(() => {
      ready = true;
    });
    await settle();
    await settle();
    expect(ready).toBe(true);
    expect(loads.get('widget-a')).toBe(30);
    expect(loads.get('widget-b')).toBeUndefined();
    loads.set('widget-c', 9);
    loads.delete('widget-a');
    loads.delete('widget-zzz');
    await settle();
    expect([...(bus.held.get(PLACEMENT_TOPIC) ?? new Map<string, unknown>())]).toEqual([
      ['widget-b', TOMBSTONE],
      [LOADS_SYNC_KEY, { sync: 'p1' }],
      ['widget-c', { loadPct: 9 }],
      ['widget-a', TOMBSTONE],
    ]);
  });

  it('is ready even when the probe can’t be published', async () => {
    const loads = placementLoads({
      subscribe: () => () => {},
      publish: () => Promise.reject(new Error('no bus')),
    });
    await expect(loads.ready).resolves.toBeUndefined();
  });

  it('records the topic schema takes', () => {
    expect(placementRecordSchema.safeParse({ loadPct: 12 }).success).toBe(true);
    expect(placementRecordSchema.safeParse(TOMBSTONE).success).toBe(true);
    expect(placementRecordSchema.safeParse({ loadPct: 'x' }).success).toBe(false);
    expect(
      uiRecordSchema.safeParse({
        placements: [{ id: 'w1', pool: 'balancer-1', label: 'Auto 1', state: 'placed' }],
      }).success,
    ).toBe(true);
  });
});

/** The placement key a widget isolate was spawned with (`config.pool`). */
const configPool = (m: IsolateManifest): unknown => Reflect.get(Object(m.config), 'pool');

describe('the Isoloop runtime with a balancer', () => {
  it('spawns auto widgets through it once the loads replayed, others through the kernel', async () => {
    const b = fakeBalancer();
    let open!: () => void;
    const ready = new Promise<void>((resolve) => {
      open = resolve;
    });
    const loads: PlacementLoads = { ...fakeLoads(), ready };
    const kernelSpawned: IsolateManifest[] = [];
    const rt = isoloopRuntime({
      kernel: {
        spawn: (m) => {
          kernelSpawned.push(m);
          return { id: m.id, snapshot: vi.fn(), stop: vi.fn(), restart: vi.fn() };
        },
        publish: () => Promise.resolve(),
        subscribe: () => () => {},
        isolates: () => [],
        pools: () => [],
      },
      widgetSrc: 'widget.js',
      drawerSrc: 'drawer.js',
      auto: { balancer: b.balancer, loads },
      chaos: true,
    });
    expect(rt.chaos).toBe(true);
    const auto = spec({ id: 'a1', placement: { mode: 'auto' } });
    const topic: CatalogTopic = SCALARS;
    rt.mountWidget(auto, el(), { mode: 'spec', topic });
    const early = rt.mountWidget(spec({ id: 'a2', placement: { mode: 'auto' } }), el(), {
      mode: 'spec',
      topic,
    });
    rt.mountWidget(spec(), el(), { mode: 'spec', topic });
    rt.mountWidget(auto, el(), { mode: 'draft', topic, draftId: 'd1' });
    await early.stop();
    expect(b.spawned).toEqual([]);
    open();
    await settle();
    expect(b.spawned.map((m): unknown[] => [m.id, m.pool, configPool(m)])).toEqual([
      ['widget-a1', undefined, '$auto'],
    ]);
    expect(kernelSpawned.map((m) => [m.id, m.pool])).toEqual([
      ['widget-w1', 'creator-pool-1'],
      ['preview-d1', undefined],
    ]);
    expect(rt.where(auto)).toBe('Automatic');
  });
});

/** A runtime over a memory bus with a fake balancer behind `auto`. */
function autoBoard(starters: WidgetSpec[]) {
  const bus = memoryBus();
  const b = fakeBalancer();
  const loads = fakeLoads();
  let t = 1_000;
  const now = () => t;
  const placer = autoPlacer(b.balancer, loads, now);
  const mounts: { spec: WidgetSpec; mode: string; stop: () => Promise<void> }[] = [];
  const drawers: unknown[] = [];
  const runtime: BoardRuntime = {
    kind: 'isoloop',
    bus,
    mountWidget: (s, _surface, m) => {
      const mount = { spec: s, mode: m.mode, stop: vi.fn(() => Promise.resolve()) };
      mounts.push(mount);
      return mount;
    },
    mountDrawer: (_surface, config) => {
      drawers.push(config);
      return { stop: () => Promise.resolve() };
    },
    where: () => 'Automatic',
    auto: placer,
    chaos: true,
  };
  let random = 0;
  const ctl = new BoardController({
    runtime,
    catalog: { topics: [SCALARS] },
    starters,
    now,
    random: () => `r${++random}`,
    poolsEveryMs: 60_000,
  });
  return {
    ctl,
    bus,
    b,
    loads,
    mounts,
    drawers,
    tick: (ms: number) => {
      t += ms;
    },
  };
}

describe('the board with a balancer', () => {
  it('holds a widget while the drawer edits it, and tells the drawer it has a balancer', async () => {
    const auto = spec({ id: 'a1', title: 'a1', placement: { mode: 'auto' } });
    const x = autoBoard([auto]);
    x.ctl.attachDrawer(el(), el());
    x.ctl.start();
    await settle();
    await settle();
    x.ctl.attach('a1', el());
    x.ctl.openEdit('a1');
    expect([...x.b.held]).toEqual(['widget-a1']);
    expect(x.drawers).toEqual([expect.objectContaining({ auto: true, chaos: true })]);
    x.ctl.closeDrawer();
    expect(x.b.held.size).toBe(0);
    x.ctl.stop();
  });

  it('stores the preview’s load on Save, and forgets a deleted widget’s', async () => {
    const x = autoBoard([]);
    x.ctl.attachDrawer(el(), el());
    x.ctl.start();
    await settle();
    await settle();
    x.ctl.openAdd();
    const d = x.ctl.state.drawer;
    if (!d.open) throw new Error('drawer closed');
    const added = spec({ id: 'n1', placement: { mode: 'auto' } });
    await x.bus.publish('creator.draft.v1', d.draftId, specRecord(added));
    await settle();
    x.b.measures.set(`preview-${d.draftId}`, 22);
    await x.bus.publish(SPECS_TOPIC, 'n1', specRecord(added));
    await settle();
    expect(x.loads.data.get('widget-n1')).toBe(22);
    await x.ctl.remove('n1');
    await settle();
    expect(x.loads.data.has('widget-n1')).toBe(false);
    x.ctl.stop();
  });

  it('notes a move as a badge for a while and in the log; placements reach the state', async () => {
    const auto = spec({ id: 'a1', title: 'a1', placement: { mode: 'auto' } });
    const x = autoBoard([auto]);
    x.ctl.start();
    await settle();
    await settle();
    x.b.setPlacements([{ id: 'widget-a1', pool: 'balancer-quarantine-1', state: 'quarantined' }]);
    x.b.move({ id: 'widget-a1', from: 'balancer-1', to: 'balancer-quarantine-1', reason: 'spike' });
    expect(x.ctl.state.moved.get('a1')).toMatchObject({ from: 'Auto 1', to: 'Quarantine' });
    expect(x.ctl.state.log).toHaveLength(1);
    expect(x.ctl.state.placements.get('a1')).toMatchObject({ label: 'Quarantine' });
    x.ctl.stop();
  });

  it('drops the badge after MOVE_BADGE_MS and publishes placements for the drawer', async () => {
    vi.useFakeTimers();
    try {
      const auto = spec({ id: 'a1', title: 'a1', placement: { mode: 'auto' } });
      const x = autoBoard([auto]);
      x.ctl.start();
      await vi.runOnlyPendingTimersAsync();
      expect(x.ctl.state.ready).toBe(true);
      x.b.setPlacements([{ id: 'widget-a1', pool: 'balancer-1', state: 'placed' }]);
      x.b.move({ id: 'widget-a1', from: 'balancer-2', to: 'balancer-1', reason: 'sustained' });
      x.tick(MOVE_BADGE_MS);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(x.ctl.state.moved.size).toBe(0);
      expect(x.ctl.state.log).toHaveLength(1);
      expect(x.bus.held.get(UI_TOPIC)?.get(UI_KEY.placements)).toEqual({
        placements: [{ id: 'a1', pool: 'balancer-1', label: 'Auto 1', state: 'placed' }],
      });
      expect(x.bus.held.get(SPECS_TOPIC)?.has(SYNC_KEY)).toBe(true);
      x.ctl.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
