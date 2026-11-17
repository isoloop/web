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

test('a task that blocks once stays; blocking again within 60 s sends it to quarantine', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const heavy = await add(page, 30);
  await add(page, 5);
  await expect(columnOf(page, heavy)).toHaveAttribute('data-pool', 'balancer-1');
  await page.waitForTimeout(1_500);
  // A first spike is only noted (ADR 0017, amended for M3i).
  await card(page, heavy).getByRole('button', { name: 'Block 2 s' }).click();
  await page.waitForTimeout(5_000);
  await expect(columnOf(page, heavy)).toHaveAttribute('data-pool', 'balancer-1');
  await card(page, heavy).getByRole('button', { name: 'Block 2 s' }).click();
  await expect(columnOf(page, heavy)).toHaveAttribute('data-kind', 'quarantine', {
    timeout: 15_000,
  });
  // The kernel's beat names the culprit, so nothing else moves (no bisect).
  await expect(page.locator('.log li[data-kind="bisect"]')).toHaveCount(0);
  await expect(page.locator('.log li').first()).toContainText(heavy);
});

test('a blocked task leaves quarantine once it has been steady for 30 s', async ({
  page,
  browserName,
}) => {
  // Playwright's WebKit stalls a worker for half a second now and then (the
  // engine constraint the plant dashboard records too): in quarantine that
  // counts as a spike and starts the 30 s again, so the test can't finish.
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, restarting the window');
  test.setTimeout(100_000);
  const heavy = await add(page, 30);
  await add(page, 5);
  await page.waitForTimeout(1_500);
  // Two blocks: a first spike is only noted.
  await card(page, heavy).getByRole('button', { name: 'Block 2 s' }).click();
  await page.waitForTimeout(3_000);
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

// Jobs whose work the busy time can't see (promise continuations): the pool
// is short of CPU, but neither its lag nor its measured load says so. Only
// the backlog the page reports does (M3i).
test('a task whose backlog keeps growing is moved within about 15 s', async ({
  page,
  browserName,
}) => {
  // On Playwright's WebKit the pool's lag rises with work its busy time
  // can't see, so the balancer bisects for an unnamed culprit instead.
  test.skip(browserName === 'webkit', 'Playwright WebKit: unseen work shows as lag, so it bisects');
  test.setTimeout(60_000);
  const a = await page.evaluate(() => window.playground.add(20, 10, true));
  const b = await page.evaluate(() => window.playground.add(20, 10, true));
  if (!a || !b) throw new Error('no room for a task');
  await expect(columnOf(page, b)).toHaveAttribute('data-pool', 'balancer-1', { timeout: 15_000 });
  await expect(columnOf(page, a)).toHaveAttribute('data-pool', 'balancer-1');
  // Each one's jobs now need 70 % of a core: 140 % between them.
  await page.evaluate(
    ([x, y]) => {
      window.playground.setLoad(x, 70);
      window.playground.setLoad(y, 70);
    },
    [a, b] as const,
  );
  await expect(page.locator('.log li[data-kind="backlog"]').first()).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.locator('.log li[data-kind="backlog"]').first()).toContainText(
    /balancer-1 → balancer-/,
  );
  await expect(columnOf(page, a)).not.toHaveAttribute(
    'data-pool',
    (await columnOf(page, b).getAttribute('data-pool')) ?? '',
  );
  // A worker each is enough: the backlog drains.
  await expect
    .poll(
      async () => Number(await card(page, a).getByTestId('backlog').getAttribute('data-backlog')),
      {
        timeout: 20_000,
      },
    )
    .toBeLessThan(5);
});

test('after Calm, a quiet task packs back into another pool within about 60 s', async ({
  page,
  browserName,
}) => {
  // Playwright's WebKit stalls workers now and then, which the balancer
  // notes as spikes, so a task there is never steady for the full minute.
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, so nothing stays steady');
  test.setTimeout(150_000);
  // 50 % and 40 % don't fit one pool (60 %), so the second gets its own.
  const a = await add(page, 50);
  const b = await add(page, 40);
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'pool', { timeout: 15_000 });
  await expect(columnOf(page, b)).toHaveAttribute('data-kind', 'pool', { timeout: 15_000 });
  const before = await columnOf(page, b).getAttribute('data-pool');
  expect(before).not.toBe(await columnOf(page, a).getAttribute('data-pool'));
  await page.getByRole('button', { name: 'Calm' }).click();
  await expect(page.locator('.log li[data-kind="pack"]').first()).toBeVisible({ timeout: 100_000 });
  await expect
    .poll(
      async () =>
        (await columnOf(page, a).getAttribute('data-pool')) ===
        (await columnOf(page, b).getAttribute('data-pool')),
      { timeout: 15_000 },
    )
    .toBe(true);
  // The move's cost is shown once the packed task has beaten in its new pool.
  await expect(page.locator('.log li[data-kind="pack"]').first().getByTestId('cost')).toBeVisible({
    timeout: 10_000,
  });
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
