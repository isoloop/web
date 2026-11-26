// The balancer reports an isolate that sits in quarantine only to be measured
// as `measuring` (a new isolate without a stored load, one a bisect moved
// there), and its way out as a `measured` move. `quarantined` and `steady`
// are for offenders only (isoloop/isoloop#346). The pages show the two apart.

import type { PlacementState } from '@isoloop/balancer';

/** Whether a placement is only being measured, not serving a quarantine. */
export const isMeasuring = (state: PlacementState | undefined): boolean => state === 'measuring';

/**
 * What a quarantine pool's column is called: `measuring` while every member is
 * only being measured, `quarantine` once an offender is in it.
 */
export const quarantineKind = (
  members: readonly { measuring: boolean }[],
): 'quarantine' | 'measuring' => (members.every((m) => m.measuring) ? 'measuring' : 'quarantine');
