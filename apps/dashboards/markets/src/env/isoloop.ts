// The widgets' environment inside an isolate: streams are bus topics, and a
// chart's canvas is handed over by the host as an OffscreenCanvas
// (`requestCanvas`), drawn on from the worker.
import { useHost, useIsolate, useWatch } from '@isoloop/react';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Source, StreamName, Streams } from '../core/streams';
import { busSource, TOPICS } from '../isoloop/source';
import type { Build, CanvasState } from './canvas';
import { createHooks } from './hooks';

function useSource(): Source {
  const { bus } = useIsolate();
  return useMemo(() => busSource(bus), [bus]);
}

export const { useLatest, useRecent, usePublish } = createHooks(useSource);

/**
 * A stream's current value per key, read with a watcher (`useWatch`) instead
 * of a subscription: the bus sends only the newest value per key, at most one
 * view per committed render, so records the widget would never draw don't
 * cross to its isolate. Records with no key are under `''`, as in the native
 * build's `useKeyed`.
 */
export function useKeyed<S extends StreamName>(stream: S): ReadonlyMap<string, Streams[S]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the bus validated each value against the stream's schema
  const view = useWatch(TOPICS[stream]) as ReadonlyMap<string | null, Streams[S]>;
  return useMemo(() => {
    const out = new Map<string, Streams[S]>();
    for (const [k, v] of view) out.set(k ?? '', v);
    return out;
  }, [view]);
}

/** The build these hooks run in, for the metrics panel. */
export const BUILD: Build = 'isoloop';

/** The canvas `ref` points at, as an OffscreenCanvas from the host, sized to its CSS box. */
export function useCanvas(ref: RefObject<HTMLCanvasElement | null>): CanvasState {
  const host = useHost();
  const [state, setState] = useState<CanvasState>({ ctx: null, width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let off: OffscreenCanvas | undefined;
    // Fetched once: Firefox 159 throws on a second getContext() after the
    // OffscreenCanvas was resized ("Cannot update created context to
    // different thread"). Resizing resets the context's state, so the
    // transform is set again on each resize.
    let ctx: OffscreenCanvasRenderingContext2D | null = null;
    let size = { width: 0, height: 0 };
    const apply = (): void => {
      if (!off || size.width === 0) return;
      const dpr = 2;
      off.width = Math.round(size.width * dpr);
      off.height = Math.round(size.height * dpr);
      ctx ??= off.getContext('2d');
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
}

/**
 * The element's size, from the host's `measure` once it's rendered, and again
 * when the page resizes (a surface's box changes with the page's layout).
 */
export function useBox(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const host = useHost();
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let live = true;
    const read = (): void => {
      void host.measure(el).then((r) => {
        if (live) setBox({ width: r.width, height: r.height });
      });
    };
    read();
    const timer = setInterval(read, 1_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [host, ref]);
  return box;
}
