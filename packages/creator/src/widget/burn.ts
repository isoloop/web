// The test-only `burn` operator at work (M3h decision 21): the widget blocks
// its own thread on command, so the balancer has something to find. Only a
// spec validated with `?chaos` holds one (spec/validate.ts).
import type { BurnOp, Operator } from '../spec/types';

/** A steady load burns this share of every period. */
export const LOAD_PERIOD_MS = 100;

const isBurn = (o: Operator): o is BurnOp => o.op === 'burn';

/** Runs the thread flat out for `ms`. */
export function spin(ms: number, now: () => number = () => performance.now()): void {
  const end = now() + ms;
  while (now() < end) {
    // Burning time is the point.
  }
}

/** Runs `fn` every `ms`; returns the function that stops it. */
export type Every = (fn: () => void, ms: number) => () => void;

const every: Every = (fn, ms) => {
  const handle = setInterval(fn, ms);
  return () => clearInterval(handle);
};

/**
 * Starts every `burn` in `operators`: a block of `forMs` every `everyMs`, or
 * `loadPct` of every 100 ms. Returns the function that stops them; with no
 * burn, it does nothing.
 */
export function startBurns(
  operators: readonly Operator[],
  o: { every?: Every; spin?: (ms: number) => void } = {},
): () => void {
  const run = o.every ?? every;
  const burn = o.spin ?? ((ms: number) => spin(ms));
  const stops = operators
    .filter(isBurn)
    .map((b) =>
      b.loadPct === undefined
        ? run(() => burn(b.forMs), b.everyMs)
        : run(() => burn((b.loadPct / 100) * LOAD_PERIOD_MS), LOAD_PERIOD_MS),
    );
  return () => {
    for (const stop of stops) stop();
  };
}
