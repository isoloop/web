// The creator's five views (M3e plan, decision 17), React, for widget
// isolates and the native build alike. Which outputs each draws is task 2's
// VIEW_INPUTS (creator/outputs); which options each reads is VIEW_OPTIONS.
export {
  ViewEnv,
  useMainThreadCanvas,
  useViewCanvas,
  type CanvasState,
  type UseCanvas,
} from './env';
export { SIZE, VIEW_SIZES, type ViewSize } from './size';
export type { ViewProps } from './props';
export { CanvasView, type Draw } from './canvas-view';
export { LineView, lineDraw } from './line';
export { BarView, barDraw } from './bar';
export { HeatmapView, heatmapDraw } from './heatmap';
export { TableView, tableOf } from './table';
export { StatView, gaugeFraction, statOf } from './stat';
export {
  VIEW_LABELS,
  VIEW_OPTIONS,
  VIEW_TYPES,
  checkViewOptions,
  statOptions,
  tableOptions,
  viewAccepts,
  type RawOptions,
  type ViewType,
} from './kinds';
export {
  cellText,
  header,
  heatmapGrid,
  latestPerGroup,
  lastPoint,
  linesOf,
  timeLabel,
} from './shape';
export { View } from './registry';
