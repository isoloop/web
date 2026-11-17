import { defineIsolate } from '@isoloop/runtime';
import { busy as busyTopic, control, done as doneTopic, tasks } from '../topics';

// A playground task: a headless isolate. Its dial comes from
// playground.tasks.v1 under its own id, read from the start, so wherever the
// balancer moves it, it carries on as set.
//
// - Jobs/s at 0: it keeps one core `load` % busy, in uninterrupted pieces of
//   `chunkMs`, and rests in between so its loop still turns.
// - Jobs/s above 0 (M3i): jobs arrive at that rate, each costing
//   `load × 10 ÷ rate` ms of work in `chunkMs` pieces. It works through them
//   as fast as its worker lets it and publishes how many it has done, so the
//   page can tell its backlog.
// - `hidden` ("after await"): either way, each piece runs in a promise
//   continuation, which the runtime's busy time doesn't see.
//
// It times its own work and publishes the running total (M3j), which the page
// reports to the balancer: the balancer then sees work done after `await` too.

/** Keeps the loop busy for `ms`, with work the engine can't skip. */
function spin(ms: number): number {
  const end = performance.now() + ms;
  let x = 0;
  while (performance.now() < end) {
    for (let i = 0; i < 1_000; i++) x = Math.sqrt(x + i);
  }
  return x;
}

/** How often the task publishes its count while it works. */
const PUBLISH_MS = 250;
/** How often it publishes its measured busy time, while that grows. */
const BUSY_MS = 500;

export default defineIsolate({
  start(ctx) {
    let load = 0;
    let chunkMs = 50;
    let rate = 0;
    let base = 0;
    let since = 0;
    let hidden = false;
    let sink = 0;
    let done = 0;
    let published = -1;
    let publishedAt = 0;
    /** Its own measured work since it started, ms (M3j). */
    let worked = 0;
    let workedSent = 0;
    const work = (ms: number): void => {
      const t = performance.now();
      sink += spin(ms);
      worked += performance.now() - t;
    };
    setInterval(() => {
      if (worked === workedSent) return;
      workedSent = worked;
      void ctx.bus.publish(busyTopic, { key: ctx.id, value: { busyMs: Math.round(worked) } });
    }, BUSY_MS);

    ctx.bus.subscribe(
      tasks,
      (r) => {
        if (r.key !== ctx.id) return;
        ({ load, chunkMs, rate, base, since, hidden } = r.value);
      },
      { from: 'earliest' },
    );
    // Its count so far, from before a move: never counted down.
    ctx.bus.subscribe(
      doneTopic,
      (r) => {
        if (r.key === ctx.id) done = Math.max(done, r.value.done);
      },
      { from: 'earliest' },
    );
    ctx.bus.subscribe(
      control,
      (r) => {
        if (r.value.to !== ctx.id) return;
        // A fault, not work: the kernel sees the long task as a spike, and it stays
        // out of the reported busy time, or one block would read as a full pool.
        if (r.value.act === 'block') sink += spin(r.value.ms ?? 2_000);
        else ctx.reportError(new Error(`${ctx.id} crashed on purpose`));
      },
      { from: 'latest' },
    );

    const arrived = (): number =>
      rate > 0 ? Math.floor(base + ((Date.now() - since) / 1_000) * rate) : Math.floor(base);
    const publish = (force: boolean): void => {
      const now = performance.now();
      if (done === published || (!force && now - publishedAt < PUBLISH_MS)) return;
      published = done;
      publishedAt = now;
      void ctx.bus.publish(doneTopic, { key: ctx.id, value: { done } });
    };

    // The loop turns through a message port (no 4 ms timer floor). A rest
    // shorter than a timer's floor is owed, and the rests add up until one
    // timer can take them, so a burning task's share stays `load` %.
    const { port1, port2 } = new MessageChannel();
    let owed = 0;
    /** Work left on the current job, ms. */
    let left = 0;
    const next = (): void => {
      port2.postMessage(0);
    };
    const step = (): void => {
      if (rate > 0) {
        jobStep();
        return;
      }
      left = 0;
      if (load <= 0) {
        owed = 0;
        setTimeout(step, 100);
        return;
      }
      if (hidden) {
        // Out of the busy time's sight: after the port's callback has returned.
        void Promise.resolve().then(() => {
          work(chunkMs);
          rest();
        });
      } else {
        work(chunkMs);
        rest();
      }
    };
    const rest = (): void => {
      owed += load >= 100 ? 0 : chunkMs * (100 / load - 1);
      if (owed < 4) {
        next();
        return;
      }
      setTimeout(step, owed);
      owed = 0;
    };
    const jobStep = (): void => {
      if (left <= 0) {
        if (arrived() <= done) {
          publish(true);
          setTimeout(step, 20);
          return;
        }
        left = (load * 10) / rate;
      }
      const slice = Math.min(chunkMs, left);
      const finish = (): void => {
        left -= slice;
        if (left <= 0) {
          done++;
          publish(false);
        }
        next();
      };
      if (hidden) {
        // A promise continuation runs after the port's callback has returned,
        // outside the time the runtime puts on this task.
        void Promise.resolve().then(() => {
          work(slice);
          finish();
        });
      } else {
        work(slice);
        finish();
      }
    };
    port1.addEventListener('message', step);
    port1.start();
    step();
    // A stopped member's timers and ports never run again (ADR 0015,
    // decision 9), so the loop ends with it.
  },
});
