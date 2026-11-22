import { describe, expect, it } from 'vitest';
import { Aggregator } from './aggregate';
import { AlertEngine } from './alerts';
import { synth } from './replay/synth';
import type { Tick } from './replay/tick';
import { SYMBOLS, type Quote, type Trade } from './schemas';

const trade = (exchange: Trade['exchange'], price: number, size: number, ts: number): Trade => ({
  exchange,
  symbol: 'BTC-USD',
  id: `${exchange}-${ts}`,
  price,
  size,
  side: 'buy',
  ts,
});
const quote = (exchange: Quote['exchange'], bid: number, ask: number): Quote => ({
  exchange,
  symbol: 'BTC-USD',
  last: (bid + ask) / 2,
  bid,
  ask,
  ts: 0,
});

describe('Aggregator', () => {
  it('computes VWAP, volume and the cross-market spread for a fixed recording', () => {
    const a = new Aggregator();
    a.addTrade(trade('coinbase', 100, 1, 1_000));
    a.addTrade(trade('kraken', 102, 3, 2_000));
    a.addTrade(trade('okx', 110, 1, 500)); // outside a 1 s window ending at 2 s
    a.setQuote(quote('coinbase', 99, 101));
    a.setQuote(quote('kraken', 100.5, 102));
    expect(a.compute('BTC-USD', 2_000, 1_500)).toEqual({
      symbol: 'BTC-USD',
      vwap: (100 * 1 + 102 * 3) / 4,
      spread: 101 - 100.5,
      volume: 4,
      windowMs: 1_500,
      ts: 2_000,
    });
  });

  it('reports a negative spread when markets cross, and null with no trades', () => {
    const a = new Aggregator();
    a.setQuote(quote('coinbase', 99, 100));
    a.setQuote(quote('bitstamp', 100.4, 101));
    expect(a.compute('BTC-USD', 0, 1_000)).toBeNull();
    a.addTrade(trade('coinbase', 100, 1, 0));
    expect(a.compute('BTC-USD', 0, 1_000)?.spread).toBeCloseTo(-0.4);
  });
});

describe('AlertEngine', () => {
  it('fires once per crossing', () => {
    // 10 s apart: long enough for a price back past the threshold to re-arm.
    const e = new AlertEngine();
    e.setRule({
      removed: false,
      id: 'r',
      symbol: 'BTC-USD',
      metric: 'price',
      op: 'above',
      threshold: 100,
    });
    const values = [99, 101, 102, 103, 99, 98, 100.5, 101];
    const fired = values.flatMap((v, i) => e.evaluate('BTC-USD', 'price', v, i * 10_000));
    expect(fired.map((f) => f.value)).toEqual([101, 100.5]);
  });

  it('ignores other symbols and metrics, re-arms on change, and stops on removal', () => {
    const e = new AlertEngine();
    e.setRule({
      removed: false,
      id: 'r',
      symbol: 'ETH-USD',
      metric: 'spread',
      op: 'below',
      threshold: 0,
    });
    expect(e.evaluate('BTC-USD', 'spread', -1, 0)).toEqual([]);
    expect(e.evaluate('ETH-USD', 'vwap', -1, 0)).toEqual([]);
    expect(e.evaluate('ETH-USD', 'spread', -1, 0)).toHaveLength(1);
    expect(e.evaluate('ETH-USD', 'spread', -2, 1)).toHaveLength(0);
    e.setRule({
      removed: false,
      id: 'r',
      symbol: 'ETH-USD',
      metric: 'spread',
      op: 'below',
      threshold: -1.5,
    });
    expect(e.evaluate('ETH-USD', 'spread', -2, 2)).toHaveLength(1);
    e.setRule({ removed: true, id: 'r' });
    expect(e.evaluate('ETH-USD', 'spread', 5, 3)).toEqual([]);
    expect(e.evaluate('ETH-USD', 'spread', -5, 4)).toEqual([]);
  });

  it("doesn't fire again after a restart for a rule that already fired", () => {
    const e = new AlertEngine();
    e.setRule({
      removed: false,
      id: 'r',
      symbol: 'BTC-USD',
      metric: 'price',
      op: 'above',
      threshold: 100,
    });
    e.markFired('r');
    expect(e.evaluate('BTC-USD', 'price', 105, 0)).toEqual([]);
    e.evaluate('BTC-USD', 'price', 95, 10_000);
    expect(e.evaluate('BTC-USD', 'price', 105, 10_001)).toHaveLength(1);
  });

  const above100 = {
    removed: false,
    id: 'r',
    symbol: 'BTC-USD',
    metric: 'price',
    op: 'above',
    threshold: 100,
  } as const;

  it('fires once while exchanges straddle the threshold', () => {
    const e = new AlertEngine();
    e.setRule(above100);
    // web#255: two exchanges, neither moving, evaluated in turn for 10 rounds.
    const fired = Array.from({ length: 10 }, (_, i) => [
      ...e.evaluate('BTC-USD', 'price', 101, i * 500),
      ...e.evaluate('BTC-USD', 'price', 99, i * 500 + 250),
    ]).flat();
    expect(fired).toHaveLength(1);
  });

  it('does the same for a rule below the threshold', () => {
    const e = new AlertEngine();
    e.setRule({ ...above100, op: 'below' });
    const fired = [99, 101, 99, 101, 99].flatMap((v, i) =>
      e.evaluate('BTC-USD', 'price', v, i * 500),
    );
    expect(fired).toHaveLength(1);
  });

  it('re-arms a price rule 10 s after the last price past the threshold', () => {
    const e = new AlertEngine();
    e.setRule(above100);
    expect(e.evaluate('BTC-USD', 'price', 101, 0)).toHaveLength(1);
    e.evaluate('BTC-USD', 'price', 99, 5_000);
    expect(e.evaluate('BTC-USD', 'price', 101, 6_000)).toHaveLength(0);
    e.evaluate('BTC-USD', 'price', 99, 15_999);
    expect(e.evaluate('BTC-USD', 'price', 101, 15_999)).toHaveLength(0);
    e.evaluate('BTC-USD', 'price', 99, 25_999);
    expect(e.evaluate('BTC-USD', 'price', 101, 26_000)).toHaveLength(1);
  });

  it('re-arms vwap and spread on the first value back, as each is one figure per symbol', () => {
    const e = new AlertEngine();
    e.setRule({ ...above100, metric: 'vwap' });
    const fired = [101, 99, 101].flatMap((v, i) => e.evaluate('BTC-USD', 'vwap', v, i * 1_000));
    expect(fired).toHaveLength(2);
  });

  it("doesn't fire again after a restart when the first price it sees is the other exchange's", () => {
    const e = new AlertEngine();
    e.setRule(above100);
    e.markFired('r');
    e.evaluate('BTC-USD', 'price', 99, 50_000);
    expect(e.evaluate('BTC-USD', 'price', 101, 50_250)).toEqual([]);
  });

  it('the same rule set again does not re-arm it', () => {
    const e = new AlertEngine();
    e.setRule(above100);
    expect(e.evaluate('BTC-USD', 'price', 101, 0)).toHaveLength(1);
    // As the job hears back a rule it created, or a redelivered request's.
    e.setRule({ ...above100 });
    expect(e.evaluate('BTC-USD', 'price', 102, 1)).toEqual([]);
  });
});

