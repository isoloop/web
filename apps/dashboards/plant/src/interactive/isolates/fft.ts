import { defineIsolate } from '@isoloop/runtime';
import { runFft } from '../../core/engines';
import { jobConfig } from '../../isolates/config';
import { busSource } from '../../isoloop/source';
import { teeOf } from './tee';

// Headless: a machine's FFT engine, also publishing its spectrum summary to
// the merged topic (merged.ts).
export default defineIsolate({
  start(ctx) {
    const c = jobConfig(ctx.config);
    const job = runFft(teeOf(ctx.bus, busSource(ctx.bus)), c.machine, c.rateKHz);
    ctx.onShutdown(() => {
      job.stop();
    });
  },
});
