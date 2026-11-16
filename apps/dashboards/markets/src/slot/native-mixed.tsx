// `#slot` in the native + workers build with parts (M3g, `native-mixed`): the
// React widgets as in native + workers; the filters and the alerts panel are
// Preact parts another team ships apart, loaded at run time and mounted into
// the slot. A part that fails to load shows a fallback in its slot only.
import { useEffect, useRef, useState } from 'react';
import { store } from '../native/store';
import { loadPart } from '../parts/load';
import type { Placement } from '../sizes/sizes';
import { Head } from './Head';
import { Slot as NativeSlot } from './native';

/** The widgets that are parts: the same split as `/mixed`. */
export const PARTS: ReadonlySet<string> = new Set(['filters', 'alerts-panel']);

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function PartSlot({ placement }: { placement: Placement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { id, widget, config } = placement;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let stopped = false;
    let unmount: (() => void) | undefined;
    loadPart(widget)
      .then((part) => {
        if (stopped) return;
        unmount = part.mount(el, store, { slot: id, ...(config === undefined ? {} : { config }) });
      })
      .catch((e: unknown) => {
        if (!stopped) setFailed(message(e));
      });
    return () => {
      stopped = true;
      unmount?.();
    };
  }, [id, widget, config]);
  return (
    <div className="slot widget" data-slot={id} data-widget={widget} data-part="">
      <Head slot={id} where="main thread · Preact" />
      {failed === null ? (
        // The part's own root: React renders nothing inside it.
        <div key="part" ref={ref} className="widget-body" />
      ) : (
        <div key="failed" className="widget-body">
          <div className="widget-error">
            {id} failed to load: {failed}
          </div>
        </div>
      )}
    </div>
  );
}

export function Slot({ placement }: { placement: Placement }) {
  return PARTS.has(placement.widget) ? (
    <PartSlot placement={placement} />
  ) : (
    <NativeSlot placement={placement} where="main thread · React" />
  );
}
