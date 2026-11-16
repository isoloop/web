import { BUILD } from '#env';
import { Slot } from '#slot';
import { BUILDS, COUNTERPART, CURRENT, SIDE, SIDE_BUILDS, type BuildName } from './builds';
import { LIBRARY, MODE } from './describe';
import { DESCRIPTION } from './placement';
import { About } from './about/About';
import { CategoryPanel } from './metrics/Categories';
import { MetricsPanel } from './metrics/Panel';
import { Responsiveness } from './responsive/Responsiveness';
import { SIZES, SPECS, specFrom, sizeHref } from './sizes/sizes';
import { PLACEMENTS, placementFrom, placementHref, switchHref, type PlacementName } from './url';

const placement = placementFrom(new URLSearchParams(location.search));

/**
 * The toggle's build, and the placement it lands in: Isoloop's `matched`
 * pairs with native + workers, and native + workers with `matched`.
 */
const TOGGLE: { build: BuildName | undefined; placement?: PlacementName } =
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
        <nav className="kernel seg" aria-label="Kernel">
          <span className="seg-items">
            {(['native', 'isoloop'] as const).map((side) => {
              const text = side === 'native' ? 'Native' : 'Isoloop';
              if (side === SIDE)
                return (
                  <span key={side} aria-current="page">
                    {text}
                  </span>
                );
              if (other === undefined)
                return (
                  <span
                    key={side}
                    aria-disabled="true"
                    title={`No ${text.toLowerCase()} build of ${BUILDS.find((b) => b.name === CURRENT)?.label ?? CURRENT}`}
                  >
                    {text}
                  </span>
                );
              return (
                <a
                  key={side}
                  aria-label={`Switch to ${other}`}
                  href={`../${other}/${location.search}`}
                  onClick={(e) => {
                    // Built at click time: the replay's position moves on.
                    e.currentTarget.href = switchHref(other, TOGGLE.placement);
                  }}
                >
                  {text}
                </a>
              );
            })}
          </span>
        </nav>
        <nav className="builds seg" aria-label="Builds">
          <span className="seg-label">Build</span>
          <span className="seg-items">
            {SIDE_BUILDS[SIDE].map((b) => {
              const title = BUILDS.find((x) => x.name === b.name)?.label;
              const mixed = b.mixed ? { 'data-mixed': '' } : {};
              return b.name === CURRENT ? (
                <span key={b.name} aria-current="page" title={title} {...mixed}>
                  {b.short}
                </span>
              ) : (
                <a
                  key={b.name}
                  title={title}
                  {...mixed}
                  href={`../${b.name}/${location.search}`}
                  onClick={(e) => {
                    e.currentTarget.href = switchHref(b.name);
                  }}
                >
                  {b.short}
                </a>
              );
            })}
          </span>
        </nav>
        <nav className="sizes seg" aria-label="Dashboard size">
          <span className="seg-label">Size</span>
          <span className="seg-items">
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
          </span>
        </nav>
        {BUILD === 'native' ? null : (
          <nav className="placements seg" aria-label="Placement">
            <span className="seg-label">Placement</span>
            <span className="seg-items">
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
            </span>
          </nav>
        )}
      </header>
      <section
        className="description"
        aria-label="What runs where"
        {...(BUILD === 'native' ? {} : { 'data-placement-note': placement })}
      >
        <h2
          className="build"
          data-build={BUILD}
          {...(BUILD === 'native' ? {} : { 'data-placement': placement })}
        >
          {BUILDS.find((b) => b.name === CURRENT)?.label}
          {BUILD === 'native' ? null : <> · placement {placement}</>}
        </h2>
        <dl>
          <div>
            <dt>Mode</dt>
            <dd>{MODE[SIDE]}</dd>
          </div>
          <div {...(CURRENT === 'mixed' ? { 'data-mixed': '' } : {})}>
            <dt>Library</dt>
            <dd>{LIBRARY[CURRENT]}</dd>
          </div>
          {BUILD === 'native' ? null : (
            <div>
              <dt>Placement</dt>
              <dd>{DESCRIPTION[placement]}</dd>
            </div>
          )}
        </dl>
      </section>
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
