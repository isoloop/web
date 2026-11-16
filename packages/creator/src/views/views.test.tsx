import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { recordingCtx } from '../draw/mock-ctx';
import {
  VIEW_INPUTS,
  type GridOutput,
  type Output,
  type OutputKind,
  type RowsOutput,
  type ScalarOutput,
  type SeriesOutput,
} from '../outputs';
import { barDraw } from './bar';
import { ViewEnv, type UseCanvas } from './env';
import { heatmapDraw } from './heatmap';
import {
  checkViewOptions,
  statOptions,
  tableOptions,
  VIEW_OPTIONS,
  VIEW_TYPES,
  viewAccepts,
} from './kinds';
import { lineDraw } from './line';
import { View } from './registry';
import { cellText, heatmapGrid, latestPerGroup, lastPoint, linesOf, timeLabel } from './shape';
import { SIZE } from './size';
import { gaugeFraction, statOf, StatView } from './stat';
import { tableOf, TableView } from './table';

const series: SeriesOutput = {
  kind: 'series',
  label: 'p95 Bearing temperature',
  unit: '°C',
  points: [
    { t: 0, v: 20 },
    { t: 1000, v: null },
    { t: 2000, v: 23 },
    { t: 3000, v: null },
  ],
};
const grid: GridOutput = {
  kind: 'grid',
  label: 'avg Speed',
  unit: 'rpm',
  groupLabel: 'Machine',
  groups: ['m1', 'm2', 'm3'],
  times: [0, 1000],
  values: [
    [1, 2],
    [3, null],
    [null, null],
  ],
};
const rows: RowsOutput = {
  kind: 'rows',
  columns: [
    { name: '$key', label: 'Machine', type: 'string' },
    { name: 'temp', label: 'Temperature', type: 'number', unit: '°C' },
    { name: 'at', label: 'At', type: 'time' },
  ],
  rows: [
    { key: 'm1', t: 2, cells: ['m1', 71.25, Date.UTC(2026, 0, 1, 12, 0, 5)] },
    { key: 'm2', t: 1, cells: ['m2', null, null] },
  ],
};
const scalar: ScalarOutput = { kind: 'scalar', label: 'count', t: 0, value: 42.5 };
const sample: Record<OutputKind, Output> = { series, grid, rows, scalar };

const ctx = (): ReturnType<typeof recordingCtx>['ctx'] => recordingCtx().ctx;
const noCanvas: UseCanvas = () => ({ ctx: null, width: 0, height: 0 });
const render = (el: React.ReactElement): string =>
  renderToStaticMarkup(<ViewEnv useCanvas={noCanvas}>{el}</ViewEnv>);

describe('the registry', () => {
  it('covers all five views, the same ones as VIEW_INPUTS and VIEW_OPTIONS', () => {
    expect(VIEW_TYPES.toSorted()).toEqual(['bar', 'heatmap', 'line', 'stat', 'table']);
    expect(Object.keys(VIEW_INPUTS).toSorted()).toEqual(VIEW_TYPES.toSorted());
    expect(Object.keys(VIEW_OPTIONS).toSorted()).toEqual(VIEW_TYPES.toSorted());
  });

  it('accepts what VIEW_INPUTS says and nothing else', () => {
    for (const t of VIEW_TYPES) {
      for (const k of ['rows', 'scalar', 'series', 'grid'] as const) {
        expect(viewAccepts(t, k)).toBe(VIEW_INPUTS[t].includes(k));
      }
    }
  });

  it('renders every view over every output kind it takes', () => {
    for (const t of VIEW_TYPES) {
      for (const k of VIEW_INPUTS[t]) {
        const html = render(<View type={t} output={sample[k]} title="T" size="m" />);
        expect(html, `${t} over ${k}`).toContain(`data-view="${t}"`);
        expect(html, `${t} over ${k}`).not.toContain('creator-view-mismatch');
      }
    }
  });

  it('shows a mismatch instead of throwing', () => {
    const html = render(<View type="heatmap" output={scalar} title="T" size="s" />);
    expect(html).toContain('creator-view-mismatch');
    expect(html).toContain('can&#x27;t show scalar output');
  });

  it('renders every view while it waits for its first output', () => {
    for (const t of VIEW_TYPES) {
      expect(render(<View type={t} output={undefined} title="T" size="s" />)).toContain(
        `data-view="${t}"`,
      );
    }
  });
});

