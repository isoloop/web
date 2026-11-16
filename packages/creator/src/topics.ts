// The creator's topic definitions (M3e decision 11), for each interactive
// page's contracts module: `contracts(...dashboardTopics, ...creatorTopics())`.
// Contracts can't change at run time (isoloop ADR 0003, decision 9), so both
// are declared at boot, empty until the page uses them.
import { topic } from '@isoloop/bus';
import { z } from 'zod';
import { specShape } from './spec/validate';
import { DRAFT_TOPIC, SPECS_TOPIC } from './widget/records';

/**
 * A spec record's shape, as the bus checks it: `{ spec }` or the tombstone
 * `{ deleted: true }`. The bus checks the shape only; `validateSpec` checks a
 * spec against the catalog before it's published.
 */
export const specRecordSchema = z.union([
  z.strictObject({ spec: specShape }),
  z.strictObject({ deleted: z.literal(true) }),
]);

/** `creator.specs.v1` (compacted, persistent) and `creator.draft.v1` (compacted, memory). */
export function creatorTopics() {
  return [
    topic(SPECS_TOPIC, {
      schema: specRecordSchema,
      retention: { kind: 'compacted' },
      durability: 'persistent',
    }),
    topic(DRAFT_TOPIC, { schema: specRecordSchema, retention: { kind: 'compacted' } }),
  ] as const;
}
