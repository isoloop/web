// Every view type, what it's called, the outputs it draws (task 2's
// VIEW_INPUTS, the one registry) and the options it reads from
// `spec.view.options`. No React here, so the validator and the drawer can
// import it without the views.
import { ROWS_LIMIT, VIEW_INPUTS, type OutputKind, type ViewType } from '../outputs';

export type { ViewType } from '../outputs';

export const VIEW_TYPES: readonly ViewType[] = ['line', 'bar', 'heatmap', 'table', 'stat'];

export const VIEW_LABELS: Readonly<Record<ViewType, string>> = {
  line: 'Line chart',
  bar: 'Bar chart',
  heatmap: 'Heatmap',
  table: 'Table',
  stat: 'Stat',
};

export function viewAccepts(type: ViewType, kind: OutputKind): boolean {
  return VIEW_INPUTS[type].includes(kind);
}

/** `spec.view.options`, as the spec format types it: a flat record. */
export type RawOptions = Readonly<Record<string, string | number | boolean>>;

/**
 * The options each view reads, with their type. Anything else in
 * `view.options` is an error (`checkViewOptions`).
 * - table `limit`: at most this many rows, 1 to `ROWS_LIMIT` (default 50)
 * - stat `gaugeMin` and `gaugeMax`: both or neither, min below max; draws a gauge
 */
export const VIEW_OPTIONS: Readonly<Record<ViewType, Readonly<Record<string, 'number'>>>> = {
  line: {},
  bar: {},
  heatmap: {},
  table: { limit: 'number' },
  stat: { gaugeMin: 'number', gaugeMax: 'number' },
};

/** The errors in a view's options, with paths under `view.options`; empty when they're fine. */
export function checkViewOptions(
  type: ViewType,
  options: RawOptions | undefined,
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = [];
  if (!options) return errors;
  const allowed = VIEW_OPTIONS[type];
  for (const [name, value] of Object.entries(options)) {
    const path = `view.options.${name}`;
    const want = allowed[name];
    if (!want) {
      const known = Object.keys(allowed);
      errors.push({
        path,
        message: `a ${type} view has no option "${name}"${known.length ? ` (it has ${known.join(', ')})` : ''}`,
      });
    } else if (typeof value !== want || !Number.isFinite(value)) {
      errors.push({ path, message: `must be a ${want}` });
    }
  }
  if (errors.length) return errors;
  if (type === 'table' && options['limit'] !== undefined) {
    const n = options['limit'];
    if (typeof n === 'number' && (!Number.isInteger(n) || n < 1 || n > ROWS_LIMIT)) {
      errors.push({
        path: 'view.options.limit',
        message: `must be a whole number from 1 to ${ROWS_LIMIT}`,
      });
    }
  }
  if (type === 'stat') {
    const { gaugeMin: min, gaugeMax: max } = options;
    if ((min === undefined) !== (max === undefined)) {
      errors.push({
        path: `view.options.${min === undefined ? 'gaugeMin' : 'gaugeMax'}`,
        message: 'a gauge needs both gaugeMin and gaugeMax',
      });
    } else if (typeof min === 'number' && typeof max === 'number' && !(min < max)) {
      errors.push({ path: 'view.options.gaugeMax', message: 'must be above gaugeMin' });
    }
  }
  return errors;
}

/** The table's options, read from valid raw options. */
export function tableOptions(options: RawOptions | undefined): { limit: number } {
  const limit = options?.['limit'];
  return { limit: typeof limit === 'number' ? limit : 50 };
}

/** The stat's options, read from valid raw options. */
export function statOptions(options: RawOptions | undefined): {
  gauge: { min: number; max: number } | undefined;
} {
  const min = options?.['gaugeMin'];
  const max = options?.['gaugeMax'];
  return { gauge: typeof min === 'number' && typeof max === 'number' ? { min, max } : undefined };
}
