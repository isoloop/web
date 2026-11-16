// The native page's sources for the board: each catalog topic read from
// plant's store, the oldest kept records first, then live ones. A merged
// topic is its eight machine streams, keyed by machine (merged.ts).
import type { NativeSources } from 'creator/board';
import { MACHINES } from '../core/machines';
import type { Store } from '../core/store';
import { of, type PlantStream, type Rec } from '../core/streams';
import { MERGED } from './catalog';
import { mergedOf } from './merged';

const PLANT: Record<string, PlantStream> = {
  'plant.fleet': 'fleet',
  'plant.alarms': 'alarms',
  'plant.events': 'events',
};

export function nativeSources(store: Store): NativeSources {
  return (topic, fn) => {
    const plant = PLANT[topic];
    if (plant) return store.subscribe(plant, (r: Rec<unknown>) => fn(r), 'earliest');
    const k =
      topic === MERGED.scalars
        ? 'scalars'
        : topic === MERGED.health
          ? 'health'
          : topic === MERGED.spectrum
            ? 'spectrum'
            : undefined;
    if (k === undefined) return () => {};
    const offs = MACHINES.map((m) => {
      const stream = of(m, k);
      return store.subscribe(
        stream,
        (r: Rec<unknown>) => {
          const merged = mergedOf(stream, r.value);
          if (merged) fn({ key: merged.key, value: merged.value });
        },
        'earliest',
      );
    });
    return () => {
      for (const off of offs) off();
    };
  };
}
