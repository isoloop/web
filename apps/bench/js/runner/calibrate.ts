// pnpm calibrate [--engine chromium] [--ms 1500]: per-op time of every
// workload on this machine, and the batch the bench uses (about 1 ms between
// clock reads). Writes calibration.json, which `pnpm bench` reads.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ENGINES, launch, runPage } from './browser.ts';
import { oneOf } from './read.ts';
import { environment } from './env.ts';
import { serve } from './serve.ts';
import { ensureBuilt, ROOT } from './build.ts';

const { values } = parseArgs({
  options: {
    engine: { type: 'string', default: 'chromium' },
    ms: { type: 'string', default: '1500' },
    out: { type: 'string' },
  },
});
ensureBuilt();
const server = await serve(resolve(ROOT, 'dist'));
const [engine = 'chromium'] = oneOf(values.engine, ENGINES, 'engine');
const browser = await launch(engine);
const r = await runPage(browser, `${server.url}?calibrate=1&ms=${values.ms}`, 600_000);
await browser.close();
server.close();
if (r.state !== 'done')
  throw new Error(`calibration failed: ${'error' in r ? r.error : ''}\n${r.console.join('\n')}`);
// The calibration page reports through window.__bench's result slot (src/page/main.ts).
interface Calibration {
  calibration: { id: string; tier: string; perOpUs: number; batch: number }[];
}
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the calibration page's own shape
const rows = (r.result as unknown as Calibration).calibration;
const RANGE: Record<string, [number, number]> = {
  cheap: [0.1, 50],
  regular: [50, 5000],
  heavy: [5000, 1_000_000],
};
for (const row of rows) {
  const [lo, hi] = RANGE[row.tier]!;
  const flag =
    row.perOpUs < lo || row.perOpUs > hi ? `  (outside ${row.tier} range ${lo}–${hi} µs)` : '';
  console.log(
    `${row.tier.padEnd(8)} ${row.id.padEnd(26)} ${row.perOpUs.toFixed(2).padStart(12)} µs/op  batch ${row.batch}${flag}`,
  );
}
const out = values.out ?? resolve(ROOT, 'calibration.json');
writeFileSync(
  out,
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as above
  `${JSON.stringify({ engine: values.engine, env: environment(ROOT), userAgent: (r.result as unknown as { userAgent: string }).userAgent, workloads: rows }, null, 2)}\n`,
);
console.log(`wrote ${out}`);
