// /benchmarks/'s data (ADR 0002, amended 2026-11-24): the runs listed in
// content/benchmarks.json, oldest first, each a `summary.json` in plant-bench's
// `Summary` shape (apps/bench/plant/summary.ts), validated here. The last run is
// the latest; the history shows once there are two. Swapping the figures to a
// new run (a plant-bench release) is a change to content/benchmarks.json only.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';

/** The matrix's figures, in the page's order (plant-bench README, rule 6). */
export const FIGURE_KEYS = [
  'mainThreadCpuPct',
  'rendererCpuPct',
  'typingMedianMs',
  'firstDataMs',
  'allWidgetsMs',
  'recoveryMs',
  'rendererPssGcMb',
] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];

const https = z.url({ protocol: /^https$/, error: 'an https URL' });
const num = z.number().nullable();

const manifestSchema = z.strictObject({
  runs: z
    .array(
      z.strictObject({
        /** The build measured: `plant` before plant-bench, `plant-bench` from 0.1.0 on. */
        name: z.string().min(1),
        /** The run's summary.json, relative to the repo root. */
        summary: z.string().regex(/summary\.json$/, 'a summary.json path'),
        /**
         * Engines left off the site, their figures and browser version both,
         * while a figure is under investigation; the raw results keep them.
         */
        withhold: z.array(z.string().min(1)).optional(),
        links: z.strictObject({
          /** The run's summary.md on GitHub. */
          summary: https,
          /** The folder with the raw results on GitHub. */
          results: https,
          /** The run's environment.json on GitHub: the exact machine, CPU model included, and versions. */
          environment: https,
        }),
      }),
    )
    .min(1),
});

const summarySchema = z.object({
  version: z.string().min(1),
  environment: z.object({
    version: z.string(),
    packages: z.record(z.string(), z.string()),
    browsers: z.record(z.string(), z.string()),
    machine: z.object({
      /** The CPU model. Kept in the raw results; the page names only the architecture. */
      cpu: z.string(),
      /** The architecture, where the run recorded it; else read from `cpu` (archOf). */
      arch: z.enum(['x64', 'arm64']).optional(),
      cpus: z.string(),
      clock: z.string(),
      memoryGb: z.number(),
      os: z.string(),
      node: z.string(),
      image: z.string(),
    }),
    started: z.iso.datetime(),
    rounds: z.number().int().positive(),
    adaptedFor: z.string().optional(),
  }),
  pairs: z.array(
    z.object({
      engine: z.string(),
      rate: z.number(),
      a: z.string(),
      b: z.string(),
      figure: z.enum(FIGURE_KEYS),
      unit: z.enum(['%', 'ms', 'MB']),
      aMedian: num,
      bMedian: num,
      delta: num,
      spread: z.tuple([z.number(), z.number()]).nullable(),
      rounds: z.number().int(),
    }),
  ),
  extras: z.array(z.unknown()),
  stopped: z.array(z.unknown()),
});

export type Summary = z.infer<typeof summarySchema>;
export type PairFigure = Summary['pairs'][number];

export interface BenchRun {
  name: string;
  version: string;
  /** The day the run started, `YYYY-MM-DD`. */
  date: string;
  environment: Summary['environment'];
  pairs: PairFigure[];
  links: { summary: string; results: string; environment: string };
}

export interface Benchmarks {
  /** Oldest first; the last is the latest. */
  runs: BenchRun[];
  latest: BenchRun;
}

function parse<T>(schema: z.ZodType<T>, raw: unknown, where: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(top level)'}: ${i.message}`)
      .join('\n');
    throw new Error(`${where} is invalid:\n${issues}`);
  }
  return parsed.data;
}

function readJson(file: string, where: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${where}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}

/** Reads content/benchmarks.json and every run it lists. */
export function loadBenchmarks(manifest: string, repoRoot: string): Benchmarks {
  const where = relative(repoRoot, manifest);
  const m = parse(manifestSchema, readJson(manifest, where), where);
  const runs = m.runs.map((r): BenchRun => {
    const file = join(repoRoot, r.summary);
    const s = parse(summarySchema, readJson(file, r.summary), r.summary);
    const shown = (engine: string): boolean => !r.withhold?.includes(engine);
    return {
      name: r.name,
      version: s.version,
      date: s.environment.started.slice(0, 10),
      environment: {
        ...s.environment,
        browsers: Object.fromEntries(
          Object.entries(s.environment.browsers).filter(([e]) => shown(e)),
        ),
      },
      pairs: s.pairs.filter((p) => shown(p.engine)),
      links: r.links,
    };
  });
  return { runs, latest: runs.at(-1)! };
}

/**
 * The CPU's architecture, for the page, which names no CPU brand or model: the
 * run's own `arch`, else read from the model string. Undefined when neither says.
 */
export function archOf(machine: {
  cpu: string;
  arch?: 'x64' | 'arm64' | undefined;
}): 'x64' | 'arm64' | undefined {
  if (machine.arch) return machine.arch;
  if (/\b(AMD|Intel)\b/i.test(machine.cpu)) return 'x64';
  if (/\b(Apple|ARM|Neoverse|Ampere|Graviton|Cortex)\b/i.test(machine.cpu)) return 'arm64';
  return undefined;
}

/** The CPUs a run was allowed, counted: `2,4,6,8` and `2-5` are 4. */
export function cpuCount(cpus: string): number {
  return cpus
    .split(',')
    .filter(Boolean)
    .reduce((n, part) => {
      const [lo = '', hi = lo] = part.split('-');
      return n + Number(hi) - Number(lo) + 1;
    }, 0);
}

/**
 * The rounds disagree on the sign of Δ: the lowest round is below zero and the
 * highest above it. Such a Δ is inside the run's own spread, and the page says so.
 */
export function withinSpread(p: Pick<PairFigure, 'spread'>): boolean {
  return p.spread !== null && p.spread[0] < 0 && p.spread[1] > 0;
}

/**
 * Between two runs, a figure's Δ changed beyond the runs' own spreads: their
 * ranges don't overlap (decision 7: the page flags those).
 */
export function changedBeyondSpread(
  before: Pick<PairFigure, 'spread'>,
  after: Pick<PairFigure, 'spread'>,
): boolean {
  if (!before.spread || !after.spread) return false;
  return before.spread[1] < after.spread[0] || after.spread[1] < before.spread[0];
}

/** One figure of one pair in a run, or a build error naming what's missing (the home page's charts). */
export function figure(
  run: Pick<BenchRun, 'pairs'>,
  q: Pick<PairFigure, 'engine' | 'rate' | 'a' | 'b' | 'figure'>,
): PairFigure & { aMedian: number; bMedian: number; delta: number } {
  const f = run.pairs.find(
    (p) =>
      p.engine === q.engine &&
      p.rate === q.rate &&
      p.a === q.a &&
      p.b === q.b &&
      p.figure === q.figure,
  );
  if (!f || f.aMedian === null || f.bMedian === null || f.delta === null) {
    throw new Error(
      `the latest benchmark run has no ${q.figure} for ${q.a} against ${q.b}, ${q.engine} at ${q.rate} kHz`,
    );
  }
  return { ...f, aMedian: f.aMedian, bMedian: f.bMedian, delta: f.delta };
}
