// From a pipeline's output to what a view draws. Pure, so it's tested apart
// from React and the canvas.
import type { Bar } from '../draw/bars';
import type { Series } from '../draw/chart';
import type { Grid } from '../draw/heatmap';
import type { Cell, Column, GridOutput, Point, SeriesOutput } from '../outputs';

/** A series as one line; a grid as one line per group. Nulls stay as gaps. */
export function linesOf(output: SeriesOutput | GridOutput): Series[] {
  if (output.kind === 'series') {
    return [{ label: output.label, points: output.points.map((p) => [p.t, p.v] as const) }];
  }
  return output.groups.map((group, g) => ({
    label: group,
    points: output.times.map((t, i) => [t, output.values[g]?.[i] ?? null] as const),
  }));
}

/** Each group's newest value, skipping groups with none. */
export function latestPerGroup(output: GridOutput): Bar[] {
  const bars: Bar[] = [];
  output.groups.forEach((label, g) => {
    const v = output.values[g]?.findLast((x) => x !== null) ?? null;
    if (v !== null) bars.push({ label, value: v });
  });
  return bars;
}

/** A series' newest point with a value. */
export function lastPoint(output: SeriesOutput): Point | undefined {
  return output.points.findLast((p) => p.v !== null);
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** A time as hh:mm:ss, in the viewer's time zone. */
export function timeLabel(t: number): string {
  const d = new Date(t);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** A grid as the heatmap draws it: groups down, ticks across ("now" when there's one). */
export function heatmapGrid(output: GridOutput): Grid {
  return {
    rows: output.groups,
    cols: output.times.length === 1 ? ['now'] : output.times.map(timeLabel),
    values: output.values,
  };
}

/** A column's header: its label, then its unit in brackets. */
export function header(c: Pick<Column, 'label' | 'unit'>): string {
  return c.unit ? `${c.label} (${c.unit})` : c.label;
}

/** A table cell's text: numbers to a few decimals, times as hh:mm:ss, gaps as a dash. */
export function cellText(
  v: Cell | undefined,
  type: Column['type'],
  format: (n: number) => string,
): string {
  if (v === null || v === undefined) return '–';
  if (typeof v === 'string') return v;
  return type === 'time' ? timeLabel(v) : format(v);
}
