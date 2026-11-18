// /how-it-works/, "Restarts and catch-up": where a subscription starts.
import { defineIsolate } from '@isoloop/runtime';
import { count } from '../topics';

declare function draw(n: number): void;

export default defineIsolate<HTMLElement>({
  start(ctx) {
    // #region show
    // Only what arrives from now on: live values.
    ctx.bus.subscribe(count, (r) => draw(r.value), { from: 'latest' });

    // Everything the topic retains, then new records: state rebuilt on every start.
    ctx.bus.subscribe(count, (r) => draw(r.value), { from: 'earliest' });

    // On after this subscription's last commit: work done once per record.
    ctx.bus.subscribe(count, (r) => draw(r.value), { from: 'committed' });
    // #endregion
  },
});
