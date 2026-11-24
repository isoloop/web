// compare's machine check (docs/plans/js-bench.md, decision 7): two runs on
// different machines differ by the machine, not by Isoloop, so compare
// refuses them unless told otherwise. A new machine's first run is the last
// release again, as its baseline (apps/bench/machines.md).

/** The machine id a run.json records; runs from before the id have none. */
export const machineOf = (run: { env: { machine?: string } }): string | null =>
  run.env.machine ?? null;

/** Null when the runs can be compared; else why not. */
export function machineMismatch(
  before: string | null,
  after: string | null,
  allowChange: boolean,
): string | null {
  if (before === after || allowChange) return null;
  return `The runs are from different machines: ${before ?? 'unnamed'} before, ${after ?? 'unnamed'} after. Compare runs from one machine, or pass --allow-machine-change to compare them anyway.`;
}
