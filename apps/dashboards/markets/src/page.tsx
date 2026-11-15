import { BUILD } from '#env';
import { Slot } from '#slot';
import { BUILDS, COUNTERPART, CURRENT, type BuildName } from './builds';
import { BLAST } from './placement';
import { About } from './about/About';
import { CategoryPanel } from './metrics/Categories';
import { MetricsPanel } from './metrics/Panel';
import { Responsiveness } from './responsive/Responsiveness';
import { SIZES, SPECS, specFrom, sizeHref } from './sizes/sizes';
import { PLACEMENTS, placementFrom, placementHref, switchHref, type PlacementName } from './url';

const placement = placementFrom(new URLSearchParams(location.search));

/** What the build runs where, for the header. */
const LABEL =
  CURRENT === 'native-workers'
    ? 'Native + workers: data in workers, widgets on the main thread'
    : BUILD === 'native'
      ? 'Native: one main thread'
      : placement === 'own'
        ? 'Isoloop: an event loop per widget'
        : placement === 'matched'
          ? 'Isoloop: data on its own workers, widgets in one pool'
          : 'Isoloop: every isolate in one pool';

/**
 * The toggle's build, and the placement it lands in: Isoloop's `matched`
 * pairs with native + workers, and native + workers with `matched`.
 */
const TOGGLE: { build: BuildName; placement?: PlacementName } =
  CURRENT === 'native-workers'
    ? { build: 'isoloop', placement: 'matched' }
    : CURRENT === 'isoloop' && placement === 'matched'
      ? { build: 'native-workers' }
      : { build: COUNTERPART[CURRENT] };

/** The page shell, the same in every build; only what a slot holds differs. */
export function Page() {
  const other = TOGGLE.build;
  const spec = specFrom(new URLSearchParams(location.search));
  const filters = spec.widgets.find((p) => p.widget === 'filters');
  const grid = spec.widgets.filter((p) => p.widget !== 'filters');
  return (
    <div className="page">
      <header>
        <h1>Markets</h1>
        <span
          className="build"
          data-build={BUILD}
          {...(BUILD === 'native' ? {} : { 'data-placement': placement })}
        >
          {LABEL}
        </span>
        <a
          className="toggle"
          href={`../${other}/${location.search}`}
          onClick={(e) => {
            // Built at click time: the replay's position moves on.
            e.currentTarget.href = switchHref(other, TOGGLE.placement);
          }}
        >
          Switch to {other}
        </a>
        <nav className="builds" aria-label="Builds">
          {BUILDS.map((b) =>
            b.name === CURRENT ? (
              <span key={b.name} aria-current="page">
                {b.label}
              </span>
            ) : (
              <a
                key={b.name}
                href={`../${b.name}/${location.search}`}
                onClick={(e) => {
                  e.currentTarget.href = switchHref(b.name);
                }}
              >
                {b.label}
              </a>
            ),
          )}
        </nav>
        <nav className="sizes" aria-label="Dashboard size">
          {SIZES.map((size) =>
            size === spec.size ? (
              <span key={size} aria-current="page">
                {SPECS[size].label}
              </span>
            ) : (
              <a key={size} href={sizeHref(size, location.search)}>
                {SPECS[size].label}
              </a>
            ),
          )}
        </nav>
        {BUILD === 'native' ? null : (
          <>
            <nav className="placements" aria-label="Placement">
              {PLACEMENTS.map((p) =>
                p === placement ? (
                  <span key={p} aria-current="page">
                    {p}
                  </span>
                ) : (
                  <a key={p} href={placementHref(p, location.search)}>
                    {p}
                  </a>
                ),
              )}
            </nav>
            <span className="placement-note" data-placement-note={placement}>
              Placement <code>{placement}</code>: {BLAST[placement]}.
            </span>
          </>
        )}
      </header>
      <Responsiveness />
      <MetricsPanel />
      <CategoryPanel widgets={spec.widgets.map((p) => p.widget)} />
      <About />
      {filters && <Slot placement={filters} />}
      <main className="grid" data-size={spec.size}>
        {grid.map((p) => (
          <Slot key={p.id} placement={p} />
        ))}
      </main>
    </div>
  );
}
