import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { cpuDelta, cpuOf, memory, pageMetrics, pssMb, processes } from 'compare/probes';

// The File processor's comparison (M3h decision 23): the same processors
// placed three ways (`own`, a worker each; `one`, all in one pool; and the
// balancer), at each mix, one page at a time, on the engine of the project
// that runs it (comparison, comparison-firefox). `one-off` is `one` with no
// balancer on the page at all: against `one` (which has a balancer watching
// every beat but never moving anything) it shows the balancer's own cost.
// It's run by `comparison/run.ts` (packages/compare), which sets the
// variables below and writes summary.md. What each figure covers:
//
// - Warm-up (`COMPARE_WARM_MS`): the generator runs from navigation; the
//   balancer measures every processor in its quarantine first (about 3 s),
//   then places it, and the files that waited meanwhile drain; 20 s covers
//   that, so the window shows the placement settled.
// - Window (`COMPARE_WINDOW_MS`): files done per second, and the latency of
//   each file from being made to its result (p50, p95); the most workers seen
//   (bus excluded, the generator's included); the balancer's moves.
// - Typing: median of 5 keystrokes into the latest results' filter, from the
//   keystroke until the table is drawn with it (`data-filter`), with the
//   files still flowing.
// - Drain: the generator stops; the time until every file made has a result
//   (up to 2 min), then the files still without one (none expected: a file
//   still waiting at 2 min, or one whose kind's processors were given up on,
//   counts too), the processors the kernel gave up on (`failed`), and the
//   files done twice (at least once is the contract, so a move can repeat
//   a file). The processors given up on are listed with their kinds and when
//   (M3j), and so are the kinds left with every processor given up: their
//   group has no member left to take its files.
// - Main-thread CPU (CDP TaskDuration), renderer CPU across all threads, and
//   renderer memory (PSS, Linux): Chromium only.
//
// Mixes: `normal` is files only; `faults` adds, in a thousand files, 2 poison
// (block their processor 2 s), 100 heavy (ten times the work) and 1 corrupt
// (crashes its processor). `faults-calm` (M3i) runs 60 s with faults, then
// stops them: its window is the last 20 s of 5 minutes calm (M3j; 60 s in
// M3i, too short for an offender's quiet window and a pack after it), so it
// shows whether the balancer packs its processors back into fewer workers.
// The rate is the same for every mix (`COMPARE_RATE`).
//
// The balancer runs with `maxWorkers=2` (M3i), what its default gives a
// 4-core machine: in a container `hardwareConcurrency` can report the host's
// threads. Every run also records (M3i) a trace, once a second, of the
// workers (M3j) and of each processor's pool, its load as the balancer, the
// beats and its own report see it (M3j), and its kind's backlog; every move
// with its reason and cost; and the spikes the balancer only noted and its
// `behind` events.
// A crash restarts the processor, and the kernel gives up on one that
// crashes more than 3 times in a minute (it's `failed`); 1 in a thousand
// keeps under that at 50 files/s, so the figures are about placement, not
// about processors given up on (counted anyway, in `failed`).
//
// CPU throttling is not used, as in the dashboards' comparisons: the bench
// server pins the run to fixed cores instead.
declare global {
  interface Window {
    files: import('../src/files/model').FileProcessor;
    kernel: import('@isoloop/host').Kernel;
  }
}

