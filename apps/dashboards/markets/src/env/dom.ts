// The DOM hooks of the builds whose widgets run on the main thread: the native
// builds, and the Preact parts the native + workers build loads apart. No store
// here, so a part's bundle can carry them without the host's code.
import { useEffect, useState, type RefObject } from 'react';
import type { CanvasState } from './canvas';

/** The canvas `ref` points at, sized to its CSS box. */
export function useCanvas(ref: RefObject<HTMLCanvasElement | null>): CanvasState {
  const [state, setState] = useState<CanvasState>({ ctx: null, width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const watch = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = 2;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      const ctx = el.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      setState({ ctx, width, height });
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [ref]);
  return state;
}

/** The element's size, from a ResizeObserver. */
export function useBox(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const watch = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [ref]);
  return box;
}
