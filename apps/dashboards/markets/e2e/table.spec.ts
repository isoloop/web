import { expect, test, type Page } from '@playwright/test';

const ROW = 22;

/**
 * Frames a far jump may leave the view without rows. Native renders on the
 * scroll event's own thread, so two frames. On Isoloop the scroll event goes
 * to the table's worker and the rows come back as patches applied on the
 * next frame, so the round trip, plus one frame of headroom: four.
 */
const FRAMES: Record<'isoloop' | 'native', number> = { native: 2, isoloop: 4 };

/** Waits one animation frame. */
const frame = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      }),
  );

for (const build of ['isoloop', 'native'] as const) {
  test(`${build}: scrolling 10,000 rows renders only the visible ones, and a far jump fills the view within ${FRAMES[build]} frames`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    // 25 trades a second per exchange and symbol at 10×: BTC-USD gets about 100
    // a recorded second, so 110 s of recording (`for`, about 11 s here) leaves
    // about 11,000 rows. Then the replay stops, so what's measured is scrolling,
    // not scrolling while the table's worker takes 3,000 trades a second.
    await page.goto(`/${build}/?size=lite&speed=10&tps=25&for=110000`);
    const table = page.locator('[data-slot="trades"] .trades');
    const inner = table.locator('.trades-inner');
    const height = async (): Promise<number> => (await inner.boundingBox())?.height ?? 0;
    await expect.poll(height, { timeout: 30_000 }).toBeGreaterThanOrEqual(10_000 * ROW);
    // The replay has ended once the table stops growing.
    let last = -1;
    await expect
      .poll(
        async () => {
          const now = await height();
          const still = now === last;
          last = now;
          return still;
        },
        { timeout: 20_000, intervals: [500] },
      )
      .toBe(true);

    const viewport = (await table.boundingBox())?.height ?? 0;
    expect(viewport).toBeGreaterThan(100);
    const took: number[] = [];
    for (const top of [0, 40_000, 110_000, 200_000, 60_000]) {
      // oxlint-disable-next-line no-await-in-loop -- each step scrolls, then checks that position
      await table.evaluate((el, t) => {
        el.scrollTop = t;
      }, top);
      let frames = 0;
      let shown = { rendered: 0, inView: 0, full: 1 };
      while (frames < FRAMES[build]) {
        // oxlint-disable-next-line no-await-in-loop -- one frame at a time, until the view is full
        await frame(page);
        frames++;
        // oxlint-disable-next-line no-await-in-loop -- see above
        shown = await table.evaluate((el, row) => {
          const box = el.getBoundingClientRect();
          const rows = [...el.querySelectorAll<HTMLElement>('.trade')];
          const inView = rows.filter((r) => {
            const b = r.getBoundingClientRect();
            return b.bottom > box.top && b.top < box.bottom;
          });
          return {
            rendered: rows.length,
            inView: inView.length,
            full: Math.floor(box.height / row),
          };
        }, ROW);
        if (shown.inView >= shown.full) break;
      }
      took.push(frames);
      expect(shown.rendered, `rows rendered at scrollTop ${top}`).toBeLessThan(60);
      expect(
        shown.inView,
        `rows in view at scrollTop ${top}, after ${frames} frames`,
      ).toBeGreaterThanOrEqual(shown.full);
    }
    info.annotations.push({ type: 'frames to fill the view', description: took.join(', ') });
  });
}
