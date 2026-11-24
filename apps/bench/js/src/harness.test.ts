import { expect, it } from 'vitest';
import { prepare, runFor } from './harness.ts';

/** A fake clock: each op costs 1 ms. */
function clock() {
  let t = 0;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

it('counts only batches that end inside the window', async () => {
  const c = clock();
  const prepared = prepare('small-filter-map', 1);
  const op = prepared.workload.op;
  prepared.workload = { ...prepared.workload, op: (s, i) => (c.tick(1), op(s, i)) };
  const r = await runFor({
    prepared,
    batch: 2,
    window: { startAt: 100, endAt: 1100 },
    now: c.now,
    pause: async () => {},
  });
  // Batches of 2 ms ending in (100, 1100]: 102, 104, … 1100.
  expect(r.ops).toBe(1000);
  expect(r.opsPerMin).toBe(60_000);
  expect(r.opP50Us).toBe(1000);
});

it('carries on from a count after a restart', async () => {
  const c = clock();
  const prepared = prepare('small-filter-map', 1);
  const op = prepared.workload.op;
  prepared.workload = { ...prepared.workload, op: (s, i) => (c.tick(1), op(s, i)) };
  const r = await runFor({
    prepared,
    batch: 1,
    window: { startAt: 0, endAt: 10 },
    startOps: 500,
    now: c.now,
    pause: async () => {},
  });
  expect(r.ops).toBe(510);
});
