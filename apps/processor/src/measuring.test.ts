import { describe, expect, it } from 'vitest';
import { isMeasuring, quarantineKind } from './measuring';
import { REASONS } from './ui';

describe('the measuring step told apart from a quarantine stay (isoloop/isoloop#346)', () => {
  it('only the measuring state is measuring; offenders are not', () => {
    expect(isMeasuring('measuring')).toBe(true);
    for (const s of ['placed', 'quarantined', 'kept-apart', 'moving', 'failed'] as const)
      expect(isMeasuring(s)).toBe(false);
    expect(isMeasuring(undefined)).toBe(false);
  });

  it('a quarantine pool is a measuring column until an offender is in it', () => {
    expect(quarantineKind([{ measuring: true }, { measuring: true }])).toBe('measuring');
    expect(quarantineKind([{ measuring: true }, { measuring: false }])).toBe('quarantine');
    expect(quarantineKind([{ measuring: false }])).toBe('quarantine');
  });

  it('a measured move and a steady move read as their own reasons', () => {
    expect(REASONS.measured).toBe('measured, placed');
    expect(REASONS.steady).toBe('steady again');
  });
});
