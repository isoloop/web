// plant-bench's run (README.md): the fixed matrix, on the `@isoloop/*`
// version installed here, into results/<version>/.
//
//   node run.ts                      the full run (README.md, decision 6)
//   node run.ts --smoke              one short round, Chromium, 1 kHz, into
//                                    results-smoke/ (CI, check it builds and runs)
//   node run.ts --summary-only [--out results/0.1.0]
//                                    rebuild summary.md and summary.json
//
// The matrix isn't an argument: builds native, native + workers, Isoloop
// `one`, `matched` and `split`; 1 and 5 kHz; Chromium, Firefox and WebKit;
// 5 interleaved rounds. The rounds and the pages are run by the vendored
// pairs runner (lib/compare/pairs.ts), one page at a time.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus as osCpus, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, firefox, webkit } from '@playwright/test';
import { readResults, runPairs, type PairsApp, type Selection } from './lib/compare/pairs.ts';
import { collect, ENVIRONMENT, FIGURES, markdown, type Environment } from './summary.ts';

const DIR = import.meta.dirname;

export const PAIRS = ['native=isoloop:one', 'native-workers=isoloop:matched'] as const;
export const EXTRAS = ['isoloop:split'] as const;
export const FULL = {
  rates: '1,5',
  rounds: 5,
  engines: 'chromium,firefox,webkit',
  warm: 6,
  window: 10,
};
export const SMOKE = { rates: '1', rounds: 1, engines: 'chromium', warm: 2, window: 3 };

const SELECTION: Selection = {
  pairs: PAIRS.map((p) => {
    const [a = '', b = ''] = p.split('=');
    return { a, b };
  }),
  extras: EXTRAS,
};

const ISOLOOP = ['bus', 'codec', 'host', 'protocol', 'react', 'runtime', 'vite'];

const installed = (pkg: string): string => {
  const file = join(DIR, 'node_modules', pkg, 'package.json');
  const json: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const v: unknown =
    typeof json === 'object' && json !== null ? Reflect.get(json, 'version') : undefined;
  if (typeof v !== 'string') throw new Error(`${pkg}: no version in ${file}`);
  return v;
};

/** Every `@isoloop/*` package at one version, or the run refuses. */
export function isoloopVersion(versions: Record<string, string>): string {
  const found = new Set(ISOLOOP.map((p) => versions[`@isoloop/${p}`]));
  if (found.size !== 1) {
    throw new Error(`@isoloop/* resolve to more than one version: ${JSON.stringify(versions)}`);
  }
  const [v] = found;
  if (!v) throw new Error('no @isoloop/* version found');
  return v;
}

const read = (file: string): string => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

