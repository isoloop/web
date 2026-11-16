// validateSpec (M3e decision 19): zod checks the shape, then the spec is
// checked against the dashboard's catalog. Zod stays behind this function, so
// swapping it later changes nothing for callers.
import { z } from 'zod';
import { fieldOf, topicOf, type Catalog, type CatalogTopic, type FieldType } from '../catalog';
import { VIEW_INPUTS, type OutputKind } from '../outputs';
import { outputKind } from '../pipeline';
import { checkViewOptions } from '../views/kinds';
import type { Operator, WidgetSpec } from './types';

export type SpecError = {
  /** Where in the spec, e.g. `operators[1].ms`; empty for the spec as a whole. */
  readonly path: string;
  readonly message: string;
};

export type SpecResult =
  | { readonly ok: true; readonly spec: WidgetSpec }
  | { readonly ok: false; readonly errors: readonly SpecError[] };

/** Ids of widgets and pools: letters, digits, `-` and `_`, up to 64. */
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const id = z
  .string()
  .regex(ID, { error: 'letters, digits, - and _, up to 64, starting with a letter or digit' });
const name = z.string().min(1).max(128);

/** Most operators a spec may list. */
export const MAX_OPERATORS = 16;
/** Most conditions in one filter, nested ones included, and how deep they nest. */
export const MAX_CONDITIONS = 64;
export const MAX_DEPTH = 8;
/** Most values an `in` list holds. */
export const MAX_IN_VALUES = 100;
/** Most records a count window may hold. */
export const MAX_WINDOW_N = 10_000;
/** The shortest `every`, in ms. */
export const MIN_EVERY_MS = 100;

const filterShape = z.strictObject({ op: z.literal('filter'), where: z.unknown() });
const windowShape = z.strictObject({
  op: z.literal('window'),
  ms: z.number().int().positive().optional(),
  n: z.number().int().min(1).max(MAX_WINDOW_N).optional(),
});
const aggregateShape = z.strictObject({
  op: z.literal('aggregate'),
  fn: z.enum(['count', 'sum', 'avg', 'min', 'max', 'last', 'percentile']),
  field: name.optional(),
  p: z.number().gt(0).max(100).optional(),
  every: z.number().int().min(MIN_EVERY_MS).optional(),
  groupBy: name.optional(),
});
const operatorShape = z.discriminatedUnion('op', [filterShape, windowShape, aggregateShape], {
  error: 'op must be "filter", "window" or "aggregate"',
});

