// A grid of values as coloured cells, with row and column labels. Generalised
// from the plant dashboard's charts/heatmap.ts (a square matrix in [-1, 1]):
// any rows and columns, coloured on their own range, with gaps.
import type { Ctx2D } from './ctx';

/** Blue for -1, dark for 0, orange for 1. */
export function divergingColor(v: number): string {
  const x = Math.max(-1, Math.min(1, v));
  const a = Math.abs(x);
  const [r, g, b] = x >= 0 ? [242, 142, 43] : [78, 121, 167];
  const mix = (c: number): number => Math.round(30 + (c - 30) * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Dark for 0, orange for 1. */
export function sequentialColor(v: number): string {
  return divergingColor(Math.max(0, Math.min(1, v)));
}

/** A cell with no value. */
export const GAP_COLOR = '#222';

export interface Grid {
  rows: readonly string[];
  cols: readonly string[];
  /** `values[r][c]`; null is a gap. */
  values: readonly (readonly (number | null)[])[];
}

/** A cell with no value to colour. */
function gap(v: number | null): v is null {
  return v === null || !Number.isFinite(v);
}

/**
 * The colour scale a grid gets: diverging around zero when it holds values on
 * both sides of it, sequential from its minimum to its maximum otherwise.
 */
export function gridScale(
  values: readonly (readonly (number | null)[])[],
): (v: number | null) => string {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const row of values) {
    for (const v of row) {
      if (v === null || !Number.isFinite(v)) continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  if (!Number.isFinite(lo)) return () => GAP_COLOR;
  if (lo < 0 && hi > 0) {
    const m = Math.max(-lo, hi);
    return (v) => (gap(v) ? GAP_COLOR : divergingColor(v / m));
  }
  const span = hi - lo || 1;
  return (v) => (gap(v) ? GAP_COLOR : sequentialColor((v - lo) / span));
}

/** Column labels drawn at most this many, evenly spaced, so they don't overlap. */
const COL_LABELS = 6;

/** Draws the grid; false when there was nothing to draw yet. */
export function drawHeatmap(
  ctx: Ctx2D,
  width: number,
  height: number,
  grid: Grid,
  o: { title: string },
): boolean {
  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(o.title, 8, 4);
  const nr = grid.rows.length;
  const nc = grid.cols.length;
  if (nr === 0 || nc === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('waiting for data…', 8, height / 2);
    return false;
  }
  const top = 22 + 14;
  const left = 56;
  const cw = Math.max(1, (width - left - 4) / nc);
  const ch = Math.max(1, (height - top - 4) / nr);
  const color = gridScale(grid.values);
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillStyle = '#9aa0a6';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.ceil(nc / COL_LABELS));
  grid.cols.forEach((label, c) => {
    if (c % step === 0) ctx.fillText(label, left + c * cw + cw / 2, top - 7);
  });
  ctx.textAlign = 'right';
  grid.rows.forEach((label, r) => {
    ctx.fillText(label, left - 3, top + r * ch + ch / 2);
  });
  ctx.textAlign = 'left';
  for (let r = 0; r < nr; r++) {
    const row = grid.values[r] ?? [];
    for (let c = 0; c < nc; c++) {
      ctx.fillStyle = color(row[c] ?? null);
      ctx.fillRect(left + c * cw, top + r * ch, cw - 1, ch - 1);
    }
  }
  return true;
}
