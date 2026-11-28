import { expect, test, type Locator, type Page } from '@playwright/test';
import type { WidgetSpec } from 'creator';

// The interactive page (M3e task 9) on both kernels: the starters drawing,
// add, edit (in place and respawned), delete, reset, reload, the 24 cap, a
// widget restarting alone, Heavy, and the way in from markets' page.
//
// On Playwright's WebKit the Isoloop page's worker-drawn canvases go through
// the page's main thread (engine constraint 2, as on markets' Heavy page and
// plant's interactive page), so it may stop drawing on a small runner. The
// tests that wait for drawing skip that pair (`needsFrames`); the way in and
// back still runs there.
const WEBKIT_STOPS =
  'WebKit presents worker canvas frames on the main thread (engine constraint 2): https://github.com/isoloop/isoloop/blob/main/docs/investigations/engine-constraints.md';

type Snapshot = { id: string; state: string; pool?: string | undefined; restarts?: number };

const KINDS = ['isoloop', 'native'] as const;

/** Skips the Isoloop page on WebKit, where it may stop drawing (above). */
const needsFrames = (browserName: string, kind: string): void => {
  test.skip(browserName === 'webkit' && kind === 'isoloop', WEBKIT_STOPS);
};
const FIRST_DRAW = 15_000;

async function open(page: Page, kind: string, search = ''): Promise<void> {
  await page.goto(`./interactive/${kind}/${search}`);
  await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
}

const slot = (page: Page, id: string): Locator =>
  page.locator(`.creator-slot[data-widget="${id}"]`);
const slots = (page: Page): Locator => page.locator('.creator-slot');
const drawer = (page: Page): Locator => page.locator('.creator-drawer');
const form = (page: Page): Locator => page.locator('.creator-drawer-form');
const field = (page: Page, name: string): Locator => form(page).locator(`[name="${name}"]`);
const action = (page: Page, name: string): Locator => form(page).locator(`[data-action="${name}"]`);
const drawn = (l: Locator, view: string): Promise<void> =>
  expect(l.locator(`canvas[data-view="${view}"]`)).toHaveAttribute(
    'data-drawn',
    new RegExp(`^${view}:`),
    { timeout: FIRST_DRAW },
  );

async function isolates(page: Page): Promise<Snapshot[]> {
  return page.evaluate(() =>
    window.kernel
      .isolates()
      .map((i) => ({ id: i.id, state: i.state, pool: i.pool, restarts: i.restarts })),
  );
}

/** Every starter shows its data: the canvases drew, the stat has a value, the tables have rows. */
async function startersDraw(page: Page, symbols = 20): Promise<void> {
  await expect(slots(page)).toHaveCount(6);
  await drawn(slot(page, 'trades-by-exchange'), 'line');
  await drawn(slot(page, 'volatility-heatmap'), 'heatmap');
  await drawn(slot(page, 'btc-volume'), 'bar');
  await expect(slot(page, 'btc-coinbase-high').locator('[data-view="stat"]')).toHaveAttribute(
    'data-value',
    /\d/,
    { timeout: FIRST_DRAW },
  );
  await expect(slot(page, 'vwap-by-symbol').locator('[data-view="table"]')).toHaveAttribute(
    'data-rows',
    String(symbols),
    { timeout: FIRST_DRAW },
  );
  await expect(slot(page, 'btc-trades').locator('[data-view="table"]')).not.toHaveAttribute(
    'data-rows',
    '0',
    { timeout: FIRST_DRAW },
  );
}

