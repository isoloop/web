import { drawHeatmap } from '../draw/heatmap';
import type { GridOutput } from '../outputs';
import { CanvasView, type Draw } from './canvas-view';
import type { ViewProps } from './props';
import { heatmapGrid } from './shape';

export function heatmapDraw(output: GridOutput | undefined, title: string): Draw {
  return (ctx, width, height) => {
    const grid = output ? heatmapGrid(output) : { rows: [], cols: [], values: [] };
    if (!drawHeatmap(ctx, width, height, grid, { title })) return null;
    return `heatmap:${grid.rows.length}x${grid.cols.length}`;
  };
}

/** Groups down, ticks across. */
export function HeatmapView({ output, title, size }: ViewProps<GridOutput>) {
  return <CanvasView view="heatmap" size={size} draw={heatmapDraw(output, title)} />;
}
