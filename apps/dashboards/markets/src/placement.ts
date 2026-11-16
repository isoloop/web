// Where the Isoloop builds run each isolate (M3f decision 3): the same code and
// data in every placement; only the host's manifests change. No Isoloop
// imports here, so the page shell can show the placement too.
//
// | placement | sources, aggregator, alerts, engines | widgets           |
// | --------- | ------------------------------------ | ----------------- |
// | `own`     | own workers                          | own workers       |
// | `matched` | own workers                          | pool `widgets`    |
// | `one`     | pool `all`                           | pool `all`        |
// | `teams`   | own workers                          | pools `react` and `preact` |
//
// `matched` runs the native + workers build's data workers (one per headless
// job) plus one thread for every widget, the fewest Isoloop can add, since it
// can't render on the main thread. `one` runs everything on one worker, the
// nearest to native's single thread. Every placement also runs the bus's own
// worker, which the worker counts here leave out. `teams` is `/mixed`'s only
// (M3g decision 7): a pool per team, the React widgets' and the Preact
// widgets', so one team's blocked widget stalls only its own team's.
import type { PlacementName } from './url';

/** What is being placed: a widget, or a headless job (a source, a service or an engine). */
export type Kind = 'widget' | 'data';

/** The team a widget belongs to in `/mixed`: the framework it renders with. */
export type Framework = 'react' | 'preact';

export function poolOf(p: PlacementName, kind: Kind, framework?: Framework): string | undefined {
  if (p === 'one') return 'all';
  if (p === 'matched' && kind === 'widget') return 'widgets';
  if (p === 'teams' && kind === 'widget') return framework ?? 'react';
  return undefined;
}

/** A widget header's "where": `pool widgets`, `pool all` or `worker 12`. */
export function whereOf(pool: string | undefined, worker: number): string {
  return pool === undefined ? `worker ${worker}` : `pool ${pool}`;
}

/** An isolate to count: its kind, and a widget's framework in `/mixed`. */
export type Member = Kind | { kind: Kind; framework: Framework };

/** Workers a placement runs for these isolates; the bus's worker is not counted. */
export function workersOf(p: PlacementName, members: readonly Member[]): number {
  const pools = new Set<string>();
  let own = 0;
  for (const m of members) {
    const pool = typeof m === 'string' ? poolOf(p, m) : poolOf(p, m.kind, m.framework);
    if (pool === undefined) own++;
    else pools.add(pool);
  }
  return own + pools.size;
}

/** What a widget's block stalls in each placement, for the page's note. */
/**
 * The box under the header, its Placement row: where the isolates run, and
 * what a blocked widget takes down. One sentence, two lines at most.
 */
export const DESCRIPTION: Record<PlacementName, string> = {
  own: 'Every isolate runs on its own worker. A blocked widget stalls only itself; the other widgets and the data keep going.',
  matched:
    'The data runs on its own workers, as in native + workers, and every widget shares one pool. A blocked widget stalls every widget, while the data keeps flowing.',
  one: "Every isolate shares one pool, the nearest to native's single thread, but off the main thread. A blocked widget stalls every isolate, data included; the page itself keeps responding.",
  teams:
    "Each team's widgets share a pool of their own, and the data runs on its own workers. A blocked widget stalls its own team's widgets only.",
};
