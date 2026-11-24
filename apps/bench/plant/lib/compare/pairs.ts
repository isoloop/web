// The head-to-head comparison in one command, for any dashboard: pairs of
// configurations (a native build against an Isoloop placement), run
// interleaved for N rounds, one page at a time, by the app's comparison spec.
// It writes each run's JSON (the spec does) and <out>/summary.md with the
// paired gaps (B minus A, per round) and their spread.
//
// The app supplies what differs (`PairsApp`): its folder, its Playwright
// project per engine, its load knob (the plant's vibration rate, `--rates`)
// and its figures. This module owns the rest: the command line, the rounds,
// the environment the spec reads, run.json and the summary.
//
// Arguments (durations in seconds):
//   --pair A=B      a pair; repeat it. A is the baseline, B the Isoloop side.
//   --extra C       a configuration measured alongside, without a pair; repeatable.
//   --<knob>        the app's load knob, comma-separated (e.g. --rates 1,5).
//   --rounds        rounds; each runs every configuration once (default 5).
//   --hold          seconds after navigation for the second memory reading
//                   (default 600; 0 skips it).
//   --warm, --window  warm-up and measuring window (defaults 6 and 10).
//   --engines       chromium, firefox, webkit (default chromium,firefox).
//   --out           results folder, relative to the app (default comparison/results).
//   --summary-only  rebuild summary.md from the JSON already in --out.
//
// What the spec reads: COMPARE_OUT, COMPARE_CONFIGS, the knob's variable,
// COMPARE_RUNS, COMPARE_HOLD_MS, COMPARE_WARM_MS and COMPARE_WINDOW_MS.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { cellOr, stoppedLabel } from './stopped.ts';

export type KnobValue = number | string;

/** The app's load knob: what each configuration is run at. */
export interface Knob {
  /** The command-line option, e.g. `rates`. It's also the key in run.json's `args`. */
  option: string;
  /** The variable the spec reads it from, e.g. `COMPARE_RATES`. */
  env: string;
  /** The option's default, e.g. `1`. */
  default: string;
  /** The result files' field that holds the value, e.g. `rate`. */
  field: string;
  /** How a section heading names a value: `1 kHz`, `Normal`. */
  label: (value: KnobValue) => string;
  /** The sections' order. Without it, numbers ascend and anything else sorts by name. */
  order?: readonly KnobValue[];
}

/** One row of the summary: a numeric field of the result files. */
export interface Figure {
  key: string;
  label: string;
  unit: string;
  digits?: number;
}

export interface PairsApp {
  /** The summary's heading, e.g. `Plant dashboard, head-to-head`. */
  title: string;
  /** The app's folder: Playwright runs there, and `--out` is relative to it. */
  dir: string;
  /** The comparison spec's Playwright project per engine. */
  projects: Readonly<Record<string, string>>;
  knob: Knob;
  /** The figures, in the summary's order. */
  figures: readonly Figure[];
  /** summary.md's text, in place of `summarize` (plant-bench writes its own, `summary.ts`). */
  summary?: (results: readonly Result[], selection: Selection, meta: unknown) => string;
}

/** One result file, as the summary reads it. */
export interface Result {
  engine: string;
  build: string;
  placement: string | null;
  /** The knob's value. */
  value: KnobValue;
  stopped: boolean;
  stage?: string | undefined;
  error?: string | undefined;
  figures: Readonly<Record<string, number | null | undefined>>;
  /** The round, from the file name's `-runN`. */
  run: number;
  /** `build` or `build:placement`, as `--pair` names it. */
  key: string;
}

export interface Selection {
  pairs: readonly { a: string; b: string }[];
  extras: readonly string[];
}

