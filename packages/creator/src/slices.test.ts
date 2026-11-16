// A widget's work in slices (runner.ts SLICE_MS): a read can take seconds,
// and a worker that blocks past the heartbeat's killAfterMs is killed as
// hung, so the pipeline advances in units and the runner yields between
// slices. The answers must be the same as one read all at once.
import { createTestContext } from '@isoloop/runtime/testing';
import { describe, expect, it } from 'vitest';
import type { CatalogTopic, Rec } from './catalog';
import type { Output } from './outputs';
import { pipeline } from './pipeline';
import type { Operator, WidgetSpec } from './spec/types';
import { isolateBus } from './widget/bus';
import { specRecord, SPECS_TOPIC } from './widget/records';
import { SLICE_MS, WidgetRunner, type WidgetState } from './widget/runner';

const VIB: CatalogTopic = {
  name: 'plant.vib',
  title: 'Raw vibration',
  key: { label: 'Machine' },
  fields: [
    { name: 't0', type: 'time' },
    { name: 'machine', type: 'string' },
    { name: 'value', type: 'number', unit: 'mm/s' },
  ],
  history: 30_000,
  time: 't0',
  samples: { field: 'values', value: 'value' },
};

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

/** `seconds` of chunks every 50 ms for `machines` machines, `perChunk` samples each, ending before `end`. */
function vib(end: number, seconds: number, machines: number, perChunk: number, seed = 3): Rec[] {
  const rnd = rng(seed);
  const out: Rec[] = [];
  for (let t = end - seconds * 1_000; t < end; t += 50)
    for (let m = 0; m < machines; m++) {
      const values = new Float32Array(perChunk);
      for (let i = 0; i < perChunk; i++) values[i] = Math.round(rnd() * 400) / 10;
      const machine = `M${m}`;
      out.push({ key: machine, t, value: { t0: t, machine, values } });
    }
  return out;
}

function widget(operators: Operator[], id = 'w1'): WidgetSpec {
  return {
    id,
    title: 'p99',
    source: { topic: VIB.name },
    operators,
    view: { type: 'line', size: 'l' },
    placement: { mode: 'manual', pool: 'pool-1' },
  };
}

const HEAVY: Operator[] = [
  { op: 'window', ms: 30_000 },
  { op: 'aggregate', fn: 'percentile', p: 99, field: 'value', every: 1_000, groupBy: '$key' },
];

const SHAPES: Record<string, Operator[]> = {
  'grid with every': HEAVY,
  'grid now': [
    { op: 'window', ms: 10_000 },
    { op: 'aggregate', fn: 'percentile', p: 50, field: 'value', groupBy: '$key' },
  ],
  series: [
    { op: 'window', ms: 5_000 },
    { op: 'aggregate', fn: 'max', field: 'value', every: 500 },
  ],
  scalar: [
    { op: 'window', ms: 5_000 },
    { op: 'aggregate', fn: 'avg', field: 'value' },
  ],
};

describe('a pipeline advanced one unit at a time', () => {
  for (const [name, ops] of Object.entries(SHAPES)) {
    it(`gives the same outputs as reading at once (${name})`, () => {
      const end = 100_000;
      const recs = vib(end, 12, 4, 40);
      const whole = pipeline(widget(ops), VIB);
      const sliced = pipeline(widget(ops), VIB);
      for (const r of recs) {
        whole.push(r);
        sliced.push(r);
      }
      // Several reads, with records arriving between them.
      const later = vib(end + 3_000, 3, 4, 40, 9);
      const reads: [number, Rec[]][] = [
        [end, []],
        [end + 1_500, later.slice(0, later.length / 2)],
        [end + 3_000, later.slice(later.length / 2)],
      ];
      for (const [now, more] of reads) {
        for (const r of more) {
          whole.push(r);
          sliced.push(r);
        }
        const expected = whole.read(now);
        let calls = 0;
        // Out of time after every unit: the most slicing there can be.
        while (!sliced.advance(now, () => true)) calls++;
        expect(sliced.output()).toEqual(expected);
        if (name === 'grid with every' && now === end) expect(calls).toBeGreaterThan(10);
      }
    });
  }

  it('keeps the last finished output while a read is in flight', () => {
    const p = pipeline(widget(HEAVY), VIB);
    for (const r of vib(100_000, 10, 4, 20)) p.push(r);
    expect(p.output()).toBeUndefined();
    expect(p.advance(100_000, () => true)).toBe(false);
    expect(p.output()).toBeUndefined();
    while (!p.advance(100_000, () => true));
    const first = p.output();
    expect(first?.kind).toBe('grid');
    expect(p.advance(101_000, () => true)).toBe(false);
    expect(p.output()).toBe(first);
  });
});

