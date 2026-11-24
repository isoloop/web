import type { BenchWindow, CopyResult } from '../harness.ts';

export type Placement =
  | 'native-main'
  | 'native-worker'
  | 'isoloop-own'
  | 'isoloop-one'
  | 'isoloop-balancer';
export const PLACEMENTS: Placement[] = [
  'native-main',
  'native-worker',
  'isoloop-own',
  'isoloop-one',
  'isoloop-balancer',
];

export interface CopySpec {
  id: string;
  workload: string;
  seed: number;
  batch: number;
}

export interface CopyOutcome extends CopySpec {
  result: CopyResult | null;
  /** Starts of this copy (more than 1 after balancer moves). */
  lives: number;
}

export interface BalancerEvent {
  /** ms from the window's start (negative: during the warm-up). */
  at: number;
  kind: 'move' | 'arrived' | 'spike' | 'behind' | 'failed' | 'crash';
  id: string;
  detail: Record<string, unknown>;
}

export interface PageResult {
  placement: Placement;
  window: BenchWindow;
  copies: CopyOutcome[];
  totalOpsPerMin: number;
  /** Every copy reported a checksum (the runner compares values across placements). */
  checksumsMatch: boolean;
  /** The main thread's 100 ms probe, inside the window. */
  lateness: { p50Ms: number; p95Ms: number; maxMs: number; samples: number };
  events: BalancerEvent[];
  /** Pool per copy at the end (isoloop placements). */
  poolsAtEnd: Record<string, string>;
  setupMs: number;
  userAgent: string;
  hardwareConcurrency: number;
}

/** A placement's handle: prepares copies, then runs them in a window. */
export interface Runner {
  /** Resolves with each copy's checksum once its inputs are ready. */
  ready(): Promise<number[]>;
  run(window: BenchWindow): Promise<Omit<CopyOutcome, keyof CopySpec>[]>;
  events: BalancerEvent[];
  poolsAtEnd(): Record<string, string>;
}
