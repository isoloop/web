/** @jsxImportSource preact */
// /benchmarks/'s "Plain JavaScript work" (ADR 0002, amended 2026-11-24): js-bench's
// latest minor or major run, from content/benchmarks.json's `js` entry
// (build/benchmarks.ts). Every figure is read from its summary.json, so a new
// run changes no code and no copy.
import type { VNode } from 'preact';
import { ChartLegend, opsNumber, PairedBars, type Verdict } from 'ui/components';
import {
  JS_PLACEMENTS,
  JS_TIERS,
  type JsEngine,
  type JsFigure,
  type JsPlacement,
  type JsRun,
} from '../../build/benchmarks.ts';
import { benchmarksPage, marks } from '../copy.ts';
import { inline } from './inline.tsx';

const c = benchmarksPage.js;
const ENGINES = ['chromium', 'firefox', 'webkit'];
const engineName = (e: string): string => benchmarksPage.engines[e] ?? e;
const place = (p: string): string => c.placements[p] ?? p;
const work = (w: string): string => c.workloads[w] ?? w;
const ops = (n: number | null): string => (n === null ? c.tables.none : opsNumber(n));

type Measured = JsFigure & { opsPerSec: number; min: number; max: number };
const measured = (f: JsFigure | undefined): f is Measured =>
  f !== undefined && f.opsPerSec !== null && f.min !== null && f.max !== null;

/** The engine the section leads with: Chromium when the run has it. */
function leadEngine(run: JsRun): JsEngine {
  const e = run.summary.engines.toSorted(
    (x, y) => ENGINES.indexOf(x.engine) - ENGINES.indexOf(y.engine),
  );
  return e.find((x) => x.engine === 'chromium') ?? e[0]!;
}

/** The workloads in tier order, as the run lists them. */
function workloadsOf(e: JsEngine): { workload: string; tier: JsFigure['tier'] }[] {
  const seen = new Map<string, JsFigure['tier']>();
  for (const f of e.workloads) seen.set(f.workload, f.tier);
  return [...seen]
    .map(([workload, tier]) => ({ workload, tier }))
    .toSorted((x, y) => JS_TIERS.indexOf(x.tier) - JS_TIERS.indexOf(y.tier));
}

const at = (e: JsEngine, workload: string, n: number, placement: string): JsFigure | undefined =>
  e.workloads.find((f) => f.workload === workload && f.n === n && f.placement === placement);

/** b against a, as a whole percentage: −19 is 19% fewer. */
const pctOf = (b: number, a: number): number => Math.round((b / a - 1) * 100);

/** Within `limit` (a share) of each other: the largest over the smallest. */
const within = (xs: number[], limit: number): boolean =>
  Math.max(...xs) / Math.min(...xs) - 1 <= limit;

