// `creator.ui.v1`'s records (M3e decisions 8 and 13): how the page and the
// drawer isolate talk. No Zod here, so the drawer isolate can import it; the
// schema the bus checks is in ../topics.ts.
//
// - `pools` (page → drawer): the page's creator pools, about once a second,
//   for the placement field. Isoloop pages only.
// - `placements` (page → drawer): where the balancer has each `auto` widget,
//   about once a second (M3h decision 20). Isoloop pages with a balancer only.
// - `open` (page → drawer): the drawer opened, to add a widget or to edit one.
//   `n` counts the openings, so the drawer acts once on each.
// - `done` (drawer → page): the drawer added, saved, deleted or cancelled;
//   the page closes it and stops the preview.

/** One creator pool, as the placement field lists it. */
export type PoolStatus = {
  /** The spec's `placement.pool`, e.g. `pool-1`. */
  readonly pool: string;
  /** "Pool 1". */
  readonly label: string;
  /** Widgets placed in it (running or starting). */
  readonly members: number;
  /** The worker's lag at its last beat, or `null` before its first. */
  readonly lagMs: number | null;
};

/** Where the page's balancer runs an `auto` widget (M3h decision 20). */
export type AutoPlacement = {
  /** The widget id. */
  readonly id: string;
  /** The kernel pool: `balancer-2`, `balancer-quarantine-1`. */
  readonly pool: string;
  /** "Auto 2", "Quarantine". */
  readonly label: string;
  readonly state: 'placed' | 'quarantined' | 'kept-apart' | 'moving';
  /** Over budget, with nowhere to go: the worker cap is reached. */
  readonly atCap?: boolean;
};

export type OpenCommand = {
  readonly n: number;
  readonly mode: 'add' | 'edit';
  /** The draft's key in `creator.draft.v1`; the preview reads it. */
  readonly draftId: string;
  /** For `edit`: the widget's id. */
  readonly id?: string;
};

export type DoneWhat = 'added' | 'saved' | 'deleted' | 'cancel';

export type DoneMessage = { readonly n: number; readonly what: DoneWhat; readonly id?: string };

export type UiRecord =
  | { readonly pools: readonly PoolStatus[] }
  | { readonly placements: readonly AutoPlacement[] }
  | { readonly open: OpenCommand }
  | { readonly done: DoneMessage };

/** The keys each record kind goes under: one value each in the compacted topic. */
export const UI_KEY = {
  pools: 'pools',
  placements: 'placements',
  open: 'open',
  done: 'done',
} as const;

const obj = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function poolsOf(v: unknown): readonly PoolStatus[] | undefined {
  if (!obj(v) || !Array.isArray(v['pools'])) return undefined;
  return v['pools'] as readonly PoolStatus[];
}

export function placementsOf(v: unknown): readonly AutoPlacement[] | undefined {
  if (!obj(v) || !Array.isArray(v['placements'])) return undefined;
  return v['placements'] as readonly AutoPlacement[];
}

export function openOf(v: unknown): OpenCommand | undefined {
  if (!obj(v) || !obj(v['open'])) return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus checked it against uiRecordSchema
  return v['open'] as OpenCommand;
}

export function doneOf(v: unknown): DoneMessage | undefined {
  if (!obj(v) || !obj(v['done'])) return undefined;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus checked it against uiRecordSchema
  return v['done'] as DoneMessage;
}
