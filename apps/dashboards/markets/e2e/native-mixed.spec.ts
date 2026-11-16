import { expect, test, type Locator, type Page } from '@playwright/test';
import { FULL } from './scope';

// `/native-mixed` (M3g decisions 1–6): native + workers, with the filters and
// the alerts panel as Preact parts another team ships apart, loaded at run
// time by `import()` from their manifest. Containment is what a native app
// writes: an error boundary per widget and a guarded load, no restart.
test.skip(!FULL, '/native-mixed runs on Chromium only in pull requests');

const slot = (page: Page, name: string): Locator => page.locator(`[data-slot="${name}"]`);

async function draws(page: Page, name: string): Promise<void> {
  const canvas = slot(page, name).locator('canvas');
  const before = await canvas.screenshot();
  await expect
    .poll(async () => Buffer.compare(await canvas.screenshot(), before) !== 0, { timeout: 10_000 })
    .toBe(true);
}

/** The filters answer: picking a symbol reaches the URL (the filters stream). */
async function filtersWork(page: Page, symbol: string): Promise<void> {
  await slot(page, 'filters').locator('select[name="symbol"]').selectOption(symbol);
  await expect.poll(() => new URL(page.url()).searchParams.get('symbol')).toBe(symbol);
}

test('the Preact parts come from their own build, through its manifest', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/native-mixed/parts/')) loaded.push(new URL(r.url()).pathname);
  });
  await page.goto('/native-mixed/?size=lite&speed=10');
  await filtersWork(page, 'ETH-USD');
  await expect(slot(page, 'alerts-panel').getByRole('button', { name: 'Add rule' })).toBeVisible();
  expect(loaded.some((p) => p.endsWith('/parts-manifest.json'))).toBe(true);
  expect(loaded.some((p) => /\/filters-[\w-]+\.js$/.test(p))).toBe(true);
  expect(loaded.some((p) => /\/alerts-panel-[\w-]+\.js$/.test(p))).toBe(true);
  await expect(slot(page, 'filters').locator('[data-head="where"]')).toHaveText(
    'main thread · Preact',
  );
  await expect(slot(page, 'price').locator('[data-head="where"]')).toHaveText(
    'main thread · React',
  );
});

test('a crashed part stays down behind its own boundary; the React widgets keep drawing', async ({
  page,
}) => {
  await page.goto('/native-mixed/?size=lite&speed=10');
  await draws(page, 'price');
  await slot(page, 'alerts-panel').locator('button[name="stress-crash"]').click();
  await expect(slot(page, 'alerts-panel').locator('.widget-error')).toHaveText(
    'alerts-panel crashed: stress: alerts-panel crashed',
  );
  await Promise.all([draws(page, 'price'), draws(page, 'spread')]);
  // No restart logic: the part stays crashed, and the other part still works.
  await page.waitForTimeout(2_000);
  await expect(slot(page, 'alerts-panel').getByRole('button', { name: 'Add rule' })).toHaveCount(0);
  await filtersWork(page, 'SOL-USD');
});

test('a crashed React widget leaves the Preact parts working', async ({ page }) => {
  await page.goto('/native-mixed/?size=lite&speed=10');
  await draws(page, 'price');
  await slot(page, 'price').locator('button[name="stress-crash"]').click();
  await expect(slot(page, 'price').locator('.widget-error')).toBeVisible();
  await filtersWork(page, 'ETH-USD');
  await draws(page, 'spread');
});

test('a part that fails to load shows a fallback in its slot only', async ({ page }) => {
  await page.route('**/native-mixed/parts/alerts-panel-*.js', (route) => route.abort());
  await page.goto('/native-mixed/?size=lite&speed=10');
  await expect(slot(page, 'alerts-panel').locator('.widget-error')).toContainText(
    'alerts-panel failed to load',
  );
  await draws(page, 'price');
  await filtersWork(page, 'ETH-USD');
});
