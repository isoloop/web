import { defineIsolate } from '@isoloop/runtime';
import { CorruptFile, isKind, work, type Job } from '../files/kinds';
import { archiveJobs, busy as busyTopic, csvJobs, hashJobs, imageJobs, results } from '../topics';

// A File processor (M3h decision 29): a headless isolate in its kind's
// consumer group. Each file the group hands it is queued, processed one at a
// time in slices of up to SLICE_MS (so its loop keeps turning), and committed
// only once its result is published: if the balancer moves it, or it
// crashes, the bus hands what it hadn't committed to the group again, and no
// file is lost. Delivery is at least once: a file whose result went out just
// before a stop, but whose commit didn't, is done again.
//
// A poison file blocks the loop for 2 s in one piece. A corrupt file throws:
// its result says so and it's committed, then the processor crashes as its
// own error, a moment later so the commit has gone out.
//
// It times its own work and publishes the running total (M3j): each slice
// after the first runs after `await`, which the runtime's busy time doesn't
// see, so the page reports this figure to the balancer.

const TOPICS = { csv: csvJobs, image: imageJobs, archive: archiveJobs, hash: hashJobs };
const SLICE_MS = 8;
const POISON_MS = 2_000;
/** Commits go out every 100 ms (the bus default); crash after that. */
const CRASH_AFTER_MS = 250;
/** How often it publishes its measured busy time, while that grows. */
const BUSY_MS = 500;

const now = (): number => performance.timeOrigin + performance.now();

function spin(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // Busy, on purpose.
  }
}

export default defineIsolate({
  start(ctx) {
    const kind: unknown =
      typeof ctx.config === 'object' && ctx.config !== null
        ? Reflect.get(ctx.config, 'kind')
        : undefined;
    if (!isKind(kind)) throw new Error(`processor ${ctx.id}: config.kind must be a file kind`);
    const topic = TOPICS[kind];
    /** A delivered file: the record (to commit) and its job. */
    type Delivered = { rec: Parameters<typeof ctx.bus.commit>[0]; job: Job };
    const queue: Delivered[] = [];
    // Files stay queued after the handler returns, so commits are by hand. A
    // commit settles its record and every one delivered before it (ADR 0016,
    // point 15); files are done one at a time in the order they arrived, so
    // a file just done is always the last whose earlier arrivals are done.
    const settle = (rec: Delivered['rec']): void => {
      ctx.bus.commit(rec);
    };
    let busy = false;
    let stopped = false;
    /** Its own measured work since it started, ms (M3j). */
    let worked = 0;
    let workedSent = 0;
    setInterval(() => {
      if (worked === workedSent) return;
      workedSent = worked;
      void ctx.bus.publish(busyTopic, { busyMs: Math.round(worked) }, { key: ctx.id });
    }, BUSY_MS);

    // Slices hand back to the loop through a port: no 4 ms timer floor.
    const { port1, port2 } = new MessageChannel();
    let resume: (() => void) | undefined;
    port1.addEventListener('message', () => resume?.());
    port1.start();
    const yieldToLoop = (): Promise<void> =>
      new Promise((r) => {
        resume = r;
        port2.postMessage(0);
      });

    const processOne = async ({ rec, job }: Delivered): Promise<void> => {
      const started = performance.now();
      /** The current slice's start: each one counts toward `worked` as it ends. */
      let sliceStart = started;
      const sliceDone = (): void => {
        worked += performance.now() - sliceStart;
      };
      // A fault, not work: the kernel sees it as a long task (a spike), and it
      // stays out of the reported busy time, or one poison file would read as
      // a full pool.
      if (job.poison) {
        spin(POISON_MS);
        sliceStart = performance.now();
      }
      try {
        const steps = work(job);
        let sliceEnd = performance.now() + SLICE_MS;
        let step = steps.next();
        while (!step.done) {
          if (performance.now() >= sliceEnd) {
            sliceDone();
            // oxlint-disable-next-line eslint/no-await-in-loop -- a slice ends: the loop turns before the next
            await yieldToLoop();
            if (stopped) return;
            sliceStart = performance.now();
            sliceEnd = sliceStart + SLICE_MS;
          }
          step = steps.next();
        }
        sliceDone();
        await ctx.bus.publish(results, {
          id: job.id,
          kind,
          status: 'ok',
          by: ctx.id,
          ms: performance.now() - started,
          created: job.at,
          done: now(),
          output: step.value.slice(0, 200),
        });
        settle(rec);
      } catch (e) {
        if (!(e instanceof CorruptFile)) throw e;
        sliceDone();
        await ctx.bus.publish(results, {
          id: job.id,
          kind,
          status: 'corrupt',
          by: ctx.id,
          ms: performance.now() - started,
          created: job.at,
          done: now(),
          output: e.message.slice(0, 200),
        });
        settle(rec);
        // No more files: the ones still queued go back to the group when it crashes.
        stopped = true;
        setTimeout(() => ctx.reportError(e), CRASH_AFTER_MS);
      }
    };

    const pump = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      while (queue.length > 0) {
        if (stopped) break;
        const next = queue.shift();
        // One file at a time, on purpose: a processor is a single worker of its group.
        // oxlint-disable-next-line eslint/no-await-in-loop -- sequential by design
        if (next) await processOne(next);
      }
      busy = false;
    };

    // `earliest` only for the group's first join: a group that has committed
    // resumes after its commits, even when every member left (both moved at
    // once, or the placement switched) (ADR 0016, point 14).
    ctx.bus.subscribe(
      topic,
      (r) => {
        queue.push({ rec: r, job: r.value });
        void pump();
      },
      { group: kind, autoCommit: false, from: 'earliest' },
    );

    // Stopping (a move, a placement switch) needs nothing here: what this
    // processor hadn't committed goes back to the group.
  },
});
