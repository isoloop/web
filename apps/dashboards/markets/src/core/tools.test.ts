// The agent tools' handlers (M4a): the aggregator's quote and the alerts
// job's create, against an in-memory Source.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentRuleId, runAggregator, runAlerts } from './services';
import type { Rec, Source, StreamName, Streams } from './streams';

type Handler = (r: Rec<unknown>) => void;

/** A Source that delivers each publish to its stream's subscribers at once. */
function memorySource() {
  const subs = new Map<StreamName, Handler[]>();
  const published: { stream: StreamName; key?: string | undefined; value: unknown }[] = [];
  const src: Source = {
    subscribe(stream, fn) {
      const list = subs.get(stream) ?? [];
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the test publishes each stream's own type
      list.push(fn as Handler);
      subs.set(stream, list);
      return () => {
        subs.set(
          stream,
          (subs.get(stream) ?? []).filter((h) => h !== fn),
        );
      };
    },
    publish(stream, value, key) {
      published.push({ stream, key, value });
      for (const h of subs.get(stream) ?? []) h({ key, value });
    },
  };
  const send = <S extends StreamName>(stream: S, value: Streams[S], key?: string): void => {
    for (const h of subs.get(stream) ?? []) h({ key, value });
  };
  return { src, published, send };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('markets.alerts.create.v1', () => {
  const rule = { symbol: 'BTC-USD', metric: 'price', op: 'above', threshold: 100_000 } as const;

  it('adds one rule, keyed by an id from the request id', () => {
    const { src, published } = memorySource();
    const svc = runAlerts(src);
    expect(svc.create('req-1', rule)).toEqual({ id: agentRuleId('req-1'), created: true });
    const rules = published.filter((p) => p.stream === 'alertRules');
    expect(rules).toEqual([
      {
        stream: 'alertRules',
        key: 'agent-req-1',
        value: { removed: false, id: 'agent-req-1', ...rule },
      },
    ]);
    svc.stop();
  });

  it('is idempotent by request id: a redelivered request adds nothing new', () => {
    const { src, published } = memorySource();
    const svc = runAlerts(src);
    svc.create('req-1', rule);
    expect(svc.create('req-1', rule)).toEqual({ id: 'agent-req-1', created: false });
    // The same rule under the same key of a compacted topic: still one rule.
    const keys = new Set(published.filter((p) => p.stream === 'alertRules').map((p) => p.key));
    expect([...keys]).toEqual(['agent-req-1']);
    svc.stop();
  });

  it('after a restart, a rule read back from the topic counts as created', () => {
    const { src, send } = memorySource();
    const svc = runAlerts(src);
    send('alertRules', { removed: false, id: 'agent-req-1', ...rule }, 'agent-req-1');
    expect(svc.create('req-1', rule).created).toBe(false);
    svc.stop();
  });

  it('a new request id adds a second rule', () => {
    const { src } = memorySource();
    const svc = runAlerts(src);
    svc.create('req-1', rule);
    expect(svc.create('req-2', rule)).toEqual({ id: 'agent-req-2', created: true });
    svc.stop();
  });

  it("the rule fires like the alerts panel's", () => {
    const { src, published, send } = memorySource();
    const svc = runAlerts(src);
    svc.create('req-1', rule);
    send('prices', {
      exchange: 'okx',
      symbol: 'BTC-USD',
      last: 100_500,
      bid: 100_499,
      ask: 100_501,
      ts: 1,
    });
    expect(published.filter((p) => p.stream === 'alerts')).toHaveLength(1);
    svc.stop();
  });
});

describe('markets.quote.v1', () => {
  it('answers the aggregate over the window and each exchange quote', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { src, send } = memorySource();
    const svc = runAggregator(src);
    const ts = Date.now() - 1_000;
    send('prices', { exchange: 'okx', symbol: 'BTC-USD', last: 100, bid: 99, ask: 101, ts });
    send('prices', { exchange: 'kraken', symbol: 'BTC-USD', last: 100, bid: 99.5, ask: 100.5, ts });
    send('trades', {
      exchange: 'okx',
      symbol: 'BTC-USD',
      id: 't1',
      price: 100,
      size: 2,
      side: 'buy',
      ts,
    });
    const q = svc.quote('BTC-USD');
    expect(q.symbol).toBe('BTC-USD');
    expect(q.aggregate).toMatchObject({ vwap: 100, volume: 2, windowMs: 60_000 });
    expect(q.aggregate?.spread).toBeCloseTo(100.5 - 99.5);
    expect(q.prices.map((p) => p.exchange).toSorted()).toEqual(['kraken', 'okx']);
    svc.stop();
  });

  it('gives a null aggregate with no trades in the window', () => {
    const { src } = memorySource();
    const svc = runAggregator(src);
    expect(svc.quote('ETH-USD')).toEqual({ symbol: 'ETH-USD', aggregate: null, prices: [] });
    svc.stop();
  });
});