const replayAggregates = (): unknown[] => {
  const a = new Aggregator();
  const ticks: Tick[] = [...synth({ seed: 21, durationMs: 10_000, startTs: 0 })];
  for (const t of ticks) if (t.kind === 'trade') a.addTrade(t.rec);
  return SYMBOLS.map((s) => a.compute(s, 10_000, 5_000));
};
describe('on the replay source', () => {
  it('gives the same aggregates for the same seed', () => {
    const first = replayAggregates();
    expect(first.every((x) => x !== null)).toBe(true);
    expect(replayAggregates()).toEqual(first);
  });

  it('fires once in the 14 s after the walk first crosses, through four exchanges', () => {
    // Seed 10 at Lite's three symbols. `last` is each exchange's last trade, a
    // buy's or a sell's price, sent with its book every 500 ms (as runReplay).
    const threshold = 99_958;
    const e = new AlertEngine();
    e.setRule({
      removed: false,
      id: 'up',
      symbol: 'BTC-USD',
      metric: 'price',
      op: 'above',
      threshold,
    });
    const last = new Map<string, number>();
    const fired: number[] = [];
    let until = Infinity;
    for (const t of synth({ seed: 10, durationMs: 40_000, symbols: SYMBOLS.slice(0, 3) })) {
      if (t.rec.symbol !== 'BTC-USD') continue;
      if (t.kind === 'trade') {
        last.set(t.rec.exchange, t.rec.price);
        continue;
      }
      const price = last.get(t.rec.exchange);
      if (price === undefined || t.t <= 10_000) continue;
      if (t.t > until) break;
      if (price > threshold) until = Math.min(until, t.t + 14_000);
      fired.push(...e.evaluate('BTC-USD', 'price', price, t.t).map(() => t.t));
    }
    expect(fired).toHaveLength(1);
  });

  it('fires a rule set just above the start price once the walk crosses it', () => {
    const e = new AlertEngine();
    const ticks = [...synth({ seed: 4, durationMs: 120_000, startTs: 0, symbols: ['SOL-USD'] })];
    const first = ticks.find((t) => t.kind === 'trade');
    if (first?.kind !== 'trade') throw new Error('no trade');
    e.setRule({
      removed: false,
      id: 'up',
      symbol: 'SOL-USD',
      metric: 'price',
      op: 'above',
      threshold: first.rec.price * 1.001,
    });
    const fired = ticks.flatMap((t) =>
      t.kind === 'trade' ? e.evaluate('SOL-USD', 'price', t.rec.price, t.t) : [],
    );
    expect(fired.length).toBeGreaterThan(0);
    // Once per crossing: never twice in a row without the price dropping back.
    expect(new Set(fired.map((f) => f.ts)).size).toBe(fired.length);
  });
});
