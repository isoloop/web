// plant-bench's results, written by run.ts into results/<version>/:
//
// - summary.md, in the order every results page uses: what we found, then the
//   A | B | Δ tables ("Lower is better" above them), then the details folded
//   (each Δ's spread over the rounds, `split`, stopped runs, the method and
//   the command to run it again);
// - summary.json, the same figures as data, for the site's charts
//   (`/benchmarks/`, the landing page). Its shape is `Summary` below.
//
// The raw result files (one per page, `<engine>/<config>-<rate>khz-runN.json`)
// stay next to them, and are what both are rebuilt from (`run.ts --summary-only`).
import { z } from 'zod';
import { median, type Result, type Selection } from './lib/compare/pairs.ts';
import { stoppedLabel } from './lib/compare/stopped.ts';

/** The matrix's figures (README.md, decision 6), in the tables' order. Lower is better for all of them. */
export const FIGURES = [
  { key: 'mainThreadCpuPct', label: 'Main-thread busy', unit: '%' },
  { key: 'rendererCpuPct', label: 'CPU, all threads', unit: '%' },
  { key: 'typingMedianMs', label: 'Typing, median of 5', unit: 'ms' },
  { key: 'firstDataMs', label: 'First data', unit: 'ms' },
  { key: 'allWidgetsMs', label: 'All 72 widgets with data', unit: 'ms' },
  { key: 'recoveryMs', label: 'Recovery after a 3 s block', unit: 'ms' },
  { key: 'rendererPssGcMb', label: 'Memory after GC', unit: 'MB' },
] as const;

export type FigureKey = (typeof FIGURES)[number]['key'];
type Unit = (typeof FIGURES)[number]['unit'];

/** Where and on what the run was measured (run.ts writes it as environment.json). */
export const ENVIRONMENT = z.object({
  /** The `@isoloop/*` version every package resolved to. */
  version: z.string(),
  /** Exact versions: every `@isoloop/*` package, React, Playwright. */
  packages: z.record(z.string(), z.string()),
  /** Engine → the browser build Playwright ran. */
  browsers: z.record(z.string(), z.string()),
  machine: z.object({
    cpu: z.string(),
    /** The CPUs the run was allowed (`Cpus_allowed_list`). */
    cpus: z.string(),
    /** Each allowed CPU's maximum clock from cpufreq, e.g. `2.0 GHz`; empty if unreadable. */
    clock: z.string(),
    memoryGb: z.number(),
    os: z.string(),
    node: z.string(),
    /** The container image, from `PLANT_BENCH_IMAGE`; empty outside one. */
    image: z.string(),
  }),
  /** When the run started. */
  started: z.string(),
  rounds: z.number(),
  /** From ADAPTED.md, when a codemod changed plant-bench for this release. */
  adaptedFor: z.string().optional(),
});
export type Environment = z.infer<typeof ENVIRONMENT>;

export interface PairFigure {
  engine: string;
  rate: number;
  /** The configurations, as `--pair` names them (`native-workers`, `isoloop:matched`). */
  a: string;
  b: string;
  figure: FigureKey;
  unit: Unit;
  /** Medians over the rounds that ran. */
  aMedian: number | null;
  bMedian: number | null;
  /** The median of B − A within each round. */
  delta: number | null;
  /** The lowest and highest round's B − A. */
  spread: [number, number] | null;
  /** Rounds with both sides measured. */
  rounds: number;
}

export interface Summary {
  version: string;
  environment: Environment;
  pairs: PairFigure[];
  /** Configurations measured alongside (`isoloop:split`): medians only. */
  extras: { engine: string; rate: number; config: string; figure: FigureKey; median: number }[];
  stopped: { engine: string; rate: number; config: string; round: number; why: string }[];
}

const NAMES: Record<string, string> = {
  native: 'native',
  'native-workers': 'native + workers',
  'isoloop:one': 'Isoloop `one`',
  'isoloop:matched': 'Isoloop `matched`',
  'isoloop:split': 'Isoloop `split`',
};
const name = (config: string): string => NAMES[config] ?? `\`${config}\``;
const ENGINES: Record<string, string> = {
  chromium: 'Chromium',
  firefox: 'Firefox',
  webkit: 'WebKit',
};
const engineName = (e: string): string => ENGINES[e] ?? e;

