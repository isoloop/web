import { expect, test, type Page } from '@playwright/test';

// The devtools panel on the plant (M4b task 11): `?devtools=1` on the Isoloop
// build connects `@isoloop/devtools`, from npm, as built by Vite. The done
// when of M4b: the panel shows the isolates, the bus and a live log, keeps
// working while the bus restarts, and lists itself marked as devtools.
const any = { '~standard': {} };
const panel = (page: Page) => page.locator('[data-isoloop-devtools]');
const row = (page: Page, id: string) => panel(page).locator(`tr[data-isolate="${id}"]`);

async function open(page: Page): Promise<void> {
  await page.goto('/isoloop/?devtools=1');
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
  await page.goto('/isoloop/');
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
  await panel(page).locator('[data-tab="log"]').click();
  await expect(panel(page).locator('[data-log-table] tbody tr')).not.toHaveCount(0);

  await panel(page).locator('[data-log-filter]').fill('plant.events');
  await panel(page).locator('[data-log-apply]').click();
  await crashBus(page);
  await page.evaluate(
    (schema) =>
      window.kernel.publish(
        { name: 'plant.events', schema },
        {
          value: {
            id: 'devtools-e2e',
            machine: 'T1',
            kind: 'start',
            text: 'after the bus restart',
            ts: Date.now(),
          },
        },
      ),
    any,
  );
  await expect(
    panel(page).locator('[data-log-table] tbody tr', { hasText: 'after the bus restart' }),
  ).toHaveCount(1);
  // The panel itself came through the restart.
  await panel(page).locator('[data-tab="isolates"]').click();
  await expect(row(page, 'isoloop-devtools')).toHaveAttribute('data-state', 'running');
});
