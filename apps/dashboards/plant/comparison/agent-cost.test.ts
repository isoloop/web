import { describe, expect, it } from 'vitest';
import { markdown, quantile, rows, spread, type Run } from './agent-cost.ts';

const run = (round: number, rtt: number[], main: number | null): Run => ({
  engine: 'chromium',
  page: 'idle',
  round,
  library: '0.1.0-next.5',
  modes: [
    {
      calls: rtt.length,
      concurrency: 1,
      rttMs: rtt,
      issueMsPerCall: [0.01],
      wallMs: 1000,
      mainMsPerCall: main,
    },
  ],
});

describe('agent-call cost summary', () => {
  it('takes nearest-rank quantiles', () => {
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(
      quantile(
        [...Array(100).keys()].map((i) => i + 1),
        0.95,
      ),
    ).toBe(95);
  });

  it('spreads the per-round figures', () => {
    expect(spread([3, 1, 2])).toEqual({ median: 2, low: 1, high: 3, rounds: 3 });
  });

  it('groups by engine, page and concurrency, one figure per round', () => {
    const [r] = rows([run(1, [1, 2, 3], 0.1), run(2, [2, 3, 4], 0.3), run(3, [3, 4, 5], 0.2)]);
    expect(r?.rttMedian).toEqual({ median: 3, low: 2, high: 4, rounds: 3 });
    expect(r?.mainPerCall?.median).toBe(0.2);
    expect(r?.callsPerSec.median).toBe(3);
    expect(r?.rttMean.median).toBeCloseTo(1000 / 3);
    expect(r?.issue.median).toBe(0.01);
  });

  it('leaves main-thread time out where an engine has none', () => {
    const [r] = rows([{ ...run(1, [1], null), engine: 'firefox' }]);
    expect(r?.mainPerCall).toBeNull();
    expect(markdown([{ ...run(1, [1], null), engine: 'firefox' }])).toContain('| – |');
  });
});
