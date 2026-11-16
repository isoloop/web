import { defineIsolate } from '@isoloop/runtime';
import { runFeed } from '../../core/sensors/feed';
import { jobConfig } from '../../isolates/config';
import { busSource } from '../../isoloop/source';
import { teeOf } from './tee';

// Headless: a machine's sensors, as on plant's page, also publishing its slow
// signals to the merged topic (merged.ts).
export default defineIsolate({
  start(ctx) {
    const feed = runFeed(teeOf(ctx.bus, busSource(ctx.bus)), jobConfig(ctx.config));
    ctx.onShutdown(() => {
      feed.stop();
    });
  },
});
