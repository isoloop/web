/** @jsxImportSource preact */
import { mkdtempSync, writeFileSync } from 'node:fs';
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
  it('reads the runs the site shows today, plant at next.b8ffdcf on the 4-core machine', () => {
    const b = loadBenchmarks(manifest, repo);
    expect(b.latest.version).toBe('0.0.0-next.b8ffdcf');
    expect(b.latest.date).toBe('2026-11-13');
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
    expect(typing).toMatchObject({ aMedian: 62, bMedian: 41, delta: -28 });
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
      'Measured on plant at <code>@isoloop/*@0.0.0-next.b8ffdcf</code>, 13 November 2026, on 4 cores fixed at 2.0 GHz.',
    );
  });

  it('describes the machine generically, the model only in the raw environment.json', () => {
    const html = page(b);
    expect(html).toContain(
      'An x64 CPU, 4 cores fixed at 2.0 GHz (CPUs 2, 4, 6, 8), 30 GB, Ubuntu 24.04.3, Node 26.13.0, in <code>mcr.microsoft.com/playwright:v1.64.1-noble</code>. The machine does nothing else during a run.',
    );
    expect(html).not.toContain(b.latest.environment.machine.cpu);
    expect(html).not.toMatch(/\b(AMD|Intel)\b/);
    expect(html).toContain(
      '<a href="https://github.com/isoloop/web/blob/main/apps/dashboards/plant/comparison/final/environment.json">the machine and versions</a>',
    );
  });

  it('opens with what we found, then the charts with the measured paired Δ', () => {
    const html = page(b);
    expect(html.indexOf('id="found"')).toBeLessThan(html.indexOf('id="figures"'));
    expect(html).toContain('typing, 28 ms lower');
    expect(html).toContain('main thread busy, 53 points lower');
    expect(html).toContain('Main thread busy');
    expect(html).not.toContain('Main-thread busy');
    expect(html).toContain('28 ms lower, better');
    expect(html).not.toContain('21 ms lower');
    // All 72 widgets: the rounds disagree, so neither better nor worse.
    expect(html).toContain('719 ms lower, within the spread');
    expect(html).toContain('Isoloop matched, within the spread');
  });

  it('folds the full tables under the charts, signed, in seconds from 1000 ms', () => {
    const html = page(b);
    expect(html).toMatch(/<details class="docs-fold bench-fold">/);
    expect(html).toContain('<td>−28 ms</td><td>−41 ms to −14 ms</td>');
    expect(html).toContain('<td>2.3 s</td><td>1.5 s</td>');
  });

  it('hides the history until there are two runs, then flags a change beyond the spread', () => {
    expect(page(b)).not.toContain('id="history"');
    const next: BenchRun = {
      ...b.latest,
      name: 'plant-bench',
      version: '0.1.0',
      pairs: b.latest.pairs.map(shift),
    };
    const html = page({ runs: [b.latest, next], latest: next });
    expect(html).toContain('id="history"');
    expect(html).toContain(
      '<td data-changed>+10 ms<span class="ui-verdict"> changed beyond the spread</span></td>',
    );
    expect(html).toContain('Measured on plant-bench at <code>@isoloop/*@0.1.0</code>');
  });
});
