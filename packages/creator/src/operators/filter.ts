// The filter operator: structured conditions compiled to a test, no eval.
import { KEY_FIELD, type Rec } from '../catalog';
import type { Where } from '../spec/types';

/** A field of a record: `$key` is the record key, anything else a top-level property. */
export function fieldValue(rec: Rec, field: string): unknown {
  return field === KEY_FIELD ? rec.key : rec.value[field];
}

/**
 * The test a condition stands for. Ordering (`<`, `<=`, `>`, `>=`) holds only
 * between numbers; a missing or non-number value fails it.
 */
export function compileWhere(where: Where): (rec: Rec) => boolean {
  if ('and' in where) {
    const all = where.and.map(compileWhere);
    return (rec) => all.every((test) => test(rec));
  }
  if ('or' in where) {
    const any = where.or.map(compileWhere);
    return (rec) => any.some((test) => test(rec));
  }
  if ('not' in where) {
    const inner = compileWhere(where.not);
    return (rec) => !inner(rec);
  }
  const { field } = where;
  if (where.op === 'in') {
    const set = new Set<unknown>(where.value);
    return (rec) => set.has(fieldValue(rec, field));
  }
  if (where.op === '==') {
    const want = where.value;
    return (rec) => fieldValue(rec, field) === want;
  }
  if (where.op === '!=') {
    const want = where.value;
    return (rec) => fieldValue(rec, field) !== want;
  }
  // The ordering ops: <, <=, >, >=.
  const { op, value } = where;
  if (typeof value !== 'number') return () => false;
  return (rec) => {
    const v = fieldValue(rec, field);
    if (typeof v !== 'number') return false;
    return op === '<' ? v < value : op === '<=' ? v <= value : op === '>' ? v > value : v >= value;
  };
}

/** Every filter operator's test at once: a record passes when all pass. */
export function compileFilters(wheres: readonly Where[]): (rec: Rec) => boolean {
  const tests = wheres.map(compileWhere);
  return (rec) => tests.every((test) => test(rec));
}
