// Bars by category (a label and a value each), with zero as the baseline.
import { colorAt, formatValue, type Ctx2D } from './ctx';

export interface Bar {
  label: string;
  value: number;
}

const PAD = { top: 22, right: 8, bottom: 18, left: 8 };

/** Draws the bars; false when there was nothing to draw yet. */
export function drawBars(
  ctx: Ctx2D,
  width: number,
  height: number,
  bars: readonly Bar[],
  o: { title: string; format?: (v: number) => string },
): boolean {
  const fmt = o.format ?? formatValue;
  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(o.title, PAD.left, 4);
  if (bars.length === 0) {
    ctx.fillStyle = '#888';
    ctx.fillText('waiting for data…', PAD.left, height / 2);
    return false;
  }
  let lo = 0;
  let hi = 0;
  for (const b of bars) {
    lo = Math.min(lo, b.value);
    hi = Math.max(hi, b.value);
  }
  if (hi === lo) hi = lo + 1;
  const w = width - PAD.left - PAD.right;
  const h = height - PAD.top - PAD.bottom;
  const y = (v: number): number => PAD.top + h - ((v - lo) / (hi - lo)) * h;
  const slot = w / bars.length;
  const bw = Math.max(1, slot - 4);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  bars.forEach((b, i) => {
    const cx = PAD.left + i * slot + slot / 2;
    const top = Math.min(y(b.value), y(0));
    ctx.fillStyle = colorAt(0);
    ctx.fillRect(cx - bw / 2, top, bw, Math.abs(y(0) - y(b.value)));
    ctx.fillStyle = '#9aa0a6';
    ctx.textBaseline = 'top';
    ctx.fillText(b.label, cx, height - PAD.bottom + 4);
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmt(b.value), cx, top - 2);
  });
  ctx.textAlign = 'left';
  return true;
}
