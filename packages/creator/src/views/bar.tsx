import { drawBars } from '../draw/bars';
import { drawChart } from '../draw/chart';
import type { GridOutput, SeriesOutput } from '../outputs';
import { CanvasView, type Draw } from './canvas-view';
import type { ViewProps } from './props';
import { latestPerGroup, linesOf } from './shape';

/** The bar view's drawing: bars over time for a series, a bar per group (its newest value) for a grid. */
export function barDraw(output: SeriesOutput | GridOutput | undefined, title: string): Draw {
  return (ctx, width, height) => {
    if (output?.kind === 'grid') {
      const bars = latestPerGroup(output);
      return drawBars(ctx, width, height, bars, { title }) ? `bar:groups:${bars.length}` : null;
    }
    const lines = output ? linesOf(output) : [];
    return drawChart(ctx, width, height, lines, { title, bars: true })
      ? `bar:series:${lines[0]?.points.length ?? 0}`
      : null;
  };
}

export function BarView({ output, title, size }: ViewProps<SeriesOutput | GridOutput>) {
  return <CanvasView view="bar" size={size} draw={barDraw(output, title)} />;
}
