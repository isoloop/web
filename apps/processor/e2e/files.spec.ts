import { expect, test, type Page } from '@playwright/test';

// The File processor (M3h decision 29), against the built app, in real time.
// Processors start in the quarantine until measured (about 3 s), then the
// balancer places them; a consumer group per kind hands a stopped
// processor's unfinished files to the group again.

declare global {
  interface Window {
    files: import('../src/files/model').FileProcessor;
  }
}

const stat = (page: Page, id: string) => page.getByTestId(id);

async function drained(page: Page, timeout = 60_000): Promise<void> {
  await page.evaluate(() => window.files.setDials({ running: false }));
  await expect
    .poll(() => page.evaluate(() => window.files.outstanding().length), { timeout })
    .toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./files/');
  await page.waitForFunction(() => window.files !== undefined);
});

test('files flow through: results, jobs per second and latency', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(stat(page, 'rate')).not.toHaveText('0.0', { timeout: 10_000 });
  await expect(stat(page, 'p50')).toHaveText(/^\d+ ms$/);
  await expect(page.locator('.recent tbody tr').first()).toBeVisible();
  // The filter narrows the latest results.
  await page.getByRole('searchbox', { name: 'Filter results' }).fill('hash');
  await expect(page.locator('.recent tbody tr').first().locator('td').nth(1)).toHaveText('Hash');
  await drained(page);
});

test('no file is lost when processors move', async ({ page }) => {
  test.setTimeout(90_000);
  await page.evaluate(() => window.files.setDials({ running: true, rate: 30 }));
  // The balancer's own moves (out of the quarantine once measured)…
  await expect(page.locator('.log li[data-kind="steady"]').first()).toBeVisible({
    timeout: 15_000,
  });
  // …and every processor stopped and started again, twice.
  await page.getByRole('radio', { name: 'One pool' }).check();
  await page.waitForTimeout(3_000);
  await page.getByRole('radio', { name: 'Balancer' }).check();
  await page.waitForTimeout(3_000);
  await drained(page);
  const s = await page.evaluate(() => window.files.snapshot());
  expect(s.produced).toBeGreaterThan(100);
  // Nothing lost: every file made has a result.
  expect(s.done).toBe(s.produced);
  // At least once, not exactly once: a processor stopped between publishing a
  // result and committing its file does that file again. At most one per stop.
  const stops = s.log.filter((l) => l.kind !== 'mode').length + 8 * 2;
  expect(s.duplicates).toBeLessThanOrEqual(stops);
});

test('a poison file sends its processor to the quarantine', async ({ page, browserName }) => {
  // Playwright's WebKit stalls workers for half a second now and then (the
  // engine constraint the plant dashboard records too): the balancer reads
  // those as spikes and moves processors before the poison file comes.
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, which the balancer moves');
  test.setTimeout(180_000);
  await page.evaluate(() => window.files.setDials({ running: true, rate: 20 }));
  // Placed out of the quarantine first.
  await expect(page.locator('section[data-pool="balancer-1"] li.card')).toHaveCount(8, {
    timeout: 20_000,
  });
  // Long enough that a processor gets a second poison file: a first spike is
  // only noted, a second within 60 s quarantines (ADR 0017, amended for M3i).
  await page.evaluate(() => window.files.setDials({ poison: 100 }));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.files.setDials({ poison: 0 }));
  // The beat names the blocked processor (a spike), or, when the beat can't
  // tell (Playwright's WebKit stalls workers now and then), the balancer
  // bisects; either way a processor goes to the quarantine.
  await expect(
    page.locator('.log li[data-kind="spike"], .log li[data-kind="bisect"]').first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator('section.column[data-kind="quarantine"] li.card').first(),
  ).toBeVisible();
  // Ten poison files hold their processors 2 s each, and a first spike no
  // longer moves its processor out: on a 2-core runner the backlog takes a
  // while to drain.
  await drained(page, 120_000);
});

// Faults on the balancer (M3j decision 10): poison, heavy and corrupt files,
// with the balancer's moves, quarantines and the kernel's restarts. Every file
// made still gets a result.
test('with faults on the balancer, no file is left without a result', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, which the balancer moves');
  test.setTimeout(300_000);
  await page.goto('./files/?maxWorkers=2');
  await page.waitForFunction(() => window.files !== undefined);
  await page.evaluate(() =>
    window.files.setDials({ running: true, rate: 20, poison: 1, heavy: 10, corrupt: 1 }),
  );
  await page.waitForTimeout(45_000);
  await page.evaluate(() => window.files.setDials({ poison: 0, heavy: 0, corrupt: 0 }));
  try {
    await drained(page, 180_000);
  } catch (e) {
    // What the kernel gave up on, and what's left, for the diagnosis.
    const left = await page.evaluate(() => ({
      givenUp: window.files.givenUp(),
      outstanding: window.files.outstanding().length,
      kinds: window.files.snapshot().kinds,
    }));
    test.info().annotations.push({ type: 'left', description: JSON.stringify(left) });
    throw e;
  }
  const s = await page.evaluate(() => window.files.snapshot());
  expect(s.produced).toBeGreaterThan(500);
  expect(s.done).toBe(s.produced);
});

for (const mode of ['own', 'one'] as const) {
  test(`in "${mode}" placement nothing moves, poison or not`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.getByRole('radio', { name: mode === 'own' ? 'Own' : 'One pool' }).check();
    await page.evaluate(() => window.files.setDials({ running: true, rate: 20 }));
    await page.waitForTimeout(2_000);
    await page.evaluate(() => window.files.setDials({ poison: 100 }));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.files.setDials({ poison: 0 }));
    await page.waitForTimeout(5_000);
    await expect(page.locator('.log li:not([data-kind="mode"])')).toHaveCount(0);
    await expect(page.locator('section.column[data-kind="quarantine"]')).toHaveCount(0);
    await drained(page);
  });
}