const OUT = process.env['COMPARE_OUT'] ?? 'comparison-results';
const MIXES = (process.env['COMPARE_MIXES'] ?? 'normal').split(',');
const ALL = ['isoloop:own', 'isoloop:one', 'isoloop:balancer', 'isoloop:one-off'];
const CONFIGS = process.env['COMPARE_CONFIGS']?.split(',') ?? ALL;
const RUNS = Number(process.env['COMPARE_RUNS'] ?? 1);
const RATE = Number(process.env['COMPARE_RATE'] ?? 50);
const WARM_MS = Number(process.env['COMPARE_WARM_MS'] ?? 20_000);
const WINDOW_MS = Number(process.env['COMPARE_WINDOW_MS'] ?? 20_000);
const DRAIN_MS = 120_000;
const SAMPLES = 5;
const FAULTS = '&poison=0.2&heavy=10&corrupt=0.1';
const MIX: Readonly<Record<string, string>> = {
  normal: '',
  faults: FAULTS,
  'faults-calm': FAULTS,
};
/** `faults-calm`: how long the faults run, and the calm before the window (5 minutes of calm in all, M3j). */
const FAULTS_MS = 60_000;
const CALM_BEFORE_WINDOW_MS = 280_000;
const VIEWPORT = { width: 1400, height: 900 };
/** Load, warm-up or faults and calm, the window, typing and up to 2 min of drain. */
const RUN_CAP_MS = 330_000;
const CALM_RUN_CAP_MS = 600_000;
const CLOSE_MS = 15_000;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const median = (xs: number[]): number =>
  xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const r1 = (x: number): number => Math.round(x * 10) / 10;

const filter = (page: Page) => page.getByRole('searchbox', { name: 'Filter results' });
const table = (page: Page) => page.locator('.recent table');

/** One keystroke's latency: from typing `text` until the table is drawn with it. */
async function latency(page: Page, text: string): Promise<number> {
  await filter(page).fill('');
  await expect(table(page)).toHaveAttribute('data-filter', '', { timeout: 30_000 });
  const t0 = Date.now();
  await filter(page).fill(text);
  await expect(table(page)).toHaveAttribute('data-filter', text, { timeout: 30_000 });
  return Date.now() - t0;
}

