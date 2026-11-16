import { expect, test, type Page } from '@playwright/test';

// Native + workers pairs with Isoloop's `matched` placement (M3f), both ways,
// and so does its React and Preact build with `mixed` (M3g).
const builds = [
  ['isoloop', 'native', ''],
  ['native', 'isoloop', ''],
  ['native-workers', 'isoloop', 'matched'],
  ['isoloop', 'native-workers', 'matched'],
  ['native-mixed', 'mixed', 'matched'],
  ['mixed', 'native-mixed', 'matched'],
] as const;

/** The replay position in the URL, in recording ms. */
const at = (page: Page): number => Number(new URL(page.url()).searchParams.get('at'));

for (const [from, to, placement] of builds) {
  const extra =
    (from === 'isoloop' || from === 'mixed') && placement !== '' ? `&placement=${placement}` : '';
  test(`${from}${extra} → ${to}: the toggle lands on the other build with the same filters and replay position`, async ({
    page,
  }) => {
    const started = Date.now();
    await page.goto(`/${from}/?size=lite&speed=10&seed=3${extra}`);
    const filters = page.locator('[data-slot="filters"]');
    await filters.locator('select[name="symbol"]').selectOption('ETH-USD');
    await filters.locator('input[name="exchange-okx"]').click();
    // Drawn as the filters say, in both builds: a controlled checkbox whose
    // state comes back from a topic (isoloop/isoloop#127).
    await expect(filters.locator('input[name="exchange-okx"]')).not.toBeChecked();
    // The URL mirrors the filters as they change.
    const url = (k: string) => () => new URL(page.url()).searchParams.get(k);
    await expect.poll(url('symbol')).toBe('ETH-USD');
    await expect.poll(url('ex')).toBe('coinbase,kraken,bitstamp');
    await page.waitForTimeout(2_000);
    await page.getByRole('link', { name: `Switch to ${to}` }).click();
    await page.waitForURL(`**/${to}/**`);
    if (to === 'isoloop' || to === 'mixed') {
      expect(new URL(page.url()).searchParams.get('placement')).toBe(placement || null);
    }
    // At least the 2 s wait at 10× (20 s of recording), and no more than the
    // whole test so far at 10×: a slow runner takes longer to get here, and the
    // replay plays on meanwhile.
    expect(at(page)).toBeGreaterThanOrEqual(18_000);
    expect(at(page)).toBeLessThan((Date.now() - started) * 10 + 5_000);
    const there = page.locator('[data-slot="filters"]');
    await expect(there.locator('select[name="symbol"]')).toHaveValue('ETH-USD');
    await expect(there.locator('input[name="exchange-okx"]')).not.toBeChecked();
    await expect(there.locator('input[name="exchange-kraken"]')).toBeChecked();
    // The pipeline runs on: ETH-USD trades from the exchanges still selected.
    const rows = page.locator('[data-slot="trades"] .trade');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    await expect(rows.first()).not.toContainText('okx');
  });
}

test('React and Preact on one page switches to its native + workers build', async ({ page }) => {
  await page.goto('./mixed/?size=lite&speed=10');
  const kernel = page.getByRole('navigation', { name: 'Kernel' });
  await expect(kernel.locator('[aria-current="page"]')).toHaveText('Isoloop');
  await expect(kernel.getByRole('link', { name: 'Switch to native-mixed' })).toHaveText('Native');
});
