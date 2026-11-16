// The drawer's form as data (M3e decision 8): what the user picked, turned
// into a widget spec and back, and validateSpec's errors mapped onto the
// field each one is about. No React, so it's tested on its own.
//
// The form has one filter operator (its rows joined by `and` or `or`, each
// row optionally negated), one window (by seconds or by count) and one
// aggregate, in the order validateSpec wants them.
import { KEY_FIELD, fieldOf, topicOf, type Catalog, type CatalogTopic } from '../catalog';
import type { OutputKind, ViewType } from '../outputs';
import { outputKind } from '../pipeline';
import type {
  AggregateFn,
  CompareOp,
  Operator,
  Scalar,
  Size,
  Where,
  WidgetSpec,
} from '../spec/types';
import { VIEW_TYPES, viewAccepts } from '../views/kinds';

export type RowOp = CompareOp | 'in';

export type FilterRow = {
  readonly field: string;
  readonly op: RowOp;
  /** As typed; `in` takes a comma-separated list. */
  readonly value: string;
  readonly not: boolean;
};

export type FormState = {
  readonly id: string;
  /** Empty: the title is made from the choices (autoTitle). */
  readonly title: string;
  readonly topic: string;
  /** Empty: every key. */
  readonly key: string;
  readonly join: 'and' | 'or';
  readonly filters: readonly FilterRow[];
  readonly windowBy: 'none' | 'seconds' | 'count';
  readonly windowValue: string;
  /** `none`: no aggregate, the records go to a table. */
  readonly fn: AggregateFn | 'none';
  readonly field: string;
  readonly p: string;
  /** Seconds between ticks; empty: one value, now. */
  readonly every: string;
  /** Empty: no grouping. */
  readonly groupBy: string;
  readonly view: ViewType;
  readonly size: Size;
  /** Table rows (`limit`). */
  readonly limit: string;
  /** Stat gauge bounds. */
  readonly gaugeMin: string;
  readonly gaugeMax: string;
  readonly pool: string;
};

export const COMPARE_OPS: readonly RowOp[] = ['==', '!=', '<', '<=', '>', '>=', 'in'];
export const AGGREGATE_FNS: readonly AggregateFn[] = [
  'avg',
  'min',
  'max',
  'sum',
  'count',
  'last',
  'percentile',
];

/** The fields a row, an aggregate or a group may use. */
export function fieldsOf(topic: CatalogTopic | undefined): {
  all: string[];
  numbers: string[];
  texts: string[];
} {
  if (!topic) return { all: [], numbers: [], texts: [] };
  const key = topic.key ? [KEY_FIELD] : [];
  return {
    all: [...key, ...topic.fields.map((f) => f.name)],
    numbers: topic.fields.filter((f) => f.type === 'number').map((f) => f.name),
    texts: [...key, ...topic.fields.filter((f) => f.type === 'string').map((f) => f.name)],
  };
}

/** A form for a new widget on the catalog's first topic: its records in a table. */
export function emptyForm(catalog: Catalog, id: string, pool: string): FormState {
  const topic = catalog.topics[0];
  const numbers = fieldsOf(topic).numbers;
  return {
    id,
    title: '',
    topic: topic?.name ?? '',
    key: '',
    join: 'and',
    filters: [],
    windowBy: 'none',
    windowValue: '60',
    fn: 'none',
    field: numbers[0] ?? '',
    p: '95',
    every: '',
    groupBy: '',
    view: 'table',
    size: 'm',
    limit: '',
    gaugeMin: '',
    gaugeMax: '',
    pool,
  };
}

/** Switching topic keeps what still fits and clears what doesn't. */
export function withTopic(form: FormState, catalog: Catalog, name: string): FormState {
  const topic = topicOf(catalog, name);
  const f = fieldsOf(topic);
  return {
    ...form,
    topic: name,
    key: topic?.key?.values?.includes(form.key) ? form.key : '',
    filters: form.filters.filter((r) => f.all.includes(r.field)),
    field: f.numbers.includes(form.field) ? form.field : (f.numbers[0] ?? ''),
    groupBy: f.texts.includes(form.groupBy) ? form.groupBy : '',
  };
}

const num = (s: string): number | undefined => {
  const t = s.trim();
  if (t === '') return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : Number.NaN;
};

