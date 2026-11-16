// What a spec change does to a running widget (M3e decision 10). Grants and
// placement are fixed when an isolate spawns, so a new source topic or a new
// placement needs a new isolate; anything else the widget applies itself.
import { placementKey, type WidgetSpec } from '../spec/types';
import type { WidgetMode } from './records';

/**
 * - `none`: nothing changed.
 * - `reconfigure`: the widget rebuilds its pipeline in place (operators, view,
 *   title, the source key).
 * - `respawn`: the host stops the widget and spawns it again (the source
 *   topic or, for a widget on the grid, the placement changed).
 *
 * A preview (`draft`) always runs on its own worker, so its placement never
 * respawns it.
 */
const unplaced = (s: WidgetSpec) => ({ ...s, placement: undefined });

export type ApplyKind = 'none' | 'reconfigure' | 'respawn';

export function applyKind(old: WidgetSpec, next: WidgetSpec, mode: WidgetMode = 'spec'): ApplyKind {
  if (old.source.topic !== next.source.topic) return 'respawn';
  if (mode === 'spec' && placementKey(old.placement) !== placementKey(next.placement)) {
    return 'respawn';
  }
  const equal = mode === 'spec' ? same(old, next) : same(unplaced(old), unplaced(next));
  return equal ? 'none' : 'reconfigure';
}

/** Deep equality for JSON values, ignoring key order and `undefined` properties. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => same(v, b[i]));
  }
  const ka = Object.keys(a).filter((k) => Reflect.get(a, k) !== undefined);
  const kb = Object.keys(b).filter((k) => Reflect.get(b, k) !== undefined);
  return ka.length === kb.length && ka.every((k) => same(Reflect.get(a, k), Reflect.get(b, k)));
}
