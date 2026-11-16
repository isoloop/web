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

export type Operator = FilterOp | WindowOp | AggregateOp;

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
  /** v1 places by hand; M3h adds `auto`. */
  readonly placement: { readonly mode: 'manual'; readonly pool: string };
};
