import { durability, onDurability } from '#host';
import { useEffect, useState } from 'react';
import { BUILDS, CURRENT, SIDE, type BuildName, type Side } from './builds';
import { SETTINGS, type PlacementName } from './url';

/**
 * The box under the header: what the page's three choices mean. Mode is the
 * kernel switch, Library the build, Placement the Isoloop placement and what
 * a blocked widget takes down (the blasts e2e/placements.spec.ts checks).
 * One sentence each, two lines at most.
 */
const MODE: Record<Side, string> = {
  native: 'No Isoloop: the app as a team would write it today, on the same widgets and data.',
  isoloop:
    'Each widget, feed and engine is an isolate: its own event loop, restarted when it fails, talking over a bus that keeps its records.',
};
const LIBRARY: Record<BuildName, string> = {
  isoloop: 'Every widget renders with React, a copy per isolate or per pool.',
  native:
    'Every widget renders with React on the main thread, beside the feeds and engines. A blocked widget stalls the whole page.',
  'native-workers':
    'React widgets on the main thread; a hand-written data worker per machine and one for the fleet. A blocked widget stalls the whole page; the data keeps flowing.',
};
const PLACED: Record<PlacementName, string> = {
  matched:
    'One data pool per machine, the fleet engine on its own worker, and all 72 widgets in one pool. A blocked widget stalls all 72 until their pool restarts; the data keeps flowing.',
  split:
    "Per machine, a pool for its 8 widgets and one for its data; the fleet's widgets in a pool of their own. A blocked widget stalls its machine's 8 widgets until their pool restarts.",
  machine:
    'One pool per machine for its widgets and its data. A blocked widget stalls its machine, data included, until the pool restarts; the other machines keep going.',
  'shared-engines':
    "Each machine's widgets in a pool of their own, every feed in one pool and every engine in another. A blocked widget stalls its machine's widgets until their pool restarts.",
  one: 'Every feed, engine and widget in one pool, off the main thread. A blocked widget stalls all of them until the pool restarts; the page itself keeps responding.',
  own: 'Every isolate on its own worker. A blocked widget stalls only itself, until it restarts.',
};

/** What runs where in this build and placement, under the header. */
export function Description() {
  const isoloop = CURRENT === 'isoloop';
  return (
    <section
      className="description"
      aria-label="What runs where"
      {...(isoloop ? { 'data-placement-note': SETTINGS.placement } : {})}
    >
      <h2 className="build" data-build={CURRENT}>
        {BUILDS.find((b) => b.name === CURRENT)?.label}
        {isoloop ? <> · placement {SETTINGS.placement}</> : null}
      </h2>
      <dl>
        <div>
          <dt>Mode</dt>
          <dd>{MODE[SIDE]}</dd>
        </div>
        <div>
          <dt>Library</dt>
          <dd>{LIBRARY[CURRENT]}</dd>
        </div>
        {isoloop ? (
          <div>
            <dt>Placement</dt>
            <dd>{PLACED[SETTINGS.placement]}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * What the page warns about: the `own` placement's worker count, over the
 * soft budget (decision 6), and alarms and events kept in memory where
 * persistent topics can't open (decision 5).
 */
export function Notices() {
  const [degraded, setDegraded] = useState(durability?.degraded);
  useEffect(
    () =>
      onDurability(() => {
        setDegraded(durability?.degraded);
      }),
    [],
  );
  return (
    <>
      {CURRENT === 'isoloop' && SETTINGS.placement === 'own' && (
        <p className="notice" role="note" data-notice="own">
          The <b>own</b> placement runs every isolate on its own worker: about 105 workers, over
          Isoloop's soft budget of 32. It's here to measure what that costs.
        </p>
      )}
      {degraded !== undefined && (
        <p className="notice" role="note" data-notice="memory">
          Alarms and events are kept in memory only on this page ({degraded}): they won't survive a
          reload.
        </p>
      )}
    </>
  );
}