/** A test bus with the heavy widget's spec and `recs` on its source topic. */
function heavyRunner(recs: readonly Rec[], o: { onChange?: (s: WidgetState) => void } = {}) {
  const t = createTestContext({});
  let now = 0;
  const runner = new WidgetRunner(
    isolateBus(t.ctx.bus),
    { id: 'w1', mode: 'spec', topic: VIB, pool: 'pool-1' },
    { now: () => now, ...o },
  );
  runner.start();
  for (const r of recs) {
    now = r.t;
    t.emit(VIB.name, r.value, r.key);
  }
  return { t, runner, setNow: (n: number) => (now = n) };
}

const nextTask = (): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, 0);
  });

/** Lets `n` tasks run, one after another. */
async function tasks(n: number): Promise<void> {
  if (n === 0) return;
  await nextTask();
  await tasks(n - 1);
}

describe('the runner in slices', () => {
  it('finishes a long first read in later tasks, each slice near SLICE_MS', async () => {
    // Plant at 5 kHz: 8 machines, 250 samples every 50 ms, 30 s kept.
    const end = 1_000_000;
    const recs = vib(end, 30, 8, 250);
    const outputs: Output[] = [];
    const { t, runner, setNow } = heavyRunner(recs, {
      onChange: (s) => {
        if (s.status === 'live' && s.output) outputs.push(s.output);
      },
    });
    t.emit(SPECS_TOPIC, specRecord(widget(HEAVY)), 'w1');
    setNow(end);
    const started = performance.now();
    const first = runner.tick();
    expect(first.status).toBe('live');
    // The whole read takes far longer than one slice, so it isn't in yet.
    expect(first.status === 'live' && first.output).toBeUndefined();
    // The test's own task runs between slices; each gap between two of its
    // turns is how long the thread was held.
    const gaps: number[] = [];
    const wait = async (last: number): Promise<void> => {
      if (outputs.length > 0) return;
      if (last - started > 60_000) throw new Error('the read never finished');
      await nextTask();
      const now = performance.now();
      gaps.push(now - last);
      await wait(now);
    };
    await wait(performance.now());
    const out = outputs[0];
    expect(out?.kind).toBe('grid');
    if (out?.kind !== 'grid') return;
    expect(out.groups).toHaveLength(8);
    expect(out.times.length).toBeGreaterThan(20);
    // Generous against a loaded CI runner; unsliced, this read blocks for
    // about a second on a fast core.
    expect(Math.max(...gaps)).toBeLessThan(SLICE_MS + 200);
  });

  it('never publishes a replaced spec’s output', async () => {
    const end = 1_000_000;
    const changes: WidgetState[] = [];
    const { t, runner, setNow } = heavyRunner(vib(end, 30, 8, 250), {
      onChange: (s) => changes.push(s),
    });
    t.emit(SPECS_TOPIC, specRecord(widget(HEAVY)), 'w1');
    setNow(end);
    runner.tick();
    // While the heavy read is in flight, the spec becomes a light one.
    const light = widget([
      { op: 'window', ms: 1_000 },
      { op: 'aggregate', fn: 'count' },
    ]);
    t.emit(SPECS_TOPIC, specRecord(light), 'w1');
    const s = runner.tick();
    expect(s.status === 'live' && s.output).toMatchObject({ kind: 'scalar' });
    await tasks(50);
    // Nothing from the heavy read arrived after the light spec applied.
    const after = changes.slice(changes.findIndex((c) => c.status === 'live' && c.spec === light));
    for (const c of after)
      if (c.status === 'live' && c.output) expect(c.output.kind).toBe('scalar');
  });

  it('stops working when stopped', async () => {
    const end = 1_000_000;
    let changed = 0;
    const { t, runner, setNow } = heavyRunner(vib(end, 30, 8, 250), {
      onChange: () => changed++,
    });
    t.emit(SPECS_TOPIC, specRecord(widget(HEAVY)), 'w1');
    setNow(end);
    runner.tick();
    const before = changed;
    runner.stop();
    await tasks(50);
    expect(changed).toBe(before);
  });
});
