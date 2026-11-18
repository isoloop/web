// /how-it-works/, "Topics, records and the bus": a publish and a subscription.
import { defineIsolate } from '@isoloop/runtime';
import { count } from '../topics';

export default defineIsolate({
  async start(ctx) {
    // #region show
    // Resolves once the bus has appended the record; rejects with a BusError.
    await ctx.bus.publish(count, { value: 1 });

    // Every record the topic retains, then each new one, in order.
    const stop = ctx.bus.subscribe(
      count,
      (r) => console.log(`#${String(r.offset)} from ${r.producer}: ${String(r.value)}`),
      { from: 'earliest' },
    );
    // #endregion
    ctx.onShutdown(() => stop());
  },
});