for (const mix of MIXES) {
  for (let run = 1; run <= RUNS; run++) {
    for (const config of CONFIGS) {
      const [build = 'isoloop', placement = 'balancer'] = config.split(':');
      const name = `${build}-${placement}-${mix}${RUNS > 1 ? `-run${run}` : ''}`;
      test(`compare: ${config} at ${mix}${RUNS > 1 ? `, run ${run}` : ''}`, async ({
        browser,
        baseURL,
        browserName,
      }) => {
        const capMs = mix === 'faults-calm' ? CALM_RUN_CAP_MS : RUN_CAP_MS;
        test.setTimeout(capMs + 60_000);
        const engine = browserName;
        const dir = `${OUT}/${engine}`;
        mkdirSync(dir, { recursive: true });
        const url = `./files/?placement=${placement}&rate=${RATE}&seed=7&start=1&maxWorkers=2${MIX[mix] ?? ''}`;
        const write = (result: object): void => {
          writeFileSync(
            `${dir}/${name}.json`,
            `${JSON.stringify({ engine, build, placement, mix, rate: RATE, url, ...result }, null, 2)}\n`,
          );
        };
        const context = await browser.newContext({
          ...(baseURL === undefined ? {} : { baseURL }),
          viewport: VIEWPORT,
        });
        const page = await context.newPage();
        const chromium = engine === 'chromium';
        const cdp = chromium ? await context.newCDPSession(page) : null;
        await cdp?.send('Performance.enable', { timeDomain: 'timeTicks' });
        let stage = 'load';
        let stoppedWhy: string | null = null;
        const t0 = Date.now();
        const cap = setTimeout(() => {
          stoppedWhy = `no result within ${Math.round(capMs / 1000)} s`;
          void Promise.race([context.close(), sleep(CLOSE_MS)]).catch(() => {});
        }, capMs);
        try {
          await page.goto(url);
          await page.waitForFunction(() => window.files !== undefined, null, { timeout: 30_000 });
          const origin = await page.evaluate(() => performance.now());
          // Once a second from here to the end of the window (M3i).
          const trace: {
            t: number;
            workers: number;
            procs: ReturnType<Window['files']['trace']>;
          }[] = [];
          const tracing = new AbortController();
          const tracer = (async () => {
            while (!tracing.signal.aborted) {
              // oxlint-disable-next-line no-await-in-loop -- sampling once a second
              const row = await page
                .evaluate(() => ({
                  t: performance.now(),
                  workers: window.files.snapshot().workerCount - 1,
                  procs: window.files.trace(),
                }))
                .catch(() => null);
              if (row)
                trace.push({
                  t: Math.round(row.t - origin),
                  workers: row.workers,
                  procs: row.procs,
                });
              // oxlint-disable-next-line no-await-in-loop -- sampling once a second
              await sleep(1_000);
            }
          })();
          let workersAfterFaults: number | null = null;
          let calmFrom: number | null = null;
          if (mix === 'faults-calm') {
            stage = 'faults';
            await page.waitForTimeout(FAULTS_MS);
            workersAfterFaults =
              (await page.evaluate(() => window.files.snapshot().workerCount)) - 1;
            calmFrom = Math.round((await page.evaluate(() => performance.now())) - origin);
            await page.evaluate(() => window.files.setDials({ poison: 0, heavy: 0, corrupt: 0 }));
            stage = 'calm';
            await page.waitForTimeout(CALM_BEFORE_WINDOW_MS);
          } else {
            stage = 'warm-up';
            await page.waitForTimeout(WARM_MS);
          }

          stage = 'window';
          const start = await page.evaluate(() => performance.now());
          const m0 = cdp ? await pageMetrics(cdp) : {};
          const p0 = chromium ? await processes(browser) : [];
          let workers = 0;
          const until = Date.now() + WINDOW_MS;
          while (Date.now() < until) {
            // oxlint-disable-next-line no-await-in-loop -- sampling once a second
            const n = await page.evaluate(() => window.files.snapshot().workerCount);
            workers = Math.max(workers, n - 1);
            // oxlint-disable-next-line no-await-in-loop -- sampling once a second
            await page.waitForTimeout(Math.min(1_000, Math.max(0, until - Date.now())));
          }
          const m1 = cdp ? await pageMetrics(cdp) : {};
          const p1 = chromium ? await processes(browser) : [];
          const win = await page.evaluate((t) => window.files.since(t), start);
          const workersEnd = (await page.evaluate(() => window.files.snapshot().workerCount)) - 1;
          tracing.abort();
          await tracer;
          const moveLog = await page.evaluate((t) => window.files.movesSince(t), origin);
          const events = await page.evaluate(() => window.files.events());
          const costs = moveLog.flatMap((m) => (m.costMs === undefined ? [] : [m.costMs]));
          const seconds = cdp
            ? (m1['Timestamp'] ?? 0) - (m0['Timestamp'] ?? 0) || WINDOW_MS / 1000
            : WINDOW_MS / 1000;
          const delta = (k: string): number => (m1[k] ?? 0) - (m0[k] ?? 0);
          const mem = chromium ? await memory(browser) : { pss: null, pssGc: null };

          stage = 'typing';
          await latency(page, 'c');
          const typing: number[] = [];
          for (const text of ['h', 'a', 'i', 'cs', 'ar'].slice(0, SAMPLES)) {
            // oxlint-disable-next-line no-await-in-loop -- one keystroke at a time
            typing.push(await latency(page, text));
          }
          const queueAtStop = await page.evaluate(() => window.files.snapshot().queue);

          stage = 'drain';
          const stopAt = Date.now();
          await page.evaluate(() => window.files.setDials({ running: false }));
          let drainMs: number | null = null;
          while (Date.now() - stopAt < DRAIN_MS) {
            // oxlint-disable-next-line no-await-in-loop -- polling
            if ((await page.evaluate(() => window.files.outstanding().length)) === 0) {
              drainMs = Date.now() - stopAt;
              break;
            }
            // oxlint-disable-next-line no-await-in-loop -- polling
            await page.waitForTimeout(250);
          }
          const end = await page.evaluate(() => {
            const s = window.files.snapshot();
            return {
              givenUp: window.files.givenUp(),
              crashes: window.files.crashes(),
              failed: window.kernel.isolates().filter((i) => i.state === 'failed').length,
              produced: s.produced,
              done: s.done,
              lost: window.files.outstanding().length,
              duplicates: s.duplicates,
              corrupt: s.corrupt,
            };
          });

          // A kind whose processors were all given up on has no member left to take its files.
          const failedNow = new Set(
            await page.evaluate(() =>
              window.kernel
                .isolates()
                .filter((i) => i.state === 'failed')
                .map((i) => i.id),
            ),
          );
          const kindsOf = new Map<string, Set<string>>();
          for (const row of trace.at(-1)?.procs ?? []) {
            const kind = row.id.replace(/-\d+$/, '');
            kindsOf.set(kind, (kindsOf.get(kind) ?? new Set()).add(row.id));
          }
          const givenUpKinds = [...kindsOf.values()].filter((ids) =>
            [...ids].every((id) => failedNow.has(id)),
          ).length;
          const calmWorkers =
            calmFrom === null ? [] : trace.filter((r) => r.t >= calmFrom).map((r) => r.workers);

          write({
            stopped: false,
            workers,
            jobsPerSec: r1(win.done / (WINDOW_MS / 1000)),
            p50Ms: win.p50 === undefined ? null : Math.round(win.p50),
            p95Ms: win.p95 === undefined ? null : Math.round(win.p95),
            moves: win.moves,
            workersAfterFaults,
            workersEnd,
            movesTotal: moveLog.length,
            backlogMoves: moveLog.filter((m) => m.reason === 'backlog').length,
            packs: moveLog.filter((m) => m.reason === 'pack').length,
            moveCostMedianMs: costs.length > 0 ? Math.round(median(costs)) : null,
            noted: events.noted,
            behind: events.behind,
            typingMedianMs: median(typing),
            typing,
            queueAtStop,
            drainMs,
            lost: end.lost,
            failed: end.failed,
            givenUpKinds,
            workersFewestCalm: calmWorkers.length > 0 ? Math.min(...calmWorkers) : null,
            givenUp: end.givenUp.map(({ at, id, kind, reason, pool }) => ({
              at: Math.round(at - origin),
              id,
              kind,
              reason,
              pool: pool ?? null,
            })),
            crashes: end.crashes.map(({ at, id, reason, pool, message }) => ({
              at: Math.round(at - origin),
              id,
              reason,
              pool: pool ?? null,
              message: message ?? null,
            })),
            duplicates: end.duplicates,
            produced: end.produced,
            done: end.done,
            corrupt: end.corrupt,
            mainThreadCpuPct: cdp ? r1((delta('TaskDuration') / seconds) * 100) : null,
            rendererCpuPct: chromium ? r1((cpuDelta(p0, p1, 'renderer') / seconds) * 100) : null,
            rendererPssMb: chromium ? pssMb([...cpuOf(p1, 'renderer').keys()]) : null,
            rendererPssGcMb: mem.pssGc,
            moveLog: moveLog.map(({ at, id, from, to, reason, costMs }) =>
              costMs === undefined
                ? { at: Math.round(at - origin), id, from, to, reason }
                : { at: Math.round(at - origin), id, from, to, reason, costMs: Math.round(costMs) },
            ),
            trace,
          });
        } catch (e) {
          write({
            stopped: true,
            stage,
            stoppedAtMs: Date.now() - t0,
            error:
              stoppedWhy ??
              (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e)).replace(
                // oxlint-disable-next-line no-control-regex -- Playwright's terminal colours
                /\u001b\[[0-9;]*m/g,
                '',
              ),
          });
        } finally {
          clearTimeout(cap);
          await cdp?.detach().catch(() => {});
          await Promise.race([context.close(), sleep(CLOSE_MS)]).catch(() => {});
        }
      });
    }
  }
}
