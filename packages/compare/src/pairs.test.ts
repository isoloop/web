import { describe, expect, it } from 'vitest';
import { median, summarize, type PairsApp, type Result } from './pairs';

const APP: PairsApp = {
  title: 'Test dashboard, head-to-head',
  dir: '.',
  projects: { chromium: 'comparison' },
  knob: {
    option: 'sizes',
    env: 'COMPARE_SIZES',
    default: 'normal',
    field: 'size',
    label: (s) => String(s)[0]?.toUpperCase() + String(s).slice(1),
    order: ['lite', 'normal', 'heavy'],
  },
  figures: [{ key: 'typingMedianMs', label: 'Typing', unit: ' ms' }],
};

const result = (key: string, value: string, run: number, typing: number | null): Result => {
  const [build = '', placement = null] = key.split(':');
  return {
    engine: 'chromium',
    build,
    placement,
    value,
    stopped: typing === null,
    figures: { typingMedianMs: typing },
    run,
    key,
  };
};

describe('summarize', () => {
  const results = [
    result('native', 'heavy', 1, 10),
    result('isoloop:one', 'heavy', 1, 30),
    result('native', 'heavy', 2, 20),
    result('isoloop:one', 'heavy', 2, 26),
    result('native', 'normal', 1, 8),
    result('isoloop:one', 'normal', 1, null),
    result('isoloop:own', 'normal', 1, 40),
  ];
  const md = summarize(
    APP,
    results,
    { pairs: [{ a: 'native', b: 'isoloop:one' }], extras: ['isoloop:own'] },
    null,
  );

  it('orders sections by the knob, labelled by the app', () => {
    expect(md.indexOf('## chromium, Normal')).toBeLessThan(md.indexOf('## chromium, Heavy'));
  });

  it('gives the median gap within rounds, its share of A and its spread', () => {
    // Gaps per round: +20 and +6; median +13 over A's median 15.
    expect(md).toContain('| Typing | 15 ms | 28 ms | +13 ms | +87% | +6 ms to +20 ms |');
  });

  it('counts and names a stopped run, and shows the extras', () => {
    expect(md).toContain('Rounds: A 1/1 ran, B 0/1 ran.');
    expect(md).toContain('- Round 1, isoloop:one: page stopped.');
    expect(md).toContain('| Typing | 8 ms | stopped | – | – | – |');
    expect(md).toContain('| Typing | 40 ms |');
  });
});

describe('median', () => {
  it('averages the middle two of an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
