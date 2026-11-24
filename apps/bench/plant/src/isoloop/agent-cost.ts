// The agent-call cost (M4a task 13, decision 20), in `PLANT_AGENT_COST=1`
// builds only: main.isoloop.tsx imports this module behind that build flag,
// so other builds contain none of it.
//
// It spawns the ping isolate and gives the run `window.agentCost(...)`, which
// makes `n` calls to `kernel.request` with at most `concurrency` in flight and
// returns each call's round trip, and `window.agentCostIssue(k)`, which issues
// `k` calls back to back without awaiting and returns how long issuing them
// held the main thread, per call. (A single call is under the timers'
// resolution: 0.1 ms in Chromium without cross-origin isolation, 1 ms in Firefox.)
/* oxlint-disable no-await-in-loop -- calls go one after another on purpose: a lane keeps one call in flight */
import ping from '../isolates/ping?isolate';
import { agentCostTopic } from './agent-cost-topic';
import { kernel } from './kernel';

const ping$ = agentCostTopic();

export type AgentCostRun = {
  /** Each call's round trip, from just before `kernel.request` to its reply, in ms. */
  rttMs: number[];
  /** Wall time for all `n` calls, in ms. */
  wallMs: number;
};

declare global {
  interface Window {
    /** The agent-call cost's runner (PLANT_AGENT_COST=1 builds only). */
    agentCost?: (n: number, concurrency: number) => Promise<AgentCostRun>;
    /** Issues `k` calls back to back; ms per call until each `kernel.request(...)` returned. */
    agentCostIssue?: (k: number) => Promise<number>;
    /** Resolves once the ping isolate has answered one call. */
    agentCostReady?: Promise<void>;
  }
}

kernel.spawn({ id: 'bench-ping', src: ping, grants: { publish: [], subscribe: [ping$.name] } });

async function one(n: number, rtt: number[]): Promise<void> {
  const t0 = performance.now();
  await kernel.request(ping$, { n, sentAt: t0 }, { timeoutMs: 10_000 });
  rtt.push(performance.now() - t0);
}

window.agentCost = async (n, concurrency) => {
  const rttMs: number[] = [];
  let next = 0;
  const t0 = performance.now();
  const lane = async (): Promise<void> => {
    while (next < n) await one(next++, rttMs);
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, lane));
  return { rttMs, wallMs: performance.now() - t0 };
};

window.agentCostIssue = async (k) => {
  const ps: Promise<unknown>[] = [];
  const t0 = performance.now();
  for (let i = 0; i < k; i++)
    ps.push(kernel.request(ping$, { n: i, sentAt: t0 }, { timeoutMs: 10_000 }));
  const t1 = performance.now();
  await Promise.all(ps);
  return (t1 - t0) / k;
};

// The first call waits out the bus and the isolate's start; retry until it answers.
window.agentCostReady = (async () => {
  for (;;) {
    try {
      await kernel.request(ping$, { n: -1, sentAt: performance.now() }, { timeoutMs: 2_000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
})();
