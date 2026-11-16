import { drawChart } from '../draw/chart';
import type { GridOutput, SeriesOutput } from '../outputs';
import { CanvasView, type Draw } from './canvas-view';
import type { ViewProps } from './props';
import { linesOf } from './shape';

/** The line view's drawing, apart from React so it can be tested on a mock context. */
export function lineDraw(output: SeriesOutput | GridOutput | undefined, title: string): Draw {
  return (ctx, width, height) => {
    const lines = output ? linesOf(output) : [];
    if (!drawChart(ctx, width, height, lines, { title })) return null;
    return `line:${lines.length}x${lines.reduce((n, s) => n + s.points.length, 0)}`;
  };
}

/** A series as one line, a grid as one line per group. */
export function LineView({ output, title, size }: ViewProps<SeriesOutput | GridOutput>) {
  return <CanvasView view="line" size={size} draw={lineDraw(output, title)} />;
}
