import { defineIsolate } from '@isoloop/runtime';
import { runAlerts } from '../core/services';
import { busSource } from '../isoloop/source';
import { createAlertTool } from '../isoloop/topics';

/** `tools: true` on markets' page, where the kernel exposes `markets.alerts.create.v1` (M4a). */
type Config = { tools?: boolean } | null | undefined;

// Headless: alert rules against prices and aggregates, into alerts.v1. With
// `tools`, it also adds the rules agents ask for, once per request id.
export default defineIsolate({
  start(ctx) {
    const svc = runAlerts(busSource(ctx.bus));
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the page passes this config
    if ((ctx.config as Config)?.tools !== true) return;
    ctx.bus.subscribe(
      createAlertTool,
      async (r) => {
        if (r.req === undefined) return;
        await ctx.bus.reply(r, svc.create(r.req.id, r.value));
      },
      { from: 'committed' },
    );
  },
});
