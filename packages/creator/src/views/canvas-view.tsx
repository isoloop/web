import { useEffect, useRef, useState } from 'react';
import type { Ctx2D } from '../draw/ctx';
import { perFrame } from '../draw/frame';
import { useViewCanvas } from './env';
import { SIZE, type ViewSize } from './size';

/**
 * What a canvas view draws: given a context and its size, draws and returns a
 * short description of what it drew, or null while it waits for data. The
 * description is kept on the canvas as `data-drawn`, for tests.
 */
export type Draw = (ctx: Ctx2D, width: number, height: number) => string | null;

/** A <canvas> drawn at most once per frame with the latest `draw`. */
export function CanvasView({ draw, size, view }: { draw: Draw; size: ViewSize; view: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { ctx, width, height } = useViewCanvas(ref);
  const [drawn, setDrawn] = useState<string | null>(null);
  const latest = useRef({ ctx, width, height, draw });
  latest.current = { ctx, width, height, draw };
  const [frame] = useState(() =>
    perFrame(() => {
      const l = latest.current;
      if (l.ctx) setDrawn(l.draw(l.ctx, l.width, l.height));
    }),
  );
  useEffect(() => {
    if (ctx) frame.request();
  }, [ctx, width, height, draw, frame]);
  useEffect(
    () => () => {
      frame.cancel();
    },
    [frame],
  );
  return (
    <canvas
      ref={ref}
      className={`creator-view creator-view-${view}`}
      data-view={view}
      data-size={size}
      data-drawn={drawn ?? undefined}
      style={{ display: 'block', width: '100%', height: SIZE[size].height }}
    />
  );
}
