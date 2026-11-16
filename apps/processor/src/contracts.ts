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

export default contracts(tasks, control);
