// Where a canvas view's context comes from. A widget isolate gets an
// OffscreenCanvas from the host; the native build draws on the <canvas>
// itself. The views take neither: the page wraps them in <ViewEnv> with the
// `useCanvas` its environment provides.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Ctx2D } from '../draw/ctx';

/** What `useCanvas` gives a view: a context to draw on and its CSS size. */
export interface CanvasState {
  ctx: Ctx2D | null;
  width: number;
  height: number;
}

/**
 * The draw target: a hook that turns the view's <canvas> into a context sized
 * to the element, updated when it resizes. Must be the same function for the
 * life of the provider (it's called as a hook).
 */
export type UseCanvas = (ref: RefObject<HTMLCanvasElement | null>) => CanvasState;

const Env = createContext<UseCanvas | null>(null);

export function ViewEnv({ useCanvas, children }: { useCanvas: UseCanvas; children: ReactNode }) {
  return <Env.Provider value={useCanvas}>{children}</Env.Provider>;
}

/** The provider's `useCanvas`; throws outside a <ViewEnv>. */
export function useViewCanvas(ref: RefObject<HTMLCanvasElement | null>): CanvasState {
  const use = useContext(Env);
  if (!use) throw new Error('A canvas view needs a <ViewEnv useCanvas={…}> around it');
  return use(ref);
}

/**
 * The main thread's draw target: the <canvas> element's own context, sized by
 * a ResizeObserver at 2× for sharp lines. For the native build and for tests.
 */
export const useMainThreadCanvas: UseCanvas = (ref) => {
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
};
