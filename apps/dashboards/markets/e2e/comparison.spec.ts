import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { cpuDelta, cpuOf, jsLoaded, memory, pageMetrics, processes, pssMb } from 'compare/probes';

// The head-to-head comparison (M3f decisions 7 and 8): the native builds and
// each Isoloop placement, at each size, one page at a time, on the engine of
// the project that runs it (comparison, comparison-firefox). It's run by
// `comparison/run.ts` (packages/compare), which sets the variables below and
// writes summary.md. What each figure covers:
//
// - Frames: gaps between the ticker tape's animation frames over a 10 s
//   window with no input; "late" are those over 25 ms. Long tasks from the
//   metrics panel over the same 10 s.
// - Typing: median of 5 keystrokes into the alerts panel's threshold, from the
//   keystroke until the panel has re-rendered ("Add rule" enabled).
// - Main-thread CPU (CDP `Performance.getMetrics` TaskDuration), renderer CPU
//   across all threads and GPU CPU (`SystemInfo.getProcessInfo`), renderer
//   memory (PSS, Linux): Chromium only, as % of one core and MB. Memory is
//   also read after a forced GC in the page and every worker.
// - Hold (`COMPARE_HOLD_MS`): after typing, the page keeps running until that
//   long after navigation, then memory is read again, before the fault.
// - Runs (`COMPARE_RUNS`): every configuration that many times, interleaved
//   (A, B, A, B), so drift on the machine falls on both sides of a pair.
// - Workers: as the metrics panel counts them (pools once, the bus's worker
//   left out).
// - Start-up: from navigation to the first data (the metrics panel), and to
//   every widget showing data (`window.slotsWithData`).
// - Fault: the price chart's block control, a 3 s busy loop in the chart's
//   own code: on its isolate's thread on Isoloop (in `matched` and `one`,
//   the pool it shares), on the main thread on the native builds. Recovery:
//   from the click until the chart's first draw after the pause
//   (`resumedAt`, reported in its timings). Markets sets no
//   `heartbeat.killAfterMs`, so on Isoloop the blocked thread is waited out,
//   not restarted, in every placement, as on the native builds.
// - JS loaded: every JavaScript file the page and its workers requested, each
//   once, sized from dist/ (gzipped, what a server would send).
// - `COMPARE_FAULT=alerts` (M3g decision 10) replaces the price chart's fault
//   with two on the alerts panel, which is the Preact team's in `/mixed` and
//   `/native-mixed`; "the other team" is every other widget but the filters:
//   - block for 3 s: the other team's renders and draws in the block's last
//     2 s, as a share of the 2 s before (from the widgets' own reports, once a
//     second), and the longest silence between two reports of any of them.
//   - crash (a throw while rendering): the same share over the 2 s after it,
//     and the time until the panel reports again, from its code restarted
//     (none if not within 10 s, as on the native builds, which have no restart).
//
// CPU throttling is not used: CDP throttling slows the main thread but not
// workers, so it would not be a like-for-like slowdown. The bench server pins
// the run to fixed cores instead (comparison/final/README.md).
const OUT = process.env['COMPARE_OUT'] ?? 'comparison-results';
const SIZES = (process.env['COMPARE_SIZES'] ?? 'normal').split(',');
const ALL = [
  'native',
  'native-workers',
  'isoloop:own',
  'isoloop:matched',
  'isoloop:one',
  'native-mixed',
  'mixed:matched',
  'mixed:teams',
  'mixed:own',
];
const FAULT = process.env['COMPARE_FAULT'] ?? 'price';
/** The widgets the alerts faults watch: every one but the Preact team's two. */
const OTHER_TEAM = (slots: string[]): string[] =>
  slots.filter((s) => s !== 'alerts-panel' && s !== 'filters');
const BLOCK_MS = 3_000;
const DIST = new URL('../dist', import.meta.url).pathname;
const CONFIGS = process.env['COMPARE_CONFIGS']?.split(',') ?? ALL;
const RUNS = Number(process.env['COMPARE_RUNS'] ?? 1);
const HOLD_MS = Number(process.env['COMPARE_HOLD_MS'] ?? 0);
const WARM_MS = Number(process.env['COMPARE_WARM_MS'] ?? 6_000);
const WINDOW_MS = Number(process.env['COMPARE_WINDOW_MS'] ?? 10_000);
const SAMPLES = 5;
const LATE_FRAME_MS = 25;
const VIEWPORT = { width: 1400, height: 900 };
const WIDGETS: Readonly<Record<string, number>> = { lite: 6, normal: 16, heavy: 24 };
// A run that hasn't finished within RUN_CAP_MS (beyond its hold) is stopped
// and recorded as "stopped". Not scaled by PERF_BUDGET_SCALE: it's a limit on
// a run, not a performance budget.
const RUN_CAP_MS = 180_000;
const CLOSE_MS = 15_000;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const median = (xs: number[]): number =>
  xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const quantile = (xs: number[], q: number): number =>
  xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? 0;
const r1 = (x: number): number => Math.round(x * 10) / 10;

