import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cpuDelta, pageMetrics, processes } from 'compare/probes';

// The interactive page's measured run (M3e decision 22): whether work in the
// drawer reaches the dashboard, and whether the dashboard's load reaches the
// drawer, on the native page and the Isoloop page, one page at a time.
// `comparison/interactive.ts` runs it in pairs; README.md in comparison/ has
// the commands. Each run, in order:
//
// 1. Load at `?rate=` (default 5 kHz), wait until the starters draw, warm up
//    (`COMPARE_WARM_MS`).
// 2. Idle window (`COMPARE_WINDOW_MS`, drawer closed): the reference for 4.
// 3. Dashboard → drawer: the drawer open on the default draft (a light one,
//    the records of the first topic in a table). 10 keystrokes into its title
//    and 10 clicks (5 × add a condition, 5 × remove it), one at a time.
// 4. Drawer → dashboard: the draft made heavy (plant.scalars, bearing temp p95
//    over 120 s, every 1 s, by machine, a line), then the same window with a
//    keystroke into the title every 500 ms. Each keystroke changes the draft,
//    so the preview rebuilds its pipeline from its 2-minute buffer 300 ms
//    later (decision 10): about 20 rebuilds per window.
//
// What each figure is:
// - Draw gaps: the starters' canvases (line, heatmap, bar) carry the time of
//   each draw (`data-drawn-at`, the drawing thread's clock). A gap is the time
//   between two draws of one canvas; widgets read their pipeline every 100 ms,
//   so gaps over 250 ms are counted as late. On Isoloop the canvases draw in
//   the widgets' workers; on native on the main thread.
// - Main-thread frames: gaps between requestAnimationFrame callbacks on the
//   page's main thread; over 25 ms is late (as on plant's page).
// - Typing: from the keydown on the host page to the first animation frame
//   after the drawer's form has rendered the new title (`data-title` on the
//   form, set by the drawer, in its worker on Isoloop).
// - Clicks: from the click to the first animation frame after the form has
//   rendered one row more (add) or less (remove).
// - CPU: main thread (CDP TaskDuration) and renderer, all threads, as % of one
//   core, over each window. Chromium only.
//
// Pages are timed from inside the page (performance.now, Date.now), by an
// init script that also watches the isolates' open shadow roots, so the
// figures don't include Playwright's polling.
const OUT = process.env['COMPARE_OUT'] ?? 'comparison-results/interactive';
const RATES = (process.env['COMPARE_RATES'] ?? '5').split(',').map(Number);
const CONFIGS = process.env['COMPARE_CONFIGS']?.split(',') ?? ['native', 'isoloop'];
const RUNS = Number(process.env['COMPARE_RUNS'] ?? 1);
const WARM_MS = Number(process.env['COMPARE_WARM_MS'] ?? 6_000);
const WINDOW_MS = Number(process.env['COMPARE_WINDOW_MS'] ?? 10_000);
const SAMPLES = 10;
const CLICK_PAIRS = 5;
const KEY_EVERY_MS = 500;
const LATE_DRAW_MS = 250;
const LATE_FRAME_MS = 25;
const CANVASES = ['bearing-p95', 'vib-heatmap', 'plant-power'] as const;
const VIEWPORT = { width: 1400, height: 900 };
const RUN_CAP_MS = 240_000;
const WAIT = 30_000;

type Echo = { len: number; at: number };
type Rows = { n: number; at: number };
type Probe = {
  keys: number[];
  echoes: Echo[];
  clicks: number[];
  rows: Rows[];
  frames: number[];
  draws: Record<string, number[]>;
};

declare global {
  interface Window {
    /** The comparison's in-page probe (the init script below). */
    probe: Probe;
  }
}

/**
 * Installed before the page's own scripts: listeners, observers and a frame
 * loop. Playwright sends it to the page as source, so its helpers live inside.
 */
