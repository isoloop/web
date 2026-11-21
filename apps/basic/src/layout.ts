// Where basic's four isolates sit on the page, by id: drawn by app.ts with
// the kernel, and by main.ts as idle panes before Start (?start=manual).
export const POOL = 'shared';

export type Slot = {
  id: string;
  name: string;
  where: string;
  /** The container: `own` for a worker each, `pooled` for the pool. */
  parent: 'own' | 'pooled';
  pool?: string;
  /** The isolate whose records it reads, if any. */
  upstream?: string;
};

export const LAYOUT: Slot[] = [
  { id: 'A', name: 'A · Counter', where: 'own worker', parent: 'own' },
  { id: 'B', name: 'B · Ticker', where: 'own worker', parent: 'own' },
  {
    id: 'C',
    name: 'C · Primes',
    where: `pool "${POOL}"`,
    parent: 'pooled',
    pool: POOL,
    upstream: 'A',
  },
  {
    id: 'D',
    name: 'D · Messages',
    where: `pool "${POOL}"`,
    parent: 'pooled',
    pool: POOL,
    upstream: 'A',
  },
];
