import { describe, expect, it, vi } from 'vitest';
import { spec } from '../test-fixtures';
import { applyKind } from './apply';
import { LOAD_PERIOD_MS, spin, startBurns, type Every } from './burn';

function fakeTimers() {
  const live = new Map<number, { fn: () => void; ms: number }>();
  let next = 0;
  const every: Every = (fn, ms) => {
    const id = ++next;
    live.set(id, { fn, ms });
    return () => void live.delete(id);
  };
  return { every, live };
}

describe('startBurns', () => {
  it('blocks for forMs every everyMs, and a load burns its share of each period', () => {
    const { every, live } = fakeTimers();
    const ran: number[] = [];
    const stop = startBurns(
      [
        { op: 'window', ms: 1000 },
        { op: 'burn', everyMs: 10_000, forMs: 500 },
        { op: 'burn', loadPct: 40 },
      ],
      { every, spin: (ms) => ran.push(ms) },
    );
    expect([...live.values()].map((t) => t.ms)).toEqual([10_000, LOAD_PERIOD_MS]);
    for (const t of live.values()) t.fn();
    expect(ran).toEqual([500, 40]);
    stop();
    expect(live.size).toBe(0);
  });

  it('does nothing without a burn', () => {
    const { every, live } = fakeTimers();
    startBurns([{ op: 'window', ms: 1000 }], { every })();
    expect(live.size).toBe(0);
  });

  it('spin runs the clock past ms', () => {
    let t = 0;
    const now = vi.fn(() => (t += 10));
    spin(35, now);
    expect(t).toBeGreaterThanOrEqual(45);
  });
});

describe('applyKind with automatic placement', () => {
  it('respawns between manual and auto, not between two auto specs', () => {
    const manual = spec();
    const auto = spec({ placement: { mode: 'auto' } });
    expect(applyKind(manual, auto)).toBe('respawn');
    expect(applyKind(auto, spec({ placement: { mode: 'auto' }, title: 'x' }))).toBe('reconfigure');
    expect(applyKind(manual, auto, 'draft')).toBe('none');
  });
});
