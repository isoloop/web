import { defineIsolate } from '@isoloop/runtime';
import { CorruptFile, isKind, work, type Job } from '../files/kinds';
import { archiveJobs, csvJobs, hashJobs, imageJobs, results } from '../topics';

// A File processor (M3h decision 29): a headless isolate in its kind's
// consumer group. Each file the group hands it is queued, processed one at a
// time in slices of up to SLICE_MS (so its loop keeps turning), and committed
// only once its result is published: if the balancer moves it, the bus hands
// what it hadn't finished to the group again, and no file is lost.
//
// A poison file blocks the loop for 2 s in one piece. A corrupt file throws:
// its result says so and it's committed, then the processor crashes as its
// own error, a moment later so the commit has gone out.

const TOPICS = { csv: csvJobs, image: imageJobs, archive: archiveJobs, hash: hashJobs };
const SLICE_MS = 8;
const POISON_MS = 2_000;
/** Commits go out every 100 ms (the bus default); crash after that. */
const CRASH_AFTER_MS = 250;

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
    // A group's commit covers every offset at or below it that this member
    // holds, and a file the group redelivers can come after a later one. So
    // a finished file is committed only up to just below the lowest file
    // still pending here, never past one that isn't done.
    const pending = new Map<number, Job>();
    const finished: Delivered['rec'][] = [];
    const settle = (rec: Delivered['rec']): void => {
      pending.delete(rec.offset);
      finished.push(rec);
      const lowest = Math.min(...pending.keys());
      let best: Delivered['rec'] | undefined;
      for (const f of finished)
        if (f.offset < lowest && (!best || f.offset > best.offset)) best = f;
      if (!best) return;
      ctx.bus.commit(best);
      const upTo = best.offset;
      for (let i = finished.length - 1; i >= 0; i--) {
        if ((finished[i]?.offset ?? Infinity) <= upTo) finished.splice(i, 1);
      }
    };
    let busy = false;
    let stopped = false;

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
      if (job.poison) spin(POISON_MS);
      try {
        const steps = work(job);
        let sliceEnd = performance.now() + SLICE_MS;
        let step = steps.next();
        while (!step.done) {
          if (performance.now() >= sliceEnd) {
            // oxlint-disable-next-line eslint/no-await-in-loop -- a slice ends: the loop turns before the next
            await yieldToLoop();
            if (stopped) return;
            sliceEnd = performance.now() + SLICE_MS;
          }
          step = steps.next();
        }
        await ctx.bus.publish(results, {
          value: {
            id: job.id,
            kind,
            status: 'ok',
            by: ctx.id,
            ms: performance.now() - started,
            created: job.at,
            done: now(),
            output: step.value.slice(0, 200),
          },
        });
        settle(rec);
      } catch (e) {
        if (!(e instanceof CorruptFile)) throw e;
        await ctx.bus.publish(results, {
          value: {
            id: job.id,
            kind,
            status: 'corrupt',
            by: ctx.id,
            ms: performance.now() - started,
            created: job.at,
            done: now(),
            output: e.message.slice(0, 200),
          },
        });
        settle(rec);
        stopped = true;
        // The rest of this processor's files go back on the topic before it
        // crashes, for the same reason as on a stop.
        const left = [...pending.values()];
        pending.clear();
        await Promise.all(left.map((j) => ctx.bus.publish(topic, { value: j })));
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

    // From the group's commits: when every member has left (both moved at
    // once, or the placement switched), the next one resumes where the group
    // got to, not from the start of the topic.
    ctx.bus.subscribe(
      topic,
      (r) => {
        pending.set(r.offset, r.value);
        queue.push({ rec: r, job: r.value });
        void pump();
      },
      { group: kind, autoCommit: false, from: 'committed' },
    );

    // Stopping (a move, a placement switch): the files still here go back on
    // their topic. A group's commit is cumulative per member, so a commit can
    // cross a redelivery on its way and cover files this processor hadn't
    // reached yet; the bus would never hand those out again. Putting them back
    // keeps every file processed at least once (a few twice, counted as
    // duplicates). In a pool the worker also outlives a stopped member, and in
    // 0.0.0-next.g3322248 so do its ports and timers: stop the loop too.
    ctx.onShutdown(async () => {
      stopped = true;
      port1.close();
      const left = [...pending.values()];
      pending.clear();
      await Promise.all(left.map((job) => ctx.bus.publish(topic, { value: job })));
    });
  },
});
