import { formatValue } from '../draw/ctx';
import type { Cell, Column, GridOutput, RowsOutput } from '../outputs';
import type { ViewProps } from './props';
import { cellText, header, latestPerGroup } from './shape';
import { SIZE } from './size';

interface Table {
  columns: readonly Pick<Column, 'label' | 'unit' | 'type'>[];
  rows: readonly { key: string; cells: readonly Cell[] }[];
}

/** Rows as they came (newest first); a grid as one row per group with its newest value. */
export function tableOf(output: RowsOutput | GridOutput, limit: number): Table {
  if (output.kind === 'rows') {
    return {
      columns: output.columns,
      rows: output.rows
        .slice(0, limit)
        .map((r, i) => ({ key: `${r.key ?? ''}:${r.t}:${i}`, cells: r.cells })),
    };
  }
  return {
    columns: [
      { label: output.groupLabel, type: 'string' },
      {
        label: output.label,
        type: 'number',
        ...(output.unit === undefined ? {} : { unit: output.unit }),
      },
    ],
    rows: latestPerGroup(output)
      .slice(0, limit)
      .map((b) => ({ key: b.label, cells: [b.label, b.value] })),
  };
}

export function TableView({
  output,
  title,
  size,
  limit = 50,
}: ViewProps<RowsOutput | GridOutput> & { limit?: number | undefined }) {
  const table = output ? tableOf(output, limit) : undefined;
  return (
    <div
      className="creator-view creator-view-table"
      data-view="table"
      data-size={size}
      data-rows={table?.rows.length ?? 0}
      style={{ height: SIZE[size].height, overflow: 'auto' }}
    >
      <div className="creator-view-title">{title}</div>
      {!table || table.rows.length === 0 ? (
        <p className="creator-view-waiting">waiting for data…</p>
      ) : (
        <table>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={i} scope="col">
                  {header(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.key}>
                {table.columns.map((c, i) => (
                  <td key={i}>{cellText(r.cells[i], c.type, formatValue)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
