/** @jsxImportSource preact */
import { describe, expect, it } from 'vitest';
import { render } from '../render.ts';
import { ChartLegend, formatDelta, formatValue, PairedBars } from './PairedBars.tsx';

// Shaped like plant's main-thread figure: matched against native + workers.
const fixture = (
  <PairedBars
    title="Main thread busy"
    unit="%"
    base="Native + workers"
    value="Isoloop matched"
    rows={[
      { label: '1 kHz', base: 41, value: 15 },
      { label: '5 kHz', base: 79, value: 27 },
    ]}
  />
);

describe('PairedBars', () => {
  it('renders the fixture as static SVG bars with the values and the delta in words', () => {
    expect(render(fixture)).toMatchSnapshot();
  });

  it('has no inline style and no script (CSP: default-src self)', () => {
    const html = render(fixture);
    expect(html).not.toContain('style=');
    expect(html).not.toContain('<script');
  });

  it('hides the bars from assistive tech and keeps names and values as text', () => {
    const html = render(fixture);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(4);
    expect(html).toContain('<span class="ui-chart-name">Native + workers</span>');
    expect(html).toContain('<span class="ui-chart-value">27%</span>');
    expect(html).toContain('data-verdict="better">52 points lower, better</p>');
  });

  it('colours a cost as worse and scales every bar in a chart to the largest value', () => {
    const html = render(
      <PairedBars
        title="Memory after GC"
        unit="MB"
        base="Native + workers"
        value="Isoloop matched"
        rows={[{ base: 100, value: 150 }]}
      />,
    );
    expect(html).toContain('width="66.67%"');
    expect(html).toContain('width="100%" height="14" aria-hidden');
    expect(html).toContain('data-verdict="worse">50 MB higher, worse</p>');
    expect(html).toContain(
      '<li data-series="value" data-verdict="worse">Isoloop matched, worse</li>',
    );
    expect(html).not.toContain('ui-chart-label');
  });

  it('takes a verdict override, a higher-is-better scale and a fixed top', () => {
    const html = render(
      <PairedBars
        title="Frames"
        unit="ms"
        base="A"
        value="B"
        lowerIsBetter={false}
        max={200}
        rows={[
          { base: 50, value: 60 },
          { base: 50, value: 44, verdict: 'same' },
        ]}
      />,
    );
    expect(html).toContain('Higher is better.');
    expect(html).toContain('width="25%"');
    expect(html).toContain('10 ms higher, better');
    expect(html).toContain('data-verdict="same">6 ms lower, within the spread</p>');
  });

  it('draws nothing for a zero and keeps a tiny bar square', () => {
    const html = render(
      <PairedBars
        title="Lost"
        unit="s"
        base="A"
        value="B"
        note={null}
        rows={[{ base: 3, value: 0 }]}
      />,
    );
    expect(html).toContain(
      '<svg class="ui-chart-svg" width="0%" height="14" aria-hidden="true" focusable="false"></svg>',
    );
    expect(html).not.toContain('ui-chart-note');
    const tiny = render(
      <PairedBars title="T" unit="s" base="A" value="B" rows={[{ base: 100, value: 1 }]} />,
    );
    expect(tiny).toContain('<rect width="100%" height="14" rx="0"></rect></svg>');
  });

  it('hides the names visually when compact, and the legend when asked', () => {
    const html = render(
      <PairedBars
        compact
        legend={false}
        title="Typing"
        unit="ms"
        base="A"
        value="B"
        rows={[{ base: 62, value: 41 }]}
      />,
    );
    expect(html).toContain('<figure class="ui-chart" data-compact>');
    expect(html).toContain('<span class="ui-chart-name">A</span>');
    expect(html).not.toContain('ui-chart-legend');
  });
});

describe('ChartLegend', () => {
  it('explains the within-the-spread colour when asked', () => {
    const html = render(
      <ChartLegend base="Native" value="Isoloop one" verdicts={['better', 'worse', 'same']} />,
    );
    expect(html).toContain(
      '<li data-series="value" data-verdict="same">Isoloop one, within the spread</li>',
    );
  });

  it('names the baseline and both of Isoloop’s colours', () => {
    expect(render(<ChartLegend base="Native + workers" value="Isoloop matched" />)).toBe(
      '<ul class="ui-chart-legend" aria-label="How to read the charts"><li data-series="base">Native + workers</li><li data-series="value" data-verdict="better">Isoloop matched, better</li><li data-series="value" data-verdict="worse">Isoloop matched, worse</li></ul>',
    );
  });
});

describe('formatting', () => {
  it.each([
    [27, '%', '27%'],
    [41, 'ms', '41 ms'],
    [1240, 'ms', '1.2 s'],
    [0.2, 's', '0.2 s'],
    [44.4, 'MB', '44 MB'],
    [2429644.2, 'ops/s', '2,429,644 ops/s'],
    [20.46, 'ops/s', '20.5 ops/s'],
  ] as const)('%d %s is %s', (n, unit, text) => {
    expect(formatValue(n, unit)).toBe(text);
  });

  it('says the sign in words, with points for percentages and seconds from 1000 ms', () => {
    expect(formatDelta(79, 27, '%').text).toBe('52 points lower, better');
    expect(formatDelta(27, 28, '%').text).toBe('1 point higher, worse');
    expect(formatDelta(1200, 2400, 'ms').text).toBe('1.2 s higher, worse');
    expect(formatDelta(3.2, 2.9, 's').text).toBe('0.3 s lower, better');
    expect(formatDelta(0, 0, 's')).toEqual({ text: 'the same', verdict: 'same' });
    expect(formatDelta(41, 41.2, 'ms')).toEqual({ text: 'the same', verdict: 'same' });
  });

  it('says an ops/s difference as a share of the baseline, higher being better', () => {
    // js-bench 0.1.0: structuredClone of 5 MB, plain Workers 25.1, Isoloop 20.5.
    expect(formatDelta(25.1, 20.5, 'ops/s', { lowerIsBetter: false }).text).toBe(
      '18% lower, worse',
    );
    expect(formatDelta(4974, 5010, 'ops/s', { lowerIsBetter: false }).text).toBe(
      '1% higher, better',
    );
    expect(formatDelta(1000, 1002, 'ops/s', { lowerIsBetter: false }).text).toBe('the same');
  });

  it('uses a measured paired delta over the difference of the two values', () => {
    // plant: typing median 62 ms → 41 ms, paired Δ −28 ms.
    expect(formatDelta(62, 41, 'ms', { delta: -28 }).text).toBe('28 ms lower, better');
    const html = render(
      <PairedBars
        title="Typing, median"
        unit="ms"
        base="Native + workers"
        value="Isoloop matched"
        rows={[{ base: 62, value: 41, delta: -28 }]}
      />,
    );
    expect(html).toContain('28 ms lower, better');
    expect(html).not.toContain('21 ms');
  });
});
