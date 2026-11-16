import { expect, test } from '@playwright/test';

// Engine constraint 2, as the plant dashboard meets it: on Playwright's
// WebKit, the Isoloop page's eight waveforms, scrolling every frame in their
// workers, take its main thread. Until Playwright 1.64 (WebKit 2370) `split`,
// with the canvases spread over nine visual pools, stopped outright and this
// was expected to fail. With Playwright 1.65's WebKit it no longer stops:
// it ran over 30 frames in 2 s on the 4-core CI runner and in some local runs,
// and 14–17 in others on a 32-core machine (2026-11-16). `matched`, the
// default, with all 24 canvases in one visual pool, already varied by machine
// (2026-11-13). So on WebKit both are reported, not asserted. The WEBKIT_STOPS
// skips in the other specs stay: with them lifted, 70 of 71 Isoloop WebKit
// tests passed locally, and the one left ("the machines stay put") shows a
// 39 px layout shift on WebKit only.
for (const placement of ['split', 'matched'] as const) {
  test(`isoloop ${placement}: the main thread keeps running frames with every widget drawing`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(30_000);
    await page.goto(`/isoloop/?placement=${placement}`);
    await page.waitForTimeout(3_000);
    const frames = await Promise.race([
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const t0 = performance.now();
            let n = 0;
            const step = (): void => {
              n++;
              if (performance.now() - t0 < 2_000) requestAnimationFrame(step);
              else resolve(n);
            };
            requestAnimationFrame(step);
          }),
      ),
      new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(0);
        }, 10_000);
      }),
    ]);
    if (browserName === 'webkit') {
      test.info().annotations.push({ type: 'frames in 2 s', description: String(frames) });
      return;
    }
    expect(frames).toBeGreaterThan(30);
  });
}