for (const kind of KINDS) {
  test.describe(kind, () => {
    test('the page loads with its six starters drawing, in their pools', async ({
      page,
      browserName,
    }) => {
      needsFrames(browserName, kind);
      await open(page, kind);
      await expect(page.locator('.page.interactive')).toHaveAttribute('data-kind', kind);
      await expect(page.locator('.kernel [aria-current]')).toHaveText(
        kind === 'isoloop' ? 'Isoloop' : 'Native',
      );
      // No Build or Placement controls on this page.
      await expect(page.locator('.builds, .placements')).toHaveCount(0);
      await startersDraw(page);
      await expect(slot(page, 'trades-by-exchange').locator('.creator-slot-where')).toHaveText(
        kind === 'isoloop' ? 'Pool 1' : 'main thread',
      );
      if (kind === 'isoloop') {
        const snap = await isolates(page);
        expect(snap.find((i) => i.id === 'widget-volatility-heatmap')?.pool).toBe('creator-pool-2');
        // The replay, the aggregator and the stats engine each on their own worker.
        for (const id of ['replay', 'aggregator', 'engine-stats']) {
          expect(snap.find((i) => i.id === id)?.pool, id).toBeUndefined();
        }
      }
    });

    test('add: build a widget in the drawer, see the preview, add it to the grid', async ({
      page,
      browserName,
    }) => {
      needsFrames(browserName, kind);
      await open(page, kind);
      await page.locator('.creator-toolbar [data-action="add"]').click();
      await expect(drawer(page)).toBeVisible();
      await field(page, 'topic').selectOption('aggregates.v1');
      await field(page, 'fn').selectOption('avg');
      await field(page, 'field').selectOption('spread');
      await field(page, 'window-by').selectOption('seconds');
      await field(page, 'window-value').fill('30');
      await field(page, 'every').fill('1');
      await field(page, 'group-by').selectOption('symbol');
      await field(page, 'view').selectOption('line');
      await field(page, 'title').fill('Spread by symbol');
      await expect(form(page)).toHaveAttribute('data-valid', 'true');
      await drawn(page.locator('.creator-drawer-preview'), 'line');
      await action(page, 'add').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slots(page)).toHaveCount(7);
      const added = slots(page).nth(6);
      await expect(added.locator('.creator-slot-title')).toHaveText('Spread by symbol');
      await drawn(added, 'line');
    });

    test('edit in place, delete, then reset to the starters', async ({ page, browserName }) => {
      needsFrames(browserName, kind);
      await open(page, kind);
      await slot(page, 'btc-coinbase-high').locator('[data-action="edit"]').click();
      await expect(form(page)).toHaveAttribute('data-mode', 'edit');
      await field(page, 'title').fill('BTC high on Coinbase');
      await action(page, 'save').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slot(page, 'btc-coinbase-high').locator('.creator-view-title')).toHaveText(
        'BTC high on Coinbase',
      );
      if (kind === 'isoloop') {
        // Reconfigured in place: the same isolate, never restarted.
        const s = (await isolates(page)).find((i) => i.id === 'widget-btc-coinbase-high');
        expect(s).toMatchObject({ state: 'running', restarts: 0, pool: 'creator-pool-2' });
      }
      await slot(page, 'btc-volume').locator('[data-action="delete"]').click();
      await expect(slot(page, 'btc-volume')).toHaveCount(0);
      await expect(slots(page)).toHaveCount(5);

      await page.locator('.creator-toolbar [data-action="reset"]').click();
      await startersDraw(page);
      await expect(slot(page, 'btc-coinbase-high').locator('.creator-slot-title')).toHaveText(
        'BTC on Coinbase, high over 30 s',
      );
    });

    test('the widgets are still there after a reload', async ({ page, browserName }) => {
      test.skip(
        kind === 'isoloop' && browserName === 'webkit',
        "Playwright's WebKit has no OPFS: creator.specs.v1 runs in memory",
      );
      await open(page, kind);
      await slot(page, 'trades-by-exchange').locator('[data-action="edit"]').click();
      // The form has the widget's spec before the title is changed.
      await expect(form(page)).toHaveAttribute('data-mode', 'edit');
      await expect(field(page, 'title')).toHaveValue('Trades per 30 s by exchange');
      await field(page, 'title').fill('Kept');
      await action(page, 'save').click();
      // The save has gone through the bus once the grid shows it.
      await expect(slot(page, 'trades-by-exchange').locator('.creator-slot-title')).toHaveText(
        'Kept',
      );
      await slot(page, 'btc-trades').locator('[data-action="delete"]').click();
      await expect(slots(page)).toHaveCount(5);
      if (kind === 'isoloop') {
        // The grid follows delivery, but a persistent topic acknowledges a
        // publish once its batch is on disk (ADR 0007), and a later publish to
        // the same topic is flushed after the earlier ones: wait for one, so
        // the reload doesn't race the delete's write.
        await page.evaluate(() =>
          window.kernel.publish(
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the kernel reads only `name`; the broker validates
            { name: 'creator.specs.v1', schema: { '~standard': {} } } as never,
            { sync: 'flushed' },
            { key: '$sync' },
          ),
        );
      }
      await page.reload();
      await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
      await expect(slots(page)).toHaveCount(5);
      await expect(slot(page, 'trades-by-exchange').locator('.creator-slot-title')).toHaveText(
        'Kept',
      );
    });

    test('at Heavy the starters draw', async ({ page, browserName }) => {
      needsFrames(browserName, kind);
      await open(page, kind, '?size=heavy');
      await expect(page.locator('.sizes [aria-current]')).toHaveText('Heavy');
      await startersDraw(page);
    });

    test('at Lite the replay has three symbols', async ({ page, browserName }) => {
      needsFrames(browserName, kind);
      await open(page, kind, '?size=lite');
      await startersDraw(page, 3);
    });

    test("markets' page links to the interactive page, and back", async ({ page }) => {
      await page.goto(`./${kind}/?size=lite`);
      await page.locator('header a.interactive-link').click();
      await expect(page).toHaveURL(new RegExp(`/interactive/${kind}/\\?size=lite$`));
      await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
      await page.locator('header a.back').click();
      await expect(page).toHaveURL(new RegExp(`/${kind}/\\?size=lite$`));
      await expect(page.locator('main.grid')).toBeVisible();
    });
  });
}