const num = (r: Result, k: string): number | null => r.figures[k] ?? null;

/** Builds the figures from the result files. */
export function collect(results: readonly Result[], sel: Selection, env: Environment): Summary {
  const pairs: PairFigure[] = [];
  const extras: Summary['extras'] = [];
  const stopped: Summary['stopped'] = results
    .filter((r) => r.stopped)
    .map((r) => ({
      engine: r.engine,
      rate: Number(r.value),
      config: r.key,
      round: r.run,
      why: stoppedLabel(r),
    }))
    .toSorted(
      (x, y) =>
        x.engine.localeCompare(y.engine) ||
        x.rate - y.rate ||
        x.round - y.round ||
        x.config.localeCompare(y.config),
    );
  const engines = [...new Set(results.map((r) => r.engine))].toSorted(engineOrder);
  const rates = [...new Set(results.map((r) => Number(r.value)))].toSorted((a, b) => a - b);
  for (const engine of engines) {
    for (const rate of rates) {
      const here = results.filter(
        (r) => r.engine === engine && Number(r.value) === rate && !r.stopped,
      );
      if (here.length === 0) continue;
      for (const { a, b } of sel.pairs) {
        const A = here.filter((r) => r.key === a);
        const B = here.filter((r) => r.key === b);
        for (const f of FIGURES) {
          const aMedian = median(A.flatMap((r) => num(r, f.key) ?? []));
          const bMedian = median(B.flatMap((r) => num(r, f.key) ?? []));
          if (aMedian === null && bMedian === null) continue;
          const gaps: number[] = [];
          for (const ra of A) {
            const rb = B.find((r) => r.run === ra.run);
            const x = num(ra, f.key);
            const y = rb ? num(rb, f.key) : null;
            if (x !== null && y !== null) gaps.push(y - x);
          }
          pairs.push({
            engine,
            rate,
            a,
            b,
            figure: f.key,
            unit: f.unit,
            aMedian,
            bMedian,
            delta: median(gaps),
            spread: gaps.length > 0 ? [Math.min(...gaps), Math.max(...gaps)] : null,
            rounds: gaps.length,
          });
        }
      }
      for (const config of sel.extras) {
        for (const f of FIGURES) {
          const m = median(
            here.filter((r) => r.key === config).flatMap((r) => num(r, f.key) ?? []),
          );
          if (m !== null) extras.push({ engine, rate, config, figure: f.key, median: m });
        }
      }
    }
  }
  return { version: env.version, environment: env, pairs, extras, stopped };
}

const engineOrder = (a: string, b: string): number => {
  const order = ['chromium', 'firefox', 'webkit'];
  return order.indexOf(a) - order.indexOf(b);
};

