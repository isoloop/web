import { expect, test, type Page } from '@playwright/test';

// What basic shows (website plan task 4b), against the built app: A and B on
// their own workers, C and D in the pool "shared". Block keeps a loop busy for
// 3 s and the kernel kills it after 2 s; Crash reports an error as the
// isolate's own (ctx.reportError).

const pane = (page: Page, id: string) => page.locator(`section[data-isolate="${id}"]`);
const status = (page: Page, id: string) => pane(page, id).locator('.status');
const restarts = (page: Page, id: string) => pane(page, id).locator('.restarts');
const surface = (page: Page, id: string) => pane(page, id).locator('.pane-body');
// Crash carries the restarts used this minute in its name ("Crash · 2/3").
const fault = (page: Page, id: string, name: 'Block 3 s' | 'Crash') =>
  surface(page, id).getByRole(
    'button',
    name === 'Crash' ? { name: /^Crash/ } : { name, exact: true },
  );

const ALL = ['A', 'B', 'C', 'D'];

async function ready(page: Page, ids = ALL): Promise<void> {
  await Promise.all(
    ids.map((id) => expect(status(page, id)).toContainText('loop ok', { timeout: 15_000 })),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await ready(page);
});

test('the four isolates run, A and B on own workers, C and D in the pool', async ({ page }) => {
  await Promise.all([
    ...['A', 'B'].map((id) => expect(pane(page, id).locator('.where')).toHaveText('own worker')),
    ...['C', 'D'].map((id) => expect(pane(page, id).locator('.where')).toHaveText('pool "shared"')),
    expect(page.locator('#browser-notice')).toHaveCount(0),
    ...ALL.map((id) => expect(restarts(page, id)).toHaveText('restarts: 0')),
  ]);
});

test('blocking C stalls D, both restart together, A and B carry on', async ({ page }) => {
  await surface(page, 'A').getByRole('button', { name: 'Increment' }).click();
  await expect(surface(page, 'D').locator('.log')).toContainText('A count = 1');
  await fault(page, 'C', 'Block 3 s').click();
  // D shares C's loop, so it stops beating too.
  await expect(status(page, 'D')).toContainText('blocked', { timeout: 2_000 });
  await expect(status(page, 'C')).toContainText('blocked');
  await Promise.all(
    ['C', 'D'].map((id) =>
      expect(restarts(page, id)).toHaveText('restarts: 1', { timeout: 8_000 }),
    ),
  );
  await ready(page, ['C', 'D']);
  // D rebuilt its log from the bus.
  await expect(surface(page, 'D').locator('.log')).toContainText('A count = 1');
  await Promise.all(['A', 'B'].map((id) => expect(restarts(page, id)).toHaveText('restarts: 0')));
  await expect(status(page, 'A')).toContainText('loop ok');
  await expect(status(page, 'B')).toContainText('loop ok');
});

for (const id of ['C', 'D']) {
  test(`a crash in ${id} restarts only ${id}, though it shares a pool`, async ({ page }) => {
    const other = id === 'C' ? 'D' : 'C';
    await surface(page, 'A').getByRole('button', { name: 'Increment' }).click();
    await expect(surface(page, 'D').locator('.log')).toContainText('A count = 1');
    await fault(page, id, 'Crash').click();
    await expect(restarts(page, id)).toHaveText('restarts: 1', { timeout: 5_000 });
    await ready(page, [id]);
    await expect(surface(page, 'D').locator('.log')).toContainText('A count = 1');
    await Promise.all(
      [other, 'A', 'B'].map((x) => expect(restarts(page, x)).toHaveText('restarts: 0')),
    );
  });
}

test('blocking A restarts only A, which reads its count back from the bus', async ({ page }) => {
  const inc = surface(page, 'A').getByRole('button', { name: 'Increment' });
  await inc.click();
  await inc.click();
  await expect(surface(page, 'A').locator('.big')).toHaveText('2');
  await fault(page, 'A', 'Block 3 s').click();
  await expect(restarts(page, 'A')).toHaveText('restarts: 1', { timeout: 8_000 });
  await ready(page, ['A']);
  await expect(surface(page, 'A').locator('.big')).toHaveText('2');
  await Promise.all(
    ['B', 'C', 'D'].map((x) => expect(restarts(page, x)).toHaveText('restarts: 0')),
  );
});

test('Crash counts the restarts used this minute', async ({ page }) => {
  await expect(fault(page, 'A', 'Crash')).toHaveText('Crash · 0/3', { timeout: 5_000 });
  const crashAndRecover = async (n: number): Promise<void> => {
    await fault(page, 'A', 'Crash').click();
    await expect(restarts(page, 'A')).toHaveText(`restarts: ${n}`, { timeout: 8_000 });
    await ready(page, ['A']);
    if (n < 2) await crashAndRecover(n + 1);
  };
  await crashAndRecover(1);
  await expect(fault(page, 'A', 'Crash')).toHaveText('Crash · 2/3', { timeout: 3_000 });
  await expect(fault(page, 'A', 'Crash')).toHaveAccessibleName(
    'Crash · 2/3 restarts used this minute',
  );
  // B's count is its own.
  await expect(fault(page, 'B', 'Crash')).toHaveText('Crash · 0/3');
});

