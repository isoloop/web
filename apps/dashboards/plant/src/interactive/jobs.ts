// The interactive page's headless isolates: per machine its feed, FFT and
// health engines (the tee versions in isolates/), and the fleet engine. No
// stats engine: the page offers nothing it computes. Each machine's jobs
// share a pool, as in plant's `matched` placement; the fleet engine has its
// own worker.
import type { Grants } from '@isoloop/protocol';
import { MACHINES, type MachineId } from '../core/machines';
import { of, type StreamName } from '../core/streams';
import fleet from '../isolates/fleet?isolate';
import { topicName } from '../isoloop/names';
import { MERGED } from './catalog';
import fft from './isolates/fft?isolate';
import feed from './isolates/feed?isolate';
import health from './isolates/health?isolate';

export interface Job {
  id: string;
  src: string;
  grants: Grants;
  config?: unknown;
  pool?: string;
}

const t = (...xs: StreamName[]): string[] => xs.map(topicName);
const TIMINGS = topicName('timings');

function machineJobs(m: MachineId, seed: number, rateKHz: number): Job[] {
  const config = { machine: m, seed, rateKHz };
  const job = (kind: string, src: string, grants: Grants): Job => ({
    id: `${kind}-${m}`,
    src,
    grants,
    config,
    pool: `data-${m}`,
  });
  return [
    job('feed', feed, {
      publish: [...t(of(m, 'vib'), of(m, 'scalars')), MERGED.scalars],
      subscribe: [],
    }),
    job('fft', fft, {
      publish: [...t(of(m, 'spectrum')), MERGED.spectrum, TIMINGS],
      subscribe: t(of(m, 'vib')),
    }),
    job('health', health, {
      publish: [...t(of(m, 'health'), 'alarms', 'events'), MERGED.health, TIMINGS],
      subscribe: t(of(m, 'health'), of(m, 'scalars'), of(m, 'spectrum')),
    }),
  ];
}

export function jobs(seed: number, rateKHz: number): Job[] {
  return [
    ...MACHINES.flatMap((m) => machineJobs(m, seed, rateKHz)),
    {
      id: 'fleet',
      src: fleet,
      grants: { publish: [topicName('fleet'), TIMINGS], subscribe: ['plant.*.health'] },
    },
  ];
}
