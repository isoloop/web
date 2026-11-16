import { expect, test, type Page } from '@playwright/test';

// The balancer playground (M3h), against the built app. Tasks are headless
// isolates; the page shows one column per worker. These run in real time:
// the balancer has no test-only speed-up (M3h, Q14).

const card = (page: Page, id: string) => page.locator(`li[data-task="${id}"]`);
const columnOf = (page: Page, id: string) =>
  card(page, id).locator('xpath=ancestor::section[@data-pool]');

async function add(page: Page, load: number): Promise<string> {
  const id = await page.evaluate((l) => window.playground.add(l), load);
  if (!id) throw new Error('no room for a task');
  await expect(card(page, id)).toHaveAttribute('data-state', 'running', { timeout: 15_000 });
  return id;
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.playground !== undefined);
});

test('it boots, and five light tasks share one balancer pool', async ({ page }) => {
  await expect(page.locator('#browser-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add 5 light tasks' }).click();
  await expect(page.getByTestId('count')).toHaveText('5/24 tasks');
  const pool = page.locator('section.column[data-pool="balancer-1"]');
  await expect(pool.locator('li.card[data-state="running"]')).toHaveCount(5, { timeout: 15_000 });
  // Each measures close to its dial once a second of beats is in.
  await expect(card(page, 'task-5').getByTestId('measured')).toHaveText(/measured 1\d %/, {
    timeout: 10_000,
  });
});

test('a task that blocks its pool goes to quarantine', async ({ page }) => {
  const heavy = await add(page, 30);
  await add(page, 5);
  await expect(columnOf(page, heavy)).toHaveAttribute('data-pool', 'balancer-1');
  await page.waitForTimeout(1_500);
  await card(page, heavy).getByRole('button', { name: 'Block 2 s' }).click();
  await expect(columnOf(page, heavy)).toHaveAttribute('data-kind', 'quarantine', {
    timeout: 15_000,
  });
  // The kernel's beat names the culprit, so nothing else moves (no bisect).
  await expect(page.locator('.log li[data-kind="bisect"]')).toHaveCount(0);
  await expect(page.locator('.log li').first()).toContainText(heavy);
});

test('a blocked task leaves quarantine once it has been steady for 30 s', async ({ page }) => {
  test.setTimeout(90_000);
  const heavy = await add(page, 30);
  await add(page, 5);
  await page.waitForTimeout(1_500);
  await card(page, heavy).getByRole('button', { name: 'Block 2 s' }).click();
  await expect(columnOf(page, heavy)).toHaveAttribute('data-kind', 'quarantine', {
    timeout: 15_000,
  });
  await expect(columnOf(page, heavy)).toHaveAttribute('data-kind', 'pool', { timeout: 50_000 });
  await expect(page.locator('.log li').first()).toContainText(heavy);
  await expect(page.locator('.log li').first().locator('.badge')).toHaveText('steady again');
});

test('a task that crashes goes to quarantine', async ({ page }) => {
  const a = await add(page, 10);
  await add(page, 10);
  await card(page, a).getByRole('button', { name: 'Crash' }).click();
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'quarantine', { timeout: 15_000 });
  await expect(page.locator('.log')).toContainText(`${a} crashed`);
});

// The pool fills (its tasks' busy time adds up to a whole core) while each
// task yields every 10 ms, so the lag stays low: the full-pool trigger (80 %
// of a core over 3 s) moves the heaviest out.
test('a task turned up to 90 % is separated within about 5 s', async ({ page }) => {
  await page.getByRole('button', { name: 'Add 5 light tasks' }).click();
  await expect(page.locator('li.card[data-state="running"]')).toHaveCount(5, { timeout: 15_000 });
  await page.getByRole('slider', { name: 'Task 3 CPU' }).fill('90');
  await expect(columnOf(page, 'task-3')).not.toHaveAttribute('data-pool', 'balancer-1', {
    timeout: 8_000,
  });
  await expect(page.locator('.log li').first()).toContainText('task-3');
  await expect(page.locator('.log li').first().locator('.badge')).toHaveText('too busy');
  // The light ones stay together.
  await expect(page.locator('section[data-pool="balancer-1"] li.card')).toHaveCount(4);
});

for (const mode of ['own', 'one'] as const) {
  test(`in "${mode}" placement nothing moves`, async ({ page }) => {
    await page.getByRole('radio', { name: mode === 'own' ? 'Own' : 'One pool' }).check();
    const a = await add(page, 30);
    await add(page, 5);
    await card(page, a).getByRole('button', { name: 'Block 2 s' }).click();
    await page.waitForTimeout(5_000);
    await expect(columnOf(page, a)).toHaveAttribute('data-kind', mode === 'own' ? 'own' : 'pool');
    await expect(page.locator('.log li[data-kind="spike"]')).toHaveCount(0);
  });
}
