// The processor's topics (isoloop/isoloop ADR 0003). The single source: the
// bus worker imports it by URL to validate, the host for `contracts.list`, and
// isolates import only its types (topics.ts). Memory topics: a reload starts
// empty.
import { contracts, topic } from '@isoloop/bus';
import { z } from 'zod';

/**
 * Each playground task's dial, keyed by task id: the share of one core it
 * burns, and the length of each uninterrupted piece of work. Compacted and
 * read from `earliest`, so a task the balancer moved (stopped, then spawned
 * in another pool) comes back with its setting.
 */
export const tasks = topic('playground.tasks.v1', {
  schema: z.object({
    load: z.number().min(0).max(100),
    chunkMs: z.number().int().min(1).max(500),
  }),
  retention: { kind: 'compacted' },
});

/** One-off faults for a task: block its loop for `ms`, or crash it. Read from `latest`. */
export const control = topic('playground.control.v1', {
  schema: z.object({
    to: z.string().min(1).max(40),
    act: z.enum(['block', 'crash']),
    ms: z.number().int().min(1).max(10_000).optional(),
  }),
  retention: { kind: 'last-n', n: 50 },
});

// ---- The File processor (M3h decision 29) ----

/** A file to process, on its kind's job topic (src/files/kinds.ts, `Job`). */
const job = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(['csv', 'image', 'archive', 'hash']),
  size: z.number().int().min(1).max(4),
  seed: z.number().int(),
  poison: z.literal(true).optional(),
  heavy: z.literal(true).optional(),
  corrupt: z.literal(true).optional(),
  at: z.number(),
});

/**
 * One job topic per kind, read by a consumer group of processors: each file
 * goes to one of them, and a processor that stops leaves its unfinished
 * files to the group (the bus redelivers what it didn't commit). Kept long
 * enough that a backlog is never trimmed before it's processed.
 */
const jobs = (kind: string) =>
  topic(`files.jobs.${kind}.v1`, { schema: job, retention: { kind: 'last-n', n: 100_000 } });
export const csvJobs = jobs('csv');
export const imageJobs = jobs('image');
export const archiveJobs = jobs('archive');
export const hashJobs = jobs('hash');

/** What a processor made of a file, or that the file was corrupt. */
export const results = topic('files.results.v1', {
  schema: z.object({
    id: z.string().min(1).max(40),
    kind: z.enum(['csv', 'image', 'archive', 'hash']),
    status: z.enum(['ok', 'corrupt']),
    /** The processor that did it. */
    by: z.string().min(1).max(40),
    /** Time spent on it, from start to finish, in ms. */
    ms: z.number().nonnegative(),
    /** When the file was made and when it was done (timeOrigin + now, ms). */
    created: z.number(),
    done: z.number(),
    output: z.string().max(200),
  }),
  retention: { kind: 'last-n', n: 100_000 },
});

/**
 * The generator's dials, under the key `dials`: whether it runs, its run and
 * seed, files per second, and how many in a hundred are poison, heavy or
 * corrupt. Compacted, read from the start.
 */
export const dials = topic('files.dials.v1', {
  schema: z.object({
    running: z.boolean(),
    run: z.number().int().min(1),
    seed: z.number().int(),
    rate: z.number().min(0).max(500),
    poison: z.number().min(0).max(100),
    heavy: z.number().min(0).max(100),
    corrupt: z.number().min(0).max(100),
  }),
  retention: { kind: 'compacted' },
});

export default contracts(tasks, control, csvJobs, imageJobs, archiveJobs, hashJobs, results, dials);
