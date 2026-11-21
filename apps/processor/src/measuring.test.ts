import { describe, expect, it } from 'vitest';
import { Offences } from './measuring';

const Q = 'balancer-quarantine-1';

describe('Offences: the measuring step told apart from a quarantine stay (isoloop/isoloop#346)', () => {
  it('a new isolate in the quarantine is measuring, and its steady exit reads measured', () => {
    const o = new Offences();
    expect(o.measuring('a', Q)).toBe(true);
    expect(o.move({ id: 'a', from: Q, to: 'balancer-1', reason: 'steady' })).toBe('measured');
    expect(o.measuring('a', 'balancer-1')).toBe(false);
  });

  it('a move into the quarantine is an offence: it is no longer measuring, and leaves steady', () => {
    const o = new Offences();
    o.move({ id: 'a', from: Q, to: 'balancer-1', reason: 'steady' });
    expect(o.move({ id: 'a', from: 'balancer-1', to: Q, reason: 'spike' })).toBe('spike');
    expect(o.measuring('a', Q)).toBe(false);
    expect(o.move({ id: 'a', from: Q, to: 'balancer-1', reason: 'steady' })).toBe('steady');
  });

  it('a spike that quarantines, or a crash, while measuring is an offence', () => {
    const o = new Offences();
    o.spike({ id: 'a', action: 'noted' });
    expect(o.measuring('a', Q)).toBe(true);
    o.spike({ id: 'a', action: 'quarantined' });
    expect(o.measuring('a', Q)).toBe(false);
    o.crash('b');
    expect(o.move({ id: 'b', from: Q, to: 'balancer-1', reason: 'steady' })).toBe('steady');
  });

  it('load moves between pools are not offences, and a forgotten isolate starts over', () => {
    const o = new Offences();
    expect(o.move({ id: 'a', from: 'balancer-1', to: 'balancer-2', reason: 'full' })).toBe('full');
    expect(o.measuring('a', Q)).toBe(true);
    o.crash('a');
    o.forget('a');
    expect(o.measuring('a', Q)).toBe(true);
  });
});
