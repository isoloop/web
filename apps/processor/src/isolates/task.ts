import { defineIsolate } from '@isoloop/runtime';
import { control, tasks } from '../topics';

// A playground task: a headless isolate that keeps one core `load` % busy, in
// uninterrupted pieces of `chunkMs`, and rests in between so its loop still
// turns. Its dial comes from playground.tasks.v1 under its own id, read from
// the start, so wherever the balancer moves it, it carries on as set.

/** Keeps the loop busy for `ms`, with work the engine can't skip. */
function spin(ms: number): number {
  const end = performance.now() + ms;
  let x = 0;
  while (performance.now() < end) {
    for (let i = 0; i < 1_000; i++) x = Math.sqrt(x + i);
  }
  return x;
}

export default defineIsolate({
  start(ctx) {
    let load = 0;
    let chunkMs = 50;
    let sink = 0;

    ctx.bus.subscribe(
      tasks,
      (r) => {
        if (r.key !== ctx.id) return;
        load = r.value.load;
        chunkMs = r.value.chunkMs;
      },
      { from: 'earliest' },
    );
    ctx.bus.subscribe(
      control,
      (r) => {
        if (r.value.to !== ctx.id) return;
        if (r.value.act === 'block') sink += spin(r.value.ms ?? 2_000);
        else ctx.reportError(new Error(`${ctx.id} crashed on purpose`));
      },
      { from: 'latest' },
    );

    // A rest shorter than a timer's 4 ms floor is owed: the loop turns
    // through a message port at once, and the rests add up until one timer
    // can take them, so the share stays `load` %.
    const { port1, port2 } = new MessageChannel();
    let owed = 0;
    let stopped = false;
    const step = (): void => {
      if (stopped) return;
      if (load <= 0) {
        owed = 0;
        setTimeout(step, 100);
        return;
      }
      sink += spin(chunkMs);
      owed += load >= 100 ? 0 : chunkMs * (100 / load - 1);
      if (owed < 4) {
        port2.postMessage(0);
        return;
      }
      setTimeout(step, owed);
      owed = 0;
    };
    port1.addEventListener('message', step);
    port1.start();
    step();
    // In a pool the worker outlives a stopped member, and so would this
    // loop: stop it here. (Keeping `sink` observable, so the work isn't
    // optimised away.)
    ctx.onShutdown(() => {
      stopped = true;
      port1.close();
      if (sink === -1) console.log(sink);
    });
  },
});
