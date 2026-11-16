/**
 * Runs `fn` at most once per frame: `requestAnimationFrame` where the scope has
 * it (the main thread, workers in Chromium and Firefox), a 16 ms timer where it
 * doesn't (WebKit workers).
 */
export function perFrame(fn: () => void): { request: () => void; cancel: () => void } {
  const raf = typeof requestAnimationFrame === 'function';
  let cancelPending: (() => void) | undefined;
  const run = (): void => {
    cancelPending = undefined;
    fn();
  };
  return {
    request: () => {
      if (cancelPending) return;
      if (raf) {
        const id = requestAnimationFrame(run);
        cancelPending = () => {
          cancelAnimationFrame(id);
        };
      } else {
        const id = setTimeout(run, 16);
        cancelPending = () => {
          clearTimeout(id);
        };
      }
    },
    cancel: () => {
      cancelPending?.();
      cancelPending = undefined;
    },
  };
}