const panel = (page: Page) => page.locator('[data-slot="alerts-panel"]');
async function latency(page: Page, text: string): Promise<number> {
  const input = panel(page).getByLabel('Threshold');
  const add = panel(page).getByRole('button', { name: 'Add rule' });
  await input.fill('');
  await expect(add).toBeDisabled({ timeout: 30_000 });
  const t0 = Date.now();
  await input.fill(text);
  await expect(add).toBeEnabled({ timeout: 30_000 });
  return Date.now() - t0;
}
const metric = async (page: Page, key: string): Promise<string> =>
  (await page.locator(`[data-metric="${key}"] dd`).textContent()) ?? '';

/** The chart's first draw after `since` (epoch ms) and a pause, as ms after `since`. */
async function recovered(page: Page, since: number, timeoutMs: number): Promise<number | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    // oxlint-disable-next-line no-await-in-loop -- polling
    const at = await page.evaluate(() => window.resumedAt('price'));
    if (at !== null && at > since) return at - since;
    // oxlint-disable-next-line no-await-in-loop -- polling
    await page.waitForTimeout(100);
  }
  return null;
}

/** Every slot on the page. */
const slotsOf = (page: Page): Promise<string[]> =>
  page
    .locator('[data-slot]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-slot') ?? ''));

const share = (during: number, before: number): number | null =>
  before > 0 ? Math.round((during / before) * 100) : null;

