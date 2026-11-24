import { Slot } from '#slot';
import { CURRENT, OTHER_SIDE, SIDE, SIDE_BUILDS } from './builds';
import { ClearHistory } from './ClearHistory';
import { CategoryPanel } from './metrics/Categories';
import { MetricsPanel } from './metrics/Panel';
import { Record } from './metrics/Record';
import { Description, Notices } from './Notices';
import { Responsiveness } from './responsive/Responsiveness';
import { MACHINES } from './core/machines';
import { WIDGETS } from './widgets';
import { layout, type WidgetName } from './widgets/catalog';
import { PLACEMENTS, RATES, SETTINGS, buildHref, withParam } from './url';

/** The diagram of what runs where in this build (architecture/ next to the builds). */
const DRAWN: ReadonlySet<string> = new Set(['one', 'matched', 'split', 'own']);
function architectureHref(): string {
  if (CURRENT !== 'isoloop') return `../architecture/${CURRENT}.html`;
  return DRAWN.has(SETTINGS.placement)
    ? `../architecture/${SETTINGS.placement}.html`
    : '../architecture/';
}

/** The page shell, the same in every build; only what a slot holds differs. */
const SHOWN = Object.keys(WIDGETS).filter((w): w is WidgetName => w in WIDGETS);

export function Page() {
  const { fleet, machines } = layout(SHOWN);
  return (
    <div className="page">
      <header>
        <h1>Plant 1</h1>
        <nav className="kernel seg" aria-label="Kernel">
          <span className="seg-items">
            {(['native', 'isoloop'] as const).map((side) => {
              const text = side === 'native' ? 'Native' : 'Isoloop';
              return side === SIDE ? (
                <span key={side} aria-current="page">
                  {text}
                </span>
              ) : (
                <a
                  key={side}
                  aria-label={`Switch to ${OTHER_SIDE}`}
                  href={buildHref(OTHER_SIDE, location.search)}
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
            {SIDE_BUILDS[SIDE].map((b) =>
              b.name === CURRENT ? (
                <span key={b.name} aria-current="page">
                  {b.short}
                </span>
              ) : (
                <a key={b.name} href={buildHref(b.name, location.search)}>
                  {b.short}
                </a>
              ),
            )}
          </span>
        </nav>
        <nav className="rates seg" aria-label="Vibration rate">
          <span className="seg-label">Rate</span>
          <span className="seg-items">
            {RATES.map((r) =>
              r === SETTINGS.rate ? (
                <span key={r} aria-current="page">
                  {r} kHz
                </span>
              ) : (
                <a key={r} href={withParam(location.search, 'rate', String(r))}>
                  {r} kHz
                </a>
              ),
            )}
          </span>
        </nav>
        <nav
          className="placements seg"
          aria-label="Placement"
          {...(CURRENT === 'isoloop' ? {} : { 'data-disabled': '' })}
        >
          <span className="seg-label">Placement</span>
          <span className="seg-items">
            {PLACEMENTS.map((p) =>
              CURRENT !== 'isoloop' ? (
                // Kept in place on native builds, so the header doesn't move.
                <span key={p} aria-disabled="true" title="Placement is an Isoloop setting">
                  {p}
                </span>
              ) : p === SETTINGS.placement ? (
                <span key={p} aria-current="page">
                  {p}
                </span>
              ) : (
                <a key={p} href={withParam(location.search, 'placement', p)}>
                  {p}
                </a>
              ),
            )}
          </span>
        </nav>
        <ClearHistory />
        <a className="architecture" href={architectureHref()}>
          Architecture
        </a>
        <a className="interactive-link" href={`../interactive/${SIDE}/?rate=${SETTINGS.rate}`}>
          Interactive mode
        </a>
      </header>
      <Description />
      <Notices />
      <Responsiveness />
      <MetricsPanel />
      <CategoryPanel widgets={SHOWN} />
      <Record />
      {fleet.length > 0 && (
        <section className="fleet" aria-label="Fleet">
          <h2>Fleet</h2>
          <div className="widgets">
            {fleet.map((p) => (
              <Slot key={p.id} placed={p} />
            ))}
          </div>
        </section>
      )}
      <main className="machines">
        {machines.map((ws, i) => (
          <section key={MACHINES[i]} className="machine" aria-label={MACHINES[i]}>
            <h2>{MACHINES[i]}</h2>
            <div className="widgets">
              {ws.map((p) => (
                <Slot key={p.id} placed={p} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
