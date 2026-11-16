// The creator's two topics, by name, and the records they hold (M3e decisions
// 10–12). No Zod here, so a widget isolate can import it; the schemas the bus
// checks are in ../topics.ts, for each page's contracts module.
import type { WidgetSpec } from '../spec/types';

/** Every widget's spec, keyed by widget id; compacted and persistent. */
export const SPECS_TOPIC = 'creator.specs.v1';
/** The drawer's draft, keyed by draft id; compacted, in memory. The preview reads it. */
export const DRAFT_TOPIC = 'creator.draft.v1';
/** The page and the drawer talking: pool status, open, done (see board/ui.ts); compacted, in memory. */
export const UI_TOPIC = 'creator.ui.v1';
/**
 * Each `auto` widget's measured load, keyed by isolate id (`widget-<id>`), so
 * a reload places it from history (M3h decision 12); compacted, persistent.
 * Only the page reads and writes it (board/loads.ts).
 */
export const PLACEMENT_TOPIC = 'creator.placement.v1';

/**
 * A spec record: the widget's spec, or a tombstone. The bus has no delete, so
 * a deleted widget's key keeps `{ deleted: true }` as its last value.
 *
 * `added` is when the widget was first added (ms since the epoch), kept
 * across edits: the grid is in add order, and a compacted topic replays a
 * key at its newest record, so replay order alone would move an edited
 * widget to the end.
 *
 * `{ sync }`, under a key starting with `$`, is the page's replay probe: it
 * publishes one after subscribing, and once it comes back every record before
 * it has been read (board/controller.ts).
 */
export type SpecRecord =
  | { readonly spec: WidgetSpec; readonly added?: number }
  | { readonly deleted: true }
  | { readonly sync: string };

export const TOMBSTONE: SpecRecord = { deleted: true };

export function specRecord(spec: WidgetSpec, added?: number): SpecRecord {
  return added === undefined ? { spec } : { spec, added };
}

/** Keys starting with `$` aren't widgets (the replay probe). */
export const isWidgetKey = (key: string | undefined): key is string =>
  key !== undefined && key !== '' && !key.startsWith('$');

/** When a record's widget was added, if it says. */
export function addedOf(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const a: unknown = Reflect.get(value, 'added');
  return typeof a === 'number' ? a : undefined;
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
