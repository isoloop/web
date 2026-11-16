// The creator's two topics, by name, and the records they hold (M3e decisions
// 10–12). No Zod here, so a widget isolate can import it; the schemas the bus
// checks are in ../topics.ts, for each page's contracts module.
import type { WidgetSpec } from '../spec/types';

/** Every widget's spec, keyed by widget id; compacted and persistent. */
export const SPECS_TOPIC = 'creator.specs.v1';
/** The drawer's draft, keyed by draft id; compacted, in memory. The preview reads it. */
export const DRAFT_TOPIC = 'creator.draft.v1';

/**
 * A spec record: the widget's spec, or a tombstone. The bus has no delete, so
 * a deleted widget's key keeps `{ deleted: true }` as its last value.
 */
export type SpecRecord = { readonly spec: WidgetSpec } | { readonly deleted: true };

export const TOMBSTONE: SpecRecord = { deleted: true };

export function specRecord(spec: WidgetSpec): SpecRecord {
  return { spec };
}

/** The spec a record holds, or `null` for a tombstone (or anything else). */
export function specOf(value: unknown): WidgetSpec | null {
  if (typeof value !== 'object' || value === null || !('spec' in value)) return null;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus checked the record against specRecordSchema (topics.ts)
  return (value as { spec: WidgetSpec }).spec;
}

/** Which topic a widget reads its spec from: its own record, or the drawer's draft. */
export type WidgetMode = 'spec' | 'draft';

export const specTopicOf = (mode: WidgetMode): string =>
  mode === 'spec' ? SPECS_TOPIC : DRAFT_TOPIC;
