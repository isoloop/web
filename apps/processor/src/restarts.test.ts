import { describe, expect, it } from 'vitest';
import { gaveUpText, restartsFrom, withRestarts } from './restarts';

describe('restartsFrom: the kernel restart limit from ?restarts=', () => {
  it('keeps the host defaults, with no supervisor config, without the parameter or at 3', () => {
    expect(restartsFrom('')).toEqual({ step: '3', limit: 3, supervisor: undefined });
    expect(restartsFrom('?restarts=3').supervisor).toBeUndefined();
    expect(restartsFrom('?restarts=banana').supervisor).toBeUndefined();
  });
  it('maps the other steps to the kernel config', () => {
    expect(restartsFrom('?restarts=0').supervisor).toEqual({ strategy: 'never' });
    expect(restartsFrom('?restarts=1').supervisor).toEqual({ maxRestarts: 1 });
    expect(restartsFrom('?restarts=10').limit).toBe(10);
    // No "no limit": the library doesn't document one, so it's the default.
    expect(restartsFrom('?restarts=none').supervisor).toBeUndefined();
  });
});

describe('the gave-up line and the URL', () => {
  it('says how many crashes in the window ended it', () => {
    expect(gaveUpText(3, 'error')).toBe('stopped: 4 crashes in 60 s, limit 3 (error)');
    expect(gaveUpText(0, 'error')).toBe('stopped: crashed (error), restarts off');
  });
  it('drops the parameter for the default and keeps the others', () => {
    expect(withRestarts('https://x/p/?restarts=1&rate=5', '3')).toBe('https://x/p/?rate=5');
    expect(withRestarts('https://x/p/?embed=1', '1')).toBe('https://x/p/?embed=1&restarts=1');
  });
});
