import { defineIsolate } from '@isoloop/runtime';
import { runAggregator } from '../core/services';
import { busSource } from '../isoloop/source';
import { quoteTool } from '../isoloop/topics';

/** `tools: true` on markets' page, where the kernel exposes `markets.quote.v1` (M4a). */
type Config = { tools?: boolean } | null | undefined;

// Headless: cross-market VWAP, spread and volume into aggregates.v1. With
// `tools`, it also answers agents' quote requests.
export default defineIsolate({
  start(ctx) {
    const svc = runAggregator(busSource(ctx.bus));
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the page passes this config
    if ((ctx.config as Config)?.tools !== true) return;
    ctx.bus.subscribe(
      quoteTool,
      async (r) => {
        if (r.req === undefined) return;
        await ctx.bus.reply(r, svc.quote(r.value.symbol));
      },
      // From the last committed record, so a request that arrived while this
      // isolate restarted is still answered within its timeout (ADR 0018, decision 5).
      { from: 'committed' },
    );
  },
});
