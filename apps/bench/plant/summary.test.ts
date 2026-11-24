import { describe, expect, it } from 'vitest';
import type { Result } from './lib/compare/pairs.ts';
import { isoloopVersion, PAIRS } from './run.ts';
import { collect, difference, markdown, value, type Environment } from './summary.ts';

const ENV: Environment = {
  version: '0.1.0',
  packages: { react: '19.3.1', '@playwright/test': '1.65.0' },
  browsers: { chromium: '158.0.8127.18', firefox: '146.0' },
  machine: {
    cpu: 'x86-64 test CPU',
    cpus: '2,4,6,8',
    clock: '2.0 GHz',
    memoryGb: 32,
    os: 'Ubuntu 24.04',
    node: '26.13.0',
    image: 'plant-bench',
  },
  started: '2026-11-24T20:00:00.000Z',
  rounds: 2,
};

const result = (
  key: string,
  run: number,
  figures: Record<string, number | null>,
  engine = 'chromium',
  rate = 5,
): Result => {
  const [build = '', placement = null] = key.split(':');
  return { engine, build, placement, value: rate, stopped: false, figures, run, key };
};

const SEL = {
  pairs: [{ a: 'native-workers', b: 'isoloop:matched' }],
  extras: ['isoloop:split'],
};

const RESULTS: Result[] = [
  result('native-workers', 1, { mainThreadCpuPct: 79, typingMedianMs: 62, allWidgetsMs: 2100 }),
  result('isoloop:matched', 1, { mainThreadCpuPct: 27, typingMedianMs: 41, allWidgetsMs: 1500 }),
  result('native-workers', 2, { mainThreadCpuPct: 81, typingMedianMs: 60, allWidgetsMs: 2000 }),
  result('isoloop:matched', 2, { mainThreadCpuPct: 29, typingMedianMs: 70, allWidgetsMs: 1450 }),
  result('isoloop:split', 1, { mainThreadCpuPct: 13 }),
  {
    ...result('isoloop:split', 2, {}),
    stopped: true,
    stage: 'load',
    error: 'no result within 180 s',
  },
  result('native-workers', 1, { typingMedianMs: 115, mainThreadCpuPct: null }, 'firefox'),
  result('isoloop:matched', 1, { typingMedianMs: 105, mainThreadCpuPct: null }, 'firefox'),
];

describe('plant-bench summary', () => {
  it('pairs each round and takes medians, Δ and spread', () => {
    const s = collect(RESULTS, SEL, ENV);
    const busy = s.pairs.find((p) => p.engine === 'chromium' && p.figure === 'mainThreadCpuPct');
    expect(busy).toMatchObject({
      aMedian: 80,
      bMedian: 28,
      delta: -52,
      spread: [-52, -52],
      rounds: 2,
    });
    const typing = s.pairs.find((p) => p.engine === 'chromium' && p.figure === 'typingMedianMs');
    expect(typing).toMatchObject({ delta: -5.5, spread: [-21, 10] });
    // Firefox has no CPU figures: rows with nothing on either side are left out.
    expect(s.pairs.some((p) => p.engine === 'firefox' && p.figure === 'mainThreadCpuPct')).toBe(
      false,
    );
    expect(s.extras).toEqual([
      {
        engine: 'chromium',
        rate: 5,
        config: 'isoloop:split',
        figure: 'mainThreadCpuPct',
        median: 13,
      },
    ]);
    expect(s.stopped).toHaveLength(1);
  });

  it('writes points, seconds from 1000 ms, and the sign', () => {
    expect(value(1500, 'ms')).toBe('1.5 s');
    expect(value(999, 'ms')).toBe('999 ms');
    expect(difference(-52, '%', 80)).toBe('−52 points');
    expect(difference(1, '%', 80)).toBe('+1 point');
    expect(difference(-600, 'ms', 2050)).toBe('−600 ms (−29%)');
    expect(difference(41, 'MB', 200)).toBe('+41 MB (+21%)');
  });

  it('puts the findings first, then the tables under "Lower is better", then folded details', () => {
    const md = markdown(collect(RESULTS, SEL, ENV), 'pnpm --filter ./apps/bench/plant bench');
    const at = (s: string): number => md.indexOf(s);
    expect(at('## What we found')).toBeGreaterThan(0);
    expect(at('## What we found')).toBeLessThan(at('## The figures'));
    expect(at('Lower is better.')).toBeLessThan(at('| Figure | A | B | Δ (B − A) |'));
    expect(at('## The figures')).toBeLessThan(at('## Details'));
    expect(at('## Details')).toBeLessThan(at('<details>'));
    expect(md).toContain(
      '- Main-thread busy: 28% against 80%, 52 points lower (better), in all 2 rounds.',
    );
    expect(md).toContain('the rounds ranged from −21 ms to +10 ms');
    expect(md).toContain('CPUs 2,4,6,8 at 2.0 GHz');
    expect(md).toContain('Chromium 158.0.8127.18, Firefox 146.0');
    expect(md).not.toMatch(/\bpp\b|TL;DR/);
    expect(md).toContain('no result within 180 s');
  });
});

describe('plant-bench run', () => {
  it('refuses mixed @isoloop/* versions', () => {
    const same = Object.fromEntries(
      ['bus', 'codec', 'host', 'protocol', 'react', 'runtime', 'vite'].map((p) => [
        `@isoloop/${p}`,
        '0.2.0',
      ]),
    );
    expect(isoloopVersion(same)).toBe('0.2.0');
    expect(() => isoloopVersion({ ...same, '@isoloop/bus': '0.1.0' })).toThrow(/more than one/);
  });

  it('keeps the fixed pairs', () => {
    expect(PAIRS).toEqual(['native=isoloop:one', 'native-workers=isoloop:matched']);
  });
});
