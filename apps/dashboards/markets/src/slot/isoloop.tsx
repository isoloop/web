import { useEffect, useRef, useState } from 'react';
import { kernel } from '../isoloop/kernel';
import { poolOf, whereOf } from '../placement';
import { FRAMEWORK, ISOLATES, srcOf } from '#widgets';
import type { Placement } from '../sizes/sizes';
import { placementFrom } from '../url';
import { Head } from './Head';

/** Own workers numbered in the order the page starts them, for the headers. */
let started = 0;
const placement = placementFrom(new URLSearchParams(location.search));
const LABEL = { react: 'React', preact: 'Preact' } as const;

/** A slot in the Isoloop build: a surface the widget's isolate renders into. */
export function Slot({ placement: slot }: { placement: Placement }) {
  const ref = useRef<HTMLDivElement>(null);
  const { id, widget, config } = slot;
  const framework = FRAMEWORK?.[widget];
  // The placement's pool for this widget, if it pools it (M3f decision 3, M3g decision 7).
  const pool = poolOf(placement, 'widget', framework);
  const [worker] = useState(() => (pool === undefined ? ++started : 0));
  const where = `${whereOf(pool, worker)}${framework ? ` · ${LABEL[framework]}` : ''}`;
  useEffect(() => {
    const surface = ref.current;
    if (!surface) return undefined;
    const { grants } = ISOLATES[widget];
    let stopped = false;
    let stop: (() => Promise<void>) | undefined;
    void srcOf(widget).then((src) => {
      if (stopped) return;
      const handle = kernel.spawn({
        id,
        src,
        surface,
        grants,
        ...(config === undefined ? {} : { config }),
        ...(pool === undefined ? {} : { pool }),
      });
      stop = () => handle.stop();
    });
    return () => {
      stopped = true;
      void stop?.();
    };
  }, [id, widget, config, pool]);
  return (
    <div className="slot" data-slot={id} data-widget={widget} data-pool={pool}>
      <Head slot={id} where={where} />
      <div ref={ref} className="widget-body" />
    </div>
  );
}
