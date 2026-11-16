import { outputKind, validateSpec } from 'creator';
import { VIEW_TYPES } from 'creator/view-kinds';
import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { STARTERS } from './starters';

describe('the starter widgets', () => {
  it('are 4 to 8, with fixed ids', () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(4);
    expect(STARTERS.length).toBeLessThanOrEqual(8);
    const ids = STARTERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('$')).toBe(false);
  });

  it('each pass validateSpec against the catalog', () => {
    for (const s of STARTERS) expect(validateSpec(s, CATALOG), s.id).toEqual({ ok: true, spec: s });
  });

  it('cover all five views, every output kind, and two pools', () => {
    expect(new Set(STARTERS.map((s) => s.view.type))).toEqual(new Set(VIEW_TYPES));
    expect(new Set(STARTERS.map((s) => outputKind(s.operators)))).toEqual(
      new Set(['rows', 'scalar', 'series', 'grid']),
    );
    expect(new Set(STARTERS.map((s) => s.placement.pool))).toEqual(new Set(['pool-1', 'pool-2']));
  });
});
