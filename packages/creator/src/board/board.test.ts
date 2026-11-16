import type { IsolateManifest, IsolateSnapshot, IsolateState } from '@isoloop/host';
import { createTestContext } from '@isoloop/runtime/testing';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogTopic } from '../catalog';
import type { DrawerConfig } from '../drawer/config';
import type { WidgetSpec } from '../spec/types';
import { CATALOG, SCALARS, spec } from '../test-fixtures';
import { specRecordSchema, uiRecordSchema } from '../topics';
import { isolateBus } from '../widget/bus';
import { DRAFT_TOPIC, SPECS_TOPIC, TOMBSTONE, UI_TOPIC, specRecord } from '../widget/records';
import { WidgetRunner } from '../widget/runner';
import { BoardController, SYNC_KEY } from './controller';
import { DRAWER_GRANTS, isoloopRuntime } from './isoloop';
import { NativeBus } from './native-bus';
import { nextPool, poolLabel, poolStatus, sortPools } from './pools';
import type { BoardRuntime } from './runtime';
import { UI_KEY } from './ui';

/** Lets the NativeBus's microtasks (and what they publish) run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function memory(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

type Mount = {
  spec: WidgetSpec;
  surface: Element;
  mode: string;
  topic: CatalogTopic;
  draftId?: string | undefined;
  stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

/** A runtime over a NativeBus that records what it mounts instead of rendering. */
function fakeRuntime(o: { pools?: boolean; storage?: ReturnType<typeof memory> } = {}) {
  const bus = new NativeBus({
    storageKey: 'test',
    storage: o.storage ?? memory(),
    sources: () => () => {},
  });
  const widgets: Mount[] = [];
  const drawers: { surface: Element; config: DrawerConfig }[] = [];
  const runtime: BoardRuntime = {
    kind: o.pools ? 'isoloop' : 'native',
    bus,
    mountWidget: (s, surface, m) => {
      const mount: Mount = {
        spec: s,
        surface,
        mode: m.mode,
        topic: m.topic,
        draftId: m.draftId,
        stop: vi.fn<() => Promise<void>>(() => Promise.resolve()),
      };
      widgets.push(mount);
      return { stop: mount.stop };
    },
    mountDrawer: (surface, config) => {
      drawers.push({ surface, config });
      return { stop: () => Promise.resolve() };
    },
    ...(o.pools
      ? { pools: (specs: readonly WidgetSpec[]) => poolStatus(specs, { isolates: [], pools: [] }) }
      : {}),
    where: (s) => poolLabel(s.placement.pool),
  };
  return { bus, runtime, widgets, drawers };
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- no DOM here; the controller only passes surfaces on
const el = (): Element => ({}) as Element;

const starter = (id: string, over: Partial<WidgetSpec> = {}) => spec({ id, title: id, ...over });
const STARTERS = [starter('s1'), starter('s2'), starter('s3')];

let clock = 1_000;
const now = () => clock++;
/** A time after every seeded starter's. */
const later = () => (clock += 10);

async function board(
  o: Parameters<typeof fakeRuntime>[0] & { cap?: number; starters?: WidgetSpec[] } = {},
) {
  const f = fakeRuntime(o);
  const ctl = new BoardController({
    runtime: f.runtime,
    catalog: CATALOG,
    starters: o.starters ?? STARTERS,
    now,
    random: (() => {
      let n = 0;
      return () => `r${++n}`;
    })(),
    ...(o.cap === undefined ? {} : { cap: o.cap }),
  });
  ctl.start();
  await settle();
  return { ...f, ctl };
}

describe('BoardController: the widgets', () => {
  it('seeds the starters on a first visit, once the replay probe comes back', async () => {
    const { ctl } = await board();
    await settle();
    expect(ctl.state.ready).toBe(true);
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's2', 's3']);
  });

  it("doesn't seed a page that has had widgets, even if all were deleted", async () => {
    const storage = memory();
    const first = await board({ storage });
    await settle();
    await Promise.all(['s1', 's2', 's3'].map((id) => first.ctl.remove(id)));
    await settle();
    first.ctl.stop();
    const again = await board({ storage });
    await settle();
    expect(again.ctl.state.ready).toBe(true);
    expect(again.ctl.state.widgets).toEqual([]);
  });

  it('runs a widget once the grid gives it a slot, and stops it when the slot goes', async () => {
    const { ctl, widgets } = await board();
    await settle();
    const surface = el();
    ctl.attach('s1', surface);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ mode: 'spec', surface, topic: SCALARS });
    ctl.detach('s1');
    expect(widgets[0]?.stop).toHaveBeenCalled();
  });

  it('an edit of operators, view or title reconfigures in place: no new widget', async () => {
    const { ctl, bus, widgets } = await board();
    await settle();
    ctl.attach('s1', el());
    await bus.publish(
      SPECS_TOPIC,
      's1',
      specRecord(starter('s1', { title: 'New', view: { type: 'bar', size: 'l' } })),
    );
    await settle();
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.stop).not.toHaveBeenCalled();
    expect(ctl.state.widgets[0]?.spec.title).toBe('New');
  });

  it('a new placement or source topic respawns it in the same slot', async () => {
    const { ctl, bus, widgets } = await board();
    await settle();
    const surface = el();
    ctl.attach('s1', surface);
    await bus.publish(
      SPECS_TOPIC,
      's1',
      specRecord(starter('s1', { placement: { mode: 'manual', pool: 'pool-2' } })),
    );
    await settle();
    expect(widgets).toHaveLength(2);
    expect(widgets[0]?.stop).toHaveBeenCalled();
    expect(widgets[1]).toMatchObject({ surface, spec: { placement: { pool: 'pool-2' } } });
    await bus.publish(
      SPECS_TOPIC,
      's1',
      specRecord(
        starter('s1', {
          source: { topic: 'plant.events.v1' },
          operators: [],
          view: { type: 'table', size: 'm' },
        }),
      ),
    );
    await settle();
    expect(widgets).toHaveLength(3);
    expect(widgets[2]?.topic.name).toBe('plant.events.v1');
  });

  it('a delete stops the widget and takes it off the grid', async () => {
    const { ctl, widgets } = await board();
    await settle();
    ctl.attach('s2', el());
    await ctl.remove('s2');
    await settle();
    expect(widgets[0]?.stop).toHaveBeenCalled();
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's3']);
  });

  it('keeps add order across edits, as `added` says', async () => {
    const { ctl, bus } = await board();
    await settle();
    await bus.publish(
      SPECS_TOPIC,
      's1',
      specRecord(starter('s1', { title: 'edited' }), ctl.state.widgets[0]?.added),
    );
    await settle();
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's2', 's3']);
  });

  it('reset tombstones what the user added and brings the starters back', async () => {
    const { ctl, bus } = await board();
    await settle();
    await bus.publish(SPECS_TOPIC, 'w9', specRecord(starter('w9'), later()));
    await ctl.remove('s2');
    await settle();
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's3', 'w9']);
    await ctl.reset();
    await settle();
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's2', 's3']);
  });

  it('holds at most `cap` widgets: the rest wait, and Add is off', async () => {
    const { ctl, bus } = await board({ cap: 4 });
    await settle();
    await Promise.all(
      ['w1', 'w2'].map((id) => bus.publish(SPECS_TOPIC, id, specRecord(starter(id), later()))),
    );
    await settle();
    expect(ctl.state.widgets.map((w) => w.id)).toEqual(['s1', 's2', 's3', 'w1']);
    expect(ctl.state.full).toBe(true);
    ctl.openAdd();
    expect(ctl.state.drawer.open).toBe(false);
  });
});

