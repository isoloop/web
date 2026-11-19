// The agent-call cost's topic (M4a task 13): a requestable topic that a
// bench-only isolate answers with the request's value, so the run measures
// `kernel.request` itself, not a handler's work. It's in the contracts only
// in a build made with `PLANT_AGENT_COST=1` (vite.config.ts); every other
// build, the deployed and measured ones included, leaves it out entirely.
import { topic } from '@isoloop/bus';
import { z } from 'zod';

// A function, not a constant: a module-level `topic(...)` call would stay in
// every build's contracts chunk even where nothing uses it.
export function agentCostTopic() {
  const ping = z.object({ n: z.number().int(), sentAt: z.number() });
  return topic('plant.bench.ping.v1', {
    schema: ping,
    reply: ping,
    // Room for the run's burst of 1,000 calls issued back to back: with
    // `last-n` 100 (markets' tools), calls past the 100th were evicted before
    // the ping isolate read them and timed out.
    retention: { kind: 'last-n', n: 2_000 },
  });
}
