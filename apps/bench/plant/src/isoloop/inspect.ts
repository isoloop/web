// `?inspect=1` (M4b task 6): keeps a reader on the kernel's inspection feed
// (ADR 0020) for the whole run, as an open devtools panel would, so the
// comparison can measure the feed's cost: the Isoloop build with it against
// the same placement without it. The reader only counts what arrives. Where
// the page is cross-origin isolated (`PLANT_COI=1` on the preview server),
// the feed also measures memory per isolate.
//
// `window.inspectStats()` answers in every Isoloop run, open or not: the ring
// buffer's size is a cost the kernel pays from start whether anyone reads it.
import type { InspectMessage } from '@isoloop/protocol';
import { kernel } from './kernel';

export type InspectStats = {
  /** Whether a reader listened for the whole run (`?inspect=1`). */
  open: boolean;
  /** Feed messages the reader got, by type; empty when closed. */
  messages: Record<string, number>;
  /** Memory figures the reader got (isolates × measurements). */
  memoryFigures: number;
  /** Events in the ring buffer now (at most 200). */
  ringEvents: number;
  /** The ring buffer as JSON, in bytes: its size as a reader receives it. */
  ringJsonBytes: number;
};

declare global {
  interface Window {
    /** The inspection feed's counts, for the comparison (Isoloop build only). */
    inspectStats?: () => InspectStats;
  }
}

const open = new URLSearchParams(location.search).get('inspect') === '1';
const inspector = kernel.inspect();
const messages: Record<string, number> = {};
let memoryFigures = 0;
if (open) {
  inspector.on((m: InspectMessage) => {
    messages[m.t] = (messages[m.t] ?? 0) + 1;
    if (m.t === 'memory') memoryFigures += m.p.isolates.length;
  });
}

window.inspectStats = () => {
  const { events } = inspector.snapshot();
  return {
    open,
    messages: { ...messages },
    memoryFigures,
    ringEvents: events.length,
    ringJsonBytes: new TextEncoder().encode(JSON.stringify(events)).length,
  };
};