function scalarOf(topic: CatalogTopic | undefined, field: string, s: string): Scalar {
  const type = topic ? fieldOf(topic, field)?.type : undefined;
  if (type === 'number' || type === 'time') {
    const v = Number(s.trim());
    return s.trim() !== '' && Number.isFinite(v) ? v : s;
  }
  return s;
}

function rowWhere(topic: CatalogTopic | undefined, r: FilterRow): Where {
  const w: Where =
    r.op === 'in'
      ? {
          field: r.field,
          op: 'in',
          value: r.value
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x !== '')
            .map((x) => scalarOf(topic, r.field, x)),
        }
      : { field: r.field, op: r.op, value: scalarOf(topic, r.field, r.value) };
  return r.not ? { not: w } : w;
}

/** The operators the form describes, in validateSpec's order. */
export function operatorsOf(form: FormState, catalog: Catalog): Operator[] {
  const topic = topicOf(catalog, form.topic);
  const ops: Operator[] = [];
  if (form.filters.length === 1 && form.filters[0]) {
    ops.push({ op: 'filter', where: rowWhere(topic, form.filters[0]) });
  } else if (form.filters.length > 1) {
    const rows = form.filters.map((r) => rowWhere(topic, r));
    ops.push({ op: 'filter', where: form.join === 'and' ? { and: rows } : { or: rows } });
  }
  if (form.windowBy !== 'none') {
    const v = num(form.windowValue) ?? Number.NaN;
    ops.push(
      form.windowBy === 'seconds'
        ? { op: 'window', ms: Math.round(v * 1000) }
        : { op: 'window', n: v },
    );
  }
  if (form.fn !== 'none') {
    const every = num(form.every);
    const p = num(form.p);
    ops.push({
      op: 'aggregate',
      fn: form.fn,
      ...(form.fn === 'count' ? {} : { field: form.field }),
      ...(form.fn === 'percentile' ? { p: p ?? Number.NaN } : {}),
      ...(every === undefined ? {} : { every: Math.round(every * 1000) }),
      ...(form.groupBy === '' ? {} : { groupBy: form.groupBy }),
    });
  }
  return ops;
}

/** What the pipeline will hand its view. */
export const kindOf = (form: FormState, catalog: Catalog): OutputKind =>
  outputKind(operatorsOf(form, catalog));

/** The views that draw this form's output. */
export const viewsFor = (kind: OutputKind): ViewType[] =>
  VIEW_TYPES.filter((v) => viewAccepts(v, kind));

/** Keeps the chosen view if it draws the output, else the first that does. */
export function fitView(form: FormState, catalog: Catalog): FormState {
  const views = viewsFor(kindOf(form, catalog));
  return views.includes(form.view) || views.length === 0
    ? form
    : { ...form, view: views[0] ?? form.view };
}

/** A title from the choices, when the user gave none: "avg temp · m1". */
export function autoTitle(form: FormState, catalog: Catalog): string {
  const topic = topicOf(catalog, form.topic);
  const label = (name: string) => (topic ? (fieldOf(topic, name)?.label ?? name) : name);
  const what =
    form.fn === 'none'
      ? (topic?.title ?? form.topic)
      : form.fn === 'count'
        ? 'count'
        : form.fn === 'percentile'
          ? `p${form.p.trim()} ${label(form.field)}`
          : `${form.fn} ${label(form.field)}`;
  const parts = [what];
  if (form.groupBy !== '') parts.push(`by ${label(form.groupBy)}`);
  if (form.key !== '') parts.push(form.key);
  return parts.join(' · ');
}

/** The spec the form describes; validateSpec decides whether it's a good one. */
export function specOfForm(form: FormState, catalog: Catalog): WidgetSpec {
  const options: Record<string, number | string> = {};
  const opt = (name: string, s: string) => {
    const v = num(s);
    if (v !== undefined) options[name] = Number.isNaN(v) ? s : v;
  };
  if (form.view === 'table') opt('limit', form.limit);
  if (form.view === 'stat') {
    opt('gaugeMin', form.gaugeMin);
    opt('gaugeMax', form.gaugeMax);
  }
  return {
    id: form.id,
    title: form.title.trim() === '' ? autoTitle(form, catalog) : form.title.trim(),
    source: { topic: form.topic, ...(form.key === '' ? {} : { key: form.key }) },
    operators: operatorsOf(form, catalog),
    view: {
      type: form.view,
      size: form.size,
      ...(Object.keys(options).length > 0 ? { options } : {}),
    },
    placement: { mode: 'manual', pool: form.pool },
  };
}

