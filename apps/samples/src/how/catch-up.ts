// /how-it-works/, "Restarts and catch-up": where a subscription starts.
import { defineIsolate } from '@isoloop/runtime';
import { count } from '../topics';

declare function draw(n: number): void;

export default defineIsolate<HTMLElement>({
  start(ctx) {
    // #region show
    // After a restart, read on after the last record this subscription committed.
    ctx.bus.subscribe(count, (r) => draw(r.value), { from: 'committed' });
    // #endregion
  },
});
