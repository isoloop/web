// A, the counter (apps/basic/src/isolates/counter.ts, without the demo's
// activity reports): it publishes its count, and after a restart reads it
// back from the bus.
// #region show
import { defineIsolate } from '@isoloop/runtime';
import { count } from './topics';

export default defineIsolate<HTMLElement>({
  start(ctx) {
    let n = 0;
    const big = document.createElement('div');
    big.textContent = '0';
    const button = document.createElement('button');
    button.textContent = 'Increment';
    button.addEventListener('click', () => {
      n++;
      big.textContent = String(n);
      void ctx.bus.publish(count, { value: n });
    });
    ctx.bus.subscribe(
      count,
      (r) => {
        if (r.value <= n) return;
        n = r.value;
        big.textContent = String(n);
      },
      { from: 'earliest' },
    );
    ctx.root?.append(big, button);
  },
});
// #endregion
