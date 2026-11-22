// /how-it-works/, "Persistence and bus crashes": a persistent and a memory topic after a bus restart.
import { defineIsolate } from '@isoloop/runtime';
import { alarms } from '../durable';
import { count } from '../topics';

declare function raise(alarm: { machine: string; level: string }): void;
declare function draw(n: number): void;
declare function clear(): void;

export default defineIsolate({
  start(ctx) {
    // #region show
    // Persistent: after a reload or a bus restart, on after the last commit, from disk.
    ctx.bus.subscribe(alarms, (r) => raise(r.value), { from: 'committed' });

    // Memory: a bus restart loses it, so clear what was built from it; new records follow.
    ctx.bus.subscribe(count, (r) => draw(r.value), { onReset: () => clear() });
    // #endregion
  },
});
