// What a widget's pipeline hands its view (M3e decision 17). The views are
// built against these shapes, so keep them small and stable.
//
// The kind follows from the spec's last operator:
//
// | Operators                          | Kind     |
// | ---------------------------------- | -------- |
// | no aggregate                       | `rows`   |
// | aggregate                          | `scalar` |
// | aggregate with `every`             | `series` |
// | aggregate with `groupBy`           | `grid`, one column (now) |
// | aggregate with `groupBy` and `every` | `grid`, one column per tick |

export type OutputKind = 'rows' | 'scalar' | 'series' | 'grid';

/** A table cell: numbers and strings as they came, anything else as null. */
export type Cell = number | string | null;

export type Column = {
  /** The field's name, or `$key` for the record key. */
  readonly name: string;
  readonly label: string;
  readonly type: 'number' | 'string' | 'time';
  readonly unit?: string;
};

/** Records as they came through the filters and window, newest first, at most `ROWS_LIMIT`. */
export type RowsOutput = {
  readonly kind: 'rows';
  readonly columns: readonly Column[];
  readonly rows: readonly {
    readonly key?: string;
    readonly t: number;
    readonly cells: readonly Cell[];
  }[];
};

/** One value now: the aggregate over the window. `value` is null when the window is empty. */
export type ScalarOutput = {
  readonly kind: 'scalar';
  /** e.g. "p95 Bearing temperature", "count". */
  readonly label: string;
  readonly unit?: string;
  readonly t: number;
  readonly value: number | null;
};

export type Point = { readonly t: number; readonly v: number | null };

/** The aggregate at each tick (`every` ms), oldest first, at most `SERIES_POINTS`. */
export type SeriesOutput = {
  readonly kind: 'series';
  readonly label: string;
  readonly unit?: string;
  readonly points: readonly Point[];
};

/**
 * The aggregate per group (rows) and tick (columns). `values[g][i]` is group
 * `groups[g]` at `times[i]`, null when the group had no records then. Groups
 * are sorted, at most `GRID_GROUPS`; times are oldest first, at most
 * `SERIES_POINTS`, and just one (now) without `every`.
 */
export type GridOutput = {
  readonly kind: 'grid';
  readonly label: string;
  readonly unit?: string;
  /** The group field's label, e.g. "Machine". */
  readonly groupLabel: string;
  readonly groups: readonly string[];
  readonly times: readonly number[];
  readonly values: readonly (readonly (number | null)[])[];
};

export type Output = RowsOutput | ScalarOutput | SeriesOutput | GridOutput;

/** Most rows a `rows` output holds. */
export const ROWS_LIMIT = 200;
/** Most ticks a `series` or `grid` output keeps. */
export const SERIES_POINTS = 120;
/** Most groups a `grid` output holds; records of further groups are left out. */
export const GRID_GROUPS = 64;

export type ViewType = 'line' | 'bar' | 'heatmap' | 'table' | 'stat';

/**
 * The outputs each view draws. `validateSpec` rejects a view whose pipeline
 * gives anything else.
 */
export const VIEW_INPUTS: Readonly<Record<ViewType, readonly OutputKind[]>> = {
  line: ['series', 'grid'],
  bar: ['series', 'grid'],
  heatmap: ['grid'],
  table: ['rows', 'grid'],
  stat: ['scalar', 'series'],
};
