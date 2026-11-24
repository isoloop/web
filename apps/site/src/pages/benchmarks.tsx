/** @jsxImportSource preact */
// /benchmarks/ (ADR 0002 and 0005, amended 2026-11-24): what we found, the
// latest run's charts with the tables folded under them, the history once there
// are two runs, the method, the feature benchmarks and the raw results. Every
// figure comes from content/benchmarks.json's runs (build/benchmarks.ts).
import type { VNode } from 'preact';
import { ChartLegend, formatDelta, formatValue, PairedBars, type Verdict } from 'ui/components';
import {
  archOf,
  changedBeyondSpread,
  cpuCount,
  FIGURE_KEYS,
  withinSpread,
  type BenchRun,
  type PairFigure,
} from '../../build/benchmarks.ts';
import { benchmarksPage as c } from '../copy.ts';
import { inline } from './inline.tsx';
import type { Page, SiteData } from './types.ts';

const BENCH_README = 'https://github.com/isoloop/web/tree/main/apps/bench/plant';
const ENGINES = ['chromium', 'firefox', 'webkit'];
/** The default placement's pair first. */
const PAIR_ORDER = ['isoloop:matched', 'isoloop:one'];

const build = (k: string): string => c.builds[k] ?? k;
const engine = (e: string): string => c.engines[e] ?? e;
const rank = (list: string[], x: string): number =>
  list.includes(x) ? list.indexOf(x) : list.length;

/** The section ids, in the page's order; the history only once there are two runs of the latest's build. */
function sections(runs: number): [string, string][] {
  return [
    ['found', c.sections.found],
    ['figures', c.sections.figures],
    ...(runs > 1 ? ([['history', c.sections.history]] as [string, string][]) : []),
    ['method', c.sections.method],
    ['features', c.sections.features],
    ['raw', c.sections.raw],
  ];
}

export function measuredOn(run: BenchRun): string {
  return c.measuredOn({
    name: run.name,
    version: run.version,
    date: run.date,
    cores: cpuCount(run.environment.machine.cpus),
    clock: run.environment.machine.clock,
  });
}

/** The pairs of a run, as {a, b}, the default placement first. */
function pairsOf(run: BenchRun): { a: string; b: string }[] {
  const seen = new Map<string, { a: string; b: string }>();
  for (const p of run.pairs) seen.set(`${p.a}=${p.b}`, { a: p.a, b: p.b });
  return [...seen.values()].toSorted((x, y) => rank(PAIR_ORDER, x.b) - rank(PAIR_ORDER, y.b));
}

const enginesOf = (run: BenchRun): string[] =>
  [...new Set(run.pairs.map((p) => p.engine))].toSorted(
    (x, y) => rank(ENGINES, x) - rank(ENGINES, y),
  );
const ratesOf = (run: BenchRun, eng?: string): number[] =>
  [...new Set(run.pairs.filter((p) => !eng || p.engine === eng).map((p) => p.rate))].toSorted(
    (x, y) => x - y,
  );

const measured = (
  p: PairFigure,
): p is PairFigure & { aMedian: number; bMedian: number; delta: number } =>
  p.aMedian !== null && p.bMedian !== null && p.delta !== null;

/** A signed difference: "−28 ms", "+19 points", "+1.0 s". */
export function signed(d: number, unit: PairFigure['unit']): string {
  const abs = Math.abs(d);
  const text =
    unit === '%'
      ? `${Math.round(abs)} point${Math.round(abs) === 1 ? '' : 's'}`
      : formatValue(abs, unit);
  if (/^0(\.0+)?\b/.test(text)) return text;
  return `${d < 0 ? '−' : '+'}${text}`;
}

/** A difference's verdict as the charts show it. */
const verdictOf = (p: PairFigure & { delta: number }): Verdict =>
  withinSpread(p) ? 'same' : p.delta < 0 ? 'better' : p.delta > 0 ? 'worse' : 'same';

/** The verdicts a group of charts shows, for its legend. */
const verdictsOf = (rows: PairFigure[]): Verdict[] => {
  const seen = new Set(rows.filter(measured).map(verdictOf));
  return (['better', 'worse', 'same'] as const).filter((v) => seen.has(v));
};

