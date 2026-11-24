// The bench page. The runner opens it with the run in the query string and
// reads `window.__bench`:
//   ?placement=isoloop-own&copies=sort-numbers-10k*4&batches=sort-numbers-10k:3
//    &warm=10000&window=60000&seed=1&maxWorkers=4
// `copies` is a comma list of workload ids, each with an optional `*n`.
import { batchFor, measureOp, prepare, wallNow } from '../harness.ts';
import { WORKLOADS } from '../workloads/index.ts';
import { nativeMain, nativeWorker } from './native.ts';
import {
  PLACEMENTS,
  type CopySpec,
  type PageResult,
  type Placement,
  type Runner,
} from './types.ts';

declare global {
  interface Window {
    __bench: { state: 'running' | 'done' | 'error'; result?: PageResult; error?: string };
  }
}

window.__bench = { state: 'running' };
const out = document.getElementById('out')!;
const log = (s: string): void => {
  out.textContent += `\n${s}`;
};

function parse() {
  const q = new URLSearchParams(location.search);
  const placement = q.get('placement') as Placement;
  if (!PLACEMENTS.includes(placement))
    throw new Error(`placement must be one of ${PLACEMENTS.join(', ')}`);
  const batches = new Map(
    (q.get('batches') ?? '')
      .split(',')
      .filter(Boolean)
      .map((p) => {
        const [id, n] = p.split(':');
        return [id!, Number(n)] as const;
      }),
  );
  const seed = Number(q.get('seed') ?? 1);
  const copies: CopySpec[] = [];
  for (const part of (q.get('copies') ?? '').split(',').filter(Boolean)) {
    const [workload, times] = part.split('*');
    for (let k = 0; k < Number(times ?? 1); k++) {
      copies.push({
        id: `c${copies.length + 1}-${workload}`,
        workload: workload!,
        seed: seed + copies.length,
        batch: batches.get(workload!) ?? 1,
      });
    }
  }
  if (copies.length === 0) throw new Error('no copies');
  return {
    placement,
    copies,
    warm: Number(q.get('warm') ?? 10_000),
    windowMs: Number(q.get('window') ?? 60_000),
    maxWorkers: Number(q.get('maxWorkers') ?? 4),
  };
}

/** setInterval(100) lateness on the main thread, inside [startAt, endAt]. */
function probe(startAt: number, endAt: number) {
  const late: number[] = [];
  let expected = wallNow() + 100;
  const timer = setInterval(() => {
    const t = wallNow();
    if (t >= startAt && t <= endAt) late.push(Math.max(0, t - expected));
    expected = t + 100;
  }, 100);
  return () => {
    clearInterval(timer);
    late.sort((a, b) => a - b);
    const at = (p: number): number =>
      late[Math.min(late.length - 1, Math.floor(p * late.length))] ?? 0;
    return {
      p50Ms: at(0.5),
      p95Ms: at(0.95),
      maxMs: late[late.length - 1] ?? 0,
      samples: late.length,
    };
  };
}

async function main(): Promise<void> {
  const cfg = parse();
  log(`${cfg.placement}: ${cfg.copies.map((c) => c.workload).join(', ')}`);
  const t0 = performance.now();
  let runner: Runner;
  if (cfg.placement === 'native-main') runner = nativeMain(cfg.copies);
  else if (cfg.placement === 'native-worker') runner = nativeWorker(cfg.copies);
  else runner = (await import('./isoloop.ts')).isoloop(cfg.placement, cfg.copies, cfg.maxWorkers);
  const checksums = await runner.ready();
  const setupMs = performance.now() - t0;
  const startAt = wallNow() + cfg.warm;
  const win = { startAt, endAt: startAt + cfg.windowMs };
  log(`ready in ${Math.round(setupMs)} ms; window ${cfg.warm} + ${cfg.windowMs} ms`);
  const stopProbe = probe(win.startAt, win.endAt);
  const outcomes = await runner.run(win);
  const lateness = stopProbe();
  const copies = cfg.copies.map((c, k) => ({ ...c, ...outcomes[k]! }));
  // Each copy's first-op checksum, from its ready step. The runner compares
  // them across placements; NaN means a copy never reported ready.
  const checksumsMatch = checksums.every((s) => !Number.isNaN(s));
  const result: PageResult = {
    placement: cfg.placement,
    window: win,
    copies: copies.map((c, k) => ({
      ...c,
      result: c.result ? { ...c.result, checksum: checksums[k]! } : null,
    })),
    totalOpsPerMin: copies.reduce((s, c) => s + (c.result?.opsPerMin ?? 0), 0),
    checksumsMatch,
    lateness,
    events: runner.events,
    poolsAtEnd: runner.poolsAtEnd(),
    setupMs,
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
  log(`total ${Math.round(result.totalOpsPerMin)} ops/min`);
  window.__bench = { state: 'done', result };
}

/** ?calibrate=1: each workload on the main thread for `ms`, per-op µs and its batch. */
async function calibrate(ms: number): Promise<void> {
  const rows = [];
  for (const w of WORKLOADS) {
    const prepared = prepare(w.id, 1);
    measureOp(prepared, Math.min(200, ms / 4)); // warm-up
    const perOpUs = measureOp(prepared, ms);
    rows.push({ id: w.id, tier: w.tier, title: w.title, perOpUs, batch: batchFor(perOpUs) });
    log(`${w.id}: ${perOpUs.toFixed(2)} µs/op`);
    await new Promise((r) => setTimeout(r, 0));
  }
  window.__bench = {
    state: 'done',
    result: { calibration: rows, userAgent: navigator.userAgent } as never,
  };
}

const q = new URLSearchParams(location.search);
(q.has('calibrate') ? calibrate(Number(q.get('ms') ?? 1500)) : main()).catch((e: unknown) => {
  const error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
  log(`error: ${error}`);
  window.__bench = { state: 'error', error };
});
