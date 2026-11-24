// Which pages a bench run opens, in which order.
import type { Placement } from '../src/page/types.ts';
import { WORKLOADS, type Tier } from '../src/workloads/index.ts';

export interface Job {
  /** File stem: `<workload>-n<N>` or `scenario-mixed`. */
  key: string;
  tier: Tier | 'scenario';
  workloads: string[];
  copies: string;
  n: number;
  placement: Placement;
  warmMs: number;
  windowMs: number;
}

export interface MatrixOptions {
  tiers: Tier[];
  workloads?: string[];
  ns: number[];
  placements?: Placement[];
  scenario: boolean;
  scenarioOnly: boolean;
  warmMs: number;
  windowMs: number;
  balancerWarmMs: number;
  scenarioWarmMs: number;
  scenarioWindowMs: number;
}

/** For n=1, own and one are the same and the balancer has nothing to place. */
export function placementsFor(n: number): Placement[] {
  return n === 1
    ? ['native-main', 'native-worker', 'isoloop-own']
    : ['native-main', 'native-worker', 'isoloop-own', 'isoloop-one', 'isoloop-balancer'];
}

/** The balancer scenario: 2 heavy copies and 6 cheap ones at once. */
export const MIXED = [
  'sort-typed-1m',
  'structured-clone-5mb',
  'map-get-set',
  'set-add-has-delete',
  'array-push-pop-indexof',
  'object-read-write',
  'small-filter-map',
  'map-get-set',
];

/** Groups of jobs: each group is one workload and n, its configs run back to back. */
export function groups(o: MatrixOptions): Job[][] {
  const out: Job[][] = [];
  if (!o.scenarioOnly) {
    const selected = WORKLOADS.filter((w) =>
      o.workloads ? o.workloads.includes(w.id) : o.tiers.includes(w.tier),
    );
    for (const w of selected) {
      for (const n of o.ns) {
        const placements = placementsFor(n).filter(
          (p) => !o.placements || o.placements.includes(p),
        );
        out.push(
          placements.map((placement) => ({
            key: `${w.id}-n${n}`,
            tier: w.tier,
            workloads: [w.id],
            copies: `${w.id}*${n}`,
            n,
            placement,
            warmMs: placement === 'isoloop-balancer' ? o.balancerWarmMs : o.warmMs,
            windowMs: o.windowMs,
          })),
        );
      }
    }
  }
  if (o.scenario || o.scenarioOnly) {
    const placements = (['isoloop-own', 'isoloop-one', 'isoloop-balancer'] as Placement[]).filter(
      (p) => !o.placements || o.placements.includes(p),
    );
    out.push(
      placements.map((placement) => ({
        key: 'scenario-mixed',
        tier: 'scenario',
        workloads: [...new Set(MIXED)],
        copies: MIXED.join(','),
        n: MIXED.length,
        placement,
        warmMs: o.scenarioWarmMs,
        windowMs: o.scenarioWindowMs,
      })),
    );
  }
  return out;
}

/** Round r runs every group with its configs rotated by r, so drift spreads over configs. */
export function schedule(gs: Job[][], rounds: number): { job: Job; round: number }[] {
  const out: { job: Job; round: number }[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (const g of gs) {
      for (let k = 0; k < g.length; k++) out.push({ job: g[(k + r - 1) % g.length]!, round: r });
    }
  }
  return out;
}
