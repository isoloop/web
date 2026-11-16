/** A 2D context, on the main thread or on an `OffscreenCanvas` in a worker. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The series colours, in order. */
export const COLORS = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1'] as const;

export function colorAt(i: number): string {
  return COLORS[i % COLORS.length] ?? COLORS[0];
}

/** Two significant decimals for small values, none past 1000. */
export function formatValue(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