function machine(): Environment['machine'] {
  const allowed = /^Cpus_allowed_list:\s*(.+)$/m.exec(read('/proc/self/status'))?.[1] ?? '';
  const ids = allowed
    .split(',')
    .flatMap((part) => {
      const [lo = '', hi = lo] = part.split('-');
      const out: number[] = [];
      for (let i = Number(lo); i <= Number(hi); i++) out.push(i);
      return out;
    })
    .filter((n) => Number.isFinite(n));
  const clocks = new Set(
    ids
      .map((i) => Number(read(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_max_freq`)))
      .filter((khz) => khz > 0)
      .map((khz) => `${(khz / 1e6).toFixed(1)} GHz`),
  );
  const os = /^PRETTY_NAME="(.+)"$/m.exec(read('/etc/os-release'))?.[1] ?? process.platform;
  return {
    cpu: osCpus()[0]?.model.trim() ?? 'unknown',
    cpus: allowed,
    clock: [...clocks].join(', '),
    memoryGb: Math.round(totalmem() / 2 ** 30),
    os,
    node: process.versions.node,
    image: process.env['PLANT_BENCH_IMAGE'] ?? '',
  };
}

async function browsers(engines: readonly string[]): Promise<Record<string, string>> {
  const types = { chromium, firefox, webkit } as const;
  const out: Record<string, string> = {};
  for (const e of engines) {
    if (e !== 'chromium' && e !== 'firefox' && e !== 'webkit') continue;
    // oxlint-disable-next-line no-await-in-loop -- one browser at a time
    const b = await types[e].launch();
    out[e] = b.version();
    // oxlint-disable-next-line no-await-in-loop
    await b.close();
  }
  return out;
}

function app(out: string): PairsApp {
  return {
    title: 'plant-bench',
    dir: DIR,
    projects: {
      chromium: 'comparison',
      firefox: 'comparison-firefox',
      webkit: 'comparison-webkit',
    },
    knob: {
      option: 'rates',
      env: 'COMPARE_RATES',
      default: '1',
      field: 'rate',
      label: (rate) => `${rate} kHz`,
    },
    figures: FIGURES.map((f) => ({ key: f.key, label: f.label, unit: f.unit })),
    summary: (results) => {
      const env = environmentOf(out);
      const s = collect(results, SELECTION, env);
      writeFileSync(join(out, 'summary.json'), `${JSON.stringify(s, null, 2)}\n`);
      return markdown(s, COMMAND);
    },
  };
}

export const COMMAND = 'pnpm --filter ./apps/bench/plant bench';

function environmentOf(out: string): Environment {
  const env = ENVIRONMENT.parse(JSON.parse(readFileSync(join(out, 'environment.json'), 'utf8')));
  const adapted = read(join(out, 'ADAPTED.md')).trim();
  return adapted ? { ...env, adaptedFor: adapted } : env;
}

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      smoke: { type: 'boolean', default: false },
      'summary-only': { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  });
  const m = args.smoke ? SMOKE : FULL;
  const packages: Record<string, string> = Object.fromEntries(
    [...ISOLOOP.map((p) => `@isoloop/${p}`), 'react', 'react-dom', '@playwright/test'].map((p) => [
      p,
      installed(p),
    ]),
  );
  const version = isoloopVersion(packages);
  const out = resolve(DIR, args.out ?? (args.smoke ? 'results-smoke' : `results/${version}`));

  if (args['summary-only']) {
    const md = app(out).summary?.(readResults(app(out), out), SELECTION, null) ?? '';
    writeFileSync(join(out, 'summary.md'), md);
    console.log(md);
    return;
  }
  if (!args.smoke && existsSync(join(out, 'run.json'))) {
    throw new Error(`${out} already holds a run; move it away or pass --out`);
  }
  // The browsers' builds and the machine, before the pages run.
  mkdirSync(out, { recursive: true });
  const environment: Environment = {
    version,
    packages,
    browsers: await browsers(m.engines.split(',')),
    machine: machine(),
    started: new Date().toISOString(),
    rounds: m.rounds,
  };
  writeFileSync(join(out, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
  console.log(`plant-bench on @isoloop/*@${version} → ${out}`);
  runPairs(app(out), [
    ...PAIRS.flatMap((p) => ['--pair', p]),
    ...EXTRAS.flatMap((e) => ['--extra', e]),
    '--rates',
    m.rates,
    '--rounds',
    String(m.rounds),
    '--hold',
    '0',
    '--warm',
    String(m.warm),
    '--window',
    String(m.window),
    '--engines',
    m.engines,
    '--out',
    out,
  ]);
  if (args.smoke) {
    // The smoke passes when every page of the round gave a result.
    const results = readResults(app(out), out);
    const stopped = results.filter((r) => r.stopped);
    const expected = new Set([...SELECTION.pairs.flatMap((p) => [p.a, p.b]), ...EXTRAS]).size;
    if (results.length !== expected || stopped.length > 0) {
      throw new Error(
        `smoke: ${results.length} of ${expected} pages gave results, ${stopped.length} stopped`,
      );
    }
  }
}

if (import.meta.main) await main();