test.describe('isoloop', () => {
  test('edit to a new pool respawns the widget there', async ({ page, browserName }) => {
    needsFrames(browserName, 'isoloop');
    await open(page, 'isoloop');
    await slot(page, 'btc-volume').locator('[data-action="edit"]').click();
    await expect(field(page, 'pool')).toHaveValue('pool-1');
    // "Automatic" first (M3h), then the pools the page has, then "Create new".
    await expect(field(page, 'pool').locator('option')).toHaveText([
      /^Automatic/,
      /^Pool 1 · 3 widgets/,
      /^Pool 2 · 3 widgets/,
      'Create new',
    ]);
    await field(page, 'pool').selectOption('$new');
    await action(page, 'save').click();
    await expect(slot(page, 'btc-volume')).toHaveAttribute('data-pool', 'pool-3');
    await expect
      .poll(async () => (await isolates(page)).find((i) => i.id === 'widget-btc-volume')?.pool)
      .toBe('creator-pool-3');
    await drawn(slot(page, 'btc-volume'), 'bar');
  });

  test('at 24 widgets Add is off', async ({ page, browserName }) => {
    needsFrames(browserName, 'isoloop');
    await open(page, 'isoloop');
    await startersDraw(page);
    const more: WidgetSpec[] = Array.from({ length: 18 }, (_, i) => ({
      id: `f${i}`,
      title: `Filler ${i}`,
      source: { topic: 'prices.v1', key: 'kraken:ETH-USD' },
      operators: [
        { op: 'window', ms: 10_000 },
        { op: 'aggregate', fn: 'last', field: 'last' },
      ],
      view: { type: 'stat', size: 's' },
      placement: { mode: 'manual', pool: 'pool-1' },
    }));
    await page.evaluate(
      (specs) =>
        Promise.all(
          specs.map((spec, i) =>
            window.kernel.publish(
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the kernel reads only `name`; the broker validates
              { name: 'creator.specs.v1', schema: { '~standard': {} } } as never,
              { spec, added: Date.now() + 1_000 + i },
              { key: spec.id },
            ),
          ),
        ),
      more,
    );
    await expect(slots(page)).toHaveCount(24);
    await expect(page.locator('.creator-count')).toHaveText('24 / 24 widgets');
    await expect(page.locator('.creator-toolbar [data-action="add"]')).toBeDisabled();
  });

  test('a restarted widget comes back alone; the others keep drawing', async ({
    page,
    browserName,
  }) => {
    needsFrames(browserName, 'isoloop');
    await open(page, 'isoloop');
    await startersDraw(page);
    await page.evaluate(() => window.kernel.restart('widget-trades-by-exchange'));
    await drawn(slot(page, 'trades-by-exchange'), 'line');
    const snap = await isolates(page);
    for (const id of [
      'widget-btc-volume',
      'widget-btc-coinbase-high',
      'widget-volatility-heatmap',
    ]) {
      expect(
        snap.find((i) => i.id === id),
        id,
      ).toMatchObject({ state: 'running', restarts: 0 });
    }
    await expect(slot(page, 'vwap-by-symbol').locator('[data-view="table"]')).toHaveAttribute(
      'data-rows',
      '20',
    );
  });
});
