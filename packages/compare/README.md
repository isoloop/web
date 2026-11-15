# compare

The head-to-head comparison the dashboards share: the plant's since M3d, the markets dashboard's from M3f. Private, with no version: apps use it from the workspace.

| Export | What it is |
| --- | --- |
| `compare/pairs` | `runPairs(app)`: the command line, the interleaved rounds (A, B, A, B…, one page at a time), `run.json` and `summary.md` with the median gap B − A per round, its share of A and its spread. `summarize` and `readResults` are the summary on its own. |
| `compare/probes` | the spec's readings from outside the page: `pageMetrics` (main thread), `processes`, `cpuOf` and `cpuDelta` (CPU per process), `pssMb` and `memory` (renderer PSS, before and after `gcAll`, a forced GC in the page and every worker). CPU and memory are Chromium only; memory is Linux only. |
| `compare/stopped` | how a run whose page stopped shows in a summary: `stoppedLabel`, `cellOr`. |

## Using it

An app describes what's its own and calls the runner; its comparison spec reads the environment the runner sets and writes one JSON per run to `<out>/<engine>/…-runN.json`.

```ts
// apps/dashboards/<app>/comparison/run.ts
import { resolve } from 'node:path';
import { runPairs, type PairsApp } from 'compare/pairs';

export const APP: PairsApp = {
  title: 'Plant dashboard, head-to-head',
  dir: resolve(import.meta.dirname, '..'),
  projects: { chromium: 'comparison', firefox: 'comparison-firefox' },
  // The load knob: --rates on the command line, COMPARE_RATES for the spec,
  // `rate` in each result file.
  knob: { option: 'rates', env: 'COMPARE_RATES', default: '1', field: 'rate', label: (r) => `${r} kHz` },
  figures: [{ key: 'typingMedianMs', label: 'Typing (median of 5)', unit: ' ms' } /* … */],
};

if (import.meta.main) runPairs(APP);
```

The spec reads `COMPARE_OUT`, `COMPARE_CONFIGS` (`build` or `build:placement`, comma-separated), the knob's variable, `COMPARE_RUNS`, `COMPARE_HOLD_MS`, `COMPARE_WARM_MS` and `COMPARE_WINDOW_MS`. Each result file has `engine`, `build`, `placement` (or `null`), the knob's field, `stopped` (with `stage` and `error` when it did) and the figures, as numbers or `null`. A knob whose values aren't numbers (sizes) gives `order`, so sections follow it.

Arguments are in the header of [`src/pairs.ts`](src/pairs.ts).
