import type { IsolateManifest, Kernel } from '@isoloop/host';
import { createTestContext } from '@isoloop/runtime/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Rec } from '../catalog';
import { pipeline } from '../pipeline';
import { EVENTS, SCALARS, rec, spec } from '../test-fixtures';
import { creatorTopics, specRecordSchema } from '../topics';
import { applyKind, same } from './apply';
import { RawBuffer } from './buffer';
import { isolateBus } from './bus';
import { widgetConfig } from './config';
import { widgetGrants } from './grants';
import { isolateIdOf, poolId, poolOfId, spawnWidget } from './host';
import { DRAFT_TOPIC, SPECS_TOPIC, TOMBSTONE, specOf, specRecord } from './records';
import { DRAFT_DELAY_MS, WidgetRunner, type WidgetConfig } from './runner';

describe('applyKind', () => {
  const base = spec();
  it('nothing changed, key order and undefined properties aside', () => {
    const reordered = { ...base, view: { size: 'm' as const, type: 'line' as const } };
    expect(applyKind(base, reordered)).toBe('none');
    expect(same({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(same({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });
  it('operators, view, title or the key: reconfigure in place', () => {
    expect(applyKind(base, { ...base, title: 'New' })).toBe('reconfigure');
    expect(applyKind(base, { ...base, view: { type: 'bar', size: 'l' } })).toBe('reconfigure');
    expect(applyKind(base, { ...base, operators: base.operators.slice(1) })).toBe('reconfigure');
    expect(applyKind(base, { ...base, source: { ...base.source, key: 'pump-2' } })).toBe(
      'reconfigure',
    );
  });
  it('the source topic or the placement: respawn', () => {
    expect(applyKind(base, { ...base, source: { topic: 'plant.events.v1' } })).toBe('respawn');
    expect(applyKind(base, { ...base, placement: { mode: 'manual', pool: 'pool-2' } })).toBe(
      'respawn',
    );
  });
  it('a preview ignores placement: it always has its own worker', () => {
    expect(
      applyKind(base, { ...base, placement: { mode: 'manual', pool: 'pool-2' } }, 'draft'),
    ).toBe('none');
    expect(applyKind(base, { ...base, source: { topic: 'plant.events.v1' } }, 'draft')).toBe(
      'respawn',
    );
  });
});

describe('widgetGrants', () => {
  it('the source topic and the spec topic it reads, no publishing', () => {
    expect(widgetGrants(spec(), 'spec')).toEqual({
      publish: [],
      subscribe: ['plant.scalars.v1', SPECS_TOPIC],
    });
    expect(widgetGrants(spec(), 'draft')).toEqual({
      publish: [],
      subscribe: ['plant.scalars.v1', DRAFT_TOPIC],
    });
  });
});

describe('creatorTopics', () => {
  it('specs compacted and persistent, the draft compacted in memory', () => {
    const [specs, draft] = creatorTopics();
    expect(specs.name).toBe(SPECS_TOPIC);
    expect(draft.name).toBe(DRAFT_TOPIC);
    expect(specs).toMatchObject({ retention: { kind: 'compacted' }, durability: 'persistent' });
    expect(draft).toMatchObject({ retention: { kind: 'compacted' } });
    expect(draft).not.toMatchObject({ durability: 'persistent' });
  });
  it('a record holds a spec or a tombstone, nothing else', () => {
    expect(specRecordSchema.safeParse(specRecord(spec())).success).toBe(true);
    expect(specRecordSchema.safeParse(TOMBSTONE).success).toBe(true);
    expect(specRecordSchema.safeParse({ deleted: false }).success).toBe(false);
    expect(specRecordSchema.safeParse({ spec: { id: 'w1' } }).success).toBe(false);
    expect(specOf(specRecord(spec()))?.id).toBe('w1');
    expect(specOf(TOMBSTONE)).toBeNull();
  });
});

const recs = (n: number, from = 0, step = 100): Rec[] =>
  Array.from({ length: n }, (_, i) =>
    rec(from + i * step, i % 2 ? 'pump-1' : 'pump-2', {
      speed: 1,
      bearingTemp: i,
      ts: from + i * step,
    }),
  );

describe('RawBuffer', () => {
  it('keeps what the topic keeps, and no more than its cap', () => {
    const b = new RawBuffer(1_000, 50);
    for (const r of recs(100)) b.push(r);
    expect(b.size).toBe(50);
    // Records from 9,400 to 9,900 ms are within 1 s of 10,400.
    b.evict(9_900 + 500);
    expect(b.size).toBe(6);
  });

  it.each([
    ['series', spec()],
    [
      'scalar',
      spec({
        operators: [
          { op: 'window', ms: 60_000 },
          { op: 'aggregate', fn: 'max', field: 'bearingTemp' },
        ],
        view: { type: 'stat', size: 's' },
      }),
    ],
    [
      'grid',
      spec({
        source: { topic: 'plant.scalars.v1' },
        operators: [
          { op: 'window', ms: 60_000 },
          { op: 'aggregate', fn: 'avg', field: 'bearingTemp', groupBy: '$key', every: 1000 },
        ],
        view: { type: 'heatmap', size: 'm' },
      }),
    ],
    [
      'rows',
      spec({
        operators: [{ op: 'filter', where: { field: 'bearingTemp', op: '>', value: 10 } }],
        view: { type: 'table', size: 'm' },
      }),
    ],
  ])('a pipeline refilled from it reads as a fresh run (%s)', (_, s) => {
    const all = recs(400);
    const b = new RawBuffer(SCALARS.history);
    for (const r of all) b.push(r);
    const now = 40_000;
    const refilled = pipeline(s, SCALARS);
    b.refill(refilled);
    const fresh = pipeline(s, SCALARS);
    for (const r of all) fresh.push(r);
    expect(refilled.read(now)).toEqual(fresh.read(now));
  });
});

describe('the host side', () => {
  it('spawnWidget: its pool on the grid, its own worker as a preview', () => {
    const spawned: IsolateManifest[] = [];
    const kernel: Pick<Kernel, 'spawn'> = {
      spawn: (m) => {
        spawned.push(m);
        return { id: m.id, snapshot: vi.fn(), stop: vi.fn(), restart: vi.fn() };
      },
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- no DOM here; spawnWidget only passes the surface on
    const surface = {} as Element;
    spawnWidget(kernel, spec(), { src: '/w.js', surface, topic: SCALARS });
    spawnWidget(kernel, spec(), {
      src: '/w.js',
      surface,
      topic: SCALARS,
      mode: 'draft',
      draftId: 'd1',
    });
    expect(spawned).toEqual([
      {
        id: 'widget-w1',
        src: '/w.js',
        surface,
        config: { id: 'w1', mode: 'spec', topic: SCALARS, pool: 'pool-1' },
        grants: widgetGrants(spec(), 'spec'),
        pool: 'creator-pool-1',
      },
      {
        id: 'preview-d1',
        src: '/w.js',
        surface,
        config: { id: 'd1', mode: 'draft', topic: SCALARS },
        grants: widgetGrants(spec(), 'draft'),
      },
    ]);
    expect(() => spawnWidget(kernel, spec(), { src: '/w.js', surface, topic: EVENTS })).toThrow(
      /isn't the spec's/,
    );
  });
  it('pool and isolate ids', () => {
    expect(poolId('pool-1')).toBe('creator-pool-1');
    expect(poolOfId('creator-pool-1')).toBe('pool-1');
    expect(poolOfId('widgets')).toBeUndefined();
    expect(isolateIdOf('draft', 'd1')).toBe('preview-d1');
  });
  it('widgetConfig checks manifest.config', () => {
    expect(widgetConfig({ id: 'w1', mode: 'spec', topic: SCALARS }).id).toBe('w1');
    expect(() => widgetConfig({ id: 'w1', mode: 'auto', topic: SCALARS })).toThrow(/mode/);
    expect(() => widgetConfig({ id: 'w1', mode: 'spec', topic: {} })).toThrow(/topic/);
  });
});

describe('WidgetRunner, on the runtime’s test context', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  let clock = 0;
  function setup(config: Partial<WidgetConfig> = {}) {
    const t = createTestContext({});
    const runner = new WidgetRunner(
      isolateBus(t.ctx.bus),
      { id: 'w1', mode: 'spec', topic: SCALARS, ...config },
      { now: () => clock },
    );
    runner.start();
    const feed = (n: number): void => {
      for (let i = 0; i < n; i++) {
        clock += 100;
        t.emit(
          'plant.scalars.v1',
          { machine: 'pump-1', ts: clock, speed: 10, bearingTemp: 50 + (i % 10) },
          'pump-1',
        );
      }
    };
    return { t, runner, feed };
  }

  it('subscribes from earliest to its source topic and its spec record only', () => {
    const { t } = setup();
    expect(t.subscriptions()).toEqual([
      { topic: 'plant.scalars.v1', from: 'earliest' },
      { topic: SPECS_TOPIC, from: 'earliest' },
    ]);
  });

  it('waits for its spec, then draws what came before it too', () => {
    clock = 1_000_000;
    const { t, runner, feed } = setup();
    feed(50);
    expect(runner.tick().status).toBe('waiting');
    t.emit(SPECS_TOPIC, specRecord(spec({ id: 'w2' })), 'w2');
    expect(runner.state.status).toBe('waiting');
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    const s = runner.tick();
    expect(s.status).toBe('live');
    expect(
      s.status === 'live' && s.output?.kind === 'series' && s.output.points.length,
    ).toBeGreaterThan(3);
  });

  it('an edit reconfigures in place, refilled from the raw records', () => {
    clock = 2_000_000;
    const { t, runner, feed } = setup();
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    feed(100);
    runner.tick();
    const edited = spec({
      title: 'Max',
      operators: [
        { op: 'window', ms: 60_000 },
        { op: 'aggregate', fn: 'max', field: 'bearingTemp' },
      ],
      view: { type: 'stat', size: 's' },
    });
    t.emit(SPECS_TOPIC, specRecord(edited), 'w1');
    const s = runner.tick();
    expect(s.status === 'live' && s.spec.title).toBe('Max');
    expect(s.status === 'live' && s.output).toMatchObject({ kind: 'scalar', value: 59 });
  });

  it('a new source topic or pool: respawn, still drawing the old spec', () => {
    clock = 3_000_000;
    const { t, runner, feed } = setup();
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    feed(20);
    runner.tick();
    t.emit(SPECS_TOPIC, specRecord(spec({ placement: { mode: 'manual', pool: 'pool-9' } })), 'w1');
    const s = runner.tick();
    expect(s.status).toBe('respawn');
    expect(s.status === 'respawn' && s.spec?.placement.pool).toBe('pool-1');
    expect(s.status === 'respawn' && s.output?.kind).toBe('series');
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    expect(runner.state.status).toBe('live');
  });

  it('a first spec on another topic is a respawn too', () => {
    const { t, runner } = setup();
    t.emit(SPECS_TOPIC, specRecord(spec({ source: { topic: 'plant.events.v1' } })), 'w1');
    expect(runner.state).toEqual({ status: 'respawn', spec: undefined, output: undefined });
  });

  it('a tombstone: deleted, nothing to draw', () => {
    clock = 4_000_000;
    const { t, runner, feed } = setup();
    t.emit(SPECS_TOPIC, specRecord(spec()), 'w1');
    feed(10);
    t.emit(SPECS_TOPIC, TOMBSTONE, 'w1');
    expect(runner.tick()).toEqual({ status: 'deleted' });
  });

  it('a preview reads the draft and rebuilds 300 ms after the last change', () => {
    vi.useFakeTimers();
    clock = 5_000_000;
    const { t, runner, feed } = setup({ id: 'd1', mode: 'draft' });
    expect(t.subscriptions()[1]).toEqual({ topic: DRAFT_TOPIC, from: 'earliest' });
    t.emit(DRAFT_TOPIC, specRecord(spec()), 'd1');
    expect(runner.state.status).toBe('live');
    feed(10);
    t.emit(DRAFT_TOPIC, specRecord(spec({ title: 'A' })), 'd1');
    vi.advanceTimersByTime(DRAFT_DELAY_MS - 50);
    t.emit(DRAFT_TOPIC, specRecord(spec({ title: 'AB' })), 'd1');
    vi.advanceTimersByTime(DRAFT_DELAY_MS - 50);
    expect(runner.state.status === 'live' && runner.state.spec.title).toBe('Pump 1 bearing p95');
    vi.advanceTimersByTime(100);
    expect(runner.state.status === 'live' && runner.state.spec.title).toBe('AB');
  });

  it('stop unsubscribes', () => {
    const { t, runner } = setup();
    runner.stop();
    expect(t.subscriptions()).toEqual([]);
  });
});
