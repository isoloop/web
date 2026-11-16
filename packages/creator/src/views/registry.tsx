// Renders any view by its type, after checking the output against VIEW_INPUTS.
import type { ReactElement } from 'react';
import type { Output } from '../outputs';
import { BarView } from './bar';
import { HeatmapView } from './heatmap';
import {
  statOptions,
  tableOptions,
  VIEW_LABELS,
  viewAccepts,
  type RawOptions,
  type ViewType,
} from './kinds';
import { LineView } from './line';
import type { ViewProps } from './props';
import { StatView } from './stat';
import { TableView } from './table';

/**
 * The view of `type` over `output`, with the spec's `view.options`. An output
 * the view doesn't draw is shown as a message, not thrown: `validateSpec`
 * should have rejected the spec.
 */
export function View({
  type,
  output,
  options,
  ...rest
}: ViewProps<Output> & { type: ViewType; options?: RawOptions | undefined }): ReactElement {
  if (output && !viewAccepts(type, output.kind)) {
    return (
      <div className="creator-view creator-view-mismatch" data-view={type} data-size={rest.size}>
        A {VIEW_LABELS[type].toLowerCase()} can't show {output.kind} output.
      </div>
    );
  }
  const series = output?.kind === 'series' ? output : undefined;
  const grid = output?.kind === 'grid' ? output : undefined;
  const byType: Record<ViewType, () => ReactElement> = {
    line: () => <LineView {...rest} output={series ?? grid} />,
    bar: () => <BarView {...rest} output={series ?? grid} />,
    heatmap: () => <HeatmapView {...rest} output={grid} />,
    table: () => (
      <TableView
        {...rest}
        {...tableOptions(options)}
        output={output?.kind === 'rows' ? output : grid}
      />
    ),
    stat: () => (
      <StatView
        {...rest}
        {...statOptions(options)}
        output={output?.kind === 'scalar' ? output : series}
      />
    ),
  };
  return byType[type]();
}
