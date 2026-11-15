import { describe, expect, it } from 'vitest';
import { filtersFrom, placementFrom, placementHref, replayConfig } from './url';

describe('replayConfig', () => {
  it('reads the replay settings, with defaults', () => {
    expect(replayConfig(new URLSearchParams(''))).toEqual({
      speed: 1,
      seed: 1,
      tradesPerSecond: 2,
    });
    expect(replayConfig(new URLSearchParams('speed=10&seed=7&tps=25&for=20000&at=1234'))).toEqual({
      speed: 10,
      seed: 7,
      tradesPerSecond: 25,
      durationMs: 20_000,
      from: 1_234,
    });
  });
});

describe('filtersFrom', () => {
  it('reads symbol, exchanges and window', () => {
    expect(filtersFrom(new URLSearchParams('symbol=ETH-USD&ex=okx,kraken&win=10000'))).toEqual({
      symbols: ['ETH-USD'],
      exchanges: ['kraken', 'okx'],
      windowMs: 10_000,
    });
  });

  it('is undefined without filters, or with nothing valid', () => {
    expect(filtersFrom(new URLSearchParams('speed=10'))).toBeUndefined();
    expect(filtersFrom(new URLSearchParams('symbol=DOGE&ex=okx'))).toBeUndefined();
  });
});

describe('placementFrom', () => {
  it('reads the placement, own by default', () => {
    expect(placementFrom(new URLSearchParams(''))).toBe('own');
    expect(placementFrom(new URLSearchParams('placement=matched'))).toBe('matched');
    expect(placementFrom(new URLSearchParams('placement=one'))).toBe('one');
    expect(placementFrom(new URLSearchParams('placement=split'))).toBe('own');
  });

  it("builds another placement's URL, without the replay position", () => {
    expect(placementHref('one', '?size=heavy&at=1234')).toBe('?size=heavy&placement=one');
    expect(placementHref('own', '?placement=one&size=heavy')).toBe('?size=heavy');
    expect(placementHref('own', '?placement=one')).toBe('?');
  });
});
