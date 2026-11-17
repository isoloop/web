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
  await expect(card(page, 'task-5').getByTestId('measured')).toHaveText(/kernel 1\d %/, {
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

// Work after `await` (promise continuations) is out of the kernel's busy
// time, but the task times it itself and the page reports that (M3j): the
// balancer sees the pool fill, and moves the task out as it would a visible one.
test('a task working after await that reports its busy time is moved', async ({
  page,
  browserName,
}) => {
  // On Playwright's WebKit the pool's lag rises with work its busy time
  // can't see, so the balancer bisects for an unnamed culprit instead.
  test.skip(browserName === 'webkit', 'Playwright WebKit: unseen work shows as lag, so it bisects');
  await page.getByRole('button', { name: 'Add 5 light tasks' }).click();
  await expect(page.locator('li.card[data-state="running"]')).toHaveCount(5, { timeout: 15_000 });
  // A controlled checkbox: the card redraws from the model a moment later.
  const afterAwait = page.getByRole('checkbox', { name: 'Task 3 works after await' });
  await afterAwait.click();
  await expect(afterAwait).toBeChecked();
  await page.getByRole('slider', { name: 'Task 3 CPU' }).fill('90');
  // The kernel sees little of it; the task's own report sees it all.
  await expect
    .poll(
      async () =>
        Number(
          /(\d+) %/.exec(
            (await card(page, 'task-3').getByTestId('reported').textContent()) ?? '',
          )?.[1] ?? 0,
        ),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(60);
  await expect(columnOf(page, 'task-3')).not.toHaveAttribute('data-pool', 'balancer-1', {
    timeout: 15_000,
  });
  const entry = page.locator('.log li', { hasText: 'task-3' }).first();
  await expect(entry.locator('.badge')).toHaveText('too busy');
  const kernel = (await card(page, 'task-3').getByTestId('measured').textContent()) ?? '';
  expect(Number(/(\d+) %/.exec(kernel)?.[1] ?? 0)).toBeLessThan(40);
});

// Jobs whose work the busy time can't see (promise continuations), and no
// busy-time report: the pool is short of CPU, but neither its lag nor its
// measured load says so. Only the backlog the page reports does (M3i).
test('a task whose backlog keeps growing is moved within about 15 s', async ({
  page,
  browserName,
}) => {
  // On Playwright's WebKit the pool's lag rises with work its busy time
  // can't see, so the balancer bisects for an unnamed culprit instead.
  test.skip(browserName === 'webkit', 'Playwright WebKit: unseen work shows as lag, so it bisects');
  test.setTimeout(60_000);
  const a = await page.evaluate(() => window.playground.add(20, 10, true, false));
  const b = await page.evaluate(() => window.playground.add(20, 10, true, false));
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

// Packing back (M3j): a member qualifies while its backlog isn't rising, so
// tasks with jobs still arriving pack too, not only idle ones.
test('a quiet task packs back while its jobs keep arriving', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, so nothing stays steady');
  test.setTimeout(180_000);
  // 50 % and 40 % of jobs at 10 a second don't fit one pool (60 %).
  const a = await page.evaluate(() => window.playground.add(50, 10));
  const b = await page.evaluate(() => window.playground.add(40, 10));
  if (!a || !b) throw new Error('no room for a task');
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'pool', { timeout: 15_000 });
  await expect(columnOf(page, b)).toHaveAttribute('data-kind', 'pool', { timeout: 15_000 });
  expect(await columnOf(page, b).getAttribute('data-pool')).not.toBe(
    await columnOf(page, a).getAttribute('data-pool'),
  );
  // Lighter jobs, still 10 a second.
  await page.evaluate(
    ([x, y]) => {
      window.playground.setLoad(x, 10);
      window.playground.setLoad(y, 10);
    },
    [a, b] as const,
  );
  await expect(page.locator('.log li[data-kind="pack"]').first()).toBeVisible({ timeout: 150_000 });
  await expect
    .poll(
      async () =>
        (await columnOf(page, a).getAttribute('data-pool')) ===
        (await columnOf(page, b).getAttribute('data-pool')),
      { timeout: 15_000 },
    )
    .toBe(true);
  // The jobs never stopped: both still have them.
  expect(
    await page.evaluate(
      (x) =>
        window.playground
          .snapshot()
          .columns.flatMap((c) => c.tasks)
          .find((t) => t.id === x)?.rate,
      a,
    ),
  ).toBe(10);
});

/** Crashes `id` and waits for the kernel to restart it: the `n`th crash. */
async function crash(page: Page, id: string, n: number): Promise<void> {
  await card(page, id).getByRole('button', { name: 'Crash' }).click();
  await expect(
    page.locator('.log li[data-kind="crash"]', { hasText: `${id} crashed` }),
  ).toHaveCount(n, { timeout: 10_000 });
}

// An offender's quiet window doubles with each offence, but is capped at
// 2 minutes (M3j): three crashes in quarantine and it still comes out.
test('an offender leaves the quarantine within 2 minutes', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, restarting the window');
  test.setTimeout(240_000);
  const a = await add(page, 10);
  await add(page, 10);
  for (let n = 1; n <= 3; n++) {
    await crash(page, a, n);
    await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'quarantine', {
      timeout: 15_000,
    });
    await expect(card(page, a)).toHaveAttribute('data-state', 'running', { timeout: 15_000 });
  }
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'pool', { timeout: 150_000 });
  await expect(page.locator('.log li').first()).toContainText(a);
  await expect(page.locator('.log li').first().locator('.badge')).toHaveText('steady again');
});

// The kernel gives up on an isolate past its restart limit (4 crashes in a
// minute). The balancer then leaves it where it is (M3j): no move brings it
// back, though an offender in quarantine would otherwise leave after 30 s.
test('a task the kernel gives up on stays failed, and no move brings it back', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit stalls workers, which the balancer moves');
  test.setTimeout(120_000);
  const a = await add(page, 10);
  await add(page, 10);
  await crash(page, a, 1);
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'quarantine', { timeout: 15_000 });
  await expect(card(page, a)).toHaveAttribute('data-state', 'running', { timeout: 15_000 });
  // Held, its next crashes don't add offences or move it: the kernel's count
  // alone reaches the limit.
  await page.evaluate((x) => {
    Object.assign(window, { release: window.balancer.hold(x) });
  }, a);
  for (let n = 2; n <= 4; n++) {
    await crash(page, a, n);
    await expect(card(page, a)).toHaveAttribute('data-state', 'running', { timeout: 15_000 });
  }
  await crash(page, a, 5);
  await expect(card(page, a)).toHaveAttribute('data-state', 'failed', { timeout: 10_000 });
  await expect(page.locator('.log li[data-kind="failed"]').first()).toContainText(a);
  await page.evaluate(() => (Reflect.get(window, 'release') as () => void)());
  // One offence: 30 s of quiet would let a live member out of the quarantine.
  await page.waitForTimeout(45_000);
  await expect(card(page, a)).toHaveAttribute('data-state', 'failed');
  await expect(columnOf(page, a)).toHaveAttribute('data-kind', 'quarantine');
  await expect(page.locator('.log li[data-kind="steady"]', { hasText: a })).toHaveCount(0);
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
