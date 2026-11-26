// Memory per worker (Chromium, cross-origin isolated), after a forced GC.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chromium' });
const rows = [];
for (const remote of ['plain', 'vite', 'rsbuild']) {
  const runs = [];
  for (let i = 0; i < (+process.env.RUNS || 5); i++) {
    const p = await b.newPage();
    await p.goto(`http://localhost:5180/?mode=isolate&remote=${remote}`);
    await p.locator('#slot [data-where]').waitFor({ timeout: 15000 });
    await p.waitForTimeout(1500);
    const r = await p.evaluate(async () => {
      const m = await performance.measureUserAgentSpecificMemory();
      const workers = m.breakdown.filter((x) => x.bytes > 0 && x.attribution.some((a) => a.scope === 'DedicatedWorkerGlobalScope'));
      (globalThis).__all = m.breakdown.filter((x) => x.bytes > 0).map((x) => ({ b: x.bytes, t: x.types, a: x.attribution.map((a) => [a.scope, a.url?.slice(-40)]) }));
      return { all: globalThis.__all, coi: crossOriginIsolated, total: m.bytes, workers: workers.map((w) => ({ bytes: w.bytes, url: w.attribution[0]?.url })) };
    });
    runs.push(r);
    await p.close();
  }
  rows.push({ remote, runs });
}
console.log(JSON.stringify(rows));
await b.close();
