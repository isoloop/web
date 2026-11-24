// pnpm bench [options]: opens one page per run, writes one JSON per run.
//
//   --tier cheap|regular|heavy|all   (default all; comma list ok)
//   --workloads a,b                  instead of tiers
//   --n 1,4                          copies at once (default 1,4)
//   --placements p,q                 subset of native-main, native-worker, isoloop-own, isoloop-one, isoloop-balancer
//   --scenario                       add the balancer's mixed scenario; --scenario-only for just it
//   --engines chromium[,firefox]     (default chromium)
//   --rounds 3 --warm 10 --window 60 (seconds) --balancer-warm 30
//   --quick                          5 s + 10 s, 1 round (balancer warm 15 s, scenario 15 + 20 s)
//   --profile base                   label: the CPU profile this runs under (server-run.sh sets it)
//   --max-workers 4                  the balancer's cap (server-run.sh sets it from the profile)
//   --out results/<version>/<profile> (default)   --resume skips runs whose JSON exists
//
// It exits with 1 when any page stopped (an error or a timeout), after writing
// every result and the summary: the CI smoke (bench.yml) fails on that.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ENGINES, launch, runPage } from './browser.ts';
import { oneOf, readJson } from './read.ts';
import { ensureBuilt, ROOT } from './build.ts';
import { environment } from './env.ts';
import { groups, schedule } from './matrix.ts';
import { serve } from './serve.ts';
import { writeSummary } from './summary.ts';
import { TIERS, type Tier } from '../src/workloads/index.ts';
import { PLACEMENTS } from '../src/page/types.ts';

const { values: a } = parseArgs({
  options: {
    tier: { type: 'string', default: 'all' },
    workloads: { type: 'string' },
    n: { type: 'string', default: '1,4' },
    placements: { type: 'string' },
    scenario: { type: 'boolean', default: false },
    'scenario-only': { type: 'boolean', default: false },
    engines: { type: 'string', default: 'chromium' },
    rounds: { type: 'string' },
    warm: { type: 'string' },
    window: { type: 'string' },
    'balancer-warm': { type: 'string' },
    quick: { type: 'boolean', default: false },
    profile: { type: 'string', default: process.env.JSBENCH_PROFILE ?? 'local' },
    'max-workers': { type: 'string', default: process.env.JSBENCH_MAX_WORKERS ?? '4' },
    out: { type: 'string' },
    resume: { type: 'boolean', default: false },
    seed: { type: 'string', default: '1' },
  },
});

const sec = (v: string | undefined, quick: number, full: number): number =>
  1000 * Number(v ?? (a.quick ? quick : full));
const opts = {
  tiers: a.tier === 'all' ? TIERS : oneOf<Tier>(a.tier, TIERS, 'tier'),
  ns: a.n.split(',').map(Number),
  scenario: a.scenario,
  scenarioOnly: a['scenario-only'],
  warmMs: sec(a.warm, 5, 10),
  windowMs: sec(a.window, 10, 60),
  balancerWarmMs: sec(a['balancer-warm'], 15, 30),
  scenarioWarmMs: sec(a['balancer-warm'], 15, 30),
  scenarioWindowMs: sec(a.window, 20, 120),
  ...(a.workloads ? { workloads: a.workloads.split(',') } : {}),
  ...(a.placements ? { placements: oneOf(a.placements, PLACEMENTS, 'placement') } : {}),
};
const rounds = Number(a.rounds ?? (a.quick ? 1 : 3));
const engines = oneOf(a.engines, ENGINES, 'engine');
const maxWorkers = Number(a['max-workers']);
// Results by the Isoloop version measured: results/<version>/<profile>[-quick].
const isoloopVersion = readJson<{ version: string }>(
  resolve(ROOT, 'node_modules/@isoloop/host/package.json'),
).version;
const out = resolve(
  ROOT,
  a.out ?? `results/${isoloopVersion}/${a.profile}${a.quick ? '-quick' : ''}`,
);

const calPath = resolve(ROOT, 'calibration.json');
if (!existsSync(calPath))
  throw new Error('No calibration.json: run `pnpm calibrate` on this machine first.');
const calibration = readJson<{
  workloads: { id: string; batch: number; perOpUs: number }[];
}>(calPath);
const batchOf = new Map(calibration.workloads.map((w) => [w.id, w.batch]));

const plan = schedule(groups(opts), rounds);
const todo = (engine: string) =>
  plan.filter(
    ({ job, round }) =>
      !(
        a.resume && existsSync(resolve(out, engine, `${job.key}--${job.placement}--r${round}.json`))
      ),
  );
const totalMs = engines.reduce(
  (t, e) => t + todo(e).reduce((s, p) => s + p.job.warmMs + p.job.windowMs + 3000, 0),
  0,
);
console.log(
  `${plan.length * engines.length} runs, about ${(totalMs / 3_600_000).toFixed(1)} h → ${out}`,
);

ensureBuilt();
mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, 'run.json'),
  `${JSON.stringify({ args: a, opts, rounds, engines, maxWorkers, env: environment(ROOT), calibration }, null, 2)}\n`,
);
const server = await serve(resolve(ROOT, 'dist'));
let stopped = 0;

// One page at a time, in order: each run has the machine to itself.
/* oxlint-disable no-await-in-loop */
for (const engine of engines) {
  const dir = resolve(out, engine);
  mkdirSync(dir, { recursive: true });
  let browser = await launch(engine);
  let k = 0;
  for (const { job, round } of plan) {
    k++;
    const file = resolve(dir, `${job.key}--${job.placement}--r${round}.json`);
    if (a.resume && existsSync(file)) continue;
    const q = new URLSearchParams({
      placement: job.placement,
      copies: job.copies,
      batches: job.workloads.map((w) => `${w}:${batchOf.get(w) ?? 1}`).join(','),
      warm: String(job.warmMs),
      window: String(job.windowMs),
      seed: a.seed,
      maxWorkers: String(maxWorkers),
    });
    if (!browser.isConnected()) browser = await launch(engine);
    const started = new Date().toISOString();
    const r = await runPage(browser, `${server.url}?${q}`, job.warmMs + job.windowMs + 180_000);
    if (r.state !== 'done') stopped++;
    const total = r.state === 'done' && r.result ? Math.round(r.result.totalOpsPerMin) : null;
    console.log(
      `[${engine} ${k}/${plan.length}] r${round} ${job.key} ${job.placement}: ${r.state}${total === null ? ` ${'error' in r ? r.error : ''}` : ` ${total.toLocaleString('en')} ops/min`}`,
    );
    writeFileSync(
      file,
      `${JSON.stringify({ engine, browserVersion: browser.version(), round, started, job, profile: a.profile, maxWorkers, ...r }, null, 2)}\n`,
    );
  }
  await browser.close();
}
/* oxlint-enable no-await-in-loop */
server.close();
writeSummary(out);
console.log(`summary: ${resolve(out, 'summary.md')}`);
if (stopped > 0) {
  console.error(`${stopped} page(s) stopped before the end of their window`);
  process.exit(1);
}