const text = (v: unknown): string =>
  typeof v === 'number' || typeof v === 'string' ? String(v) : '';

function rowsOf(where: Where): { rows: Where[]; join: 'and' | 'or' } {
  if ('and' in where) return { rows: [...where.and], join: 'and' };
  if ('or' in where) return { rows: [...where.or], join: 'or' };
  return { rows: [where], join: 'and' };
}

function rowOf(w: Where): FilterRow | undefined {
  const not = 'not' in w;
  const inner = 'not' in w ? w.not : w;
  if (!('field' in inner)) return undefined;
  const value = Array.isArray(inner.value)
    ? inner.value.map((v) => String(v)).join(', ')
    : text(inner.value);
  return { field: inner.field, op: inner.op, value, not };
}

/**
 * A form for editing `spec`. Specs the form can't show (nested groups) keep
 * the rows it can; the drawer was the only writer, so that doesn't happen.
 */
export function formOfSpec(spec: WidgetSpec, catalog: Catalog): FormState {
  const base = emptyForm(catalog, spec.id, spec.placement.pool);
  const patch: { -readonly [K in keyof FormState]?: FormState[K] } = {};
  for (const op of spec.operators) {
    if (op.op === 'filter') {
      const { rows, join } = rowsOf(op.where);
      patch.join = join;
      patch.filters = rows.map(rowOf).filter((r): r is FilterRow => r !== undefined);
    } else if (op.op === 'window') {
      patch.windowBy = op.ms === undefined ? 'count' : 'seconds';
      patch.windowValue = op.ms === undefined ? String(op.n) : String(op.ms / 1000);
    } else {
      patch.fn = op.fn;
      patch.field = op.field ?? base.field;
      patch.p = op.p === undefined ? base.p : String(op.p);
      patch.every = op.every === undefined ? '' : String(op.every / 1000);
      patch.groupBy = op.groupBy ?? '';
    }
  }
  return {
    ...base,
    title: spec.title,
    topic: spec.source.topic,
    key: spec.source.key ?? '',
    view: spec.view.type,
    size: spec.view.size,
    limit: text(spec.view.options?.['limit']),
    gaugeMin: text(spec.view.options?.['gaugeMin']),
    gaugeMax: text(spec.view.options?.['gaugeMax']),
    ...patch,
  };
}

/** A form field an error belongs to: `title`, `topic`, `key`, `row-2`, `window`, `fn`… */
export type FieldId = string;

/**
 * Which form field a validateSpec error path is about, for the form's
 * operators (operatorsOf's order). `form` is the field shown at the top.
 */
export function fieldOfPath(path: string, form: FormState): FieldId {
  if (path === 'title' || path.startsWith('title')) return 'title';
  if (path.startsWith('source.topic')) return 'topic';
  if (path.startsWith('source.key')) return 'key';
  if (path.startsWith('view.options.limit')) return 'limit';
  if (path.startsWith('view.options.gauge')) return 'gauge';
  if (path.startsWith('view')) return 'view';
  if (path.startsWith('placement')) return 'pool';
  const m = /^operators\[(\d+)\](.*)$/.exec(path);
  if (!m) return 'form';
  const i = Number(m[1]);
  const rest = m[2] ?? '';
  const hasFilter = form.filters.length > 0;
  const hasWindow = form.windowBy !== 'none';
  const filterAt = hasFilter ? 0 : -1;
  const windowAt = hasWindow ? (hasFilter ? 1 : 0) : -1;
  if (i === filterAt) {
    const row = /^\.where\.(?:and|or)\[(\d+)\]/.exec(rest);
    return `row-${row ? Number(row[1]) : 0}`;
  }
  if (i === windowAt) return 'window';
  if (rest.startsWith('.field')) return 'field';
  if (rest.startsWith('.p')) return 'p';
  if (rest.startsWith('.every')) return 'every';
  if (rest.startsWith('.groupBy')) return 'groupBy';
  if (rest === '' && form.fn !== 'none' && !hasWindow) return 'window';
  return 'fn';
}
