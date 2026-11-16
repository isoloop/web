import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EXCHANGES, SYMBOLS } from '../core/symbols';
import { CATALOG, KEEP_MS, PRICES } from './catalog';
import list, { OFFERED } from './contracts';

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

  it('declares each offered topic with the time window the catalog states', () => {
    for (const t of CATALOG.topics) {
      expect(list.get(t.name)?.retention, t.name).toEqual({ kind: 'time', ms: t.history });
    }
    expect(CATALOG.topics.map((t) => t.history).toSorted((a, b) => a - b)).toEqual(
      Object.values(KEEP_MS).toSorted((a, b) => a - b),
    );
  });

  it('keys prices by every exchange and symbol, as the replay publishes them', () => {
    expect(PRICES.key?.values).toHaveLength(EXCHANGES.length * SYMBOLS.length);
    expect(PRICES.key?.values).toContain('coinbase:BTC-USD');
  });
});
