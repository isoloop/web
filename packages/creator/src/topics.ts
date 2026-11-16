// The creator's topic definitions (M3e decision 11), for each interactive
// page's contracts module: `contracts(...dashboardTopics, ...creatorTopics())`.
// Contracts can't change at run time (isoloop ADR 0003, decision 9), so both
// are declared at boot, empty until the page uses them.
import { topic } from '@isoloop/bus';
import { z } from 'zod';
import { specShape } from './spec/validate';
import { DRAFT_TOPIC, SPECS_TOPIC, UI_TOPIC } from './widget/records';

/**
 * A spec record's shape, as the bus checks it: `{ spec }` or the tombstone
 * `{ deleted: true }`. The bus checks the shape only; `validateSpec` checks a
 * spec against the catalog before it's published.
 */
export const specRecordSchema = z.union([
  z.strictObject({ spec: specShape, added: z.number().optional() }),
  z.strictObject({ deleted: z.literal(true) }),
  z.strictObject({ sync: z.string().max(64) }),
]);

const poolStatus = z.strictObject({
  pool: z.string().max(64),
  label: z.string().max(64),
  members: z.number().int().nonnegative(),
  lagMs: z.number().nonnegative().nullable(),
});

/**
 * `creator.ui.v1`: the page and the drawer (board/ui.ts). `pools` the page
 * publishes about once a second; `open` when it opens the drawer; `done` the
 * drawer publishes when it added, saved, deleted or cancelled.
 */
export const uiRecordSchema = z.union([
  z.strictObject({ pools: z.array(poolStatus).max(64) }),
  z.strictObject({
    open: z.strictObject({
      n: z.number().int(),
      mode: z.enum(['add', 'edit']),
      draftId: z.string().max(64),
      id: z.string().max(64).optional(),
    }),
  }),
  z.strictObject({
    done: z.strictObject({
      n: z.number().int(),
      what: z.enum(['added', 'saved', 'deleted', 'cancel']),
      id: z.string().max(64).optional(),
    }),
  }),
]);

/**
 * `creator.specs.v1` (compacted, persistent), `creator.draft.v1` and
 * `creator.ui.v1` (compacted, memory).
 */
export function creatorTopics() {
  return [
    topic(SPECS_TOPIC, {
      schema: specRecordSchema,
      retention: { kind: 'compacted' },
      durability: 'persistent',
    }),
    topic(DRAFT_TOPIC, { schema: specRecordSchema, retention: { kind: 'compacted' } }),
    topic(UI_TOPIC, { schema: uiRecordSchema, retention: { kind: 'compacted' } }),
  ] as const;
}
