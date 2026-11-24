// pnpm summary <results dir>: summary.md and summary.json from a run's JSON
// files.
//
// - summary.md: the findings (findings.md, written by hand), then a table per
//   tier, then the balancer scenario, in operations per second.
// - summary.json: the same figures as data, for the site's section on
//   /benchmarks/ (docs/plans/js-bench.md, decision 5). Its shape is `Summary`
//   below; the site's build validates it.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PageResult, Placement } from '../src/page/types.ts';
import type { Tier } from '../src/workloads/index.ts';
import { placementsFor } from './matrix.ts';
import { readJson } from './read.ts';

export interface RunFile {
  engine: string;
  browserVersion: string;
  round: number;
  job: {
    key: string;
    tier: Tier | 'scenario';
    n: number;
    placement: Placement;
    warmMs: number;
    windowMs: number;
  };
  state: 'done' | 'error';
  error?: string;
  result?: PageResult;
}

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = xs.toSorted((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
export const fmt = (x: number | null): string =>
  x === null ? '—' : x >= 100 ? Math.round(x).toLocaleString('en') : x.toFixed(1);
// Results files store ops/min; the summary shows ops/s.
const ratio = (x: number | null, y: number | null): string =>
  x === null || y === null || y === 0 ? '—' : `${(x / y).toFixed(2)}×`;

export function load(dir: string): RunFile[] {
  const out: RunFile[] = [];
  for (const engine of readdirSync(dir)) {
    const d = resolve(dir, engine);
    if (!statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d))
      if (f.endsWith('.json')) out.push(readJson<RunFile>(resolve(d, f)));
  }
  return out;
}

/** One workload at one n in one placement: medians over the rounds, all copies together. */
export interface WorkloadFigure {
  workload: string;
  tier: Tier;
  /** Copies at once: 1 or 4. */
  n: number;
  placement: Placement;
  /** Rounds that finished. */
  rounds: number;
  /** Operations per second, all copies together: the median over rounds, and the lowest and highest round. */
  opsPerSec: number | null;
  min: number | null;
  max: number | null;
  /** One op's time, the median over every copy's p50, in µs. */
  opP50Us: number | null;
  /** How late the page's 100 ms timer fired, p95, the median over rounds, in ms. */
  latenessP95Ms: number | null;
  /** Balancer moves inside the window, per round; empty for the other placements. */
  moves: number[];
}

/** The balancer scenario: 2 heavy copies and 6 cheap ones at once. */
export interface Scenario {
  placements: Placement[];
  /** Per copy, operations per second in each placement (the median over rounds). */
  copies: { id: string; workload: string; opsPerSec: Partial<Record<Placement, number | null>> }[];
  /** The workers (pools) in use at the end, per placement. */
  workers: Partial<Record<Placement, number | null>>;
  latenessP95Ms: Partial<Record<Placement, number | null>>;
}

export interface EngineSummary {
  engine: string;
  /** The browser build Playwright ran, e.g. `158.0.8127.18`. */
  browser: string;
  workloads: WorkloadFigure[];
  scenario: Scenario | null;
  /** Copies whose checksum differed between placements, as `<workload>-n<N> <copy>`. */
  checksumMismatches: string[];
}

/** A run's figures, as summary.json holds them. */
export interface Summary {
  /** The `@isoloop/*` version measured. */
  version: string;
  /** The day the run started, `YYYY-MM-DD`. */
  date: string;
  /** The machine's id (apps/bench/machines.md), e.g. `bench-machine-1`. */
  machine: string;
  /** The CPU profile: `base` for the published runs. */
  profile: string;
  /** The cores the run was allowed, and their clock, e.g. `2.0 GHz`. */
  cores: number | null;
  clock: string | null;
  rounds: number;
  /** The balancer's cap. */
  maxWorkers: number;
  engines: EngineSummary[];
  /** Runs that stopped: the page errored or timed out. */
  failed: number;
}

export interface RunJson {
  env: {
    machine?: string;
    cpu: string | null;
    mhz: { min: number; max: number } | null;
    cpusetEffective: string | null;
    cpuMax: string | null;
    isoloop: Record<string, string | null>;
    git: string | null;
    date: string;
  };
  maxWorkers: number;
  rounds: number;
  args: { profile: string };
}

/** How many CPUs a cpuset list names: `2,4,6,8` → 4, `0-3,8` → 5. */
export function cpusetSize(list: string | null): number | null {
  if (!list) return null;
  let n = 0;
  for (const part of list.split(',')) {
    const [a, b] = part.split('-').map(Number);
    if (a === undefined || Number.isNaN(a)) return null;
    n += b === undefined ? 1 : b - a + 1;
  }
  return n;
}

/** The highest clock seen, in GHz to one decimal: 1996.4 MHz → `2.0 GHz`. */
export const clockOf = (mhz: { max: number } | null): string | null =>
  mhz ? `${(mhz.max / 1000).toFixed(1)} GHz` : null;

const ORDER: (Tier | 'scenario')[] = ['cheap', 'regular', 'heavy', 'scenario'];

export function summarize(runs: RunFile[], run: RunJson): Summary {
  const engines: EngineSummary[] = [];
  for (const engine of [...new Set(runs.map((r) => r.engine))].toSorted()) {
    const er = runs.filter((r) => r.engine === engine && r.state === 'done' && r.result);
    const workloads: WorkloadFigure[] = [];
    const checksumMismatches: string[] = [];
    const tierOf = (k: string): Tier | 'scenario' => er.find((r) => r.job.key === k)!.job.tier;
    const keys = [...new Set(er.map((r) => r.job.key))]
      .filter((k) => tierOf(k) !== 'scenario')
      .toSorted((x, y) => ORDER.indexOf(tierOf(x)) - ORDER.indexOf(tierOf(y)));
    for (const key of keys) {
      const first = er.find((r) => r.job.key === key)!;
      const tier = first.job.tier;
      if (tier === 'scenario') continue;
      const n = first.job.n;
      const sums = new Map<string, Set<number>>();
      for (const placement of placementsFor(n)) {
        const rs = er.filter((r) => r.job.key === key && r.job.placement === placement);
        if (rs.length === 0) continue;
        for (const r of rs)
          for (const c of r.result!.copies)
            if (c.result)
              (sums.get(c.id) ?? sums.set(c.id, new Set()).get(c.id)!).add(c.result.checksum);
        const totals = rs.map((r) => r.result!.totalOpsPerMin / 60);
        workloads.push({
          workload: key.replace(/-n\d+$/, ''),
          tier,
          n,
          placement,
          rounds: rs.length,
          opsPerSec: median(totals),
          min: Math.min(...totals),
          max: Math.max(...totals),
          opP50Us: median(
            rs.flatMap((r) =>
              r
                .result!.copies.map((c) => c.result?.opP50Us)
                .filter((x): x is number => typeof x === 'number'),
            ),
          ),
          latenessP95Ms: median(rs.map((r) => r.result!.lateness.p95Ms)),
          moves:
            placement === 'isoloop-balancer'
              ? rs.map((r) => r.result!.events.filter((e) => e.kind === 'move' && e.at >= 0).length)
              : [],
        });
      }
      for (const [id, set] of sums) if (set.size > 1) checksumMismatches.push(`${key} ${id}`);
    }
    const scen = er.filter((r) => r.job.tier === 'scenario');
    let scenario: Scenario | null = null;
    if (scen.length) {
      const placements = [...new Set(scen.map((r) => r.job.placement))];
      const of = (p: Placement) => scen.filter((r) => r.job.placement === p);
      const per = (f: (r: RunFile) => number) =>
        Object.fromEntries(placements.map((p) => [p, median(of(p).map(f))]));
      scenario = {
        placements,
        copies: scen[0]!.result!.copies.map((c) => ({
          id: c.id,
          workload: c.workload,
          opsPerSec: per(
            (r) => (r.result!.copies.find((x) => x.id === c.id)?.result?.opsPerMin ?? 0) / 60,
          ),
        })),
        workers: per((r) => new Set(Object.values(r.result!.poolsAtEnd)).size),
        latenessP95Ms: per((r) => r.result!.lateness.p95Ms),
      };
    }
    engines.push({
      engine,
      browser: er[0]?.browserVersion ?? '',
      workloads,
      scenario,
      checksumMismatches,
    });
  }
  return {
    version: run.env.isoloop['@isoloop/host'] ?? 'unknown',
    date: run.env.date.slice(0, 10),
    machine: run.env.machine ?? 'unnamed',
    profile: run.args.profile,
    cores: cpusetSize(run.env.cpusetEffective),
    clock: clockOf(run.env.mhz),
    rounds: run.rounds,
    maxWorkers: run.maxWorkers,
    engines,
    failed: runs.filter((r) => r.state !== 'done').length,
  };
}

export function writeSummary(dir: string): void {
  const runs = load(dir);
  const run = readJson<RunJson>(resolve(dir, 'run.json'));
  const lines: string[] = [];
  const env = run.env;
  lines.push(`# js-bench: ${run.args.profile}`, '');
  const findings = (() => {
    try {
      return readFileSync(resolve(dir, 'findings.md'), 'utf8').trim();
    } catch {
      return '_To write by hand in findings.md after looking at the tables._';
    }
  })();
  lines.push('## Findings', '', findings, '');
  lines.push(
    `${env.machine ?? 'unnamed machine'} (${env.cpu ?? 'unknown CPU'}), ${env.mhz ? `${Math.round(env.mhz.min)}–${Math.round(env.mhz.max)} MHz seen` : 'clock unknown'}, cpuset \`${env.cpusetEffective ?? '—'}\`, cpu.max \`${env.cpuMax ?? '—'}\`, balancer maxWorkers ${run.maxWorkers}. \`@isoloop/host\` ${env.isoloop['@isoloop/host']}, js-bench \`${env.git}\`, ${env.date.slice(0, 16)}Z. ${run.rounds} round(s); figures are medians over rounds, with the min–max.`,
    '',
  );

  const failed = runs.filter((r) => r.state !== 'done');
  for (const engine of [...new Set(runs.map((r) => r.engine))].toSorted()) {
    const er = runs.filter((r) => r.engine === engine && r.state === 'done' && r.result);
    lines.push(`## ${engine} ${er[0]?.browserVersion ?? ''}`, '');
    const keys = [...new Set(er.filter((r) => r.job.tier !== 'scenario').map((r) => r.job.key))];
    for (const tier of ['cheap', 'regular', 'heavy']) {
      const tk = keys.filter((k) => er.find((r) => r.job.key === k)?.job.tier === tier);
      if (tk.length === 0) continue;
      lines.push(
        `### ${tier}`,
        '',
        "Operations per second, all copies together (median, min–max). × columns: against native-main and native-worker at the same n. Lateness: the main thread's 100 ms timer, p95.",
        '',
      );
      lines.push(
        '| workload | n | placement | ops/s | min–max | × main | × worker | op p50 µs | lateness p95 ms | moves |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      );
      for (const key of tk) {
        const of = (p: Placement) => er.filter((r) => r.job.key === key && r.job.placement === p);
        const n = er.find((r) => r.job.key === key)!.job.n;
        const med = (p: Placement) => median(of(p).map((r) => r.result!.totalOpsPerMin / 60));
        const main = med('native-main');
        const worker = med('native-worker');
        const sums = new Map<string, Set<number>>();
        for (const p of placementsFor(n)) {
          const rs = of(p);
          if (rs.length === 0) continue;
          for (const r of rs)
            for (const c of r.result!.copies)
              if (c.result)
                (sums.get(c.id) ?? sums.set(c.id, new Set()).get(c.id)!).add(c.result.checksum);
          const totals = rs.map((r) => r.result!.totalOpsPerMin / 60);
          const opUs = median(
            rs.flatMap((r) =>
              r
                .result!.copies.map((c) => c.result?.opP50Us)
                .filter((x): x is number => typeof x === 'number'),
            ),
          );
          const late = median(rs.map((r) => r.result!.lateness.p95Ms));
          const moves = rs.map(
            (r) => r.result!.events.filter((e) => e.kind === 'move' && e.at >= 0).length,
          );
          lines.push(
            `| ${key.replace(/-n\d+$/, '')} | ${n} | ${p} | ${fmt(med(p))} | ${fmt(Math.min(...totals))}–${fmt(Math.max(...totals))} | ${ratio(med(p), main)} | ${ratio(med(p), worker)} | ${fmt(opUs)} | ${fmt(late)} | ${p === 'isoloop-balancer' ? moves.join(', ') : ''} |`,
          );
        }
        for (const [id, set] of sums)
          if (set.size > 1)
            lines.push(
              `| ⚠ ${key} ${id}: checksums differ across placements (${[...set].join(', ')}) | | | | | | | | | |`,
            );
      }
      lines.push('');
    }

    const scen = er.filter((r) => r.job.tier === 'scenario');
    if (scen.length) {
      lines.push(
        '### The balancer scenario: 2 heavy copies + 6 cheap',
        '',
        'Operations per second per copy (median over rounds), and the moves inside the window.',
        '',
      );
      const ids = scen[0]!.result!.copies.map((c) => c.id);
      const ps = [...new Set(scen.map((r) => r.job.placement))];
      lines.push(`| copy | ${ps.join(' | ')} |`, `| --- | ${ps.map(() => '---').join(' | ')} |`);
      for (const id of ids) {
        lines.push(
          `| ${id} | ${ps.map((p) => fmt(median(scen.filter((r) => r.job.placement === p).map((r) => (r.result!.copies.find((c) => c.id === id)?.result?.opsPerMin ?? 0) / 60)))).join(' | ')} |`,
        );
      }
      lines.push(
        `| workers at the end (pools) | ${ps.map((p) => fmt(median(scen.filter((r) => r.job.placement === p).map((r) => new Set(Object.values(r.result!.poolsAtEnd)).size)))).join(' | ')} |`,
      );
      lines.push(
        `| main-thread lateness p95 ms | ${ps.map((p) => fmt(median(scen.filter((r) => r.job.placement === p).map((r) => r.result!.lateness.p95Ms)))).join(' | ')} |`,
        '',
      );
      lines.push('<details><summary>Balancer events and pools at the end</summary>', '');
      for (const r of scen.filter((x) => x.job.placement === 'isoloop-balancer')) {
        lines.push(`Round ${r.round}: pools ${JSON.stringify(r.result!.poolsAtEnd)}`, '');
        for (const e of r.result!.events)
          lines.push(
            `- ${(e.at / 1000).toFixed(1)} s ${e.kind} ${e.id} ${JSON.stringify(e.detail)}`,
          );
        lines.push('');
      }
      lines.push('</details>', '');
    }
  }
  if (failed.length) {
    lines.push('## Runs that failed', '');
    for (const f of failed)
      lines.push(
        `- ${f.engine} r${f.round} ${f.job.key} ${f.job.placement}: ${f.error ?? 'unknown'}`,
      );
    lines.push('');
  }
  writeFileSync(resolve(dir, 'summary.md'), `${lines.join('\n')}\n`);
  writeFileSync(resolve(dir, 'summary.json'), `${JSON.stringify(summarize(runs, run), null, 2)}\n`);
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: pnpm summary <results dir>');
  writeSummary(resolve(dir));
}
