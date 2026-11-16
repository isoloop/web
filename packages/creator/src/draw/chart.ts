// Lines or bars over time on a 2D context: the same code runs on an
// OffscreenCanvas in a widget isolate and on a <canvas> in the native build.
// Copied from the plant dashboard's charts/canvas-chart.ts, so the
// interactive pages don't reach into an app (M3e plan, decision 7).
import { colorAt, formatValue, type Ctx2D } from './ctx';

export interface Series {
  label: string;
  /** Defaults to the palette colour at the series' index. */
  color?: string;
  /** [time ms, value], oldest first; a null value is a gap in the line. */
  points: readonly (readonly [number, number | null])[];
}

export interface ChartOptions {
  title: string;
  format?: (v: number) => string;
  /** Draw bars instead of lines (the first series only). */
  bars?: boolean;
  /** A horizontal line, e.g. zero for a spread. */
  baseline?: number;
}

const PAD = { top: 22, right: 64, bottom: 18, left: 8 };
/** Series past this many get no label in the header, which has no room for them. */
const LABELLED = 4;

/** Draws the chart; false when there was nothing to draw yet. */
export function drawChart(
  ctx: Ctx2D,
  width: number,
  height: number,
  series: readonly Series[],
  o: ChartOptions,
): boolean {
  const fmt = o.format ?? formatValue;
  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.textBaseline = 'top';
  ctx.fillText(o.title, PAD.left, 4);

  const all: [number, number][] = [];
  for (const s of series) for (const [t, v] of s.points) if (v !== null) all.push([t, v]);
  if (all.length === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('waiting for data…', PAD.left, height / 2);
    return false;
  }
  let t0 = Number.POSITIVE_INFINITY;
  let t1 = Number.NEGATIVE_INFINITY;
  let lo = o.baseline ?? Number.POSITIVE_INFINITY;
  let hi = o.baseline ?? Number.NEGATIVE_INFINITY;
  for (const [t, v] of all) {
    t0 = Math.min(t0, t);
    t1 = Math.max(t1, t);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (o.bars) lo = Math.min(lo, 0);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const x = (t: number): number => PAD.left + (t1 === t0 ? w : ((t - t0) / (t1 - t0)) * w);
  const y = (v: number): number => PAD.top + h - ((v - lo) / (hi - lo)) * h;

  // Axis labels: high, low, and the baseline.
  ctx.fillStyle = '#888';
  ctx.textBaseline = 'middle';
  ctx.fillText(fmt(hi), width - PAD.right + 4, y(hi));
  ctx.fillText(fmt(lo), width - PAD.right + 4, y(lo));
  if (o.baseline !== undefined) {
    ctx.strokeStyle = '#555';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y(o.baseline));
    ctx.lineTo(PAD.left + w, y(o.baseline));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (o.bars) {
    const s = series[0];
    if (!s) return false;
    const bw = Math.max(1, w / Math.max(1, s.points.length) - 1);
    ctx.fillStyle = s.color ?? colorAt(0);
    for (const [t, v] of s.points) {
      if (v !== null) ctx.fillRect(x(t) - bw / 2, Math.min(y(v), y(0)), bw, Math.abs(y(0) - y(v)));
    }
    return true;
  }
  ctx.lineWidth = 1.5;
  series.forEach((s, i) => {
    const color = s.color ?? colorAt(i);
    ctx.strokeStyle = color;
    ctx.beginPath();
    let pen = false;
    for (const [t, v] of s.points) {
      if (v === null) pen = false;
      else if (pen) ctx.lineTo(x(t), y(v));
      else {
        ctx.moveTo(x(t), y(v));
        pen = true;
      }
    }
    ctx.stroke();
    if (i >= LABELLED) return;
    const last = s.points.findLast(([, v]) => v !== null)?.[1] ?? null;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${s.label}${last === null ? '' : ` ${fmt(last)}`}`,
      PAD.left + (o.title ? 120 : 0) + i * 130,
      4,
    );
  });
  return true;
}
