import { describe, expect, it } from 'vitest';
import { machineMismatch, machineOf } from './machine.ts';

describe('machineMismatch', () => {
  it('lets two runs on one machine through', () => {
    expect(machineMismatch('bench-machine-1', 'bench-machine-1', false)).toBeNull();
  });
  it('refuses two machines', () => {
    expect(machineMismatch('bench-machine-1', 'bench-machine-2', false)).toMatch(
      /bench-machine-1 before, bench-machine-2 after.*--allow-machine-change/,
    );
  });
  it('refuses a run with no machine against one with', () => {
    expect(machineMismatch(null, 'bench-machine-1', false)).toMatch(/unnamed before/);
  });
  it('compares two machines with --allow-machine-change', () => {
    expect(machineMismatch('bench-machine-1', 'bench-machine-2', true)).toBeNull();
  });
});

describe('machineOf', () => {
  it('reads env.machine, or null', () => {
    expect(machineOf({ env: { machine: 'bench-machine-1' } })).toBe('bench-machine-1');
    expect(machineOf({ env: {} })).toBeNull();
  });
});
