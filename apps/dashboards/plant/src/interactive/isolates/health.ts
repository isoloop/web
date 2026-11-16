import { defineIsolate } from '@isoloop/runtime';
import { runHealth } from '../../core/engines';
import { jobConfig } from '../../isolates/config';
import { busSource } from '../../isoloop/source';
import { teeOf } from './tee';

// Headless: a machine's health engine, also publishing its health to the
// merged topic (merged.ts).
export default defineIsolate({
  start(ctx) {
    const c = jobConfig(ctx.config);
    const job = runHealth(teeOf(ctx.bus, busSource(ctx.bus)), c.machine);
    ctx.onShutdown(() => {
      job.stop();
    });
  },
});
