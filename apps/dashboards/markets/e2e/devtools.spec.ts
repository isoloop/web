import { expect, test, type Page } from '@playwright/test';

// The devtools panel on the markets dashboard (M4b task 11): `?devtools=1` on the Isoloop
// build connects `@isoloop/devtools`, from npm, as built by Vite. The done
// when of M4b: the panel shows the isolates, the bus and a live log, keeps
// working while the bus restarts, and lists itself marked as devtools.
const any = { '~standard': {} };
const panel = (page: Page) => page.locator('[data-isoloop-devtools]');
const row = (page: Page, id: string) => panel(page).locator(`tr[data-isolate="${id}"]`);

async function open(page: Page): Promise<void> {
  await page.goto('/isoloop/?size=lite&speed=10&devtools=1');
  await panel(page).locator('button[data-health]').click();
  await expect(panel(page).locator('[data-view="isolates"]')).toBeVisible();
}

async function crashBus(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ready = new Promise<void>((resolve) => {
      const off = window.kernel.on('bus:ready', (e) => {
        if (!e.first) {
          off();
          resolve();
        }
      });
    });
    window.kernel.debug.crashBus();
    await ready;
  });
}

test('without ?devtools=1 there is no panel and no panel isolate', async ({ page }) => {
  await page.goto('/isoloop/?size=lite&speed=10');
  await expect.poll(() => page.evaluate(() => window.kernel.isolates().length)).toBeGreaterThan(0);
  await expect(panel(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => window.kernel.isolates().some((i) => i.id === 'isoloop-devtools')),
  ).toBe(false);
});

test('the panel lists the isolates, itself marked as devtools', async ({ page }) => {
  await open(page);
  await expect(row(page, 'isoloop-devtools')).toHaveAttribute('data-state', 'running');
  await expect(row(page, 'isoloop-devtools').locator('[data-devtools-self]')).toHaveText(
    'devtools',
  );
  const ids = await page.evaluate(() =>
    window.kernel
      .isolates()
      .map((i) => i.id)
      .filter((id) => id !== 'isoloop-devtools'),
  );
  expect(ids.length).toBeGreaterThan(0);
  await Promise.all(ids.slice(0, 5).map((id) => expect(row(page, id)).toBeAttached()));
});

test('the bus view shows the topics with their head offsets', async ({ page }) => {
  await open(page);
  await panel(page).locator('[data-tab="bus"]').click();
  const bus = panel(page).locator('[data-view="bus"]');
  await expect(bus.locator('[data-bus-state]')).toHaveAttribute('data-bus-state', 'running');
  await expect(bus.locator('tr[data-topic]')).not.toHaveCount(0);
  await expect(bus.locator('tr[data-topic] [data-head]').first()).toHaveText(/^\d+$/);
});

test('the log shows live records, and keeps going through a bus restart', async ({ page }) => {
  await open(page);
  await panel(page).locator('[data-tab="messages"], [data-tab="log"]').click();
  await expect(panel(page).locator('[data-log-table] tbody tr')).not.toHaveCount(0);

  await panel(page).locator('[data-log-filter]').fill('alert-rules.v1');
  await panel(page).locator('[data-log-apply]').click();
  await crashBus(page);
  await page.evaluate(
    (schema) =>
      window.kernel.publish(
        { name: 'alert-rules.v1', schema },
        {
          key: 'devtools-e2e',
          value: {
            removed: false,
            id: 'devtools-e2e',
            symbol: 'ETH-USD',
            metric: 'price',
            op: 'above',
            threshold: 123456789,
          },
        },
      ),
    any,
  );
  await expect(
    panel(page).locator('[data-log-table] tbody tr', { hasText: '123456789' }),
  ).toHaveCount(1);
  // The panel itself came through the restart.
  await panel(page).locator('[data-tab="isolates"]').click();
  await expect(row(page, 'isoloop-devtools')).toHaveAttribute('data-state', 'running');
});

test('the bar’s Devtools switch reloads with ?devtools=1 and opens the panel; native has none', async ({
  page,
}) => {
  await page.goto('/isoloop/?size=lite&speed=10');
  const box = page.locator('.ui-bar').getByRole('checkbox', { name: /Devtools/ });
  await expect(box).not.toBeChecked();
  await expect(panel(page)).toHaveCount(0);
  await box.check();
  await expect(page).toHaveURL(/devtools=1/);
  await expect(page.locator('.ui-bar').getByRole('checkbox', { name: /Devtools/ })).toBeChecked();
  await expect(panel(page)).toHaveCount(1);
  // Off again: the flag goes, and so does the panel.
  await page
    .locator('.ui-bar')
    .getByRole('checkbox', { name: /Devtools/ })
    .uncheck();
  await expect(page).not.toHaveURL(/devtools=1/);
  await expect(panel(page)).toHaveCount(0);
  // The interactive page has the same switch; the native build has none.
  await page.goto('/interactive/isoloop/');
  await expect(page.locator('.ui-bar').getByRole('checkbox', { name: /Devtools/ })).toHaveCount(1);
  await page.goto('/native/?size=lite&speed=10');
  await expect(page.locator('.ui-devtools-switch')).toHaveCount(0);
});
