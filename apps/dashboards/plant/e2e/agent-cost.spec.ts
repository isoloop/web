// The agent-call cost (M4a task 13, decision 20), on demand only: the cost of
// one `kernel.request` from the main thread, the call every agent transport
// makes (the dev MCP and WebMCP add their own hop on top, which isn't here).
//
// Run against a `PLANT_AGENT_COST=1` build (comparison/README.md): its ping
// isolate answers each call with the call's own value, so a round trip is the
// host → bus → isolate → bus → host path with no handler work in it.
//
// Two pages, interleaved per round, one page at a time:
// - `idle`: `?agent=idle`, the kernel, the bus and the ping isolate only;
// - `plant-5khz`: the Isoloop build, `matched`, at 5 kHz, as the feed's cost.
//
// Per page and mode (1 call in flight, then 8): 3 pairs of a 2 s window
// without calls and a burst of CALLS calls. Main-thread time per call, on
// Chromium, is CDP `Performance.getMetrics` TaskDuration over the bursts, less
// the page's own rate measured in the windows beside them, over the calls.
// Firefox has no such counter, so it reports round trips only. After each
// burst, ISSUE_BURST calls issued back to back without awaiting give the time
// `kernel.request(...)` itself holds the main thread per call, on both engines.
/* oxlint-disable no-await-in-loop -- the run is sequential by design: a quiet window, then a burst, one page at a time */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { z } from 'zod';
import type { ModeResult, Run } from '../comparison/agent-cost.ts';

const ROUNDS = Number(process.env['AGENT_COST_ROUNDS'] ?? 5);
const CALLS = Number(process.env['AGENT_COST_CALLS'] ?? 500);
const OUT = process.env['AGENT_COST_OUT'] ?? 'comparison/agent-cost/results';
const PAIRS = 3;
// Calls issued back to back for the synchronous part (one call is below the timers' resolution).
const ISSUE_BURST = 1_000;
const QUIET_MS = 2_000;
const PAGES = [
  { name: 'idle', url: '/isoloop/?agent=idle', warmMs: 3_000 },
  { name: 'plant-5khz', url: '/isoloop/?rate=5&seed=7&placement=matched', warmMs: 6_000 },
] as const;
const LIBRARY = z
  .object({ version: z.string() })
  .parse(JSON.parse(readFileSync('node_modules/@isoloop/host/package.json', 'utf8'))).version;

async function taskSeconds(cdp: CDPSession | null): Promise<number | null> {
  if (cdp === null) return null;
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')?.value ?? null;
}

async function mode(page: Page, cdp: CDPSession | null, concurrency: number): Promise<ModeResult> {
  const rttMs: number[] = [];
  const issueMsPerCall: number[] = [];
  let wallMs = 0;
  let quietTask = 0;
  let quietWall = 0;
  let callTask = 0;
  for (let i = 0; i < PAIRS; i++) {
    const q0 = await taskSeconds(cdp);
    const w0 = Date.now();
    await page.waitForTimeout(QUIET_MS);
    const q1 = await taskSeconds(cdp);
    quietWall += Date.now() - w0;
    if (q0 !== null && q1 !== null) quietTask += (q1 - q0) * 1000;

    const c0 = await taskSeconds(cdp);
    const r = await page.evaluate(
      ([n, c]) => {
        if (!window.agentCost) throw new Error('not a PLANT_AGENT_COST=1 build');
        return window.agentCost(n, c);
      },
      [CALLS, concurrency] as const,
    );
    const c1 = await taskSeconds(cdp);
    rttMs.push(...r.rttMs);
    wallMs += r.wallMs;
    if (c0 !== null && c1 !== null)
      callTask += (c1 - c0) * 1000 - (quietTask / quietWall) * r.wallMs;
    issueMsPerCall.push(
      await page.evaluate((k) => window.agentCostIssue?.(k) ?? Number.NaN, ISSUE_BURST),
    );
  }
  return {
    calls: CALLS * PAIRS,
    concurrency,
    rttMs,
    issueMsPerCall,
    wallMs,
    mainMsPerCall: cdp === null ? null : callTask / (CALLS * PAIRS),
  };
}

test.describe.configure({ mode: 'serial' });

for (let round = 1; round <= ROUNDS; round++) {
  for (const p of PAGES) {
    test(`round ${round}: ${p.name}`, async ({ browser, browserName, baseURL }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext(baseURL === undefined ? {} : { baseURL });
      const page = await context.newPage();
      const cdp = browserName === 'chromium' ? await context.newCDPSession(page) : null;
      await cdp?.send('Performance.enable', { timeDomain: 'timeTicks' });
      await page.goto(p.url);
      await page.waitForFunction(() => window.agentCostReady !== undefined, null, {
        timeout: 30_000,
      });
      await page.evaluate(() => window.agentCostReady);
      await page.waitForTimeout(p.warmMs);
      const modes = [await mode(page, cdp, 1), await mode(page, cdp, 8)];
      for (const m of modes) expect(m.rttMs).toHaveLength(m.calls);
      const run: Run = { engine: browserName, page: p.name, round, library: LIBRARY, modes };
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `${browserName}-r${round}-${p.name}.json`), JSON.stringify(run));
      await context.close();
    });
  }
}
