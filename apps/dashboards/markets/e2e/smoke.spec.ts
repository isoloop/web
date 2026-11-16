import { expect, test } from '@playwright/test';

// Installed from npm and built with @isoloop/vite: the pipeline runs (M3b
// tasks 1, 7, 10). The bus is only in the Isoloop build; the native build's
// store answers the same questions.
const any = { '~standard': {} };

test('the root sends visitors to the Isoloop build', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/isoloop\/$/);
  await expect(page.locator('.build')).toHaveAttribute('data-build', 'isoloop');
});

test('the replay source publishes trades to the bus', async ({ page }) => {
  await page.goto('./isoloop/?size=lite&speed=10');
  const n = await page.evaluate(
    (schema) =>
      new Promise<number>((resolve) => {
        let seen = 0;
        window.kernel.subscribe({ name: 'trades.v1', schema }, () => {
          if (++seen === 20) resolve(seen);
        });
      }),
    any,
  );
  expect(n).toBe(20);
});

test('the native build runs the same pipeline on its store', async ({ page }) => {
  await page.goto('./native/?size=lite&speed=10');
  await expect(page.locator('.build')).toHaveAttribute('data-build', 'native');
  const symbols = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const seen = new Set<string>();
        window.store.subscribe(
          'aggregates',
          (r) => {
            seen.add(r.value.symbol);
            if (seen.size === 3) resolve([...seen].toSorted());
          },
          'latest',
        );
      }),
  );
  expect(symbols).toEqual(['BTC-USD', 'ETH-USD', 'SOL-USD']);
});

test('the native + workers build runs the same pipeline from its workers', async ({ page }) => {
  await page.goto('./native-workers/?size=normal&speed=10');
  await expect(page.locator('.build')).toHaveAttribute('data-build', 'native');
  await expect(page.locator('.build')).toContainText('Native + workers');
  await expect(page.locator('.page > .description')).toContainText('hand-written worker each');
  // The replay, the aggregator, the alerts and the three engines, a worker each.
  await expect(page.locator('[data-metric="workers"] dd')).toHaveText('6', { timeout: 15_000 });
  const seen = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const streams = new Set<string>();
        const done = (s: string) => () => {
          streams.add(s);
          if (streams.size === 4) resolve([...streams].toSorted());
        };
        // Records published in four different workers reach the page's store.
        window.store.subscribe('trades', done('trades'), 'latest');
        window.store.subscribe('aggregates', done('aggregates'), 'latest');
        window.store.subscribe('stats', done('stats'), 'latest');
        window.store.subscribe('depth', done('depth'), 'latest');
      }),
  );
  expect(seen).toEqual(['aggregates', 'depth', 'stats', 'trades']);
  await page.getByText('About this demo').click();
  await expect(page.locator('.about [data-node="aggregator"] .state')).toHaveText('worker');
  await expect(page.locator('.about [data-node="price"] .state')).toHaveText('main thread');
});

test("the native + workers build with parts runs the same pipeline, and a part publishes into the host's store", async ({
  page,
}) => {
  await page.goto('./native-mixed/?size=normal&speed=10');
  await expect(page.locator('.build')).toHaveAttribute('data-build', 'native');
  await expect(page.locator('.build')).toContainText('Native + workers · React and Preact');
  await expect(page.locator('[data-metric="workers"] dd')).toHaveText('6', { timeout: 15_000 });
  const filters = page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        window.store.subscribe(
          'filters',
          (r) => {
            if (r.value.symbols[0] === 'ETH-USD') resolve(r.value.symbols[0]);
          },
          'latest',
        );
      }),
  );
  // The filters are a Preact part: its publish goes through the host it was given.
  await page.locator('[data-slot="filters"] select[name="symbol"]').selectOption('ETH-USD');
  expect(await filters).toBe('ETH-USD');
});

test('the interactive page sends visitors to its Isoloop build, and both load', async ({
  page,
}) => {
  await page.goto('./interactive/');
  await expect(page).toHaveURL(/\/interactive\/isoloop\/$/);
  await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
  await page.goto('./interactive/native/');
  await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
});