describe('view options', () => {
  it('are fine when absent or known', () => {
    for (const t of VIEW_TYPES) expect(checkViewOptions(t, undefined)).toEqual([]);
    expect(checkViewOptions('table', { limit: 10 })).toEqual([]);
    expect(checkViewOptions('stat', { gaugeMin: 0, gaugeMax: 100 })).toEqual([]);
  });

  it('reject unknown names and wrong types, with paths', () => {
    expect(checkViewOptions('line', { color: 'red' })).toEqual([
      { path: 'view.options.color', message: 'a line view has no option "color"' },
    ]);
    expect(checkViewOptions('table', { rows: 3 })[0]?.message).toContain('(it has limit)');
    expect(checkViewOptions('table', { limit: '10' })).toEqual([
      { path: 'view.options.limit', message: 'must be a number' },
    ]);
  });

  it('check the table limit and the gauge range', () => {
    expect(checkViewOptions('table', { limit: 0 })[0]?.path).toBe('view.options.limit');
    expect(checkViewOptions('table', { limit: 1.5 })).toHaveLength(1);
    expect(checkViewOptions('table', { limit: 201 })).toHaveLength(1);
    expect(checkViewOptions('stat', { gaugeMin: 0 })).toEqual([
      { path: 'view.options.gaugeMax', message: 'a gauge needs both gaugeMin and gaugeMax' },
    ]);
    expect(checkViewOptions('stat', { gaugeMin: 5, gaugeMax: 5 })).toEqual([
      { path: 'view.options.gaugeMax', message: 'must be above gaugeMin' },
    ]);
  });

  it('are read with defaults', () => {
    expect(tableOptions(undefined)).toEqual({ limit: 50 });
    expect(tableOptions({ limit: 5 })).toEqual({ limit: 5 });
    expect(statOptions(undefined)).toEqual({ gauge: undefined });
    expect(statOptions({ gaugeMin: 1, gaugeMax: 2 })).toEqual({ gauge: { min: 1, max: 2 } });
  });

  it('reach the view through View', () => {
    expect(
      render(<View type="table" output={rows} title="T" size="s" options={{ limit: 1 }} />),
    ).toContain('data-rows="1"');
    expect(
      render(
        <View
          type="stat"
          output={scalar}
          title="T"
          size="s"
          options={{ gaugeMin: 0, gaugeMax: 100 }}
        />,
      ),
    ).toContain('<svg');
  });
});

describe('shapes', () => {
  it('a series is one line and a grid one line per group, gaps kept', () => {
    expect(linesOf(series)).toEqual([
      {
        label: 'p95 Bearing temperature',
        points: [
          [0, 20],
          [1000, null],
          [2000, 23],
          [3000, null],
        ],
      },
    ]);
    const lines = linesOf(grid);
    expect(lines.map((l) => l.label)).toEqual(['m1', 'm2', 'm3']);
    expect(lines[1]?.points).toEqual([
      [0, 3],
      [1000, null],
    ]);
  });

  it("a grid's bars are each group's newest value, groups without one left out", () => {
    expect(latestPerGroup(grid)).toEqual([
      { label: 'm1', value: 2 },
      { label: 'm2', value: 3 },
    ]);
  });

  it("a series' last point is its newest with a value", () => {
    expect(lastPoint(series)).toEqual({ t: 2000, v: 23 });
    expect(lastPoint({ ...series, points: [{ t: 0, v: null }] })).toBeUndefined();
  });

  it('a heatmap has groups down and ticks across, "now" for a single tick', () => {
    const g = heatmapGrid(grid);
    expect(g.rows).toEqual(['m1', 'm2', 'm3']);
    expect(g.cols).toEqual([timeLabel(0), timeLabel(1000)]);
    expect(heatmapGrid({ ...grid, times: [5], values: [[1], [2], [3]] }).cols).toEqual(['now']);
  });

  it('times are hh:mm:ss and gaps a dash', () => {
    expect(timeLabel(0)).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(cellText(null, 'number', String)).toBe('–');
    expect(cellText('x', 'string', String)).toBe('x');
    expect(cellText(1.5, 'number', (n) => n.toFixed(1))).toBe('1.5');
    expect(cellText(0, 'time', String)).toBe(timeLabel(0));
  });
});