test('past the crash-loop guard A stays failed until it is restarted', async ({ page }) => {
  // 3 restarts within a minute are allowed; the 4th crash leaves it failed.
  // One crash after another: each waits for A to run again.
  const crashAndRecover = async (n: number): Promise<void> => {
    await fault(page, 'A', 'Crash').click();
    await expect(restarts(page, 'A')).toHaveText(`restarts: ${n}`, { timeout: 8_000 });
    await ready(page, ['A']);
    if (n < 3) await crashAndRecover(n + 1);
  };
  await crashAndRecover(1);
  // The Crash button counts the restarts used this minute.
  await expect(fault(page, 'A', 'Crash')).toHaveText('Crash · 3/3', { timeout: 3_000 });
  await fault(page, 'A', 'Crash').click();
  await expect(status(page, 'A')).toHaveText('failed: stopped restarting', { timeout: 5_000 });
  await expect(pane(page, 'A').locator('.guard')).toBeVisible();
  await expect(pane(page, 'A').locator('.guard')).toContainText('crash-loop guard');
  // Nothing else noticed.
  await Promise.all(['B', 'C', 'D'].map((id) => expect(status(page, id)).toContainText('loop ok')));
  await pane(page, 'A').getByRole('button', { name: 'Restart A' }).click();
  await ready(page, ['A']);
  await expect(pane(page, 'A').locator('.guard')).toBeHidden();
});

test("while A is down, C and D say they have no count from A, and aren't stuck", async ({
  page,
}) => {
  const waiting = (id: string) => pane(page, id).locator('.waiting');
  await Promise.all(['C', 'D'].map((id) => expect(waiting(id)).toBeHidden()));
  // A blocked for 3 s is killed at 2 s and restarted: down for a while.
  await fault(page, 'A', 'Block 3 s').click();
  await Promise.all(
    ['C', 'D'].map((id) => expect(waiting(id)).toHaveText('no count from A', { timeout: 8_000 })),
  );
  // Their own loops are fine.
  await Promise.all(['C', 'D'].map((id) => expect(status(page, id)).toContainText('loop ok')));
  await ready(page, ['A']);
  await Promise.all(['C', 'D'].map((id) => expect(waiting(id)).toBeHidden()));
  // A and B have no upstream, so they never show it.
  await Promise.all(['A', 'B'].map((id) => expect(waiting(id)).toBeHidden()));
});

test('a note sent from D reaches its log through the bus', async ({ page }) => {
  const input = surface(page, 'D').getByRole('textbox', { name: 'Note' });
  await input.fill('hello');
  await input.press('Enter');
  await expect(surface(page, 'D').locator('.log li').first()).toHaveText('D note: hello');
  await expect(input).toHaveValue('');
});

test('?embed=1 shows the demo without the header and footer', async ({ page }) => {
  await page.goto('./?embed=1');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-embed', '');
  await expect(page.locator('.ui-header')).toBeHidden();
  await expect(page.locator('.ui-footer')).toBeHidden();
  // The landing page explains the demo above the iframe, so basic's intro is hidden.
  await expect(page.locator('.intro > p:not(.guard-note):not(.reads)')).toBeHidden();
  // So is the sentence about C and D reading A: the landing page has its own.
  await expect(page.locator('.intro .reads')).toBeHidden();
  await expect(page.locator('.intro .rules')).toBeHidden();
  // The controls and the pool's caption stay.
  await expect(page.locator('#block-main')).toBeVisible();
  await expect(page.locator('.pool .caption')).toBeVisible();
});

test('without ?embed=1 the intro is shown', async ({ page }) => {
  await page.goto('./');
  await ready(page);
  await expect(page.locator('.intro > p:not(.guard-note):not(.reads)')).toBeVisible();
  await expect(page.locator('.intro .reads')).toContainText("C and D read A's count");
  await expect(page.locator('.intro .rules')).toBeVisible();
});

test('the theme follows a change made on another page, live, with no reload', async ({ page }) => {
  await page.goto('./?theme=light');
  await ready(page);
  // ?theme= pins this page; a second page follows storage.
  const other = await page.context().newPage();
  await other.goto('./');
  await ready(other);
  await other.evaluate(() => {
    window.localStorage.setItem('isoloop-theme', 'light');
  });
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  // A mark on the document: it survives only if the page isn't reloaded.
  await other.evaluate(() => Reflect.set(window, 'marker', 1));
  const bg = () =>
    other.evaluate(() => {
      const el = document.querySelector('.pane');
      return el ? getComputedStyle(el).backgroundColor : '';
    });
  const lightBg = await bg();
  // The toggle on the first page writes the key; the second page switches.
  await page.locator('.ui-header .ui-toggle').click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(bg).not.toBe(lightBg);
  // Same document: no reload happened, and the isolates kept running.
  expect(await other.evaluate(() => Reflect.get(window, 'marker') as unknown)).toBe(1);
  await expect(restarts(other, 'B')).toHaveText('restarts: 0');
});
