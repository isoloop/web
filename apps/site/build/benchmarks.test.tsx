/** @jsxImportSource preact */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'ui/render';
import { describe, expect, it } from 'vitest';
import { Benchmarks } from '../src/pages/benchmarks.tsx';
import {
  archOf,
  changedBeyondSpread,
  cpuCount,
  figure,
  loadBenchmarks,
  withinSpread,
  type BenchRun,
  type Benchmarks as BenchmarksData,
  type PairFigure,
} from './benchmarks.ts';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
const manifest = fileURLToPath(new URL('../content/benchmarks.json', import.meta.url));

/** A temporary repo with a manifest and summaries. */
function fixture(manifestJson: unknown, files: Record<string, unknown>): [string, string] {
  const dir = mkdtempSync(join(tmpdir(), 'bench-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(body));
  }
  const m = join(dir, 'benchmarks.json');
  writeFileSync(m, JSON.stringify(manifestJson));
  return [m, dir];
}

const page = (benchmarks: BenchmarksData): string =>
  render(<Benchmarks benchmarks={benchmarks} examples={[]} />);

/** Typing for matched on Chromium moves to +10 ms, its rounds all above zero. */
const shift = (p: PairFigure): PairFigure =>
  p.figure === 'typingMedianMs' && p.engine === 'chromium' && p.b === 'isoloop:matched'
    ? { ...p, delta: 10, spread: [5, 20] }
    : p;

describe('loadBenchmarks', () => {
  it('reads the runs the site shows today, plant-bench at 0.1.0 on the 4-core machine, after plant at next.b8ffdcf', () => {
    const b = loadBenchmarks(manifest, repo);
    expect(b.runs.map((r) => r.version)).toEqual(['0.0.0-next.b8ffdcf', '0.1.0']);
    expect(b.latest.name).toBe('plant-bench');
    expect(b.latest.date).toBe('2026-11-24');
    expect(cpuCount(b.latest.environment.machine.cpus)).toBe(4);
    expect(b.latest.environment.machine.clock).toBe('2.0 GHz');
    // matched against native + workers, Chromium at 5 kHz: typing's paired Δ.
    const typing = b.latest.pairs.find(
      (p) =>
        p.engine === 'chromium' &&
        p.rate === 5 &&
        p.b === 'isoloop:matched' &&
        p.figure === 'typingMedianMs',
    );
    expect(typing).toMatchObject({ aMedian: 58, bMedian: 41, delta: -18 });
  });

  it('leaves a withheld engine off the site, figures and browser version both', () => {
    const b = loadBenchmarks(manifest, repo);
    expect(b.latest.pairs.some((p) => p.engine === 'webkit')).toBe(false);
    expect(Object.keys(b.latest.environment.browsers)).toEqual(['chromium', 'firefox']);
  });

  it('fails naming the file and the field', () => {
    const [m, dir] = fixture(
      {
        runs: [
          {
            name: 'plant',
            summary: 'summary.json',
            links: {
              summary: 'https://x.test/s',
              results: 'https://x.test/r',
              environment: 'https://x.test/e',
            },
          },
        ],
      },
      { 'summary.json': { version: '0.1.0', pairs: [] } },
    );
    expect(() => loadBenchmarks(m, dir)).toThrow(/summary\.json is invalid:\n {2}environment/);
    const [bad, dir2] = fixture({ runs: [] }, {});
    expect(() => loadBenchmarks(bad, dir2)).toThrow(/benchmarks\.json is invalid/);
  });
});

// The home page's four figures: plant-bench's results/0.1.0 summary.md, Chromium
// at 5 kHz, native-workers (A) against isoloop:matched (B).
describe('figure', () => {
  const { latest } = loadBenchmarks(manifest, repo);
  const q = { engine: 'chromium', rate: 5, a: 'native-workers', b: 'isoloop:matched' };
  const at = (f: PairFigure['figure']): number[] => {
    const { aMedian, bMedian, delta } = figure(latest, { ...q, figure: f });
    return [Math.round(aMedian), Math.round(bMedian), Math.round(delta)];
  };

  it('gives the landing page’s four figures, with the paired Δ', () => {
    expect(at('mainThreadCpuPct')).toEqual([78, 24, -54]);
    expect(at('typingMedianMs')).toEqual([58, 41, -18]);
    expect(at('rendererCpuPct')).toEqual([97, 112, 19]);
    expect(at('rendererPssGcMb')).toEqual([227, 272, 46]);
  });

  it('names a figure the run doesn’t have', () => {
    expect(() => figure(latest, { ...q, engine: 'firefox', figure: 'mainThreadCpuPct' })).toThrow(
      /no mainThreadCpuPct for native-workers against isoloop:matched, firefox at 5 kHz/,
    );
  });
});

describe('spreads', () => {
  it('calls a Δ whose rounds disagree on its sign within the spread', () => {
    expect(withinSpread({ spread: [-793, 1019] })).toBe(true);
    expect(withinSpread({ spread: [-41, -14] })).toBe(false);
    expect(withinSpread({ spread: null })).toBe(false);
  });

  it('flags a change between runs only when their spreads don’t overlap', () => {
    expect(changedBeyondSpread({ spread: [-41, -14] }, { spread: [-20, -5] })).toBe(false);
    expect(changedBeyondSpread({ spread: [-41, -14] }, { spread: [-10, 4] })).toBe(true);
  });

  it('names the architecture, never the CPU model', () => {
    expect(archOf({ cpu: 'AMD Example 8-Core' })).toBe('x64');
    expect(archOf({ cpu: 'Intel(R) Xeon(R) CPU' })).toBe('x64');
    expect(archOf({ cpu: 'Neoverse-N1' })).toBe('arm64');
    expect(archOf({ cpu: 'Some CPU', arch: 'arm64' })).toBe('arm64');
    expect(archOf({ cpu: 'unknown' })).toBeUndefined();
  });

  it('counts the CPUs a run was allowed', () => {
    expect(cpuCount('2,4,6,8')).toBe(4);
    expect(cpuCount('2-5,8')).toBe(5);
  });
});

describe('/benchmarks/', () => {
  const b = loadBenchmarks(manifest, repo);

  it('labels the figures with what they were measured on', () => {
    expect(page(b)).toContain(
      'Measured on plant-bench at <code>@isoloop/*@0.1.0</code>, 24 November 2026, on 4 cores fixed at 2.0 GHz.',
    );
  });

  it('describes the machine generically, the model only in the raw environment.json', () => {
    const html = page(b);
    expect(html).toContain(
      'An x64 CPU, 4 cores fixed at 2.0 GHz (CPUs 2, 4, 6, 8), 31 GB, Ubuntu 24.04.5 LTS, Node 26.13.0, in <code>mcr.microsoft.com/playwright:v1.65.0-noble, Node 26.13.0, pnpm 12.16.1</code>. The machine does nothing else during a run.',
    );
    expect(html).not.toContain(b.latest.environment.machine.cpu);
    expect(html).not.toMatch(/\b(AMD|Intel)\b/);
    expect(html).toContain(
      '<a href="https://github.com/isoloop/web/blob/main/apps/bench/plant/results/0.1.0/environment.json">the machine and versions</a>',
    );
  });

  it('opens with what we found, then the charts with the measured paired Δ', () => {
    const html = page(b);
    expect(html.indexOf('id="found"')).toBeLessThan(html.indexOf('id="figures"'));
    expect(html).toContain('typing, 32 ms lower');
    expect(html).toContain('main thread busy, 54 points lower');
    expect(html).toContain('Main thread busy');
    expect(html).not.toContain('Main-thread busy');
    expect(html).toContain('32 ms lower, better');
    expect(html).not.toContain('17 ms lower');
    // Typing and all 72 widgets for matched: the rounds disagree, so neither better nor worse.
    expect(html).toContain('18 ms lower, within the spread');
    expect(html).toContain('787 ms lower, within the spread');
    expect(html).toContain('Isoloop matched, within the spread');
  });

  it('folds the full tables under the charts, signed, in seconds from 1000 ms', () => {
    const html = page(b);
    expect(html).toMatch(/<details class="docs-fold bench-fold">/);
    expect(html).toContain('<td>−18 ms</td><td>−40 ms to +1 ms</td>');
    expect(html).toContain('<td>2.3 s</td><td>1.5 s</td>');
  });

  it('hides the history until there are two runs of the same build, then flags a change beyond the spread', () => {
    // plant at next.b8ffdcf is another build, so 0.1.0 alone has no history; it stays under Raw results.
    expect(page(b)).not.toContain('id="history"');
    expect(page(b)).not.toContain('href="#history"');
    expect(page(b)).toContain('plant at 0.0.0-next.b8ffdcf, 2026-11-13');
    const next: BenchRun = {
      ...b.latest,
      name: 'plant-bench',
      version: '0.2.0',
      pairs: b.latest.pairs.map(shift),
    };
    const html = page({ runs: [...b.runs, next], latest: next });
    expect(html).toContain('id="history"');
    const history = html.slice(html.indexOf('id="history"'), html.indexOf('id="method"'));
    expect(history).toContain('0.1.0');
    expect(history).not.toContain('b8ffdcf');
    expect(html).toContain(
      '<td data-changed>+10 ms<span class="ui-verdict"> changed beyond the spread</span></td>',
    );
    expect(html).toContain('Measured on plant-bench at <code>@isoloop/*@0.2.0</code>');
  });
});

describe('/benchmarks/, plain JavaScript work', () => {
  const b = loadBenchmarks(manifest, repo);
  const js = b.js;
  if (!js) throw new Error('content/benchmarks.json lists no js-bench run');

  it('reads js-bench 0.1.0 on bench machine 1, complete', () => {
    expect(js.summary).toMatchObject({
      version: '0.1.0',
      date: '2026-11-24',
      machine: 'bench-machine-1',
      cores: 4,
      clock: '2.0 GHz',
      failed: 0,
    });
    const clone = js.summary.engines[0]!.workloads.find(
      (f) => f.workload === 'structured-clone-5mb' && f.n === 4 && f.placement === 'isoloop-own',
    );
    expect(clone?.opsPerSec).toBeCloseTo(20.5, 1);
  });

  it('comes after the plant sections and before the raw results, in the navigation too', () => {
    const html = page(b);
    expect(html.indexOf('id="features"')).toBeLessThan(html.indexOf('id="js"'));
    expect(html.indexOf('id="js"')).toBeLessThan(html.indexOf('id="raw"'));
    expect(html).toContain('<a href="#js">Plain JavaScript work</a>');
    expect(page({ ...b, js: undefined })).not.toContain('id="js"');
  });

  it('labels it with the bench, version, date, browser and machine, linking the machine', () => {
    expect(page(b)).toContain(
      'Measured on js-bench at <code>@isoloop/*@0.1.0</code>, 24 November 2026, Chromium 158, on <a href="https://github.com/isoloop/web/blob/main/apps/bench/machines.md">bench machine 1</a>, 4 cores fixed at 2.0 GHz.',
    );
    expect(page(b)).toContain('This run is Chromium only.');
  });

  it('finds in operations per second, both directions, with the open cost linked', () => {
    const html = page(b);
    expect(html).toContain('Within 2% on 16 of 17 workloads');
    expect(html).toContain('20.5 against 25.1 (19% fewer)');
    expect(html).toContain('4,654 against 2,806 (66% more)');
    expect(html).toContain('<a href="https://github.com/isoloop/isoloop/issues/441">');
  });

  it('charts each workload at four copies, plain Workers against Isoloop, and folds all five placements', () => {
    const html = page(b);
    expect(html).toContain('2,430,537 ops/s');
    expect(html).toContain('19% lower, worse');
    expect(html).toMatch(/Isoloop balancer<\/th><th scope="col" data-num>Balancer moves/);
    expect(html).toContain('All copies, summed');
  });

  it('names no CPU brand or model, and no em dash', () => {
    const i = page(b).indexOf('id="js"');
    const section = page(b).slice(i, page(b).indexOf('id="raw"'));
    expect(section).not.toMatch(/\b(AMD|Intel|Ryzen)\b/);
    expect(section).not.toContain('—');
  });

  it('refuses a js-bench run with stopped pages, naming the file', () => {
    const summary = { ...js.summary, failed: 2 };
    const [m, dir] = fixture(
      {
        runs: [
          {
            name: 'plant',
            summary: 'plant.summary.json',
            links: {
              summary: 'https://x.test/s',
              results: 'https://x.test/r',
              environment: 'https://x.test/e',
            },
          },
        ],
        js: {
          summary: 'js.summary.json',
          links: {
            summary: 'https://x.test/s',
            results: 'https://x.test/r',
            machine: 'https://x.test/m',
            bench: 'https://x.test/b',
          },
        },
      },
      {
        'plant.summary.json': JSON.parse(
          readFileSync(join(repo, 'apps/dashboards/plant/comparison/final/summary.json'), 'utf8'),
        ),
        'js.summary.json': summary,
      },
    );
    expect(() => loadBenchmarks(m, dir)).toThrow(/js\.summary\.json: 2 runs stopped/);
    writeFileSync(
      join(dir, 'js.summary.json'),
      JSON.stringify({ ...summary, machine: 'hauseserver' }),
    );
    expect(() => loadBenchmarks(m, dir)).toThrow(/js\.summary\.json is invalid:\n {2}machine/);
  });
});
