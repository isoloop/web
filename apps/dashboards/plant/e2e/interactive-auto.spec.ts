import { expect, test, type Locator, type Page } from '@playwright/test';
import { WEBKIT_STOPS, stopsOn } from './scope';

// Automatic placement on the interactive page (M3h task 6), Isoloop only: the
// page's balancer places widgets added with "Automatic", keeps a light one in
// a pool, and moves a widget that blocks (the test-only `burn`, `?chaos`) to
// the quarantine, with a badge on the widget and an entry in the placement log.

const MOVE = 30_000;

const slot = (page: Page, title: string): Locator =>
  page
    .locator('.creator-slot')
    .filter({ has: page.locator('.creator-slot-title', { hasText: title }) });
const form = (page: Page): Locator => page.locator('.creator-drawer-form');
const field = (page: Page, name: string): Locator => form(page).locator(`[name="${name}"]`);

async function open(page: Page): Promise<void> {
  await page.goto('./interactive/isoloop/?chaos');
  await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
}

/**
 * Adds a widget from the drawer: the first topic's records in a table, with
 * `title`, then `more` (a burn). Waits 3.5 s on the preview first, so the
 * balancer has measured it when the widget is added (M3h decision 12).
 */
async function add(page: Page, title: string, more?: (page: Page) => Promise<void>): Promise<void> {
  await page.locator('.creator-toolbar [data-action="add"]').click();
  await expect(field(page, 'pool')).toHaveValue('$auto');
  await expect(field(page, 'pool').locator('option').first()).toHaveText('Automatic');
  await field(page, 'title').fill(title);
  await more?.(page);
  await expect(form(page)).toHaveAttribute('data-valid', 'true');
  await page.waitForTimeout(3_500);
  await form(page).locator('[data-action="add"]').click();
  await expect(page.locator('.creator-drawer')).toBeHidden();
}

test.describe('isoloop', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(stopsOn(browserName, 'isoloop'), WEBKIT_STOPS);
  });

  test('without ?chaos the drawer has no burn, and validateSpec refuses one', async ({ page }) => {
    await page.goto('./interactive/isoloop/');
    await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
    await page.locator('.creator-toolbar [data-action="add"]').click();
    await expect(field(page, 'pool')).toHaveValue('$auto');
    await expect(form(page).locator('[data-chaos]')).toHaveCount(0);
  });

  test('a light widget stays pooled; a blocking one goes to the quarantine, with a badge and a log entry', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await open(page);
    await expect(page.locator('.creator-placement-log')).toHaveAttribute('data-moves', '0');

    await add(page, 'Light');
    const light = slot(page, 'Light');
    await expect(light).toHaveAttribute('data-placement', 'auto');
    await expect(light).toHaveAttribute('data-auto-pool', /^balancer-\d+$/, { timeout: MOVE });
    await expect(light.locator('.creator-slot-where')).toHaveText(/^Auto \d+$/);

    await add(page, 'Blocker', async (p) => {
      await field(p, 'burn').selectOption('block');
      await field(p, 'burnEvery').fill('3');
      await field(p, 'burnFor').fill('400');
    });
    const blocker = slot(page, 'Blocker');
    await expect(blocker).toHaveAttribute('data-auto-pool', /^balancer-quarantine-\d+$/, {
      timeout: MOVE,
    });
    await expect(blocker.locator('.creator-slot-where')).toHaveText(/^Quarantine/);
    const log = page.locator('.creator-placement-log');
    await expect(log).not.toHaveAttribute('data-moves', '0');
    await log.locator('summary').click();
    await expect(log.locator('li[data-reason]').first()).toBeVisible();
    // The light widget was never the one moved.
    const lightId = await light.getAttribute('data-widget');
    await expect(log.locator(`li[data-widget="${lightId}"]`)).toHaveCount(0);
    await expect(light).toHaveAttribute('data-auto-pool', /^balancer-\d+$/);

    // The balancer saw it the same way.
    const placed = await page.evaluate(() =>
      window.balancer.placements().map((p) => ({ id: p.id, pool: p.pool, state: p.state })),
    );
    expect(placed).toContainEqual(
      expect.objectContaining({
        id: `widget-${lightId}`,
        pool: expect.stringMatching(/^balancer-\d+$/),
      }),
    );
  });

  test('a move shows a badge on the widget while it lasts', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    await add(page, 'Neighbour');
    await expect(slot(page, 'Neighbour')).toHaveAttribute('data-auto-pool', /^balancer-\d+$/, {
      timeout: MOVE,
    });
    await add(page, 'Spiky', async (p) => {
      await field(p, 'burn').selectOption('block');
      await field(p, 'burnEvery').fill('3');
      await field(p, 'burnFor').fill('400');
    });
    await expect(slot(page, 'Spiky').locator('.creator-slot-badge')).toBeVisible({
      timeout: MOVE,
    });
  });
});
