// The isoloop-spec@1 widget (M3e decisions 15 and 16). A widget reads one
// topic, runs its operators in order and hands the result to one view. No
// user code: conditions are structured JSON, never expressions.
import type { ViewType } from '../outputs';

export const SPEC_VERSION = 'isoloop-spec@1';

export type Scalar = number | string;

export type CompareOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

/**
 * A condition on a field (`$key` for the record key): a comparison, `in` a
 * list, or `and`, `or` and `not` over conditions.
 */
export type Where =
  | { readonly field: string; readonly op: CompareOp; readonly value: Scalar }
  | { readonly field: string; readonly op: 'in'; readonly value: readonly Scalar[] }
  | { readonly and: readonly Where[] }
  | { readonly or: readonly Where[] }
  | { readonly not: Where };

export type FilterOp = { readonly op: 'filter'; readonly where: Where };

/** The records of the last `ms` milliseconds, or the last `n` records: one of the two. */
export type WindowOp =
  | { readonly op: 'window'; readonly ms: number; readonly n?: undefined }
  | { readonly op: 'window'; readonly n: number; readonly ms?: undefined };

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'last' | 'percentile';

export type AggregateOp = {
  readonly op: 'aggregate';
  readonly fn: AggregateFn;
  /** The number field to aggregate; every function but `count` needs one. */
  readonly field?: string;
  /** For `percentile`: 0 < p ≤ 100. */
  readonly p?: number;
  /** Take the aggregate every `every` ms and keep the history (a series or a grid). */
  readonly every?: number;
  /** One aggregate per value of this string field (or `$key`). */
  readonly groupBy?: string;
};

/**
 * Test-only (M3h decision 21): makes the widget misbehave on command, for the
 * balancer's E2E tests and measurement. `everyMs` + `forMs` blocks for
 * `forMs` every `everyMs`; `loadPct` keeps a steady load (a share of one
 * core). validateSpec rejects it unless the page runs with `?chaos`.
 */
export type BurnOp =
  | {
      readonly op: 'burn';
      readonly everyMs: number;
      readonly forMs: number;
      readonly loadPct?: undefined;
    }
  | {
      readonly op: 'burn';
      readonly loadPct: number;
      readonly everyMs?: undefined;
      readonly forMs?: undefined;
    };

export type Operator = FilterOp | WindowOp | AggregateOp | BurnOp;

export type Size = 's' | 'm' | 'l';

export type WidgetSpec = {
  readonly id: string;
  readonly title: string;
  readonly source: { readonly topic: string; readonly key?: string };
  /** In order: filters, then at most one window, then at most one aggregate. */
  readonly operators: readonly Operator[];
  readonly view: {
    readonly type: ViewType;
    readonly size: Size;
    /** View settings; each view says which it reads. */
    readonly options?: Readonly<Record<string, string | number | boolean>>;
  };
  readonly placement: Placement;
};

/**
 * Where a widget runs: a creator pool picked by hand (M3e decision 13), or
 * wherever the page's balancer puts it (M3h decision 19).
 */
export type Placement =
  | { readonly mode: 'manual'; readonly pool: string }
  | { readonly mode: 'auto'; readonly pool?: undefined };

/** One string per placement, to compare two: the pool, or `$auto`. */
export const placementKey = (p: Placement): string => (p.mode === 'auto' ? '$auto' : p.pool);
