// A widget's pipeline: its source key, filters, window and aggregate, run on
// records as they arrive, read as one of the four outputs.
import { fieldOf, KEY_FIELD, type CatalogTopic, type Rec } from './catalog';
import { aggregate, groupBy } from './operators/aggregate';
import { compileFilters, fieldValue } from './operators/filter';
import { BUFFER_LIMIT, RecordWindow, type WindowShape } from './operators/window';
import {
  GRID_GROUPS,
  ROWS_LIMIT,
  SERIES_POINTS,
  type Cell,
  type Column,
  type Output,
  type OutputKind,
  type Point,
} from './outputs';
import type { AggregateOp, Operator, WidgetSpec, WindowOp } from './spec/types';

/** The output kind a list of operators gives (see the table in outputs.ts). */
export function outputKind(operators: readonly Operator[]): OutputKind {
  const agg = operators.find((o): o is AggregateOp => o.op === 'aggregate');
  if (!agg) return 'rows';
  if (agg.groupBy !== undefined) return 'grid';
  return agg.every === undefined ? 'scalar' : 'series';
}

export interface Pipeline {
  readonly kind: OutputKind;
  /** Takes a record from the source topic; records for another key or that fail a filter are dropped. */
  push(rec: Rec): void;
  /**
   * The output at `now` (ms since the epoch). With `every`, it first takes
   * the aggregate at each tick (multiples of `every`) since the last read, or,
   * on the first read, since the oldest record, so a replayed history shows at once.
   */
  read(now: number): Output;
}

function label(topic: CatalogTopic, field: string): string {
  return fieldOf(topic, field)?.label ?? field;
}

function unitOf(topic: CatalogTopic, field: string | undefined): { unit?: string } {
  const unit = field === undefined ? undefined : fieldOf(topic, field)?.unit;
  return unit === undefined ? {} : { unit };
}

function cell(v: unknown): Cell {
  return typeof v === 'number' || typeof v === 'string' ? v : null;
}

/**
 * The pipeline for a spec that `validateSpec` accepted, on its source topic's
 * catalog entry.
 */
export function pipeline(spec: WidgetSpec, topic: CatalogTopic): Pipeline {
  const { operators } = spec;
  const kind = outputKind(operators);
  const key = spec.source.key;
  const passes = compileFilters(operators.flatMap((o) => (o.op === 'filter' ? [o.where] : [])));
  const win = operators.find((o): o is WindowOp => o.op === 'window');
  const agg = operators.find((o): o is AggregateOp => o.op === 'aggregate');
  const shape: WindowShape =
    win === undefined ? null : win.ms !== undefined ? { ms: win.ms } : { n: win.n };
  const window = new RecordWindow(
    shape,
    agg === undefined && shape === null ? ROWS_LIMIT : BUFFER_LIMIT,
  );

  const push = (rec: Rec): void => {
    if (key !== undefined && rec.key !== key) return;
    if (passes(rec)) window.push(rec);
  };

  if (agg === undefined) {
    const columns: Column[] = [
      ...(topic.key ? [{ name: KEY_FIELD, label: topic.key.label, type: 'string' as const }] : []),
      ...topic.fields.map((f) => ({
        name: f.name,
        label: f.label ?? f.name,
        type: f.type,
        ...(f.unit === undefined ? {} : { unit: f.unit }),
      })),
    ];
    return {
      kind,
      push,
      read(now) {
        const recs = window.at(now);
        window.evict(now);
        const rows = recs
          .slice(-ROWS_LIMIT)
          .toReversed()
          .map((r) => {
            const cells = columns.map((c) => cell(fieldValue(r, c.name)));
            return r.key === undefined ? { t: r.t, cells } : { key: r.key, t: r.t, cells };
          });
        return { kind: 'rows', columns, rows };
      },
    };
  }

  const { fn, field, p, every } = agg;
  const aggLabel =
    fn === 'count'
      ? 'count'
      : fn === 'percentile'
        ? `p${p ?? 50} ${label(topic, field ?? '')}`
        : `${fn} ${label(topic, field ?? '')}`;
  const unit = fn === 'count' ? {} : unitOf(topic, field);
  const at = (recs: readonly Rec[]): number | null => aggregate(fn, recs, field, p);
  const groupField = agg.groupBy;
  const groupLabel = groupField === undefined ? '' : label(topic, groupField);

  // Ticks to take since the last read, oldest first, at most SERIES_POINTS.
  let lastTick: number | undefined;
  const ticks = (now: number, step: number): number[] => {
    const end = Math.floor(now / step) * step;
    const oldest = window.oldest();
    const start =
      lastTick !== undefined
        ? lastTick + step
        : oldest === undefined
          ? end
          : Math.ceil(oldest / step) * step;
    const from = Math.max(start, end - (SERIES_POINTS - 1) * step);
    const out: number[] = [];
    for (let t = from; t <= end; t += step) out.push(t);
    if (out.length > 0) lastTick = end;
    return out;
  };

  if (groupField === undefined) {
    if (every === undefined) {
      return {
        kind,
        push,
        read(now) {
          const value = at(window.at(now));
          window.evict(now);
          return { kind: 'scalar', label: aggLabel, ...unit, t: now, value };
        },
      };
    }
    let points: Point[] = [];
    return {
      kind,
      push,
      read(now) {
        for (const t of ticks(now, every)) points.push({ t, v: at(window.at(t)) });
        if (points.length > SERIES_POINTS) points = points.slice(-SERIES_POINTS);
        if (lastTick !== undefined) window.evict(lastTick);
        return { kind: 'series', label: aggLabel, ...unit, points: [...points] };
      },
    };
  }

  // A grid: one row per group, one column per tick (or just now).
  let times: number[] = [];
  let rows = new Map<string, (number | null)[]>();
  const column = (t: number): void => {
    const groups = groupBy(window.at(t), groupField, GRID_GROUPS);
    for (const [g, recs] of groups) {
      if (!rows.has(g) && rows.size < GRID_GROUPS)
        rows.set(
          g,
          times.map(() => null),
        );
      rows.get(g)?.push(at(recs));
    }
    times.push(t);
    for (const [g, values] of rows) if (!groups.has(g)) values.push(null);
  };
  const grid = (): Output => {
    const groups = [...rows.keys()].toSorted();
    return {
      kind: 'grid',
      label: aggLabel,
      ...unit,
      groupLabel,
      groups,
      times: [...times],
      values: groups.map((g) => (rows.get(g) ?? []).slice()),
    };
  };
  return {
    kind,
    push,
    read(now) {
      if (every === undefined) {
        times = [];
        rows = new Map();
        column(now);
        window.evict(now);
        return grid();
      }
      for (const t of ticks(now, every)) column(t);
      if (times.length > SERIES_POINTS) {
        const drop = times.length - SERIES_POINTS;
        times = times.slice(drop);
        for (const [g, values] of rows) {
          const kept = values.slice(drop);
          if (kept.every((v) => v === null)) rows.delete(g);
          else rows.set(g, kept);
        }
      }
      if (lastTick !== undefined) window.evict(lastTick);
      return grid();
    },
  };
}
