// The landing page's code: the setup behind its demo (apps/basic), without
// the demo's recording code. basic's own contracts are apps/basic/src/contracts.ts.
// #region show
import { contracts, topic } from '@isoloop/bus';
import { z } from 'zod';

export const count = topic('count.v1', {
  schema: z.number().int().nonnegative(),
  retention: { kind: 'last-n', n: 100 },
});

export const primes = topic('primes.v1', {
  schema: z.object({ count: z.number().int(), ms: z.number().nonnegative() }),
  retention: { kind: 'last-n', n: 20 },
});

export const note = topic('note.v1', {
  schema: z.string().trim().min(1).max(200),
  retention: { kind: 'last-n', n: 50 },
});

export default contracts(count, primes, note);
// #endregion