function install(): void {
  const p: Probe = { keys: [], echoes: [], clicks: [], rows: [], frames: [], draws: {} };
  window.probe = p;
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- install() is sent to the page whole
  const ancestors = function* (n: Node | null): Generator<Element> {
    while (n) {
      if (n instanceof Element) yield n;
      const parent: Node | null = n.parentNode;
      n = parent instanceof ShadowRoot ? parent.host : parent;
    }
  };
  const slotOf = (n: Node): string | null => {
    for (const a of ancestors(n)) {
      if (a.classList.contains('creator-drawer-preview')) return null;
      const id = a.getAttribute('data-widget');
      if (a.classList.contains('creator-slot') && id) return id;
    }
    return null;
  };
  let rowCount = -1;
  const seen = (recs: MutationRecord[]): void => {
    for (const r of recs) {
      const el = r.target;
      if (!(el instanceof Element)) continue;
      if (r.type === 'attributes' && r.attributeName === 'data-drawn-at') {
        const id = slotOf(el);
        const at = Number(el.getAttribute('data-drawn-at'));
        if (id && Number.isFinite(at)) (p.draws[id] ??= []).push(at);
      } else if (r.type === 'attributes' && r.attributeName === 'data-title') {
        const len = (el.getAttribute('data-title') ?? '').length;
        requestAnimationFrame(() => p.echoes.push({ len, at: performance.now() }));
      }
      const form = [...ancestors(el)].find((a) => a.classList.contains('creator-drawer-form'));
      if (form && r.type === 'childList') {
        const n = form.querySelectorAll('.creator-row').length;
        if (n !== rowCount) {
          rowCount = n;
          requestAnimationFrame(() => p.rows.push({ n, at: performance.now() }));
        }
      }
    }
  };
  const observer = new MutationObserver(seen);
  const watch = (root: Node): void => {
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-drawn-at', 'data-title'],
    });
  };
  // Isolates' surfaces are open shadow roots: watch each one as it's made.
  // oxlint-disable-next-line typescript/unbound-method -- called with its element below
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const root = attach.call(this, init);
    watch(root);
    return root;
  };
  document.addEventListener('DOMContentLoaded', () => watch(document.documentElement));
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- install() is sent to the page whole
  const target = (e: Event): Element | null => {
    const t = e.composedPath()[0];
    return t instanceof Element ? t : null;
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (target(e)?.getAttribute('name') === 'title') p.keys.push(performance.now());
    },
    true,
  );
  window.addEventListener(
    'click',
    (e) => {
      const a = target(e)?.closest('[data-action]')?.getAttribute('data-action');
      if (a === 'add-row' || a === 'remove-row') p.clicks.push(performance.now());
    },
    true,
  );
  const frame = (t: number): void => {
    p.frames.push(t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const median = (xs: number[]): number | null =>
  xs.length === 0 ? null : (xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)] ?? null);
const quantile = (xs: number[], q: number): number | null =>
  xs.length === 0
    ? null
    : (xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] ?? null);
const r1 = (x: number | null): number | null => (x === null ? null : Math.round(x * 10) / 10);
const gapsOf = (ts: readonly number[]): number[] => ts.slice(1).map((t, i) => t - (ts[i] ?? t));

/** Draw and frame figures for a window: [from, to] in epoch ms (draws) and page ms (frames). */
async function windowFigures(
  page: Page,
  epoch: [number, number],
  perf: [number, number],
): Promise<{
  drawGapsLate: number;
  drawGapP95Ms: number | null;
  drawGapMaxMs: number | null;
  draws: number;
  framesLate: number;
  fps: number;
}> {
  const p = await page.evaluate(() => ({ draws: window.probe.draws, frames: window.probe.frames }));
  const gaps: number[] = [];
  let draws = 0;
  for (const id of CANVASES) {
    const ts = (p.draws[id] ?? []).filter((t) => t >= epoch[0] && t <= epoch[1]);
    draws += ts.length;
    // The time from the window's start to the first draw, and from the last
    // to its end, count as gaps too: a canvas that stops drawing shows.
    gaps.push(...gapsOf([epoch[0], ...ts, epoch[1]]));
  }
  const frames = p.frames.filter((t) => t >= perf[0] && t <= perf[1]);
  const frameGaps = gapsOf(frames);
  return {
    drawGapsLate: gaps.filter((g) => g > LATE_DRAW_MS).length,
    drawGapP95Ms: r1(quantile(gaps, 0.95)),
    drawGapMaxMs: r1(gaps.length ? Math.max(...gaps) : null),
    draws,
    framesLate: frameGaps.filter((g) => g > LATE_FRAME_MS).length,
    fps: r1(frames.length / ((perf[1] - perf[0]) / 1000)) ?? 0,
  };
}

const now = (page: Page): Promise<{ epoch: number; perf: number }> =>
  page.evaluate(() => ({ epoch: Date.now(), perf: performance.now() }));

