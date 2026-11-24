import { cheap } from './cheap.ts';
import { heavy } from './heavy.ts';
import { regular } from './regular.ts';
import type { Tier, Workload } from './types.ts';

export type { Tier, Workload } from './types.ts';

export const WORKLOADS: Workload[] = [...cheap, ...regular, ...heavy];
export const TIERS: Tier[] = ['cheap', 'regular', 'heavy'];

export function workload(id: string): Workload {
  const w = WORKLOADS.find((x) => x.id === id);
  if (!w) throw new Error(`unknown workload: ${id}`);
  return w;
}
