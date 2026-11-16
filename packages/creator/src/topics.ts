// The creator's topic definitions (M3e decision 11), for each interactive
// page's contracts module: `contracts(...dashboardTopics, ...creatorTopics())`.
// Contracts can't change at run time (isoloop ADR 0003, decision 9), so both
// are declared at boot, empty until the page uses them.
import { topic } from '@isoloop/bus';
import { z } from 'zod';
import { specShape } from './spec/validate';
import { DRAFT_TOPIC, PLACEMENT_TOPIC, SPECS_TOPIC, UI_TOPIC } from './widget/records';

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

const autoPlacement = z.strictObject({
  id: z.string().max(64),
  pool: z.string().max(64),
  label: z.string().max(64),
  state: z.enum(['placed', 'quarantined', 'kept-apart', 'moving']),
  atCap: z.boolean().optional(),
});

/**
 * `creator.ui.v1`: the page and the drawer (board/ui.ts). `pools` and
 * `placements` the page publishes about once a second; `open` when it opens
 * the drawer; `done` the drawer publishes when it added, saved, deleted or
 * cancelled.
 */
export const uiRecordSchema = z.union([
  z.strictObject({ pools: z.array(poolStatus).max(64) }),
  z.strictObject({ placements: z.array(autoPlacement).max(64) }),
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
 * A load record in `creator.placement.v1` (M3h decision 12): the widget's
 * measured share of one core, a tombstone once it's deleted, or the page's
 * replay probe (board/loads.ts).
 */
export const placementRecordSchema = z.union([
  z.strictObject({ loadPct: z.number().min(0).max(10_000) }),
  z.strictObject({ deleted: z.literal(true) }),
  z.strictObject({ sync: z.string().max(64) }),
]);

/**
 * `creator.specs.v1` and `creator.placement.v1` (compacted, persistent),
 * `creator.draft.v1` and `creator.ui.v1` (compacted, memory).
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
    topic(PLACEMENT_TOPIC, {
      schema: placementRecordSchema,
      retention: { kind: 'compacted' },
      durability: 'persistent',
    }),
  ] as const;
}