/** Parses the command line, runs the rounds (unless `--summary-only`) and writes summary.md. */
export function runPairs(app: PairsApp, argv: string[] = process.argv.slice(2)): void {
  const { values: args } = parseArgs({
    args: argv,
    options: {
      pair: { type: 'string', multiple: true, default: [] },
      extra: { type: 'string', multiple: true, default: [] },
      [app.knob.option]: { type: 'string', default: app.knob.default },
      rounds: { type: 'string', default: '5' },
      hold: { type: 'string', default: '600' },
      warm: { type: 'string', default: '6' },
      window: { type: 'string', default: '10' },
      engines: { type: 'string', default: 'chromium,firefox' },
      out: { type: 'string', default: 'comparison/results' },
      'summary-only': { type: 'boolean', default: false },
    },
  });
  const str = (k: string): string => {
    const v = args[k];
    if (typeof v !== 'string') throw new Error(`--${k} is missing`);
    return v;
  };
  const list = (k: string): string[] => {
    const v = args[k];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };

  const OUT = resolve(app.dir, str('out'));
  const pairs = list('pair').map((p) => {
    const [a, b] = p.split('=');
    if (!a || !b) throw new Error(`--pair wants A=B, got ${p}`);
    return { a, b };
  });
  const extras = list('extra');
  const configs = [...new Set([...pairs.flatMap((p) => [p.a, p.b]), ...extras])];
  const rounds = Number(str('rounds'));
  const engines = str('engines').split(',');

  if (!args['summary-only']) {
    if (configs.length === 0) throw new Error('give at least one --pair or --extra');
    mkdirSync(OUT, { recursive: true });
    const env = {
      ...process.env,
      COMPARE_OUT: OUT,
      COMPARE_CONFIGS: configs.join(','),
      [app.knob.env]: str(app.knob.option),
      COMPARE_RUNS: String(rounds),
      COMPARE_HOLD_MS: String(Number(str('hold')) * 1000),
      COMPARE_WARM_MS: String(Number(str('warm')) * 1000),
      COMPARE_WINDOW_MS: String(Number(str('window')) * 1000),
    };
    writeFileSync(
      join(OUT, 'run.json'),
      `${JSON.stringify({ started: new Date().toISOString(), args, configs, cpus: cpus() }, null, 2)}\n`,
    );
    for (const engine of engines) {
      const project = app.projects[engine];
      if (!project) throw new Error(`unknown engine ${engine}`);
      console.log(`\n== ${engine}: ${configs.length} configurations × ${rounds} rounds`);
      // A stopped page is written as a result, so the run goes on either way.
      spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', `--project=${project}`, '--workers=1', '--reporter=list'],
        { cwd: app.dir, env, stdio: 'inherit' },
      );
    }
  }

  let meta: unknown = null;
  try {
    meta = JSON.parse(readFileSync(join(OUT, 'run.json'), 'utf8'));
  } catch {
    // a summary of results copied in from elsewhere
  }
  const results = readResults(app, OUT);
  const md = app.summary
    ? app.summary(results, { pairs, extras }, meta)
    : summarize(app, results, { pairs, extras }, meta);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'summary.md'), md);
  console.log(md);
}

function cpus(): string {
  try {
    return (
      readFileSync('/proc/self/status', 'utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1] ?? ''
    );
  } catch {
    return '';
  }
}

const N = z.number().nullable().optional();

/** Every result file in `<out>/<engine>/`, checked against the app's figures. */
export function readResults(app: PairsApp, out: string): Result[] {
  const schema = z.object({
    engine: z.string(),
    build: z.string(),
    placement: z.string().nullable(),
    [app.knob.field]: z.union([z.number(), z.string()]),
    stopped: z.boolean(),
    stage: z.string().optional(),
    error: z.string().optional(),
    ...Object.fromEntries(app.figures.map((f) => [f.key, N])),
  });
  const results: Result[] = [];
  for (const dir of existsSync(out) ? readdirSync(out, { withFileTypes: true }) : []) {
    if (!dir.isDirectory()) continue;
    for (const f of readdirSync(join(out, dir.name))) {
      if (!f.endsWith('.json')) continue;
      const raw: Record<string, unknown> = schema.parse(
        JSON.parse(readFileSync(join(out, dir.name, f), 'utf8')),
      );
      results.push(toResult(app, raw, Number(/-run(\d+)\.json$/.exec(f)?.[1] ?? 1)));
    }
  }
  return results;
}

function toResult(app: PairsApp, raw: Record<string, unknown>, run: number): Result {
  const s = (k: string): string | undefined => {
    const v = raw[k];
    return typeof v === 'string' ? v : undefined;
  };
  const build = s('build') ?? '';
  const placement = s('placement') ?? null;
  const value = raw[app.knob.field];
  return {
    engine: s('engine') ?? '',
    build,
    placement,
    value: typeof value === 'number' ? value : String(value),
    stopped: raw['stopped'] === true,
    stage: s('stage'),
    error: s('error'),
    figures: Object.fromEntries(
      app.figures.map((f) => {
        const v = raw[f.key];
        return [f.key, typeof v === 'number' ? v : null];
      }),
    ),
    run,
    key: placement ? `${build}:${placement}` : build,
  };
}

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? null) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

