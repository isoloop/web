import { defineIsolate } from '@isoloop/runtime';
import { KINDS, random, type Job, type Kind } from '../files/kinds';
import { archiveJobs, csvJobs, dials, hashJobs, imageJobs } from '../topics';

// The File processor's generator (M3h decision 29): a headless isolate on a
// worker of its own that makes synthetic files at the dialled rate and
// publishes each to its kind's job topic. Seeded: a run with the same seed
// and dials makes the same files in the same order.

const TOPICS = { csv: csvJobs, image: imageJobs, archive: archiveJobs, hash: hashJobs };
/** How often it publishes the files due since the last tick. */
const TICK_MS = 50;

type Dials = {
  running: boolean;
  run: number;
  seed: number;
  rate: number;
  poison: number;
  heavy: number;
  corrupt: number;
};

const now = (): number => performance.timeOrigin + performance.now();

export default defineIsolate({
  start(ctx) {
    let d: Dials | undefined;
    let rnd = random(1);
    let n = 0;
    let due = 0;
    let last = performance.now();

    ctx.bus.subscribe(
      dials,
      (r) => {
        if (r.key !== 'dials') return;
        const next = r.value;
        // A new run or seed starts the sequence again.
        if (!d || next.run !== d.run || next.seed !== d.seed) {
          rnd = random(next.seed * 1_000 + next.run);
          n = 0;
          due = 0;
        }
        d = next;
        last = performance.now();
      },
      { from: 'earliest' },
    );

    const make = (dl: Dials): Job => {
      const kind: Kind = KINDS[Math.floor(rnd() * KINDS.length)] ?? 'csv';
      const roll = rnd() * 100;
      const job: Job = {
        id: `${dl.run}-${++n}`,
        kind,
        size: 1 + Math.floor(rnd() * 4),
        seed: Math.floor(rnd() * 2 ** 31),
        at: now(),
      };
      // One roll, three bands, so the dials add up (5 % poison + 10 % heavy…).
      if (roll < dl.poison) job.poison = true;
      else if (roll < dl.poison + dl.heavy) job.heavy = true;
      else if (roll < dl.poison + dl.heavy + dl.corrupt) job.corrupt = true;
      return job;
    };

    setInterval(() => {
      const t = performance.now();
      const dt = t - last;
      last = t;
      if (!d?.running || d.rate <= 0) return;
      due += (d.rate * dt) / 1_000;
      // Never more than a second's worth at once, after a stall.
      due = Math.min(due, Math.max(1, d.rate));
      while (due >= 1) {
        due -= 1;
        const job = make(d);
        void ctx.bus.publish(TOPICS[job.kind], job);
      }
    }, TICK_MS);
  },
});