async function opened() {
  const b = await board({ pools: true });
  await settle();
  const form = el();
  const preview = el();
  b.ctl.attachDrawer(form, preview);
  const ui: { key?: string | undefined; value: unknown }[] = [];
  b.bus.subscribe(UI_TOPIC, (r) => ui.push(r));
  return { ...b, form, preview, ui };
}

describe('BoardController: the drawer', () => {
  it('opening starts the form once and tells it what to do', async () => {
    const { ctl, drawers, ui, form } = await opened();
    ctl.openAdd();
    await settle();
    ctl.closeDrawer();
    ctl.openEdit('s2');
    await settle();
    expect(drawers).toHaveLength(1);
    expect(drawers[0]).toMatchObject({
      surface: form,
      config: { native: false, cap: 24, catalog: CATALOG },
    });
    const opens = ui.filter((r) => r.key === UI_KEY.open).map((r) => r.value);
    expect(opens).toEqual([
      { open: { n: 1, mode: 'add', draftId: 'd1-r2' } },
      { open: { n: 2, mode: 'edit', draftId: 'd2-r3', id: 's2' } },
    ]);
    expect(ctl.state.drawer).toEqual({ open: true, mode: 'edit', id: 's2', draftId: 'd2-r3' });
    for (const v of opens) expect(uiRecordSchema.safeParse(v).success).toBe(true);
  });

  it('the preview follows the draft: started on the first, respawned on a new topic only', async () => {
    const { ctl, bus, widgets, preview } = await opened();
    ctl.openAdd();
    const { drawer } = ctl.state;
    if (!drawer.open) throw new Error('closed');
    await bus.publish(DRAFT_TOPIC, drawer.draftId, specRecord(spec({ id: 'new' })));
    await settle();
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ mode: 'draft', surface: preview, draftId: drawer.draftId });
    await bus.publish(DRAFT_TOPIC, drawer.draftId, specRecord(spec({ id: 'new', title: 'typed' })));
    await bus.publish(
      DRAFT_TOPIC,
      'another-draft',
      specRecord(spec({ source: { topic: 'plant.events.v1' } })),
    );
    await settle();
    expect(widgets).toHaveLength(1);
    await bus.publish(
      DRAFT_TOPIC,
      drawer.draftId,
      specRecord(
        spec({
          id: 'new',
          source: { topic: 'plant.events.v1' },
          operators: [],
          view: { type: 'table', size: 'm' },
        }),
      ),
    );
    await settle();
    expect(widgets).toHaveLength(2);
    expect(widgets[0]?.stop).toHaveBeenCalled();
  });

  it("the form's done closes the drawer and stops the preview; an old opening's done doesn't", async () => {
    const { ctl, bus, widgets } = await opened();
    ctl.openAdd();
    const first = ctl.state.drawer;
    ctl.openAdd();
    const d = ctl.state.drawer;
    if (!d.open || !first.open) throw new Error('closed');
    await bus.publish(DRAFT_TOPIC, d.draftId, specRecord(spec({ id: 'new' })));
    await settle();
    await bus.publish(UI_TOPIC, UI_KEY.done, { done: { n: 1, what: 'cancel' } });
    await settle();
    expect(ctl.state.drawer.open).toBe(true);
    await bus.publish(UI_TOPIC, UI_KEY.done, { done: { n: 2, what: 'added', id: 'new' } });
    await settle();
    expect(ctl.state.drawer.open).toBe(false);
    expect(widgets[0]?.stop).toHaveBeenCalled();
  });

  it('closing tombstones the draft, so the draft topic holds only open drafts', async () => {
    const { ctl, bus } = await opened();
    ctl.openAdd();
    const d = ctl.state.drawer;
    if (!d.open) throw new Error('closed');
    const drafts: { key?: string | undefined; value: unknown }[] = [];
    bus.subscribe(DRAFT_TOPIC, (r) => drafts.push(r));
    ctl.closeDrawer();
    await settle();
    expect(drafts).toContainEqual({ key: d.draftId, value: TOMBSTONE });
  });

  it('deleting the widget being edited closes the drawer', async () => {
    const { ctl } = await opened();
    ctl.openEdit('s1');
    await ctl.remove('s1');
    await settle();
    expect(ctl.state.drawer.open).toBe(false);
  });

  it('tells the form about the pools, on Isoloop pages', async () => {
    const { ui, ctl, bus } = await opened();
    await bus.publish(
      SPECS_TOPIC,
      'w9',
      specRecord(starter('w9', { placement: { mode: 'manual', pool: 'pool-3' } }), later()),
    );
    await settle();
    const pools = ui.findLast((r) => r.key === UI_KEY.pools)?.value;
    expect(pools).toEqual({
      pools: [
        { pool: 'pool-1', label: 'Pool 1', members: 3, lagMs: null },
        { pool: 'pool-3', label: 'Pool 3', members: 1, lagMs: null },
      ],
    });
    expect(uiRecordSchema.safeParse(pools).success).toBe(true);
    ctl.stop();
  });
});