// Gaps in a % figure are percentage points, so they don't read as the Gap % column.
const fmt = (x: number | null, m: Figure, sign = false): string =>
  x === null
    ? '–'
    : `${sign && x > 0 ? '+' : ''}${x.toFixed(m.digits ?? 0)}${sign && m.unit === '%' ? ' pp' : m.unit}`;
const num = (r: Result, k: string): number | null => r.figures[k] ?? null;

function knobOrder(knob: Knob, values: KnobValue[]): KnobValue[] {
  const { order } = knob;
  if (order) return values.toSorted((a, b) => order.indexOf(a) - order.indexOf(b));
  return values.toSorted((a, b) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)),
  );
}

/** summary.md: per engine and knob value, each pair's gaps and the extras' medians. */
export function summarize(
  app: PairsApp,
  results: readonly Result[],
  { pairs, extras: extraKeys }: Selection,
  meta: unknown,
): string {
  const out: string[] = [`# ${app.title}`, ''];
  if (meta) out.push('Run settings:', '', '```json', JSON.stringify(meta, null, 2), '```', '');
  out.push(
    'Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.',
    '',
  );

  for (const engine of [...new Set(results.map((r) => r.engine))].toSorted()) {
    for (const value of knobOrder(app.knob, [...new Set(results.map((r) => r.value))])) {
      const here = results.filter((r) => r.engine === engine && r.value === value);
      if (here.length === 0) continue;
      out.push(`## ${engine}, ${app.knob.label(value)}`, '');
      for (const { a, b } of pairs) {
        const A = here.filter((r) => r.key === a);
        const B = here.filter((r) => r.key === b);
        if (A.length === 0 && B.length === 0) continue;
        const okA = A.filter((r) => !r.stopped);
        const okB = B.filter((r) => !r.stopped);
        out.push(
          `### ${a} (A) vs ${b} (B)`,
          '',
          `Rounds: A ${okA.length}/${A.length} ran, B ${okB.length}/${B.length} ran.`,
          '',
          ...[...A, ...B]
            .filter((r) => r.stopped)
            .map((r) => `- Round ${r.run}, ${r.key}: ${stoppedLabel(r)}.`),
          ...([...A, ...B].some((r) => r.stopped) ? [''] : []),
          '| Figure | A | B | Gap (B − A) | Gap % | Gap spread |',
          '| --- | --- | --- | --- | --- | --- |',
        );
        for (const m of app.figures) {
          const ma = median(okA.flatMap((r) => num(r, m.key) ?? []));
          const mb = median(okB.flatMap((r) => num(r, m.key) ?? []));
          if (ma === null && mb === null && okA.length + okB.length > 0) continue;
          const gaps: number[] = [];
          for (const ra of okA) {
            const rb = okB.find((r) => r.run === ra.run);
            const x = num(ra, m.key);
            const y = rb ? num(rb, m.key) : null;
            if (x !== null && y !== null) gaps.push(y - x);
          }
          const g = median(gaps);
          const pct = g !== null && ma ? `${g > 0 ? '+' : ''}${Math.round((g / ma) * 100)}%` : '–';
          const spread =
            gaps.length > 1
              ? `${fmt(Math.min(...gaps), m, true)} to ${fmt(Math.max(...gaps), m, true)}`
              : '–';
          out.push(
            `| ${m.label} | ${cellOr(fmt(ma, m), A)} | ${cellOr(fmt(mb, m), B)} | ${fmt(g, m, true)} | ${pct} | ${spread} |`,
          );
        }
        out.push('');
      }
      const extras = extraKeys.filter((c) => here.some((r) => r.key === c));
      if (extras.length > 0) {
        out.push(
          '### Measured alongside',
          '',
          `| Figure | ${extras.join(' | ')} |`,
          `| --- |${extras.map(() => ' --- |').join('')}`,
        );
        for (const m of app.figures) {
          const cells = extras.map((c) =>
            cellOr(
              fmt(
                median(
                  here.filter((r) => r.key === c && !r.stopped).flatMap((r) => num(r, m.key) ?? []),
                ),
                m,
              ),
              here.filter((r) => r.key === c),
            ),
          );
          if (cells.every((c) => c === '–')) continue;
          out.push(`| ${m.label} | ${cells.join(' | ')} |`);
        }
        out.push('');
      }
    }
  }
  return `${out.join('\n')}\n`;
}
