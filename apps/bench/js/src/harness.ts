// The one loop every placement runs (main thread, plain Worker, isolate).
import { workload as find, type Workload } from './workloads/index.ts';

/** A wall-clock window, epoch ms: `performance.timeOrigin + performance.now()`. */
export interface BenchWindow {
  startAt: number;
  endAt: number;
}

export interface Prepared {
  workload: Workload;
  state: unknown;
  /** The first op's result on fresh inputs: equal across placements when the same work runs. */
  checksum: number;
}

export interface CopyResult {
  ops: number;
  opsPerMin: number;
  /** Per-op time from each batch inside the window, µs. */
  opP50Us: number | null;
  opP95Us: number | null;
  batches: number;
  checksum: number;
}

export interface RunOptions {
  prepared: Prepared;
  /** Ops between clock reads (calibrated to about 1 ms). */
  batch: number;
  window: BenchWindow;
  /** Ops already counted before a restart (a balancer move). */
  startOps?: number;
  /** Op index to carry on from, so keys keep varying after a restart. */
  startIndex?: number;
  sliceMs?: number;
  /** Called after each slice with the ops counted so far (startOps included). */
  onSlice?: (ops: number, index: number) => void;
  /** Checked after each slice: true ends the run early (the isolate is stopping). */
  stopped?: () => boolean;
  now?: () => number;
  pause?: () => Promise<void>;
}

export const wallNow = (): number => performance.timeOrigin + performance.now();
const yieldNow = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

let sink = 0;
/** Read once at the end so the engine can't drop the work. */
export const sinkValue = (): number => sink;

export function prepare(id: string, seed: number): Prepared {
  const workload = find(id);
  const state = workload.setup(seed);
  const checksum = workload.op(state, 0);
  return { workload, state, checksum };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

/**
 * Runs batches of ops in slices of about `sliceMs`, yielding between slices,
 * from now until `window.endAt`. Ops before `startAt` are the warm-up; a batch
 * counts when it ends inside the window.
 */
export async function runFor(o: RunOptions): Promise<CopyResult> {
  const now = o.now ?? wallNow;
  const pause = o.pause ?? yieldNow;
  const sliceMs = o.sliceMs ?? 50;
  const { workload, state } = o.prepared;
  const op = workload.op;
  const batch = Math.max(1, Math.floor(o.batch));
  let ops = o.startOps ?? 0;
  let i = o.startIndex ?? 1;
  const perOpUs: number[] = [];
  let t = now();
  while (t < o.window.endAt) {
    const sliceStart = t;
    do {
      const b0 = t;
      for (let k = 0; k < batch; k++) sink = (sink + op(state, i++)) % 1e9;
      t = now();
      if (t > o.window.startAt && t <= o.window.endAt) {
        ops += batch;
        perOpUs.push(((t - b0) * 1000) / batch);
      }
    } while (t - sliceStart < sliceMs && t < o.window.endAt);
    o.onSlice?.(ops, i);
    if (o.stopped?.()) break;
    await pause();
    t = now();
  }
  perOpUs.sort((a, b) => a - b);
  const windowMs = o.window.endAt - o.window.startAt;
  return {
    ops,
    opsPerMin: (ops * 60_000) / windowMs,
    opP50Us: percentile(perOpUs, 0.5),
    opP95Us: percentile(perOpUs, 0.95),
    batches: perOpUs.length,
    checksum: o.prepared.checksum,
  };
}

/** Times `op` on the current thread for about `ms`: per-op µs, for calibration. */
export function measureOp(prepared: Prepared, ms: number): number {
  const { workload, state } = prepared;
  let n = 0;
  const t0 = performance.now();
  let t = t0;
  while (t - t0 < ms || n < 3) {
    sink = (sink + workload.op(state, n + 1)) % 1e9;
    n++;
    t = performance.now();
  }
  return ((t - t0) * 1000) / n;
}

/** A batch of about `targetMs` (1 ms by default), at least 1. */
export const batchFor = (perOpUs: number, targetMs = 1): number =>
  Math.max(1, Math.round((targetMs * 1000) / perOpUs));
