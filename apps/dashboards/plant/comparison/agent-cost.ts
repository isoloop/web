// The agent-call cost (M4a task 13): turns the runs `e2e/agent-cost.spec.ts`
// wrote into `summary.md`. Usage: `node comparison/agent-cost.ts <dir>`.
//
// Each run is one page load (one engine, one page, one round) and holds, per
// mode (sequential, or several calls in flight), the calls' round trips,
// their synchronous part, and on Chromium the main thread's time per call.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export type ModeResult = {
  calls: number;
  concurrency: number;
  rttMs: number[];
  /** Per pair: ms per call to issue a burst of calls back to back, until each `kernel.request(...)` returned. */
  issueMsPerCall: number[];
  wallMs: number;
  /** Main-thread time per call (CDP TaskDuration over the calls, less the page's own rate), ms; null off Chromium. */
  mainMsPerCall: number | null;
};

export type Run = {
  engine: string;
  page: 'idle' | 'plant-5khz';
  round: number;
  library: string;
  modes: ModeResult[];
};

export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = xs.toSorted((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
  return s[i] ?? Number.NaN;
}

const median = (xs: readonly number[]): number => quantile(xs, 0.5);

/** The median of the per-round figures, with the lowest and highest round. */
export type Spread = { median: number; low: number; high: number; rounds: number };

export function spread(perRound: readonly number[]): Spread {
  return {
    median: median(perRound),
    low: Math.min(...perRound),
    high: Math.max(...perRound),
    rounds: perRound.length,
  };
}

export type Row = {
  engine: string;
  page: string;
  concurrency: number;
  rttMedian: Spread;
  rttP95: Spread;
  rttMean: Spread;
  issue: Spread;
  mainPerCall: Spread | null;
  callsPerSec: Spread;
};

export function rows(runs: readonly Run[]): Row[] {
  const keys = new Map<string, Run[]>();
  for (const r of runs) {
    for (const m of r.modes) {
      const k = `${r.engine}|${r.page}|${m.concurrency}`;
      keys.set(k, [...(keys.get(k) ?? []), { ...r, modes: [m] }]);
    }
  }
  return [...keys.entries()].map(([k, rs]) => {
    const [engine = '', page = '', c = '1'] = k.split('|');
    const ms = rs.map((r) => r.modes[0]).filter((m): m is ModeResult => m !== undefined);
    const main = ms.map((m) => m.mainMsPerCall).filter((x): x is number => x !== null);
    return {
      engine,
      page,
      concurrency: Number(c),
      rttMedian: spread(ms.map((m) => median(m.rttMs))),
      rttP95: spread(ms.map((m) => quantile(m.rttMs, 0.95))),
      rttMean: spread(ms.map((m) => (m.wallMs / m.calls) * m.concurrency)),
      issue: spread(ms.map((m) => median(m.issueMsPerCall))),
      mainPerCall: main.length === ms.length && main.length > 0 ? spread(main) : null,
      callsPerSec: spread(ms.map((m) => (m.calls / m.wallMs) * 1000)),
    };
  });
}

const f = (x: number, d: number): string => x.toFixed(d);
const cell = (s: Spread | null, d: number): string =>
  s === null ? '–' : `${f(s.median, d)} (${f(s.low, d)} to ${f(s.high, d)})`;

export function markdown(runs: readonly Run[]): string {
  const rs = rows(runs);
  const libs = [...new Set(runs.map((r) => r.library))].join(', ');
  const lines = [
    '# Agent-call cost (M4a task 13)',
    '',
    `Library: ${libs}. ${new Set(runs.map((r) => r.round)).size} rounds; each cell is the median of the per-round figures, with the lowest and highest round in brackets.`,
    '',
    '| Engine | Page | In flight | Round trip, median (ms) | Round trip, p95 (ms) | Round trip, mean from wall time (ms) | Issuing one call (ms) | Main thread per call (ms) | Calls/s |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rs.map(
      (r) =>
        `| ${r.engine} | ${r.page} | ${r.concurrency} | ${cell(r.rttMedian, 2)} | ${cell(r.rttP95, 2)} | ${cell(r.rttMean, 2)} | ${cell(r.issue, 3)} | ${cell(r.mainPerCall, 3)} | ${cell(r.callsPerSec, 0)} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

const MODE = z.object({
  calls: z.number(),
  concurrency: z.number(),
  rttMs: z.array(z.number()),
  issueMsPerCall: z.array(z.number()),
  wallMs: z.number(),
  mainMsPerCall: z.number().nullable(),
});
const RUN = z.object({
  engine: z.string(),
  page: z.enum(['idle', 'plant-5khz']),
  round: z.number(),
  library: z.string(),
  modes: z.array(MODE),
});

export function readRuns(dir: string): Run[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .toSorted()
    .map((n) => RUN.parse(JSON.parse(readFileSync(join(dir, n), 'utf8'))));
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error('usage: node comparison/agent-cost.ts <dir>');
  writeFileSync(join(dir, 'summary.md'), markdown(readRuns(dir)));
  console.log(markdown(readRuns(dir)));
}