/** The shape of a widget spec, before the catalog checks: for the bus (topics.ts). */
export const specShape = z.strictObject({
  id,
  title: z.string().trim().min(1).max(80),
  source: z.strictObject({ topic: name, key: z.string().min(1).max(128).optional() }),
  operators: z.array(operatorShape).max(MAX_OPERATORS),
  view: z.strictObject({
    type: z.enum(['line', 'bar', 'heatmap', 'table', 'stat']),
    size: z.enum(['s', 'm', 'l']),
    options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  placement: z.strictObject({
    mode: z.literal('manual', { error: 'v1 places widgets by hand: mode must be "manual"' }),
    pool: id,
  }),
});

function pathOf(segments: readonly PropertyKey[]): string {
  let out = '';
  for (const s of segments) {
    if (typeof s === 'number') out += `[${s}]`;
    else out += out === '' ? String(s) : `.${String(s)}`;
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=']);
const ORDERING = new Set(['<', '<=', '>', '>=']);

function valueFits(type: FieldType, v: unknown): boolean {
  return type === 'string' ? typeof v === 'string' : typeof v === 'number' && Number.isFinite(v);
}

function checkWhere(
  where: unknown,
  path: string,
  topic: CatalogTopic | undefined,
  errors: SpecError[],
  depth: number,
  count: { n: number },
): void {
  count.n += 1;
  if (count.n > MAX_CONDITIONS) {
    if (count.n === MAX_CONDITIONS + 1)
      errors.push({ path, message: `a filter has at most ${MAX_CONDITIONS} conditions` });
    return;
  }
  if (depth > MAX_DEPTH) {
    errors.push({ path, message: `conditions nest at most ${MAX_DEPTH} deep` });
    return;
  }
  if (!isRecord(where)) {
    errors.push({
      path,
      message:
        'a condition is { field, op, value }, or { and: [...] }, { or: [...] }, { not: {...} }',
    });
    return;
  }
  const w = where;
  const keys = Object.keys(w);
  for (const group of ['and', 'or'] as const) {
    if (group in w) {
      if (keys.length !== 1)
        errors.push({ path, message: `"${group}" stands alone in its condition` });
      const list = w[group];
      if (!Array.isArray(list) || list.length === 0) {
        errors.push({ path: `${path}.${group}`, message: 'a non-empty list of conditions' });
        return;
      }
      list.forEach((c, i) =>
        checkWhere(c, `${path}.${group}[${i}]`, topic, errors, depth + 1, count),
      );
      return;
    }
  }
  if ('not' in w) {
    if (keys.length !== 1) errors.push({ path, message: '"not" stands alone in its condition' });
    checkWhere(w['not'], `${path}.not`, topic, errors, depth + 1, count);
    return;
  }
  const extra = keys.filter((k) => k !== 'field' && k !== 'op' && k !== 'value');
  if (extra.length > 0)
    errors.push({ path, message: `unknown key ${extra.map((k) => `"${k}"`).join(', ')}` });
  const { field, op, value } = w;
  if (typeof field !== 'string' || field === '') {
    errors.push({ path: `${path}.field`, message: 'the field to test' });
    return;
  }
  if (op !== 'in' && (typeof op !== 'string' || !COMPARE.has(op))) {
    errors.push({ path: `${path}.op`, message: 'op must be one of ==, !=, <, <=, >, >=, in' });
    return;
  }
  const f = topic ? fieldOf(topic, field) : undefined;
  if (topic && !f) {
    errors.push({ path: `${path}.field`, message: `"${topic.name}" has no field "${field}"` });
    return;
  }
  if (op === 'in') {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IN_VALUES) {
      errors.push({
        path: `${path}.value`,
        message: `"in" takes a list of 1 to ${MAX_IN_VALUES} values`,
      });
      return;
    }
    if (f) {
      value.forEach((v: unknown, i) => {
        if (!valueFits(f.type, v))
          errors.push({ path: `${path}.value[${i}]`, message: `"${field}" holds ${f.type}s` });
      });
    }
    return;
  }
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
    errors.push({ path: `${path}.value`, message: 'a number or a string' });
    return;
  }
  if (!f) return;
  if (f.type === 'string' && ORDERING.has(op)) {
    errors.push({ path: `${path}.op`, message: `"${field}" is text: use ==, != or in` });
    return;
  }
  if (!valueFits(f.type, value))
    errors.push({ path: `${path}.value`, message: `"${field}" holds ${f.type}s` });
}

const NEEDS: Readonly<Record<OutputKind, string>> = {
  rows: 'no aggregate',
  scalar: 'an aggregate',
  series: 'an aggregate with every',
  grid: 'an aggregate with groupBy',
};

function checkOperators(
  operators: readonly Operator[],
  topic: CatalogTopic | undefined,
  errors: SpecError[],
): void {
  // filters, then at most one window, then at most one aggregate, last.
  let stage: 'filters' | 'window' | 'aggregate' = 'filters';
  let windowed = false;
  operators.forEach((o, i) => {
    const at = `operators[${i}]`;
    if (stage === 'aggregate') {
      errors.push({ path: at, message: 'the aggregate is the last operator' });
      return;
    }
    switch (o.op) {
      case 'filter':
        if (stage === 'window') errors.push({ path: at, message: 'filters go before the window' });
        checkWhere(o.where, `${at}.where`, topic, errors, 1, { n: 0 });
        return;
      case 'window': {
        if (stage === 'window') errors.push({ path: at, message: 'a widget has one window' });
        stage = 'window';
        windowed = true;
        const hasMs = o.ms !== undefined;
        const hasN = o.n !== undefined;
        if (hasMs === hasN) {
          errors.push({
            path: at,
            message: 'a window has either ms (a time) or n (a count of records)',
          });
          return;
        }
        if (o.ms !== undefined && topic && o.ms > topic.history) {
          errors.push({
            path: `${at}.ms`,
            message: `"${topic.name}" keeps ${topic.history} ms of history: the window can't be longer`,
          });
        }
        return;
      }
      case 'aggregate': {
        stage = 'aggregate';
        if (!windowed) errors.push({ path: at, message: 'an aggregate needs a window before it' });
        if (o.fn === 'count') {
          if (o.field !== undefined)
            errors.push({ path: `${at}.field`, message: 'count counts records: no field' });
        } else if (o.field === undefined) {
          errors.push({ path: `${at}.field`, message: `${o.fn} needs a number field` });
        } else if (topic) {
          const f = fieldOf(topic, o.field);
          if (!f)
            errors.push({
              path: `${at}.field`,
              message: `"${topic.name}" has no field "${o.field}"`,
            });
          else if (f.type !== 'number') {
            errors.push({ path: `${at}.field`, message: `"${o.field}" isn't a number field` });
          }
        }
        if (o.fn === 'percentile' && o.p === undefined) {
          errors.push({ path: `${at}.p`, message: 'percentile needs p, 0 < p ≤ 100' });
        }
        if (o.fn !== 'percentile' && o.p !== undefined) {
          errors.push({ path: `${at}.p`, message: 'only percentile takes p' });
        }
        if (o.groupBy !== undefined && topic) {
          const g = fieldOf(topic, o.groupBy);
          if (!g)
            errors.push({
              path: `${at}.groupBy`,
              message: `"${topic.name}" has no field "${o.groupBy}"`,
            });
          else if (g.type !== 'string') {
            errors.push({
              path: `${at}.groupBy`,
              message: `group by a text field or $key; "${o.groupBy}" isn't one`,
            });
          }
        }
        return;
      }
    }
  });
}

/**
 * Checks a widget spec, as JSON from anywhere (a form, a topic, an agent),
 * against a dashboard's catalog. On success `spec` is the checked spec, with
 * the title trimmed.
 */
export function validateSpec(input: unknown, catalog: Catalog): SpecResult {
  const parsed = specShape.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: pathOf(i.path), message: i.message })),
    };
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- zod checked the shape and `where` is checked below; the spec is returned only when that finds nothing
  const spec = parsed.data as unknown as WidgetSpec;
  const errors: SpecError[] = [];

  const topic = topicOf(catalog, spec.source.topic);
  if (!topic) {
    const offered = catalog.topics.map((t) => `"${t.name}"`).join(', ');
    errors.push({
      path: 'source.topic',
      message: `no topic "${spec.source.topic}" here; the catalog has ${offered}`,
    });
  } else if (spec.source.key !== undefined) {
    if (!topic.key) errors.push({ path: 'source.key', message: `"${topic.name}" has no keys` });
    else if (topic.key.values && !topic.key.values.includes(spec.source.key)) {
      errors.push({
        path: 'source.key',
        message: `no ${topic.key.label} "${spec.source.key}"; one of ${topic.key.values.join(', ')}`,
      });
    }
  }

  checkOperators(spec.operators, topic, errors);

  const kind = outputKind(spec.operators);
  const takes = VIEW_INPUTS[spec.view.type];
  if (!takes.includes(kind)) {
    errors.push({
      path: 'view.type',
      message: `a ${spec.view.type} view draws ${takes.join(' or ')}; this pipeline gives ${kind} (${spec.view.type} needs ${takes.map((k) => NEEDS[k]).join(' or ')})`,
    });
  }
  errors.push(...checkViewOptions(spec.view.type, spec.view.options));

  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec };
}