describe('canvas views', () => {
  it('render a canvas sized by size', () => {
    const html = render(<View type="line" output={series} title="T" size="l" />);
    expect(html).toContain('<canvas');
    expect(html).toContain(`height:${SIZE.l.height}px`);
    expect(html).toContain('data-size="l"');
  });

  it('need a ViewEnv', () => {
    expect(() =>
      renderToStaticMarkup(<View type="line" output={series} title="T" size="s" />),
    ).toThrow(/ViewEnv/);
  });

  it('describe what they drew, or null while waiting', () => {
    expect(lineDraw(series, 'T')(ctx(), 300, 200)).toBe('line:1x4');
    expect(lineDraw(grid, 'T')(ctx(), 300, 200)).toBe('line:3x6');
    expect(lineDraw(undefined, 'T')(ctx(), 300, 200)).toBeNull();
    expect(heatmapDraw(grid, 'T')(ctx(), 300, 200)).toBe('heatmap:3x2');
    expect(heatmapDraw(undefined, 'T')(ctx(), 300, 200)).toBeNull();
    expect(barDraw(series, 'T')(ctx(), 300, 200)).toBe('bar:series:4');
    expect(barDraw(grid, 'T')(ctx(), 300, 200)).toBe('bar:groups:2');
    expect(barDraw(undefined, 'T')(ctx(), 300, 200)).toBeNull();
  });
});

describe('table', () => {
  it('heads each column with its label and unit; times as hh:mm:ss, gaps as a dash', () => {
    const html = render(<TableView output={rows} title="Temps" size="m" />);
    expect(html).toContain('<th scope="col">Machine</th>');
    expect(html).toContain('<th scope="col">Temperature (°C)</th>');
    expect(html).toContain('<td>71.3</td>');
    expect(html).toContain(`<td>${timeLabel(Date.UTC(2026, 0, 1, 12, 0, 5))}</td>`);
    expect(html).toContain('<td>–</td>');
    expect(html).toContain('data-rows="2"');
  });

  it('shows a grid as a row per group with its newest value', () => {
    const t = tableOf(grid, 50);
    expect(t.columns.map((c) => c.label)).toEqual(['Machine', 'avg Speed']);
    expect(t.columns[1]?.unit).toBe('rpm');
    expect(t.rows.map((r) => r.cells)).toEqual([
      ['m1', 2],
      ['m2', 3],
    ]);
    expect(render(<TableView output={grid} title="T" size="s" />)).toContain(
      '<th scope="col">avg Speed (rpm)</th>',
    );
  });

  it('keeps to the row limit', () => {
    expect(render(<TableView output={rows} title="T" size="s" limit={1} />)).toContain(
      'data-rows="1"',
    );
  });

  it('waits for data', () => {
    expect(render(<TableView output={undefined} title="T" size="s" />)).toContain(
      'waiting for data…',
    );
  });
});

describe('stat', () => {
  it("shows the number with the output's unit and label", () => {
    const html = render(<StatView output={{ ...scalar, unit: '°C' }} title="Temp" size="s" />);
    expect(html).toContain('42.5');
    expect(html).toContain('°C');
    expect(html).toContain('count');
    expect(html).not.toContain('<svg');
  });

  it("shows a series' newest value", () => {
    expect(statOf(series)).toEqual({ value: 23, label: 'p95 Bearing temperature', unit: '°C' });
    expect(render(<StatView output={series} title="T" size="s" />)).toContain('data-value="23"');
  });

  it('draws a gauge with its range when asked', () => {
    const html = render(
      <StatView output={scalar} title="Temp" size="m" gauge={{ min: 0, max: 100 }} />,
    );
    expect(html).toContain('<svg');
    expect(html).toContain('data-fraction="0.425"');
    expect(html).toContain('gauge from 0 to 100');
  });

  it('shows a dash and no unit before the first value', () => {
    const html = render(
      <StatView
        output={{ ...scalar, value: null, unit: '°C' }}
        title="Temp"
        size="s"
        gauge={{ min: 0, max: 1 }}
      />,
    );
    expect(html).toContain('–');
    expect(html).not.toContain('°C');
    expect(html).not.toContain('data-fraction');
  });

  it('clamps the gauge', () => {
    expect(gaugeFraction(-5, 0, 10)).toBe(0);
    expect(gaugeFraction(15, 0, 10)).toBe(1);
    expect(gaugeFraction(5, 0, 10)).toBe(0.5);
    expect(gaugeFraction(5, 3, 3)).toBe(0);
  });
});
