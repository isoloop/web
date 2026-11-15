// The plant's head-to-head comparison: pairs of configurations (a native build
// against an Isoloop placement), run interleaved for N rounds, one page at a
// time, by e2e/comparison.spec.ts. The runner is the shared `compare/pairs`
// (packages/compare); this file says what's the plant's: its projects, its
// load knob (the vibration rate) and its figures. README.md in this folder has
// the command and the Docker line.
//
//   node comparison/run.ts \
//     --pair native=isoloop:one --pair native-workers=isoloop:matched \
//     --extra isoloop:split --rates 1,5 --rounds 5 --hold 600 \
//     --engines chromium,firefox --out comparison/matched/results
//
// Arguments (durations in seconds):
//   --pair A=B      a pair; repeat it. A is the baseline, B the Isoloop side.
//   --extra C       a configuration measured alongside, without a pair; repeatable.
//   --rates         vibration rates in kHz, comma-separated (default 1).
//   --rounds        rounds; each runs every configuration once (default 5).
//   --hold          seconds after navigation for the second memory reading
//                   (default 600; 0 skips it).
//   --warm, --window  warm-up and measuring window (defaults 6 and 10).
//   --engines       chromium, firefox, webkit (default chromium,firefox).
//   --out           results folder (default comparison/results).
//   --summary-only  rebuild summary.md from the JSON already in --out.
import { resolve } from 'node:path';
import { runPairs, type PairsApp } from 'compare/pairs';

export const PLANT: PairsApp = {
  title: 'Plant dashboard, head-to-head',
  dir: resolve(import.meta.dirname, '..'),
  projects: { chromium: 'comparison', firefox: 'comparison-firefox', webkit: 'comparison-webkit' },
  knob: {
    option: 'rates',
    env: 'COMPARE_RATES',
    default: '1',
    field: 'rate',
    label: (rate) => `${rate} kHz`,
  },
  figures: [
    { key: 'workers', label: 'Workers (Isoloop also runs the bus worker, not counted)', unit: '' },
    { key: 'framesLate', label: 'Late frames (of ~60/s × window)', unit: '' },
    { key: 'typingMedianMs', label: 'Typing (median of 5)', unit: ' ms' },
    { key: 'mainThreadCpuPct', label: 'Main-thread CPU', unit: '%' },
    { key: 'rendererCpuPct', label: 'CPU, all threads', unit: '%' },
    { key: 'rendererPssMb', label: 'Memory, first reading', unit: ' MB' },
    { key: 'rendererPssGcMb', label: 'Memory, first reading, after GC', unit: ' MB' },
    { key: 'rendererPssHoldMb', label: 'Memory at hold', unit: ' MB' },
    { key: 'rendererPssHoldGcMb', label: 'Memory at hold, after GC', unit: ' MB' },
    { key: 'firstDataMs', label: 'First data', unit: ' ms' },
    { key: 'allWidgetsMs', label: 'All 72 widgets with data', unit: ' ms' },
    { key: 'recoveryMs', label: 'Recovery after a 3 s block', unit: ' ms' },
    { key: 'dataGapT3S', label: 'Data gap, T3', unit: ' s', digits: 1 },
    { key: 'dataGapOthersS', label: 'Data gap, other machines', unit: ' s', digits: 1 },
  ],
};

if (import.meta.main) runPairs(PLANT);
