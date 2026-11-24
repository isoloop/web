import { describe, expect, it } from 'vitest';
import { clockOf, cpusetSize, summarize, type RunFile, type RunJson } from './summary.ts';
import type { Placement } from '../src/page/types.ts';

const RUN: RunJson = {
  env: {
    machine: 'bench-machine-1',
    cpu: 'x86-64 test CPU',
    mhz: { min: 400, max: 1996.4 },
    cpusetEffective: '2,4,6,8',
    cpuMax: 'max 100000',
    isoloop: { '@isoloop/host': '0.1.0' },
    git: 'abc1234',
    date: '2026-11-24T08:25:35.877Z',
  },
  maxWorkers: 4,
  rounds: 2,
  args: { profile: 'base' },
};

const file = (
  key: string,
  n: number,
  placement: Placement,
  round: number,
  opsPerMin: number,
  extra: Partial<RunFile> = {},
): RunFile => ({
  engine: 'chromium',
  browserVersion: '158.0.8127.18',
  round,
  job: {
    key,
    tier: key.startsWith('scenario') ? 'scenario' : 'cheap',
    n,
    placement,
    warmMs: 10_000,
    windowMs: 60_000,
  },
  state: 'done',
  result: {
    placement,
    window: { startAt: 0, endAt: 60_000 },
    copies: Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      workload: 'map-get-set',
      seed: 1,
      batch: 1,
      lives: 1,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the fields summarize() reads
      result: { checksum: 7, opsPerMin: opsPerMin / n, opP50Us: 2 } as never,
    })),
    totalOpsPerMin: opsPerMin,
    checksumsMatch: true,
    lateness: { p50Ms: 1, p95Ms: round * 2, maxMs: 9, samples: 600 },
    events:
      placement === 'isoloop-balancer'
        ? [
            { at: -5, kind: 'move', id: 'c0', detail: {} },
            { at: 5, kind: 'move', id: 'c1', detail: {} },
          ]
        : [],
    poolsAtEnd: { c0: 'p0', c1: 'p0' },
    setupMs: 10,
    userAgent: 'test',
    hardwareConcurrency: 16,
  },
  ...extra,
});

describe('summarize', () => {
  const runs = [
    file('map-get-set-n1', 1, 'native-main', 1, 600),
    file('map-get-set-n1', 1, 'native-main', 2, 1200),
    file('map-get-set-n1', 1, 'isoloop-own', 1, 900),
    file('map-get-set-n4', 4, 'isoloop-balancer', 1, 2400),
    file('map-get-set-n4', 4, 'isoloop-own', 1, 0, { state: 'error', error: 'timeout' }),
    file('scenario-mixed', 2, 'isoloop-one', 1, 1200),
  ];
  const s = summarize(runs, RUN);

  it('takes the label fields from run.json', () => {
    expect(s).toMatchObject({
      version: '0.1.0',
      date: '2026-11-24',
      machine: 'bench-machine-1',
      profile: 'base',
      cores: 4,
      clock: '2.0 GHz',
      rounds: 2,
      maxWorkers: 4,
      failed: 1,
    });
    expect(s.engines.map((e) => [e.engine, e.browser])).toEqual([['chromium', '158.0.8127.18']]);
  });

  it('gives ops/s as the median over rounds, with the min and max', () => {
    const main = s.engines[0]!.workloads.find((w) => w.n === 1 && w.placement === 'native-main');
    expect(main).toMatchObject({
      workload: 'map-get-set',
      tier: 'cheap',
      rounds: 2,
      opsPerSec: 15,
      min: 10,
      max: 20,
      opP50Us: 2,
      latenessP95Ms: 3,
      moves: [],
    });
  });

  it('counts only the balancer moves inside the window, and leaves out stopped runs', () => {
    const n4 = s.engines[0]!.workloads.filter((w) => w.n === 4);
    expect(n4.map((w) => [w.placement, w.moves])).toEqual([['isoloop-balancer', [1]]]);
  });

  it('gives the scenario per copy, with the workers used', () => {
    expect(s.engines[0]!.scenario).toEqual({
      placements: ['isoloop-one'],
      copies: [
        { id: 'c0', workload: 'map-get-set', opsPerSec: { 'isoloop-one': 10 } },
        { id: 'c1', workload: 'map-get-set', opsPerSec: { 'isoloop-one': 10 } },
      ],
      workers: { 'isoloop-one': 1 },
      latenessP95Ms: { 'isoloop-one': 2 },
    });
  });
});

describe('the label helpers', () => {
  it('counts a cpuset', () => {
    expect(cpusetSize('2,4,6,8')).toBe(4);
    expect(cpusetSize('0-3,8')).toBe(5);
    expect(cpusetSize(null)).toBeNull();
  });
  it('rounds the clock to GHz', () => {
    expect(clockOf({ max: 1996.4 })).toBe('2.0 GHz');
    expect(clockOf(null)).toBeNull();
  });
});
