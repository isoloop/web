// Creator pools (M3e decision 13): named `pool-1`, `pool-2`… in specs, shown
// as "Pool 1", "Pool 2"…, run as the kernel pools `creator-pool-1`… (poolId).
// `auto` widgets aren't in them: the balancer's pools are its own (auto.ts).
import type { IsolateSnapshot, PoolSnapshot } from '@isoloop/host';
import type { WidgetSpec } from '../spec/types';
import { poolId } from '../widget/host';
import type { PoolStatus } from './ui';

const NUMBERED = /^pool-(\d+)$/;

/** "Pool 3" for `pool-3`; any other name as it is. */
export function poolLabel(pool: string): string {
  const m = NUMBERED.exec(pool);
  return m ? `Pool ${m[1]}` : pool;
}

/** The next free numbered pool: one past the highest in use. */
export function nextPool(pools: readonly string[]): string {
  let max = 0;
  for (const p of pools) {
    const m = NUMBERED.exec(p);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `pool-${max + 1}`;
}

const numberOf = (p: string): number => {
  const m = NUMBERED.exec(p);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
};

/** Pools by number, then by name. */
export function sortPools(pools: Iterable<string>): string[] {
  return [...new Set(pools)].toSorted((a, b) => numberOf(a) - numberOf(b) || a.localeCompare(b));
}

/**
 * The placement field's list: each pool the page's widgets name, with how
 * many widgets it holds and its worker's lag from the kernel's snapshots.
 */
export function poolStatus(
  specs: readonly WidgetSpec[],
  snapshots: { isolates: readonly IsolateSnapshot[]; pools: readonly PoolSnapshot[] },
): PoolStatus[] {
  const members = new Map<string, number>();
  for (const s of specs) {
    if (s.placement.mode !== 'manual') continue;
    members.set(s.placement.pool, (members.get(s.placement.pool) ?? 0) + 1);
  }
  return sortPools(members.keys()).map((pool) => {
    const kernelPool = poolId(pool);
    const lags = snapshots.isolates
      .filter((i) => i.pool === kernelPool && i.state === 'running' && i.lastBeatAt > 0)
      .map((i) => i.lagMs);
    return {
      pool,
      label: poolLabel(pool),
      members: members.get(pool) ?? 0,
      lagMs: lags.length > 0 ? Math.max(...lags) : null,
    };
  });
}
