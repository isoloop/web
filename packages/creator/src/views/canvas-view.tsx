import { useEffect, useRef, useState } from 'react';
import type { Ctx2D } from '../draw/ctx';
import { perFrame } from '../draw/frame';
import { useViewCanvas } from './env';
import { SIZE, type ViewSize } from './size';

/**
 * What a canvas view draws: given a context and its size, draws and returns a
 * short description of what it drew, or null while it waits for data. The
 * description is kept on the canvas as `data-drawn`, for tests, and the time
 * of each draw (epoch ms, the drawing thread's clock) as `data-drawn-at`, for
 * the comparison's draw gaps (M3e decision 22). The time is set on the element
 * directly, so a draw doesn't re-render the view.
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
      if (!l.ctx) return;
      const what = l.draw(l.ctx, l.width, l.height);
      setDrawn(what);
      if (what !== null) ref.current?.setAttribute('data-drawn-at', String(Date.now()));
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