const median = (xs: number[]): number => {
  const s = xs.toSorted((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** "0.9 µs", "4.0 ms", "811 ms": one op's time. */
function opTime(us: number): string {
  if (us < 1000) return `${us < 10 ? us.toFixed(1) : Math.round(us)} µs`;
  const ms = us / 1000;
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;
}

/** "10 ms", "1.6 ms", "4.0 s": the timer's lateness. */
function lateness(ms: number | null): string {
  if (ms === null) return c.tables.none;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

/**
 * Isoloop against the baseline: within the spread when each one's median is
 * inside the other's lowest-to-highest range, else by the sign.
 */
function verdictOf(base: Measured, value: Measured): Verdict {
  const overlap = value.min <= base.max && base.min <= value.max;
  if (overlap) return 'same';
  return value.opsPerSec > base.opsPerSec ? 'better' : 'worse';
}

/** The section's label: what it was measured on. */
export function jsMeasuredOn(run: JsRun): string {
  const s = run.summary;
  const browsers = s.engines
    .toSorted((x, y) => ENGINES.indexOf(x.engine) - ENGINES.indexOf(y.engine))
    .map((e) => `${engineName(e.engine)} ${e.browser.split('.')[0]}`)
    .join(', ');
  return c.measuredOn({
    version: s.version,
    date: s.date,
    browsers,
    cores: s.cores,
    clock: s.clock,
    machine: c.machine(s.machine),
    machineHref: run.links.machine,
  });
}

/** The exceptions to a finding, as a nested list. */
function Others({ label, items }: { label: string; items: string[] }): VNode | null {
  if (items.length === 0) return null;
  return (
    <>
      {' '}
      {label}:
      <ul>
        {items.map((i) => (
          <li key={i}>{inline(i)}</li>
        ))}
      </ul>
    </>
  );
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;

function Findings({ e }: { e: JsEngine }): VNode {
  const ws = workloadsOf(e).map((w) => w.workload);
  const total = ws.length;

  // One copy: the main thread, a plain Worker and Isoloop.
  const one = ws.map((w) => ({
    w,
    xs: ['native-main', 'native-worker', 'isoloop-own'].map((p) => at(e, w, 1, p)),
  }));
  const oneAll = one.filter((r) => r.xs.every(measured));
  const oneSame = oneAll.filter((r) =>
    within(
      r.xs.map((x) => x!.opsPerSec!),
      0.05,
    ),
  );
  const oneOther = oneAll
    .filter((r) => !oneSame.includes(r))
    .map((r) => `${work(r.w)}: ${r.xs.map((x) => ops(x!.opsPerSec)).join(' / ')}`);

  // Four copies: a worker each, one shared worker and the balancer.
  const four = ws
    .map((w) => ({
      w,
      main: at(e, w, 4, 'native-main'),
      workers: at(e, w, 4, 'native-worker'),
      own: at(e, w, 4, 'isoloop-own'),
      one: at(e, w, 4, 'isoloop-one'),
      bal: at(e, w, 4, 'isoloop-balancer'),
    }))
    .filter((r) => measured(r.main) && measured(r.workers));
  const vs = (
    rows: typeof four,
    key: 'own' | 'one' | 'bal',
    base: 'main' | 'workers',
    limit: number,
  ) => {
    const rs = rows.filter((r) => measured(r[key]));
    const same = rs.filter((r) => within([r[key]!.opsPerSec!, r[base]!.opsPerSec!], limit));
    const other = rs
      .filter((r) => !same.includes(r))
      .map(
        (r) =>
          `${c.against(work(r.w), ops(r[key]!.opsPerSec), ops(r[base]!.opsPerSec))} (${c.share(pctOf(r[key]!.opsPerSec!, r[base]!.opsPerSec!))})`,
      );
    return { rs, same, other };
  };
  const own = vs(four, 'own', 'workers', 0.02);
  const ratios = own.same.map((r) => r.own!.opsPerSec! / r.main!.opsPerSec!);
  const oneShared = vs(four, 'one', 'main', 0.05);
  const bal = vs(four, 'bal', 'workers', 0.1);
  const balShares = bal.same.map((r) => r.bal!.opsPerSec! / r.workers!.opsPerSec!);
  const moves = median(four.flatMap((r) => r.bal?.moves ?? []));

  // The page's timer.
  const late = (n: number, ps: string[]): number[] =>
    e.workloads
      .filter((f) => f.n === n && ps.includes(f.placement) && f.latenessP95Ms !== null)
      .map((f) => f.latenessP95Ms!);
  const offMain = JS_PLACEMENTS.filter((p) => p !== 'native-main');
  const main1 = late(1, ['native-main']);
  const main4 = late(4, ['native-main']);
  const off = [...late(1, offMain), ...late(4, offMain)];

  return (
    <ol class="bench-js-found">
      {oneAll.length > 0 && (
        <li>
          {inline(c.findings.oneCopy(oneSame.length, total))}
          <Others label={c.findings.oneCopyOther} items={oneOther} />
        </li>
      )}
      {own.rs.length > 0 && ratios.length > 0 && (
        <li>
          {inline(
            c.findings.fourOwn(
              own.same.length,
              total,
              Math.min(...ratios).toFixed(1),
              Math.max(...ratios).toFixed(1),
            ),
          )}
          <Others label={c.findings.fourOwnOther} items={own.other} />
        </li>
      )}
      {oneShared.rs.length > 0 && (
        <li>
          {inline(c.findings.fourOne(oneShared.same.length, total))}
          <Others label={c.findings.fourOneOther} items={oneShared.other} />
        </li>
      )}
      {bal.rs.length > 0 && balShares.length > 0 && (
        <li>
          {inline(
            c.findings.balancer(
              pct(Math.min(...balShares)),
              pct(Math.max(...balShares)),
              bal.same.length,
              total,
              String(Math.round(moves)),
            ),
          )}
          <Others label={c.findings.balancerOther} items={bal.other} />
        </li>
      )}
      {main1.length > 0 && main4.length > 0 && off.length > 0 && (
        <li>
          {inline(
            c.findings.timer(
              lateness(median(main1)),
              lateness(median(main4)),
              lateness(Math.max(...main1, ...main4)),
              lateness(Math.ceil(Math.max(...off))),
            ),
          )}
        </li>
      )}
    </ol>
  );
}

/** The open cost (decision 14), while its workload still differs from plain Workers. */
function OpenCost({ e }: { e: JsEngine }): VNode | null {
  const w = c.openCost.workload;
  const [o1, b1, o4, b4] = [
    at(e, w, 1, 'isoloop-own'),
    at(e, w, 1, 'native-worker'),
    at(e, w, 4, 'isoloop-own'),
    at(e, w, 4, 'native-worker'),
  ];
  if (!measured(o1) || !measured(b1) || !measured(o4) || !measured(b4)) return null;
  if (within([o4.opsPerSec, b4.opsPerSec], 0.05)) return null;
  return (
    <p class="bench-note">
      {inline(
        c.openCost.text(ops(o1.opsPerSec), ops(b1.opsPerSec), ops(o4.opsPerSec), ops(b4.opsPerSec)),
      )}{' '}
      <a href={c.openCost.issue}>{c.openCost.link}</a>.
    </p>
  );
}

/** One chart per workload, grouped by tier: plain Workers against Isoloop, a worker each, at four copies. */
function Charts({ e }: { e: JsEngine }): VNode {
  const base = place('native-worker');
  const value = place('isoloop-own');
  const ws = workloadsOf(e);
  const verdicts = new Set<Verdict>();
  const tiers = JS_TIERS.map((tier) => {
    const charts = ws
      .filter((w) => w.tier === tier)
      .flatMap(({ workload }) => {
        const b = at(e, workload, 4, 'native-worker');
        const v = at(e, workload, 4, 'isoloop-own');
        if (!measured(b) || !measured(v)) return [];
        const verdict = verdictOf(b, v);
        verdicts.add(verdict);
        return [
          <PairedBars
            key={workload}
            compact
            legend={false}
            note={null}
            lowerIsBetter={false}
            title={inline(work(workload))}
            unit="ops/s"
            base={base}
            value={value}
            rows={[{ base: b.opsPerSec, value: v.opsPerSec, verdict }]}
          />,
        ];
      });
    const times = ws
      .filter((w) => w.tier === tier)
      .map((w) => at(e, w.workload, 1, 'native-main')?.opP50Us)
      .filter((x): x is number => typeof x === 'number');
    return { tier, charts, times };
  });
  return (
    <>
      <p class="bench-note">{c.charts.note}</p>
      {tiers
        .filter((t) => t.charts.length > 0)
        .map((t) => (
          <div key={t.tier} class="bench-pair">
            <h4>
              {c.tiers[t.tier]}
              {t.times.length > 0 && (
                <span class="bench-tier-time">
                  , {c.tierTime(opTime(Math.min(...t.times)), opTime(Math.max(...t.times)))}
                </span>
              )}
            </h4>
            <div class="bench-charts">{t.charts}</div>
          </div>
        ))}
      <ChartLegend
        base={base}
        value={value}
        verdicts={(['better', 'worse', 'same'] as const).filter((v) => verdicts.has(v))}
      />
    </>
  );
}

function Table({
  label,
  caption,
  head,
  rows,
}: {
  label: string;
  caption: string;
  head: string[];
  rows: { key: string; th: VNode | string; cells: string[] }[];
}): VNode {
  return (
    <div class="ui-table-wrap" tabindex={0} role="region" aria-label={label}>
      <table class="ui-table bench-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th scope="col" key={h} data-num={i > 0 ? '' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.th}</th>
              {r.cells.map((x, i) => (
                <td key={head[i + 1]} data-num="">
                  {x}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllPlacements({ e }: { e: JsEngine }): VNode {
  return (
    <details class="docs-fold bench-fold">
      <summary>{c.tables.all}</summary>
      <Table
        label={c.tables.all}
        caption={c.tables.allCaption}
        head={[c.tables.workload, ...JS_PLACEMENTS.map(place), c.tables.moves]}
        rows={workloadsOf(e).map(({ workload }) => ({
          key: workload,
          th: <>{inline(work(workload))}</>,
          cells: [
            ...JS_PLACEMENTS.map((p) => ops(at(e, workload, 4, p)?.opsPerSec ?? null)),
            (at(e, workload, 4, 'isoloop-balancer')?.moves ?? []).join(', ') || c.tables.none,
          ],
        }))}
      />
    </details>
  );
}

function OneCopy({ e }: { e: JsEngine }): VNode {
  const ps = ['native-main', 'native-worker', 'isoloop-own'];
  return (
    <>
      <h3>{c.tables.oneCopy}</h3>
      <p>{c.tables.oneCopyNote}</p>
      <Table
        label={c.tables.oneCopy}
        caption={c.tables.oneCopyCaption}
        head={[c.tables.workload, place('native-main'), c.oneWorker, place('isoloop-own')]}
        rows={workloadsOf(e).map(({ workload }) => ({
          key: workload,
          th: <>{inline(work(workload))}</>,
          cells: ps.map((p) => ops(at(e, workload, 1, p)?.opsPerSec ?? null)),
        }))}
      />
    </>
  );
}

function Timer({ e }: { e: JsEngine }): VNode {
  const of = (n: number, p: string): number[] =>
    e.workloads
      .filter((f) => f.n === n && f.placement === p && f.latenessP95Ms !== null)
      .map((f) => f.latenessP95Ms!);
  return (
    <>
      <h3>{c.tables.timer}</h3>
      <p>{c.tables.timerNote}</p>
      <Table
        label={c.tables.timer}
        caption={c.tables.timerCaption}
        head={[
          c.tables.placement,
          c.tables.typical(1),
          c.tables.highest(1),
          c.tables.typical(4),
          c.tables.highest(4),
        ]}
        rows={JS_PLACEMENTS.map((p) => {
          const one = of(1, p);
          const four = of(4, p);
          return {
            key: p,
            th: place(p),
            cells: [
              one.length ? lateness(median(one)) : c.tables.none,
              one.length ? lateness(Math.max(...one)) : c.tables.none,
              four.length ? lateness(median(four)) : c.tables.none,
              four.length ? lateness(Math.max(...four)) : c.tables.none,
            ],
          };
        })}
      />
    </>
  );
}

function Scenario({ e }: { e: JsEngine }): VNode | null {
  const raw = e.scenario;
  if (!raw) return null;
  const s = {
    ...raw,
    placements: raw.placements.toSorted(
      (x, y) => JS_PLACEMENTS.indexOf(x) - JS_PLACEMENTS.indexOf(y),
    ),
  };
  const total = (p: JsPlacement): number | null => {
    let sum = 0;
    for (const x of s.copies) {
      const v = x.opsPerSec[p];
      if (typeof v !== 'number') return null;
      sum += v;
    }
    return sum;
  };
  const own = total('isoloop-own');
  const bal = total('isoloop-balancer');
  const workers = (p: JsPlacement): string => String(s.workers[p] ?? c.tables.none);
  return (
    <>
      <h3>
        {c.scenario.heading} <span class="ui-pill">{marks.experimental}</span>
      </h3>
      {own !== null && bal !== null && (
        <p>
          {c.scenario.text(
            ops(own),
            workers('isoloop-own'),
            ops(bal),
            workers('isoloop-balancer'),
            c.share(pctOf(bal, own)),
          )}
        </p>
      )}
      <details class="docs-fold bench-fold">
        <summary>{c.scenario.fold}</summary>
        <Table
          label={c.scenario.fold}
          caption={c.scenario.caption}
          head={[c.scenario.copy, ...s.placements.map(place)]}
          rows={[
            ...s.copies.map((x) => ({
              key: x.id,
              th: <>{inline(work(x.workload))}</>,
              cells: s.placements.map((p) => ops(x.opsPerSec[p] ?? null)),
            })),
            {
              key: 'total',
              th: c.scenario.total,
              cells: s.placements.map((p) => ops(total(p))),
            },
            {
              key: 'workers',
              th: c.scenario.workers,
              cells: s.placements.map(workers),
            },
            {
              key: 'lateness',
              th: c.scenario.lateness,
              cells: s.placements.map((p) => lateness(s.latenessP95Ms[p] ?? null)),
            },
          ]}
        />
      </details>
    </>
  );
}

function Method({ run }: { run: JsRun }): VNode {
  const items: [string, string][] = [
    ...c.method.items,
    [c.method.placementsLabel, c.method.placementsText(run.summary.maxWorkers)],
    [c.method.roundsLabel, c.method.rounds(run.summary.rounds)],
    [c.method.when, c.method.whenText],
  ];
  return (
    <>
      <h3>{c.method.heading}</h3>
      <dl class="bench-method">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{inline(v)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** The section's body, under its heading. */
export function JsBench({ run }: { run: JsRun }): VNode {
  const e = leadEngine(run);
  return (
    <>
      <p class="bench-measured">{inline(jsMeasuredOn(run))}</p>
      <p>{inline(c.lede)}</p>
      {run.summary.engines.length === 1 && (
        <p class="bench-note">{c.oneBrowser(engineName(e.engine))}</p>
      )}
      <h3>{c.found}</h3>
      <Findings e={e} />
      <OpenCost e={e} />
      <p class="bench-note">{c.findings.notMeasured}</p>
      <h3>{c.charts.heading}</h3>
      <Charts e={e} />
      <AllPlacements e={e} />
      <OneCopy e={e} />
      <Timer e={e} />
      <Scenario e={e} />
      <Method run={run} />
    </>
  );
}