/** A value in its unit: ms at or over 1000 in seconds, % as is. */
export function value(x: number | null, unit: Unit): string {
  if (x === null) return '–';
  if (unit === 'ms')
    return Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`;
  if (unit === 'MB') return `${Math.round(x)} MB`;
  return `${Math.round(x)}%`;
}

/** A difference: signed, % figures in points, others with their share of A. */
export function difference(d: number | null, unit: Unit, of: number | null): string {
  if (d === null) return '–';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const abs = Math.abs(d);
  if (unit === '%') {
    const n = Math.round(abs);
    return n === 0 ? '0 points' : `${sign}${n} point${n === 1 ? '' : 's'}`;
  }
  const share = of ? ` (${sign}${Math.round((abs / of) * 100)}%)` : '';
  return `${sign}${value(abs, unit)}${share}`;
}

/** The difference in words: lower is better for every figure. */
function inWords(p: PairFigure): string {
  if (p.delta === null) return 'no paired rounds';
  const d = difference(Math.abs(p.delta), p.unit, p.aMedian).replaceAll('+', '');
  const roundedZero =
    p.unit === '%' ? Math.round(Math.abs(p.delta)) === 0 : Math.abs(p.delta) < 0.5;
  if (roundedZero) return 'the same';
  const way = p.delta < 0 ? 'lower (better)' : 'higher (worse)';
  const agree =
    p.spread && p.rounds > 1
      ? p.spread[0] > 0 || p.spread[1] < 0
        ? `, in all ${p.rounds} rounds`
        : `; the rounds ranged from ${difference(p.spread[0], p.unit, null)} to ${difference(p.spread[1], p.unit, null)}`
      : '';
  return `${d} ${way}${agree}`;
}

const label = (key: FigureKey): string => FIGURES.find((f) => f.key === key)?.label ?? key;

/** The findings: Chromium at the highest rate, each pair, every figure. */
function findings(s: Summary): string[] {
  const rates = s.pairs.filter((p) => p.engine === 'chromium').map((p) => p.rate);
  const out: string[] = [];
  if (rates.length === 0) {
    out.push('- No Chromium results: nothing to report.');
    return out;
  }
  const rate = Math.max(...rates);
  const heavier = new Set(rates).size > 1 ? ', the heavier load' : '';
  out.push(
    `Chromium at ${rate} kHz${heavier}. Medians over the rounds; each difference is the Isoloop side against its native build, round by round.`,
  );
  const seen = new Set<string>();
  for (const p of s.pairs) {
    if (p.engine !== 'chromium' || p.rate !== rate) continue;
    const key = `${p.a}=${p.b}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push('', `**${name(p.b)} against ${name(p.a)}:**`, '');
    }
    out.push(
      `- ${label(p.figure)}: ${value(p.bMedian, p.unit)} against ${value(p.aMedian, p.unit)}, ${inWords(p)}.`,
    );
  }
  if (s.stopped.length > 0) {
    out.push(
      '',
      `- ${s.stopped.length} page${s.stopped.length === 1 ? '' : 's'} stopped before a result; ${s.stopped.length === 1 ? "it's" : "they're"} listed under the details and left out of every figure.`,
    );
  }
  return out;
}

/**
 * The CPU as a class, never its brand or model (those stay in environment.json):
 * `An x64 CPU`, `An arm64 CPU`, else `A CPU`.
 */
export function cpuClass(cpu: string): string {
  if (/\b(AMD|Intel)\b/i.test(cpu)) return 'An x64 CPU';
  if (/\b(Apple|ARM|Neoverse|Ampere|Graviton|Cortex)\b/i.test(cpu)) return 'An arm64 CPU';
  return 'A CPU';
}

function measuredOn(env: Environment): string {
  const m = env.machine;
  const browsers = Object.entries(env.browsers)
    .toSorted(([a], [b]) => engineOrder(a, b))
    .map(([e, v]) => `${engineName(e)} ${v}`)
    .join(', ');
  const parts = [
    `${cpuClass(m.cpu)}, CPUs ${m.cpus || '(all)'}${m.clock ? ` at ${m.clock}` : ''}, ${m.memoryGb} GB`,
    m.os,
    m.image ? `in \`${m.image}\`` : '',
    `Node ${m.node}`,
  ].filter(Boolean);
  return [
    `- **Isoloop:** \`@isoloop/*@${env.version}\`, React ${env.packages['react'] ?? '?'}, Playwright ${env.packages['@playwright/test'] ?? '?'}.`,
    `- **Machine:** ${parts.join('; ')}.`,
    `- **Browsers:** ${browsers}.`,
    `- **Run:** started ${env.started}, ${env.rounds} interleaved round${env.rounds === 1 ? '' : 's'} per configuration.`,
    ...(env.adaptedFor ? [`- **Adapted for this release:** ${env.adaptedFor}`] : []),
  ].join('\n');
}

function table(rows: PairFigure[]): string[] {
  const out = ['| Figure | A | B | Δ (B − A) |', '| --- | --- | --- | --- |'];
  for (const p of rows) {
    out.push(
      `| ${label(p.figure)} | ${value(p.aMedian, p.unit)} | ${value(p.bMedian, p.unit)} | ${difference(p.delta, p.unit, p.aMedian)} |`,
    );
  }
  return out;
}

const groups = (
  s: Summary,
): { engine: string; rate: number; a: string; b: string; rows: PairFigure[] }[] => {
  const out: { engine: string; rate: number; a: string; b: string; rows: PairFigure[] }[] = [];
  for (const p of s.pairs) {
    let g = out.find(
      (x) => x.engine === p.engine && x.rate === p.rate && x.a === p.a && x.b === p.b,
    );
    if (!g) {
      g = { engine: p.engine, rate: p.rate, a: p.a, b: p.b, rows: [] };
      out.push(g);
    }
    g.rows.push(p);
  }
  return out;
};

