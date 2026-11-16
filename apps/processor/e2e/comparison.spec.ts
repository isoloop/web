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
//   a file).
// - Main-thread CPU (CDP TaskDuration), renderer CPU across all threads, and
//   renderer memory (PSS, Linux): Chromium only.
//
// Mixes: `normal` is files only; `faults` adds, in a thousand files, 2 poison
// (block their processor 2 s), 100 heavy (ten times the work) and 1 corrupt
// (crashes its processor). The rate is the same for both (`COMPARE_RATE`).
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
const MIX: Readonly<Record<string, string>> = {
  normal: '',
  faults: '&poison=0.2&heavy=10&corrupt=0.1',
};
const VIEWPORT = { width: 1400, height: 900 };
const RUN_CAP_MS = 240_000;
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
        test.setTimeout(RUN_CAP_MS + 60_000);
        const engine = browserName;
        const dir = `${OUT}/${engine}`;
        mkdirSync(dir, { recursive: true });
        const url = `./files/?placement=${placement}&rate=${RATE}&seed=7&start=1${MIX[mix] ?? ''}`;
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
          stoppedWhy = `no result within ${Math.round(RUN_CAP_MS / 1000)} s`;
          void Promise.race([context.close(), sleep(CLOSE_MS)]).catch(() => {});
        }, RUN_CAP_MS);
        try {
          await page.goto(url);
          await page.waitForFunction(() => window.files !== undefined, null, { timeout: 30_000 });
          stage = 'warm-up';
          await page.waitForTimeout(WARM_MS);

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
              failed: window.kernel.isolates().filter((i) => i.state === 'failed').length,
              produced: s.produced,
              done: s.done,
              lost: window.files.outstanding().length,
              duplicates: s.duplicates,
              corrupt: s.corrupt,
            };
          });

          write({
            stopped: false,
            workers,
            jobsPerSec: r1(win.done / (WINDOW_MS / 1000)),
            p50Ms: win.p50 === undefined ? null : Math.round(win.p50),
            p95Ms: win.p95 === undefined ? null : Math.round(win.p95),
            moves: win.moves,
            typingMedianMs: median(typing),
            typing,
            queueAtStop,
            drainMs,
            lost: end.lost,
            failed: end.failed,
            duplicates: end.duplicates,
            produced: end.produced,
            done: end.done,
            corrupt: end.corrupt,
            mainThreadCpuPct: cdp ? r1((delta('TaskDuration') / seconds) * 100) : null,
            rendererCpuPct: chromium ? r1((cpuDelta(p0, p1, 'renderer') / seconds) * 100) : null,
            rendererPssMb: chromium ? pssMb([...cpuOf(p1, 'renderer').keys()]) : null,
            rendererPssGcMb: mem.pssGc,
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
