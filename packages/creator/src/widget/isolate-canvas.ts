// The draw target inside a widget isolate: the host hands the <canvas> over
// as an OffscreenCanvas (`requestCanvas`), and its size arrives as `resize`
// events. As plant's src/env/isoloop.ts.
import { useHost } from '@isoloop/react';
import { useEffect, useState } from 'react';
import type { CanvasState, UseCanvas } from '../views/env';

export const useIsolateCanvas: UseCanvas = (ref) => {
  const host = useHost();
  const [state, setState] = useState<CanvasState>({ ctx: null, width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let off: OffscreenCanvas | undefined;
    let size = { width: 0, height: 0 };
    const apply = (): void => {
      if (!off || size.width === 0) return;
      const dpr = 2;
      off.width = Math.round(size.width * dpr);
      off.height = Math.round(size.height * dpr);
      const ctx = off.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      setState({ ctx, ...size });
    };
    const onResize = (e: Event): void => {
      const w: unknown = Reflect.get(e, 'width');
      const h: unknown = Reflect.get(e, 'height');
      if (typeof w === 'number' && typeof h === 'number') {
        size = { width: w, height: h };
        apply();
      }
    };
    el.addEventListener('resize', onResize);
    void host.requestCanvas(el).then((c) => {
      off = c;
      apply();
    });
    return () => {
      el.removeEventListener('resize', onResize);
    };
  }, [host, ref]);
  return state;
};