const snap = (
  id: string,
  pool: string,
  lagMs: number,
  state: IsolateState = 'running',
): IsolateSnapshot => ({ id, pool, lagMs, state, lastBeatAt: 1, restarts: 0, dropped: 0 });

const noop = (): void => {};

describe('the pools', () => {
  it('labels, sorts and numbers them', () => {
    expect(poolLabel('pool-12')).toBe('Pool 12');
    expect(poolLabel('engines')).toBe('engines');
    expect(sortPools(['pool-10', 'b', 'pool-2', 'pool-2', 'a'])).toEqual([
      'pool-2',
      'pool-10',
      'a',
      'b',
    ]);
    expect(nextPool([])).toBe('pool-1');
    expect(nextPool(['pool-1', 'pool-4', 'x'])).toBe('pool-5');
  });

  it("a pool's lag is its running members' highest, from the kernel's snapshots", () => {
    const status = poolStatus([spec({ id: 'a' }), spec({ id: 'b' })], {
      isolates: [
        snap('widget-a', 'creator-pool-1', 4),
        snap('widget-b', 'creator-pool-1', 9),
        snap('other', 'machine-1', 99),
        snap('widget-c', 'creator-pool-1', 500, 'restarting'),
      ],
      pools: [],
    });
    expect(status).toEqual([{ pool: 'pool-1', label: 'Pool 1', members: 2, lagMs: 9 }]);
  });
});

