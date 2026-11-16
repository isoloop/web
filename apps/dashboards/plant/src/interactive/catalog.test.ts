import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MACHINES } from '../core/machines';
import { MACHINE_KEEP, PLANT_KEEP, SLOW_KEEP_MS, type Keep } from '../core/retention';
import { CATALOG, FLEET, HEALTH, SCALARS, SPECTRUM, SPECTRUM_KEEP_MS } from './catalog';
import list, { OFFERED } from './contracts';

const msOf = (k: Keep): number => {
  if (k.kind !== 'time') throw new Error(`expected time retention, got ${k.kind}`);
  return k.ms;
};

/** The catalog type a zod field schema matches. */
function typeOf(schema: z.ZodType): 'number' | 'string' | undefined {
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodString || schema instanceof z.ZodEnum) return 'string';
  if (schema instanceof z.ZodLiteral) {
    return typeof schema.value === 'string' ? 'string' : undefined;
  }
  return undefined;
}

describe('the interactive catalog', () => {
  it('offers only topics the page declares', () => {
    for (const t of CATALOG.topics) expect(list.get(t.name), t.name).toBeDefined();
  });

  it("matches each topic's schema: every field exists, with its type", () => {
    for (const t of CATALOG.topics) {
      const schema = OFFERED[t.name];
      expect(schema, t.name).toBeDefined();
      if (!schema) continue;
      for (const f of t.fields) {
        const field: unknown = schema.shape[f.name];
        expect(field, `${t.name}.${f.name}`).toBeInstanceOf(z.ZodType);
        if (!(field instanceof z.ZodType)) continue;
        // A time is ms since the epoch: a number field.
        const want = f.type === 'time' ? 'number' : f.type;
        expect(typeOf(field), `${t.name}.${f.name}`).toBe(want);
      }
      if (t.time !== undefined) expect(t.fields.map((f) => f.name)).toContain(t.time);
    }
  });

  it('keys the merged topics by machine', () => {
    for (const t of [SCALARS, HEALTH, SPECTRUM]) expect(t.key?.values).toEqual(MACHINES);
  });

  it('offers windows no longer than each topic keeps', () => {
    expect(SCALARS.history).toBe(msOf(MACHINE_KEEP.scalars));
    expect(HEALTH.history).toBe(msOf(MACHINE_KEEP.health));
    expect(SPECTRUM.history).toBe(msOf(MACHINE_KEEP.spectrum));
    expect(SPECTRUM_KEEP_MS).toBe(msOf(MACHINE_KEEP.spectrum));
    // The plant-wide topics keep a count; the fleet engine publishes once a second.
    const fleet = PLANT_KEEP.fleet;
    expect(fleet.kind === 'last-n' && fleet.n * 1_000).toBeGreaterThanOrEqual(FLEET.history);
    for (const t of CATALOG.topics) expect(t.history, t.name).toBeLessThanOrEqual(SLOW_KEEP_MS);
  });

  it('declares the merged topics with the retention the catalog states', () => {
    for (const t of [SCALARS, HEALTH, SPECTRUM]) {
      expect(list.get(t.name)?.retention).toEqual({ kind: 'time', ms: t.history });
    }
  });
});
