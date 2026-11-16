// The balancer's load store on an interactive page (M3h decision 12): each
// `auto` widget's measured load, kept in `creator.placement.v1` (compacted,
// persistent) so a reload places it from history. `get` answers from what the
// topic replayed; `ready` settles once the replay is done (a probe record
// came back), so the page spawns nothing before it knows the loads.
import { PLACEMENT_TOPIC, TOMBSTONE } from '../widget/records';
import type { LoadsLike } from './auto';
import type { HostBus } from './runtime';

/** The replay probe's key: not an isolate id. */
export const LOADS_SYNC_KEY = '$sync';

export interface PlacementLoads extends LoadsLike {
  /** Settles once the topic's history has been read. */
  readonly ready: Promise<void>;
  /** Stops reading the topic. */
  close(): void;
}

const randomText = (): string => Math.random().toString(36).slice(2, 10);

function loadOf(v: unknown): number | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const pct: unknown = Reflect.get(v, 'loadPct');
  return typeof pct === 'number' && Number.isFinite(pct) ? pct : undefined;
}

export function placementLoads(bus: HostBus, random: () => string = randomText): PlacementLoads {
  const loads = new Map<string, number>();
  const probe = random();
  let done!: () => void;
  const ready = new Promise<void>((resolve) => {
    done = resolve;
  });
  const off = bus.subscribe(PLACEMENT_TOPIC, (r) => {
    if (r.key === undefined) return;
    if (r.key === LOADS_SYNC_KEY) {
      if (typeof r.value === 'object' && r.value !== null && Reflect.get(r.value, 'sync') === probe)
        done();
      return;
    }
    const pct = loadOf(r.value);
    if (pct === undefined) loads.delete(r.key);
    else loads.set(r.key, pct);
  });
  // A failed probe (no bus) still lets the page start: every widget is then unmeasured.
  bus.publish(PLACEMENT_TOPIC, LOADS_SYNC_KEY, { sync: probe }).catch(() => done());
  return {
    ready,
    get: (id) => loads.get(id),
    set: (id, loadPct) => {
      loads.set(id, loadPct);
      void bus.publish(PLACEMENT_TOPIC, id, { loadPct }).catch(() => {});
    },
    delete: (id) => {
      if (!loads.delete(id)) return;
      void bus.publish(PLACEMENT_TOPIC, id, TOMBSTONE).catch(() => {});
    },
    close: off,
  };
}
