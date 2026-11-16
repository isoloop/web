// The interactive page's head-to-head (M3e decision 22): the native page (A)
// against the Isoloop page (B), interleaved for N rounds, one page at a time,
// by e2e/interactive-compare.spec.ts, which says what each figure is. The
// runner is the shared `compare/pairs`; README.md in this folder has the
// commands.
//
//   node comparison/interactive.ts --pair native=isoloop --rates 5 --rounds 5 \
//     --hold 0 --engines chromium,firefox --out comparison/interactive/final
//
// Arguments as in run.ts. `--hold` has no effect here (no memory reading);
// pass 0 so run.json says so.
import { resolve } from 'node:path';
import { runPairs, type PairsApp } from 'compare/pairs';

export const INTERACTIVE: PairsApp = {
  title: 'Plant, interactive mode, head-to-head',
  dir: resolve(import.meta.dirname, '..'),
  projects: { chromium: 'interactive-comparison', firefox: 'interactive-comparison-firefox' },
  knob: {
    option: 'rates',
    env: 'COMPARE_RATES',
    default: '5',
    field: 'rate',
    label: (rate) => `${rate} kHz`,
  },
  figures: [
    { key: 'idleDrawGapsLate', label: 'Idle: starters’ draw gaps over 250 ms', unit: '' },
    { key: 'idleDrawGapMaxMs', label: 'Idle: longest draw gap', unit: ' ms' },
    { key: 'idleFramesLate', label: 'Idle: main-thread frames over 25 ms', unit: '' },
    { key: 'idleMainThreadCpuPct', label: 'Idle: main-thread CPU', unit: '%' },
    { key: 'typingMedianMs', label: 'Drawer typing (median of 10)', unit: ' ms' },
    { key: 'typingP95Ms', label: 'Drawer typing (p95 of 10)', unit: ' ms' },
    { key: 'clickMedianMs', label: 'Drawer clicks (median of 10)', unit: ' ms' },
    { key: 'clickP95Ms', label: 'Drawer clicks (p95 of 10)', unit: ' ms' },
    { key: 'previewMs', label: 'Heavy preview: first draw', unit: ' ms' },
    { key: 'heavyDrawGapsLate', label: 'Heavy preview: starters’ draw gaps over 250 ms', unit: '' },
    { key: 'heavyDrawGapP95Ms', label: 'Heavy preview: draw gap p95', unit: ' ms' },
    { key: 'heavyDrawGapMaxMs', label: 'Heavy preview: longest draw gap', unit: ' ms' },
    { key: 'heavyFramesLate', label: 'Heavy preview: main-thread frames over 25 ms', unit: '' },
    { key: 'heavyMainThreadCpuPct', label: 'Heavy preview: main-thread CPU', unit: '%' },
    { key: 'heavyRendererCpuPct', label: 'Heavy preview: CPU, all threads', unit: '%' },
    { key: 'heavyTypingMedianMs', label: 'Heavy preview: drawer typing (median)', unit: ' ms' },
    { key: 'heavyTypingP95Ms', label: 'Heavy preview: drawer typing (p95)', unit: ' ms' },
  ],
};

if (import.meta.main) runPairs(INTERACTIVE);
