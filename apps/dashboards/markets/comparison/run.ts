// The markets dashboard's head-to-head comparison (M3f decisions 7 and 8):
// pairs of configurations (a native build against an Isoloop placement), run
// interleaved for N rounds, one page at a time, by e2e/comparison.spec.ts. The
// runner is the shared `compare/pairs` (packages/compare); this file says
// what's the markets dashboard's: its projects, its load knob (the size) and
// its figures. final/README.md has bench machine 1's command.
//
// M3g's federated comparison (federated/README.md) runs the React and Preact
// builds with the alerts panel's faults in place of the price chart's:
//
//   COMPARE_FAULT=alerts node comparison/run.ts \
//     --pair native-mixed=mixed:matched --extra mixed:teams --extra mixed:own \
//     --sizes normal,heavy --rounds 5 --hold 0 \
//     --engines chromium,firefox --out comparison/federated/results
//
//   node comparison/run.ts \
//     --pair native=isoloop:one --pair native-workers=isoloop:matched \
//     --extra isoloop:own --sizes normal,heavy --rounds 5 --hold 0 \
//     --engines chromium,firefox --out comparison/final/results
//
// Arguments (durations in seconds):
//   --pair A=B      a pair; repeat it. A is the baseline, B the Isoloop side.
//   --extra C       a configuration measured alongside, without a pair; repeatable.
//   --sizes         lite, normal, heavy, comma-separated (default normal).
//   --rounds        rounds; each runs every configuration once (default 5).
//   --hold          seconds after navigation for the second memory reading
//                   (default 600; 0 skips it).
//   --warm, --window  warm-up and measuring window (defaults 6 and 10).
//   --engines       chromium, firefox (default chromium,firefox).
//   --out           results folder (default comparison/results).
//   --summary-only  rebuild summary.md from the JSON already in --out.
import { resolve } from 'node:path';
import { runPairs, type PairsApp } from 'compare/pairs';

const SIZES = ['lite', 'normal', 'heavy'] as const;

export const MARKETS: PairsApp = {
  title: 'Markets dashboard, head-to-head',
  dir: resolve(import.meta.dirname, '..'),
  projects: { chromium: 'comparison', firefox: 'comparison-firefox' },
  knob: {
    option: 'sizes',
    env: 'COMPARE_SIZES',
    default: 'normal',
    field: 'size',
    label: (s) => {
      const name = String(s);
      return name.charAt(0).toUpperCase() + name.slice(1);
    },
    order: SIZES,
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
    { key: 'allWidgetsMs', label: 'All widgets with data', unit: ' ms' },
    { key: 'recoveryMs', label: 'Recovery after a 3 s block of the price chart', unit: ' ms' },
    { key: 'jsGzKb', label: 'JS loaded, gzipped', unit: ' KB' },
    {
      key: 'blockOtherKeptPct',
      label: 'Alerts panel blocked 3 s: the other widgets’ updates kept',
      unit: '%',
    },
    {
      key: 'blockOtherSilenceMs',
      label: 'Alerts panel blocked 3 s: the other widgets’ longest silence',
      unit: ' ms',
    },
    {
      key: 'crashOtherKeptPct',
      label: 'Alerts panel crashed: the other widgets’ updates kept',
      unit: '%',
    },
    { key: 'crashBackMs', label: 'Alerts panel crashed: back after', unit: ' ms' },
  ],
};

if (import.meta.main) runPairs(MARKETS);