describe('NativeBus', () => {
  it('keeps the specs across a reload, without the replay probe', async () => {
    const storage = memory();
    const a = new NativeBus({ storageKey: 'plant', storage, sources: () => () => {} });
    await a.publish(SPECS_TOPIC, 'w1', specRecord(spec()));
    await a.publish(SPECS_TOPIC, SYNC_KEY, { sync: 'x' });
    await a.publish(DRAFT_TOPIC, 'd1', specRecord(spec()));
    const b = new NativeBus({ storageKey: 'plant', storage, sources: () => () => {} });
    const specs: unknown[] = [];
    const drafts: unknown[] = [];
    b.subscribe(SPECS_TOPIC, (r) => specs.push(r.key));
    b.subscribe(DRAFT_TOPIC, (r) => drafts.push(r.key));
    await settle();
    expect(specs).toEqual(['w1']);
    expect(drafts).toEqual([]);
    expect([...storage.data.keys()]).toEqual(['creator:plant:specs']);
  });

  it('compacts: a key replays at its newest record, and delivery is never synchronous', async () => {
    const bus = new NativeBus({ storageKey: 'x', storage: memory(), sources: () => () => {} });
    void bus.publish(SPECS_TOPIC, 'w1', specRecord(spec({ title: 'a' })));
    void bus.publish(SPECS_TOPIC, 'w1', specRecord(spec({ title: 'b' })));
    const got: unknown[] = [];
    bus.subscribe(SPECS_TOPIC, (r) => got.push(r.value));
    expect(got).toEqual([]);
    await settle();
    expect(got).toEqual([specRecord(spec({ title: 'b' }))]);
  });

  it("passes the page's own topics to its sources", () => {
    const sources = vi.fn(() => () => {});
    const bus = new NativeBus({ storageKey: 'x', storage: memory(), sources });
    bus.subscribe('plant.scalars.v1', noop);
    expect(sources).toHaveBeenCalledWith('plant.scalars.v1', noop);
  });
});

