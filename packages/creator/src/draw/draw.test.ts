import { describe, expect, it } from 'vitest';
import { drawBars } from './bars';
import { drawChart } from './chart';
import { colorAt, COLORS, formatValue } from './ctx';
import { divergingColor, drawHeatmap, GAP_COLOR, gridScale, sequentialColor } from './heatmap';
import { recordingCtx } from './mock-ctx';

const texts = (r: ReturnType<typeof recordingCtx>): unknown[] =>
  r.named('fillText').map((a) => a[0]);

describe('drawChart', () => {
  it('waits for data with no points', () => {
    const r = recordingCtx();
    expect(drawChart(r.ctx, 300, 200, [], { title: 'T' })).toBe(false);
    expect(texts(r)).toEqual(['T', 'waiting for data…']);
  });

  it('draws one line per series, labelled with its last value, in palette colours', () => {
    const r = recordingCtx();
    const drew = drawChart(
      r.ctx,
      300,
      200,
      [
        {
          label: 'a',
          points: [
            [0, 1],
            [1, 2],
            [2, 3],
          ],
        },
        {
          label: 'b',
          points: [
            [0, 5],
            [2, 4],
          ],
        },
      ],
      { title: 'T' },
    );
    expect(drew).toBe(true);
    expect(r.named('lineTo')).toHaveLength(3);
    expect(r.named('stroke')).toHaveLength(2);
    expect(texts(r)).toContain('a 3.00');
    expect(texts(r)).toContain('b 4.00');
  });

  it('lifts the pen at a null, so a gap stays a gap', () => {
    const r = recordingCtx();
    drawChart(
      r.ctx,
      300,
      200,
      [
        {
          label: 'a',
          points: [
            [0, 1],
            [1, null],
            [2, 3],
            [3, 4],
          ],
        },
      ],
      { title: '' },
    );
    expect(r.named('moveTo')).toHaveLength(2);
    expect(r.named('lineTo')).toHaveLength(1);
    expect(texts(r)).toContain('a 4.00');
  });

  it('labels at most four series in the header', () => {
    const r = recordingCtx();
    const many = Array.from({ length: 6 }, (_, i) => ({
      label: `s${i}`,
      points: [[0, i]] as const,
    }));
    drawChart(r.ctx, 300, 200, many, { title: '' });
    expect(r.named('stroke')).toHaveLength(6);
    expect(texts(r).filter((t) => typeof t === 'string' && t.startsWith('s'))).toHaveLength(4);
  });

  it('draws bars from zero for the first series', () => {
    const r = recordingCtx();
    drawChart(
      r.ctx,
      300,
      200,
      [
        {
          label: 'a',
          points: [
            [0, 2],
            [1, 4],
          ],
        },
      ],
      { title: '', bars: true },
    );
    const rects = r.named('fillRect');
    expect(rects).toHaveLength(2);
    for (const [, , w, h] of rects) {
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });
});

describe('drawBars', () => {
  it('draws a bar per category with its label and value', () => {
    const r = recordingCtx();
    expect(
      drawBars(
        r.ctx,
        300,
        200,
        [
          { label: 'x', value: 2 },
          { label: 'y', value: -1 },
        ],
        { title: 'T' },
      ),
    ).toBe(true);
    expect(r.named('fillRect')).toHaveLength(2);
    expect(texts(r)).toEqual(expect.arrayContaining(['x', 'y', '2.00', '-1.00']));
  });

  it('waits for data with no bars', () => {
    const r = recordingCtx();
    expect(drawBars(r.ctx, 300, 200, [], { title: 'T' })).toBe(false);
  });
});

describe('drawHeatmap', () => {
  it('draws a cell per value and labels rows and columns', () => {
    const r = recordingCtx();
    const drew = drawHeatmap(
      r.ctx,
      300,
      200,
      {
        rows: ['r1', 'r2'],
        cols: ['c1', 'c2', 'c3'],
        values: [
          [1, 2, 3],
          [4, null, 6],
        ],
      },
      { title: 'T' },
    );
    expect(drew).toBe(true);
    expect(r.named('fillRect')).toHaveLength(6);
    expect(texts(r)).toEqual(['T', 'c1', 'c2', 'c3', 'r1', 'r2']);
    // The null cell is a gap.
    expect(r.calls.filter((c) => c.name === 'fillRect').map((c) => c.fillStyle)[4]).toBe(GAP_COLOR);
  });

  it('labels at most six columns', () => {
    const r = recordingCtx();
    const cols = Array.from({ length: 24 }, (_, i) => `c${i}`);
    drawHeatmap(r.ctx, 300, 200, { rows: ['r'], cols, values: [cols.map(() => 1)] }, { title: '' });
    expect(texts(r).filter((t) => typeof t === 'string' && t.startsWith('c'))).toHaveLength(6);
  });

  it('waits for data with an empty grid', () => {
    const r = recordingCtx();
    expect(drawHeatmap(r.ctx, 300, 200, { rows: [], cols: [], values: [] }, { title: 'T' })).toBe(
      false,
    );
  });
});

describe('colour scales', () => {
  it('is diverging around zero when values sit on both sides', () => {
    const scale = gridScale([[-2, 0, 1]]);
    expect(scale(-2)).toBe(divergingColor(-1));
    expect(scale(1)).toBe(divergingColor(0.5));
  });

  it('is sequential from min to max otherwise', () => {
    const scale = gridScale([[10, null, 20]]);
    expect(scale(10)).toBe(sequentialColor(0));
    expect(scale(20)).toBe(sequentialColor(1));
    expect(scale(null)).toBe(GAP_COLOR);
  });

  it('copes with no finite values', () => {
    expect(gridScale([[null, Number.NaN]])(1)).toBe(GAP_COLOR);
  });
});

describe('helpers', () => {
  it('cycles the palette', () => {
    expect(colorAt(COLORS.length)).toBe(COLORS[0]);
  });

  it('formats by magnitude', () => {
    expect(formatValue(1.234)).toBe('1.23');
    expect(formatValue(12.34)).toBe('12.3');
    expect(formatValue(1234.5)).toBe('1235');
  });
});
