// The File processor's comparison (M3h decision 23): the same processors
// placed three ways, run interleaved for N rounds, one page at a time, by
// e2e/comparison.spec.ts. The runner is the shared `compare/pairs`
// (packages/compare); this file says what's the processor's: its projects,
// its load knob (the mix) and its figures. final/README.md has the bench
// server's command.
//
//   node comparison/run.ts \
//     --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
//     --pair isoloop:one-off=isoloop:one --mixes normal,faults,faults-calm --rounds 5 \
//     --hold 0 --warm 20 --window 20 --engines chromium,firefox \
//     --out comparison/v0.3.0/results
//
// `COMPARE_RATE` sets the generator's files per second (default 50).
import { resolve } from 'node:path';
import { runPairs, type PairsApp } from 'compare/pairs';

const MIXES = ['normal', 'faults', 'faults-calm'] as const;

export const PROCESSOR: PairsApp = {
  title: 'File processor, placements compared',
  dir: resolve(import.meta.dirname, '..'),
  projects: { chromium: 'comparison', firefox: 'comparison-firefox' },
  knob: {
    option: 'mixes',
    env: 'COMPARE_MIXES',
    default: 'normal',
    field: 'mix',
    label: (m) =>
      m === 'faults' ? 'With faults' : m === 'faults-calm' ? 'Faults, then calm' : 'Normal',
    order: MIXES,
  },
  figures: [
    { key: 'workers', label: 'Workers (bus excluded)', unit: '' },
    { key: 'jobsPerSec', label: 'Files done per second', unit: '', digits: 1 },
    { key: 'p50Ms', label: 'Latency per file, p50', unit: ' ms' },
    { key: 'p95Ms', label: 'Latency per file, p95', unit: ' ms' },
    { key: 'typingMedianMs', label: 'Typing (median of 5)', unit: ' ms' },
    { key: 'moves', label: 'Moves in the window', unit: '' },
    { key: 'workersAfterFaults', label: 'Workers after the faults (faults, then calm)', unit: '' },
    { key: 'workersEnd', label: 'Workers at the end of the window', unit: '' },
    {
      key: 'workersFewestCalm',
      label: 'Fewest workers in the calm (faults, then calm)',
      unit: '',
    },
    { key: 'movesTotal', label: 'Moves in the whole run', unit: '' },
    { key: 'backlogMoves', label: 'Moves for a rising backlog', unit: '' },
    { key: 'packs', label: 'Packs back', unit: '' },
    { key: 'moveCostMedianMs', label: 'Move cost, median (stop to first beat)', unit: ' ms' },
    { key: 'noted', label: 'Spikes only noted', unit: '' },
    { key: 'behind', label: 'Behind events', unit: '' },
    { key: 'queueAtStop', label: 'Queue when the generator stops', unit: '' },
    { key: 'drainMs', label: 'Drain after the generator stops', unit: ' ms' },
    { key: 'lost', label: 'Files without a result 2 min after the generator stops', unit: '' },
    { key: 'failed', label: 'Processors the kernel gave up on', unit: '' },
    { key: 'givenUpKinds', label: 'Kinds with every processor given up on', unit: '' },
    { key: 'duplicates', label: 'Files done twice', unit: '' },
    { key: 'mainThreadCpuPct', label: 'Main-thread CPU', unit: '%' },
    { key: 'rendererCpuPct', label: 'CPU, all threads', unit: '%' },
    { key: 'rendererPssGcMb', label: 'Memory after GC', unit: ' MB' },
  ],
};

if (import.meta.main) runPairs(PROCESSOR);