for (const rate of RATES) {
  for (let run = 1; run <= RUNS; run++) {
    for (const build of CONFIGS) {
      const name = `${build}-${rate}khz${RUNS > 1 ? `-run${run}` : ''}`;
      test(`interactive compare: ${build} at ${rate} kHz${RUNS > 1 ? `, run ${run}` : ''}`, async ({
        browser,
        baseURL,
        browserName,
      }) => {
        test.setTimeout(RUN_CAP_MS);
        const engine = browserName;
        const dir = `${OUT}/${engine}`;
        mkdirSync(dir, { recursive: true });
        const write = (result: object): void => {
          writeFileSync(
            `${dir}/${name}.json`,
            `${JSON.stringify({ engine, build, placement: null, rate, ...result }, null, 2)}\n`,
          );
        };
        const context = await browser.newContext({
          ...(baseURL === undefined ? {} : { baseURL }),
          viewport: VIEWPORT,
        });
        await context.addInitScript(install);
        const page = await context.newPage();
        const chromium = engine === 'chromium';
        const cdp = chromium ? await context.newCDPSession(page) : null;
        await cdp?.send('Performance.enable', { timeDomain: 'timeTicks' });
        const url = `/interactive/${build}/?rate=${rate}&seed=7`;
        const form = page.locator('.creator-drawer-form');
        const field = (n: string): Locator => form.locator(`[name="${n}"]`);
        const title = field('title');
        let stage = 'load';

        /** CPU over a window: main thread and renderer, % of one core (Chromium). */
        const cpu = async (): Promise<
          () => Promise<{ main: number | null; all: number | null }>
        > => {
          const m0 = cdp ? await pageMetrics(cdp) : {};
          const p0 = chromium ? await processes(browser) : [];
          return async () => {
            const m1 = cdp ? await pageMetrics(cdp) : {};
            const p1 = chromium ? await processes(browser) : [];
            const s = (m1['Timestamp'] ?? 0) - (m0['Timestamp'] ?? 0) || WINDOW_MS / 1000;
            const d = (k: string): number => (m1[k] ?? 0) - (m0[k] ?? 0);
            return {
              main: cdp ? r1((d('TaskDuration') / s) * 100) : null,
              all: chromium ? r1((cpuDelta(p0, p1, 'renderer') / s) * 100) : null,
            };
          };
        };

        /** One keystroke into the title, timed until the form has rendered it. */
        const keystroke = async (ch: string): Promise<number> => {
          const len = ((await title.inputValue()) + ch).length;
          const k = await page.evaluate(() => window.probe.keys.length);
          await page.keyboard.press(ch);
          await page.waitForFunction((n) => window.probe.echoes.some((e) => e.len === n), len, {
            timeout: WAIT,
          });
          return page.evaluate(
            (a) => {
              const echo = window.probe.echoes.find((e) => e.len === a.len);
              const key = window.probe.keys[a.k];
              return echo && key !== undefined ? echo.at - key : -1;
            },
            { len, k },
          );
        };

        /** One click on add-row or remove-row, timed until the form has n rows. */
        const click = async (what: 'add-row' | 'remove-row', n: number): Promise<number> => {
          const c = await page.evaluate(() => window.probe.clicks.length);
          const r = await page.evaluate(() => window.probe.rows.length);
          await form.locator(`[data-action="${what}"]`).last().click();
          await page.waitForFunction(
            (a) => window.probe.rows.slice(a.r).some((x) => x.n === a.n),
            { r, n },
            { timeout: WAIT },
          );
          return page.evaluate(
            (a) => {
              const row = window.probe.rows.slice(a.r).find((x) => x.n === a.n);
              const at = window.probe.clicks[a.c];
              return row && at !== undefined ? row.at - at : -1;
            },
            { r, n, c },
          );
        };

        try {
          await page.goto(url);
          await expect(page.locator('.creator-board[data-ready]')).toBeAttached({ timeout: WAIT });
          for (const id of CANVASES) {
            // oxlint-disable-next-line no-await-in-loop -- one after another
            await expect(
              page.locator(`.creator-slot[data-widget="${id}"] canvas[data-view]`),
            ).toHaveAttribute('data-drawn-at', /\d/, { timeout: WAIT });
          }
          stage = 'warm-up';
          await page.waitForTimeout(WARM_MS);

          // 2. Idle.
          stage = 'idle';
          const idleCpu = await cpu();
          const i0 = await now(page);
          await page.waitForTimeout(WINDOW_MS);
          const i1 = await now(page);
          const idleCpuEnd = await idleCpu();
          const idle = await windowFigures(page, [i0.epoch, i1.epoch], [i0.perf, i1.perf]);

          // 3. Dashboard → drawer: a light draft, one keystroke or click at a time.
          stage = 'latency';
          await page.locator('.creator-toolbar [data-action="add"]').click();
          await expect(form).toHaveAttribute('data-state', 'open', { timeout: WAIT });
          await title.click();
          await title.fill('');
          await expect(form).toHaveAttribute('data-title', '', { timeout: WAIT });
          const typing: number[] = [];
          for (let i = 0; i < SAMPLES; i++) {
            // oxlint-disable-next-line no-await-in-loop -- one at a time
            typing.push(await keystroke(String.fromCharCode(97 + (i % 26))));
          }
          const rows0 = await form.locator('.creator-row').count();
          const clicks: number[] = [];
          for (let i = 0; i < CLICK_PAIRS; i++) {
            // oxlint-disable-next-line no-await-in-loop -- one at a time
            clicks.push(await click('add-row', rows0 + 1));
            // oxlint-disable-next-line no-await-in-loop -- one at a time
            clicks.push(await click('remove-row', rows0));
          }

          // 4. Drawer → dashboard: the heavy preview, typed into while it rebuilds.
          stage = 'heavy preview';
          await field('topic').selectOption('plant.scalars');
          await field('window-by').selectOption('seconds');
          await field('window-value').fill('120');
          await field('fn').selectOption('percentile');
          await field('field').selectOption('bearingTemp');
          await field('p').fill('95');
          await field('every').fill('1');
          await field('group-by').selectOption('$key');
          await field('view').selectOption('line');
          await expect(form).toHaveAttribute('data-valid', 'true', { timeout: WAIT });
          const previewFrom = Date.now();
          await expect(
            page.locator('.creator-drawer-preview canvas[data-view="line"]'),
          ).toHaveAttribute('data-drawn', /^line:8x/, { timeout: WAIT });
          const previewMs = Date.now() - previewFrom;
          await title.click();
          await title.fill('');
          await expect(form).toHaveAttribute('data-title', '', { timeout: WAIT });

          stage = 'heavy window';
          const k0 = await page.evaluate(() => window.probe.keys.length);
          const e0 = await page.evaluate(() => window.probe.echoes.length);
          const heavyCpu = await cpu();
          const h0 = await now(page);
          const end = Date.now() + WINDOW_MS;
          let sent = 0;
          while (Date.now() < end) {
            const next = Date.now() + KEY_EVERY_MS;
            // oxlint-disable-next-line no-await-in-loop -- a cadence
            await page.keyboard.press(String.fromCharCode(97 + (sent % 26)));
            sent += 1;
            // oxlint-disable-next-line no-await-in-loop -- a cadence
            await page.waitForTimeout(Math.max(0, Math.min(next, end) - Date.now()));
          }
          const h1 = await now(page);
          const heavyCpuEnd = await heavyCpu();
          const heavy = await windowFigures(page, [h0.epoch, h1.epoch], [h0.perf, h1.perf]);
          // Every keystroke's echo, once the form has caught up.
          await page
            .waitForFunction((n) => window.probe.echoes.some((e) => e.len === n), sent, {
              timeout: WAIT,
            })
            .catch(() => {});
          const heavyTyping = await page.evaluate(
            (a) => {
              const keys = window.probe.keys.slice(a.k0, a.k0 + a.sent);
              const echoes = window.probe.echoes.slice(a.e0);
              return keys.map((at, i) => {
                const echo = echoes.find((e) => e.len === i + 1);
                return echo ? echo.at - at : null;
              });
            },
            { k0, e0, sent },
          );
          const heavyDone = heavyTyping.filter((x): x is number => x !== null);

          write({
            stopped: false,
            url,
            idleDrawGapsLate: idle.drawGapsLate,
            idleDrawGapMaxMs: idle.drawGapMaxMs,
            idleDraws: idle.draws,
            idleFramesLate: idle.framesLate,
            idleFps: idle.fps,
            idleMainThreadCpuPct: idleCpuEnd.main,
            idleRendererCpuPct: idleCpuEnd.all,
            typingMedianMs: r1(median(typing)),
            typingP95Ms: r1(quantile(typing, 0.95)),
            typing: typing.map(r1),
            clickMedianMs: r1(median(clicks)),
            clickP95Ms: r1(quantile(clicks, 0.95)),
            clicks: clicks.map(r1),
            previewMs,
            heavyDrawGapsLate: heavy.drawGapsLate,
            heavyDrawGapP95Ms: heavy.drawGapP95Ms,
            heavyDrawGapMaxMs: heavy.drawGapMaxMs,
            heavyDraws: heavy.draws,
            heavyFramesLate: heavy.framesLate,
            heavyFps: heavy.fps,
            heavyMainThreadCpuPct: heavyCpuEnd.main,
            heavyRendererCpuPct: heavyCpuEnd.all,
            heavyKeys: sent,
            heavyTypingMedianMs: r1(median(heavyDone)),
            heavyTypingP95Ms: r1(quantile(heavyDone, 0.95)),
            heavyTypingMissing: sent - heavyDone.length,
          });
        } catch (e) {
          write({
            stopped: true,
            url,
            stage,
            error: (e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e)).replace(
              // oxlint-disable-next-line no-control-regex -- Playwright's terminal colours
              /\u001b\[[0-9;]*m/g,
              '',
            ),
          });
        } finally {
          await cdp?.detach().catch(() => {});
          await context.close().catch(() => {});
        }
      });
    }
  }
}