/** "28 ms lower", without the verdict, for the findings. */
const deltaWords = (p: PairFigure & { delta: number }): string =>
  formatDelta(p.aMedian ?? 0, p.bMedian ?? 0, p.unit, { delta: p.delta }).text.replace(
    /, (better|worse)$/,
    '',
  );

const label = (p: PairFigure): string => c.found.figures[p.figure];

function Findings({ run }: { run: BenchRun }): VNode {
  const rate = Math.max(...ratesOf(run, 'chromium'));
  const here = run.pairs.filter((p) => p.engine === 'chromium' && p.rate === rate).filter(measured);
  return (
    <>
      <p>{c.found.intro(engine('chromium'), c.rate(rate))}</p>
      {pairsOf(run).map(({ a, b }) => {
        const rows = here.filter((p) => p.a === a && p.b === b);
        const within = rows.filter((p) => verdictOf(p) === 'same' && p.spread);
        const better = rows.filter((p) => verdictOf(p) === 'better');
        const worse = rows.filter((p) => verdictOf(p) === 'worse');
        return (
          <div key={b} class="bench-finding">
            <h3>
              {c.pair(build(b), build(a))}
              {b === PAIR_ORDER[0] ? `, ${c.defaultPlacement}` : ''}
            </h3>
            <ul>
              {better.length > 0 && (
                <li>
                  <b>{c.found.better}:</b>{' '}
                  {better.map((p) => c.found.item(label(p), deltaWords(p))).join('; ')}.
                </li>
              )}
              {worse.length > 0 && (
                <li>
                  <b>{c.found.worse}:</b>{' '}
                  {worse.map((p) => c.found.item(label(p), deltaWords(p))).join('; ')}.
                </li>
              )}
              {within.length > 0 && (
                <li>
                  <b>{c.found.within}:</b>{' '}
                  {within
                    .map((p) =>
                      c.found.range(
                        label(p),
                        signed(p.spread![0], p.unit),
                        signed(p.spread![1], p.unit),
                      ),
                    )
                    .join('; ')}
                  .
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/** One figure for one pair on one engine: a row per load. */
function FigureChart({ rows, figure }: { rows: PairFigure[]; figure: string }): VNode | null {
  const shown = rows.filter(measured);
  const first = shown[0];
  if (!first) return null;
  const largest = Math.max(...shown.flatMap((p) => [p.aMedian, p.bMedian]));
  return (
    <PairedBars
      compact
      legend={false}
      note={null}
      title={figure}
      unit={first.unit}
      base={build(first.a)}
      value={build(first.b)}
      {...(first.unit === '%' ? { max: Math.max(100, largest) } : {})}
      rows={shown.map((p) => ({
        label: c.rate(p.rate),
        base: p.aMedian,
        value: p.bMedian,
        delta: p.delta,
        verdict: verdictOf(p),
      }))}
    />
  );
}

function PairTable({ rows, a, b }: { rows: PairFigure[]; a: string; b: string }): VNode {
  return (
    <div class="ui-table-wrap" tabindex={0} role="region" aria-label={c.pair(build(b), build(a))}>
      <table class="ui-table bench-table">
        <caption>{c.table.caption(build(b), build(a))}</caption>
        <thead>
          <tr>
            <th scope="col">{c.table.figure}</th>
            <th scope="col">{c.table.load}</th>
            <th scope="col">{build(a)}</th>
            <th scope="col">{build(b)}</th>
            <th scope="col">{c.table.delta}</th>
            <th scope="col">{c.table.spread}</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(measured).map((p) => (
            <tr key={`${p.figure}-${p.rate}`}>
              <th scope="row">{c.figures[p.figure]}</th>
              <td>{c.rate(p.rate)}</td>
              <td>{formatValue(p.aMedian, p.unit)}</td>
              <td>{formatValue(p.bMedian, p.unit)}</td>
              <td>{signed(p.delta, p.unit)}</td>
              <td>
                {p.spread
                  ? `${signed(p.spread[0], p.unit)} to ${signed(p.spread[1], p.unit)}`
                  : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figures({ run }: { run: BenchRun }): VNode {
  const pairs = pairsOf(run);
  const engines = enginesOf(run);
  return (
    <>
      <p class="bench-note">{c.figuresNote}</p>
      {engines.map((eng) => (
        <section key={eng} class="bench-engine" aria-labelledby={`figures-${eng}`}>
          <h3 id={`figures-${eng}`}>{engine(eng)}</h3>
          {pairs.map(({ a, b }) => {
            const rows = run.pairs.filter((p) => p.engine === eng && p.a === a && p.b === b);
            if (!rows.some(measured)) return null;
            return (
              <div key={b} class="bench-pair">
                <h4>{c.pair(build(b), build(a))}</h4>
                <div class="bench-charts">
                  {FIGURE_KEYS.map((f) => (
                    <FigureChart
                      key={f}
                      figure={c.figures[f]}
                      rows={rows.filter((p) => p.figure === f)}
                    />
                  ))}
                </div>
                <ChartLegend base={build(a)} value={build(b)} verdicts={verdictsOf(rows)} />
              </div>
            );
          })}
          {eng !== 'chromium' && <p class="bench-note">{c.timingsOnly(engine(eng))}</p>}
          <details class="docs-fold bench-fold">
            <summary>
              {c.table.summary} <span>{engine(eng)}</span>
            </summary>
            {pairs.map(({ a, b }) => {
              const rows = run.pairs
                .filter((p) => p.engine === eng && p.a === a && p.b === b)
                .toSorted(
                  (x, y) =>
                    FIGURE_KEYS.indexOf(x.figure) - FIGURE_KEYS.indexOf(y.figure) ||
                    x.rate - y.rate,
                );
              return rows.length > 0 ? <PairTable key={b} rows={rows} a={a} b={b} /> : null;
            })}
          </details>
        </section>
      ))}
    </>
  );
}

/** Each figure's Δ at each version, Chromium at the highest load, per pair. */
function History({ runs }: { runs: BenchRun[] }): VNode {
  const latest = runs.at(-1)!;
  const rate = Math.max(...ratesOf(latest, 'chromium'));
  const at = (run: BenchRun, a: string, b: string, f: string): PairFigure | undefined =>
    run.pairs.find(
      (p) => p.engine === 'chromium' && p.rate === rate && p.a === a && p.b === b && p.figure === f,
    );
  return (
    <>
      <p>{c.history.lede(engine('chromium'), c.rate(rate))}</p>
      {pairsOf(latest).map(({ a, b }) => (
        <div
          key={b}
          class="ui-table-wrap"
          tabindex={0}
          role="region"
          aria-label={c.pair(build(b), build(a))}
        >
          <table class="ui-table bench-table">
            <caption>{c.table.caption(build(b), build(a))}</caption>
            <thead>
              <tr>
                <th scope="col">{c.table.figure}</th>
                {runs.map((r) => (
                  <th scope="col" key={r.version}>
                    {r.version}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIGURE_KEYS.map((f) => (
                <tr key={f}>
                  <th scope="row">{c.figures[f]}</th>
                  {runs.map((r, i) => {
                    const p = at(r, a, b, f);
                    const before = i > 0 ? at(runs[i - 1]!, a, b, f) : undefined;
                    const changed = p && before ? changedBeyondSpread(before, p) : false;
                    return (
                      <td key={r.version} data-changed={changed ? '' : undefined}>
                        {p?.delta != null ? signed(p.delta, p.unit) : '–'}
                        {changed && <span class="ui-verdict"> {c.history.changed}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function Method({ run }: { run: BenchRun }): VNode {
  const env = run.environment;
  const browsers = Object.entries(env.browsers)
    .toSorted(([x], [y]) => rank(ENGINES, x) - rank(ENGINES, y))
    .map(([e, v]) => `${engine(e)} ${v}`)
    .join(', ');
  const items: [string, string][] = [
    [
      c.method.machine,
      c.method.machineText({
        arch: archOf(env.machine),
        cores: cpuCount(env.machine.cpus),
        cpus: env.machine.cpus,
        clock: env.machine.clock,
        memoryGb: env.machine.memoryGb,
        os: env.machine.os,
        node: env.machine.node,
        image: env.machine.image,
      }),
    ],
    [
      c.method.versions,
      c.method.versionsText({
        version: env.version,
        react: env.packages['react'] ?? '?',
        playwright: env.packages['@playwright/test'] ?? '?',
        browsers,
      }),
    ],
    [c.method.rounds, c.method.roundsText(env.rounds)],
    [c.method.delta, c.method.deltaText],
  ];
  return (
    <dl class="bench-method">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{inline(v)}</dd>
        </div>
      ))}
      <div>
        <dt>{c.method.page}</dt>
        <dd>
          <ol>
            {c.method.pageSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </dd>
      </div>
      <div>
        <dt>{c.method.when}</dt>
        <dd>{c.method.whenText}</dd>
      </div>
    </dl>
  );
}

function FeatureBenchmarks({ examples }: Pick<SiteData, 'examples'>): VNode {
  const blocks = examples.flatMap((e) =>
    e.measurements.status === 'measured'
      ? e.measurements.blocks
          // Plant's desktop run is this page's own figures.
          .filter((b) => !(e.id === 'dashboards/plant' && b.id === 'desktop'))
          .map((b) => ({ example: e.title, block: b }))
      : [],
  );
  return (
    <>
      <p>
        {c.features.lede}
        <a href="/examples/">{c.features.examples}</a>.
      </p>
      <ul class="bench-list">
        {blocks.map(({ example, block }) => (
          <li key={`${example}-${block.id}`}>
            {example}: {block.heading}, {c.features.tag(block.tag)} (
            <a href={block.results}>{c.features.results}</a>)
          </li>
        ))}
      </ul>
    </>
  );
}

function Raw({ runs }: { runs: BenchRun[] }): VNode {
  return (
    <>
      <p>{c.raw.lede}</p>
      <ul class="bench-list">
        {runs.toReversed().map((r) => (
          <li key={r.version}>
            {c.raw.run(r.name, r.version, r.date)} <a href={r.links.summary}>{c.raw.summary}</a>,{' '}
            <a href={r.links.results}>{c.raw.results}</a>,{' '}
            <a href={r.links.environment}>{c.raw.environment}</a>
          </li>
        ))}
        <li>
          <a href={BENCH_README}>{c.raw.bench}</a>
        </li>
      </ul>
    </>
  );
}

function SideNav({ runs }: { runs: number }): VNode {
  return (
    <nav class="docs-side bench-nav" aria-label={c.nav}>
      <div>
        <h2>{c.nav}</h2>
        <ul>
          {sections(runs).map(([id, text]) => (
            <li key={id}>
              <a href={`#${id}`}>{text}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** The page, from the runs and the examples' other measurements. */
export function Benchmarks({
  benchmarks,
  examples,
}: Pick<SiteData, 'benchmarks' | 'examples'>): VNode {
  const { runs, latest } = benchmarks;
  // Only runs of the same build compare: an older build's run stays under Raw results.
  const comparable = runs.filter((r) => r.name === latest.name);
  const body: Record<string, VNode> = {
    found: <Findings run={latest} />,
    figures: <Figures run={latest} />,
    history: <History runs={comparable} />,
    method: <Method run={latest} />,
    features: <FeatureBenchmarks examples={examples} />,
    raw: <Raw runs={runs} />,
  };
  return (
    <div class="docs-layout docs-layout-index">
      <div class="docs-only-wide">
        <SideNav runs={comparable.length} />
      </div>
      <main class="docs-article bench">
        <h1>{c.heading}</h1>
        <p class="docs-lead">{c.lede}</p>
        <p class="bench-measured">{inline(measuredOn(latest))}</p>
        <details class="docs-fold docs-only-narrow">
          <summary>{c.nav}</summary>
          <SideNav runs={comparable.length} />
        </details>
        {sections(comparable.length).map(([id, text]) => (
          <section key={id} id={id} class="bench-section" aria-labelledby={`${id}-h`}>
            <h2 id={`${id}-h`}>{text}</h2>
            {body[id]}
          </section>
        ))}
      </main>
    </div>
  );
}

export const benchmarksPage: Page = {
  path: '/benchmarks/',
  section: 'benchmarks',
  head: { title: c.title, searchTitle: c.searchTitle, description: c.description },
  scripts: ['/src/demos/benchmarks.ts'],
  render: (data) => <Benchmarks {...data} />,
};