describe('the Isoloop runtime', () => {
  it('spawns widgets in their pool, previews and the drawer on their own workers', () => {
    const spawned: IsolateManifest[] = [];
    const rt = isoloopRuntime({
      kernel: {
        spawn: (m) => {
          spawned.push(m);
          return { id: m.id, snapshot: vi.fn(), stop: vi.fn(), restart: vi.fn() };
        },
        publish: () => Promise.resolve(),
        subscribe: () => noop,
        isolates: () => [],
        pools: () => [],
      },
      widgetSrc: 'widget.js',
      drawerSrc: 'drawer.js',
    });
    const surface = el();
    rt.mountWidget(spec(), surface, { mode: 'spec', topic: SCALARS });
    rt.mountWidget(spec(), surface, { mode: 'draft', topic: SCALARS, draftId: 'd1' });
    rt.mountDrawer(surface, { catalog: CATALOG, native: false, cap: 24 });
    expect(spawned.map((m) => [m.id, m.pool, m.src])).toEqual([
      ['widget-w1', 'creator-pool-1', 'widget.js'],
      ['preview-d1', undefined, 'widget.js'],
      ['creator-drawer', undefined, 'drawer.js'],
    ]);
    expect(spawned[2]).toMatchObject({ grants: DRAWER_GRANTS });
    expect(rt.where(spec({ placement: { mode: 'manual', pool: 'pool-2' } }))).toBe('Pool 2');
  });
});

describe('the creator topics', () => {
  it('take the replay probe and `added`, and the ui records', () => {
    expect(specRecordSchema.safeParse({ sync: 'abc' }).success).toBe(true);
    expect(specRecordSchema.safeParse(specRecord(spec(), 5)).success).toBe(true);
    expect(uiRecordSchema.safeParse({ done: { n: 1, what: 'saved', id: 'w1' } }).success).toBe(
      true,
    );
    expect(uiRecordSchema.safeParse({ done: { n: 1, what: 'nope' } }).success).toBe(false);
  });
});

describe('a widget after a bus restart', () => {
  it('starts again empty from the lost source topic, on the spec it runs', () => {
    let t0 = 1_000_000;
    const t = createTestContext({});
    const runner = new WidgetRunner(
      isolateBus(t.ctx.bus),
      { id: 'w1', mode: 'spec', topic: SCALARS },
      { now: () => t0 },
    );
    runner.start();
    const s = spec({
      operators: [
        { op: 'window', ms: 60_000 },
        { op: 'aggregate', fn: 'count' },
      ],
      view: { type: 'stat', size: 's' },
    });
    t.emit(SPECS_TOPIC, specRecord(s), 'w1');
    for (let i = 0; i < 5; i++) {
      t0 += 100;
      t.emit('plant.scalars.v1', { machine: 'pump-1', ts: t0, speed: 1, bearingTemp: 1 }, 'pump-1');
    }
    expect(runner.tick()).toMatchObject({ status: 'live', output: { kind: 'scalar', value: 5 } });
    t.reset('plant.scalars.v1');
    expect(runner.state).toMatchObject({ status: 'live', output: undefined });
    t0 += 100;
    t.emit('plant.scalars.v1', { machine: 'pump-1', ts: t0, speed: 1, bearingTemp: 1 }, 'pump-1');
    expect(runner.tick()).toMatchObject({ status: 'live', output: { kind: 'scalar', value: 1 } });
    runner.stop();
  });
});

describe('a respawned widget', () => {
  it('replays its older records without asking for another respawn', () => {
    const t = createTestContext({});
    const runner = new WidgetRunner(
      isolateBus(t.ctx.bus),
      { id: 'w1', mode: 'spec', topic: SCALARS, pool: 'pool-3' },
      { now: () => 1_000_000 },
    );
    runner.start();
    // The compacted topic still holds the record from before the move.
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    expect(runner.state.status).toBe('respawn');
    t.emit(SPECS_TOPIC, specRecord(spec({ placement: { mode: 'manual', pool: 'pool-3' } })), 'w1');
    expect(runner.state).toMatchObject({ status: 'live', spec: { placement: { pool: 'pool-3' } } });
    runner.stop();
  });
});
