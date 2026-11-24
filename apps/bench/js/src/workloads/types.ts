export type Tier = 'cheap' | 'regular' | 'heavy';

/**
 * One benchmark operation. `setup` builds the inputs outside the timed loop;
 * `op` is one operation, which returns a number fed to a sink so the engine
 * can't drop the work. `i` is the op's index, used to vary keys between ops.
 * An op that would mutate its input (sorts) works on a copy, and the copy is
 * part of the op everywhere.
 */
export interface Workload<S = any> {
  id: string;
  tier: Tier;
  title: string;
  setup(seed: number): S;
  op(state: S, i: number): number;
}
