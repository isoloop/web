// For the E2E tests that block a loop: wait until it has been steady for a
// second first, so the block lands on a settled loop and not in start-up work.
// A person rarely clicks that early; a test always does. The kernel itself has
// no warm-up: its kill threshold applies from `ready` on.

/** The part of the page's kernel it reads; the site's tests don't have its type. */
interface Beats {
  on(event: 'isolate:beat', fn: (b: { id: string; lagMs: number; at: number }) => void): () => void;
}

/** What `steadyLoop` needs of a page or a frame. */
interface Scope {
  evaluate(fn: (id: string) => Promise<void>, id: string): Promise<void>;
}

/** Resolves once `id`'s beats have been on time (at most 100 ms late) for over 1 s. */
export function steadyLoop(scope: Scope, id: string): Promise<void> {
  return scope.evaluate(
    (who) =>
      new Promise<void>((resolve, reject) => {
        let from: number | undefined;
        const timer = setTimeout(() => {
          off();
          reject(new Error(`${who}: its loop wasn't steady for 1 s within 15 s`));
        }, 15_000);
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the pages under test expose it
        const { kernel } = window as unknown as { kernel: Beats };
        const off = kernel.on('isolate:beat', (beat) => {
          if (beat.id !== who) return;
          if (beat.lagMs > 100) from = undefined;
          else if (from === undefined) from = beat.at;
          else if (beat.at - from >= 1100) {
            off();
            clearTimeout(timer);
            resolve();
          }
        });
      }),
    id,
  );
}
