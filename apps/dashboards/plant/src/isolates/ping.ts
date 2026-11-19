import { defineIsolate } from '@isoloop/runtime';
import { agentCostTopic } from '../isoloop/agent-cost-topic';

// Headless, bench-only (M4a task 13, `PLANT_AGENT_COST=1` builds): answers each
// ping with its own value, so a round trip has no handler work in it.
export default defineIsolate({
  start(ctx) {
    ctx.bus.subscribe(agentCostTopic(), async (r) => {
      if (r.req === undefined) return;
      await ctx.bus.reply(r, r.value);
    });
  },
});