/** The alerts panel's two faults (`COMPARE_FAULT=alerts`): a 3 s block, then a crash. */
async function alertsFaults(page: Page): Promise<Record<string, number | null>> {
  const others = OTHER_TEAM(await slotsOf(page));
  const panelSlot = panel(page);
  await panelSlot.hover();
  // Two reports of every widget before the block.
  await page.waitForTimeout(2_500);
  const blockAt = Date.now();
  // From a timer, not awaited: on the native builds the click would wait the loop out.
  await panelSlot
    .locator('button[name="stress-block"]')
    .evaluate((el: HTMLElement) => setTimeout(() => el.click(), 0));
  // The block, then the reports that come after it.
  await page.waitForTimeout(BLOCK_MS + 4_000);
  const block = await page.evaluate(
    ([slots, at, ms]) => ({
      before: window.updatesIn(slots, at - 2_000, at),
      during: window.updatesIn(slots, at + 1_000, at + ms),
      silence: window.longestSilence(slots, at - 1_500, at + ms + 3_000),
    }),
    [others, blockAt, BLOCK_MS] as const,
  );

  await page.waitForTimeout(2_000);
  const crashAt = Date.now();
  await panelSlot.locator('button[name="stress-crash"]').click();
  // Back: the panel reports again from a run of its code that started after
  // the click, so a report its crashed run sent late isn't counted.
  let backMs: number | null = null;
  while (Date.now() < crashAt + 10_000) {
    // oxlint-disable-next-line no-await-in-loop -- polling
    const report = await page.evaluate(([since]) => window.firstReport('alerts-panel', since), [
      crashAt,
    ] as const);
    if (report !== null) {
      backMs = report - crashAt;
      break;
    }
    // oxlint-disable-next-line no-await-in-loop -- polling
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(Math.max(0, crashAt + 3_500 - Date.now()));
  const crash = await page.evaluate(
    ([slots, at]) => ({
      before: window.updatesIn(slots, at - 2_000, at),
      after: window.updatesIn(slots, at + 1_000, at + 3_000),
    }),
    [others, crashAt] as const,
  );
  return {
    blockOtherKeptPct: share(block.during, block.before),
    blockOtherSilenceMs: block.silence,
    crashOtherKeptPct: share(crash.after, crash.before),
    crashBackMs: backMs,
  };
}

for (const size of SIZES) {
  for (let run = 1; run <= RUNS; run++) {
    for (const config of CONFIGS) {
      const [build = 'native', placement] = config.split(':');
      const name = `${placement ? `${build}-${placement}` : build}-${size}${RUNS > 1 ? `-run${run}` : ''}`;
      test(`compare: ${config} at ${size}${RUNS > 1 ? `, run ${run}` : ''}`, async ({
        browser,
        baseURL,
        browserName,
      }) => {
        test.setTimeout(RUN_CAP_MS + HOLD_MS + 60_000);
        const engine = browserName;
        const dir = `${OUT}/${engine}`;
        mkdirSync(dir, { recursive: true });
        const write = (result: object): void => {
          writeFileSync(
            `${dir}/${name}.json`,
            `${JSON.stringify({ engine, build, placement: placement ?? null, size, ...result }, null, 2)}\n`,
          );
        };
        const context = await browser.newContext({
          ...(baseURL === undefined ? {} : { baseURL }),
          viewport: VIEWPORT,
        });
        const js = jsLoaded(context, DIST);
        const page = await context.newPage();
        const chromium = engine === 'chromium';
        const cdp = chromium ? await context.newCDPSession(page) : null;
        await cdp?.send('Performance.enable', { timeDomain: 'timeTicks' });
        const url = `/${build}/?size=${size}&speed=1&seed=7${placement ? `&placement=${placement}` : ''}`;
        const widgets = WIDGETS[size] ?? 0;
        let stage = 'load';
        let stoppedWhy: string | null = null;
        const t0 = Date.now();
        const cap = setTimeout(() => {
          stoppedWhy = `no result within ${Math.round((RUN_CAP_MS + HOLD_MS) / 1000)} s`;
          void Promise.race([context.close(), sleep(CLOSE_MS)]).catch(() => {});
        }, RUN_CAP_MS + HOLD_MS);
        try {
          await page.goto(url);
          await expect(page.locator('[data-metric="first-data"] dd')).toHaveText(/ms$/, {
            timeout: 30_000,
          });
          let allMs: number | null = null;
          while (Date.now() - t0 < 30_000) {
            // oxlint-disable-next-line no-await-in-loop -- polling
            if ((await page.evaluate(() => window.slotsWithData())) >= widgets) {
              allMs = Date.now() - t0;
              break;
            }
            // oxlint-disable-next-line no-await-in-loop -- polling
            await page.waitForTimeout(100);
          }
          stage = 'warm-up';
          await page.waitForTimeout(WARM_MS);

          stage = 'window';
          const m0 = cdp ? await pageMetrics(cdp) : {};
          const p0 = chromium ? await processes(browser) : [];
          const frames0 = await page.evaluate(() => window.tape.frames);
          await page.waitForTimeout(WINDOW_MS);
          const m1 = cdp ? await pageMetrics(cdp) : {};
          const p1 = chromium ? await processes(browser) : [];
          const tape = await page.evaluate(() => ({
            frames: window.tape.frames,
            gaps: window.tape.gaps,
          }));
          const longTasks = await metric(page, 'long-tasks');
          const memAtMs = Date.now() - t0;
          const mem = chromium ? await memory(browser) : { pss: null, pssGc: null };
          const categories = await page.evaluate(() => window.categories());
          const seconds = cdp
            ? (m1['Timestamp'] ?? 0) - (m0['Timestamp'] ?? 0) || WINDOW_MS / 1000
            : WINDOW_MS / 1000;
          const delta = (k: string): number => (m1[k] ?? 0) - (m0[k] ?? 0);
          const frameGaps = tape.gaps.slice(-(tape.frames - frames0));

          stage = 'typing';
          await latency(page, '0');
          const typing: number[] = [];
          for (let i = 0; i < SAMPLES; i++) {
            // oxlint-disable-next-line no-await-in-loop
            typing.push(await latency(page, String(i + 1)));
          }

          let held: { pss: number | null; pssGc: number | null } | null = null;
          if (HOLD_MS > 0) {
            stage = 'hold';
            await page.waitForTimeout(Math.max(0, t0 + HOLD_MS - Date.now()));
            held = chromium ? await memory(browser) : null;
          }

          const jsAtStart = js();
          let recoveryMs: number | null = null;
          let alerts: Record<string, number | null> = {};
          if (FAULT === 'alerts') {
            stage = 'fault';
            alerts = await alertsFaults(page);
          } else {
            // The fault: block the price chart for 3 s.
            stage = 'fault';
            const price = page.locator('[data-slot="price"]');
            await price.hover();
            const block = price.locator('button[name="stress-block"]');
            const clicked = Date.now();
            // Clicked from a timer, not awaited: on the native builds Playwright's
            // click would wait the busy loop out.
            await block.evaluate((el: HTMLElement) => setTimeout(() => el.click(), 0));
            recoveryMs = await recovered(page, clicked, 20_000);
            await page.waitForTimeout(1_000);
          }

          write({
            stopped: false,
            url,
            workers: Number(await metric(page, 'workers')),
            firstDataMs: Number((await metric(page, 'first-data')).replace(/\D+/g, '')),
            allWidgetsMs: allMs,
            widgets,
            frames: frameGaps.length,
            fps: r1(frameGaps.length / (WINDOW_MS / 1000)),
            frameP95Ms: r1(quantile(frameGaps, 0.95)),
            framesLate: frameGaps.filter((g) => g > LATE_FRAME_MS).length,
            longTasks: Number(longTasks),
            typingMedianMs: median(typing),
            typing,
            mainThreadCpuPct: cdp ? r1((delta('TaskDuration') / seconds) * 100) : null,
            rendererCpuPct: chromium ? r1((cpuDelta(p0, p1, 'renderer') / seconds) * 100) : null,
            gpuCpuPct: chromium ? r1((cpuDelta(p0, p1, 'GPU') / seconds) * 100) : null,
            rendererPssMb: chromium ? pssMb([...cpuOf(p1, 'renderer').keys()]) : null,
            rendererPssGcMb: mem.pssGc,
            memAtMs,
            holdMs: HOLD_MS || null,
            rendererPssHoldMb: held?.pss ?? null,
            rendererPssHoldGcMb: held?.pssGc ?? null,
            recoveryMs,
            fault: FAULT,
            ...alerts,
            jsFiles: jsAtStart.files,
            jsKb: Math.round(jsAtStart.bytes / 1024),
            jsGzKb: Math.round(jsAtStart.gzipBytes / 1024),
            categories,
            bundle: await metric(page, 'bundle'),
          });
        } catch (e) {
          write({
            stopped: true,
            url,
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