/** summary.md. `command` is how to run this again. */
export function markdown(s: Summary, command: string): string {
  const out: string[] = [
    `# plant-bench on Isoloop ${s.version}`,
    '',
    measuredOn(s.environment),
    '',
  ];
  out.push('## What we found', '', ...findings(s), '');

  out.push(
    '## The figures',
    '',
    'Lower is better. A is the native build, B the Isoloop placement; Δ is B − A within each round, its median over the rounds.',
    '',
  );
  let heading = '';
  for (const g of groups(s)) {
    const h = `${engineName(g.engine)}, ${g.rate} kHz`;
    if (h !== heading) {
      out.push(`### ${h}`, '');
      heading = h;
    }
    out.push(`**${name(g.a)} (A) and ${name(g.b)} (B)**`, '', ...table(g.rows), '');
  }

  out.push('## Details', '');
  out.push('<details>', '<summary>Each Δ’s spread over the rounds</summary>', '');
  for (const g of groups(s)) {
    out.push(
      `**${engineName(g.engine)}, ${g.rate} kHz: ${name(g.a)} (A) and ${name(g.b)} (B)**`,
      '',
      '| Figure | Rounds | Lowest Δ | Highest Δ |',
      '| --- | --- | --- | --- |',
      ...g.rows.map(
        (p) =>
          `| ${label(p.figure)} | ${p.rounds} | ${difference(p.spread?.[0] ?? null, p.unit, null)} | ${difference(p.spread?.[1] ?? null, p.unit, null)} |`,
      ),
      '',
    );
  }
  out.push('</details>', '');

  if (s.extras.length > 0) {
    out.push('<details>', '<summary>Measured alongside, without a pair</summary>', '');
    const configs = [...new Set(s.extras.map((e) => e.config))];
    const where = [...new Set(s.extras.map((e) => `${e.engine}:${e.rate}`))];
    out.push(
      `| | ${where
        .map((w) => {
          const [e = '', r = ''] = w.split(':');
          return `${engineName(e)}, ${r} kHz`;
        })
        .join(' | ')} |`,
      `| --- |${where.map(() => ' --- |').join('')}`,
    );
    for (const config of configs) {
      for (const f of FIGURES) {
        const cells = where.map((w) => {
          const [e, r] = w.split(':');
          const x = s.extras.find(
            (y) =>
              y.config === config && y.engine === e && String(y.rate) === r && y.figure === f.key,
          );
          return value(x?.median ?? null, f.unit);
        });
        if (cells.every((c) => c === '–')) continue;
        out.push(`| ${name(config)}: ${f.label} | ${cells.join(' | ')} |`);
      }
    }
    out.push('', '</details>', '');
  }

  out.push('<details>', `<summary>Stopped pages (${s.stopped.length})</summary>`, '');
  out.push(
    ...(s.stopped.length === 0
      ? ['None.']
      : s.stopped.map(
          (x) =>
            `- ${engineName(x.engine)}, ${x.rate} kHz, round ${x.round}, ${name(x.config)}: ${x.why}.`,
        )),
    '',
    '</details>',
    '',
  );

  out.push(
    '<details>',
    '<summary>Method, and how to run it again</summary>',
    '',
    'Each configuration runs one page at a time, interleaved: round 1 runs every configuration once, then round 2, so drift on the machine falls on both sides of a pair. On each page: 6 s of warm-up, a 10 s window with no input (main-thread busy is CDP `TaskDuration`, all-thread CPU is the renderer’s, both as a share of one core), 5 keystrokes into a widget’s filter (typing), memory after a forced GC in the page and every worker (renderer PSS, Chromium on Linux), then a 3 s block of one machine’s gauges (recovery: until every affected widget shows data from after the click). Firefox and WebKit report the timings only. Raw results are the JSON files beside this one, one per page; `run.json` and `environment.json` hold the arguments, the machine and the versions.',
    '',
    '```bash',
    command,
    '```',
    '',
    '</details>',
    '',
  );
  return `${out.join('\n')}\n`;
}
