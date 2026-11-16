import { expect, test, type Locator, type Page } from '@playwright/test';
import type { WidgetSpec } from 'creator';
import { WEBKIT_STOPS, stopsOn } from './scope';

// The interactive page (M3e task 6) on both kernels: the starters drawing,
// add, edit (in place and respawned), delete, reset, reload, the 24 cap, a
// widget restarting alone, `?rate=5`, and the way in from plant's page.
//
// On Playwright's WebKit the Isoloop page's worker-drawn canvases go through
// the page's main thread (engine constraint 2, as on plant's page): on a
// 4-core CI runner it stopped drawing, on a 32-core desktop it kept up. The
// tests that wait for drawing skip that pair (`needsFrames`); the way in and
// back still runs there.

type Snapshot = { id: string; state: string; pool?: string | undefined; restarts?: number };

const KINDS = ['isoloop', 'native'] as const;

/** Skips the Isoloop page on WebKit, where it may stop drawing (above). */
const needsFrames = (browserName: string, kind: string): void => {
  test.skip(stopsOn(browserName, kind), WEBKIT_STOPS);
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
async function startersDraw(page: Page): Promise<void> {
  await expect(slots(page)).toHaveCount(6);
  await drawn(slot(page, 'bearing-p95'), 'line');
  await drawn(slot(page, 'vib-heatmap'), 'heatmap');
  await drawn(slot(page, 'plant-power'), 'bar');
  await expect(slot(page, 't1-exhaust').locator('[data-view="stat"]')).toHaveAttribute(
    'data-value',
    /\d/,
    { timeout: FIRST_DRAW },
  );
  await expect(slot(page, 'health-scores').locator('[data-view="table"]')).toHaveAttribute(
    'data-rows',
    '8',
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
      await expect(slot(page, 'bearing-p95').locator('.creator-slot-where')).toHaveText(
        kind === 'isoloop' ? 'Pool 1' : 'main thread',
      );
      if (kind === 'isoloop') {
        const snap = await isolates(page);
        expect(snap.find((i) => i.id === 'widget-vib-heatmap')?.pool).toBe('creator-pool-2');
        // The feeds and engines run as on plant's page, a pool per machine.
        expect(snap.find((i) => i.id === 'feed-T3')?.pool).toBe('data-T3');
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
      await field(page, 'topic').selectOption('plant.health');
      await field(page, 'fn').selectOption('avg');
      await field(page, 'field').selectOption('score');
      await field(page, 'window-by').selectOption('seconds');
      await field(page, 'window-value').fill('30');
      await field(page, 'every').fill('1');
      await field(page, 'group-by').selectOption('$key');
      await field(page, 'view').selectOption('line');
      await field(page, 'title').fill('Health by machine');
      await expect(form(page)).toHaveAttribute('data-valid', 'true');
      await drawn(page.locator('.creator-drawer-preview'), 'line');
      await action(page, 'add').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slots(page)).toHaveCount(7);
      const added = slots(page).nth(6);
      await expect(added.locator('.creator-slot-title')).toHaveText('Health by machine');
      await drawn(added, 'line');
    });

    test('edit in place, delete, then reset to the starters', async ({ page, browserName }) => {
      needsFrames(browserName, kind);
      await open(page, kind);
      await slot(page, 't1-exhaust').locator('[data-action="edit"]').click();
      await expect(form(page)).toHaveAttribute('data-mode', 'edit');
      await field(page, 'title').fill('T1 exhaust, hottest');
      await action(page, 'save').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slot(page, 't1-exhaust').locator('.creator-view-title')).toHaveText(
        'T1 exhaust, hottest',
      );
      if (kind === 'isoloop') {
        // Reconfigured in place: the same isolate, never restarted.
        const s = (await isolates(page)).find((i) => i.id === 'widget-t1-exhaust');
        expect(s).toMatchObject({ state: 'running', restarts: 0, pool: 'creator-pool-2' });
      }
      await slot(page, 'plant-power').locator('[data-action="delete"]').click();
      await expect(slot(page, 'plant-power')).toHaveCount(0);
      await expect(slots(page)).toHaveCount(5);

      await page.locator('.creator-toolbar [data-action="reset"]').click();
      await startersDraw(page);
      await expect(slot(page, 't1-exhaust').locator('.creator-slot-title')).toHaveText(
        'T1 exhaust temp, max over 30 s',
      );
    });

    test('the widgets are still there after a reload', async ({ page, browserName }) => {
      test.skip(
        kind === 'isoloop' && browserName === 'webkit',
        "Playwright's WebKit has no OPFS: creator.specs.v1 runs in memory",
      );
      await open(page, kind);
      await slot(page, 'bearing-p95').locator('[data-action="edit"]').click();
      await field(page, 'title').fill('Kept');
      await action(page, 'save').click();
      await slot(page, 'active-alarms').locator('[data-action="delete"]').click();
      await expect(slots(page)).toHaveCount(5);
      await page.reload();
      await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
      await expect(slots(page)).toHaveCount(5);
      await expect(slot(page, 'bearing-p95').locator('.creator-slot-title')).toHaveText('Kept');
    });

    test('at ?rate=5 the starters draw', async ({ page, browserName }) => {
      needsFrames(browserName, kind);
      await open(page, kind, '?rate=5');
      await expect(page.locator('.rates [aria-current]')).toHaveText('5 kHz');
      await startersDraw(page);
    });

    test("plant's page links to the interactive page, and back", async ({ page }) => {
      await page.goto(`./${kind}/?rate=2`);
      await page.locator('header a.interactive-link').click();
      await expect(page).toHaveURL(new RegExp(`/interactive/${kind}/\\?rate=2$`));
      await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
      await page.locator('header a.back').click();
      await expect(page).toHaveURL(new RegExp(`/${kind}/\\?rate=2$`));
      await expect(page.locator('main.machines')).toBeVisible();
    });
  });
}

test.describe('isoloop', () => {
  test('edit to a new pool respawns the widget there', async ({ page, browserName }) => {
    needsFrames(browserName, 'isoloop');
    await open(page, 'isoloop');
    await slot(page, 'plant-power').locator('[data-action="edit"]').click();
    await expect(field(page, 'pool')).toHaveValue('pool-1');
    await expect(field(page, 'pool').locator('option')).toHaveText([
      /^Pool 1 · 3 widgets/,
      /^Pool 2 · 3 widgets/,
      'Create new',
    ]);
    await field(page, 'pool').selectOption('$new');
    await action(page, 'save').click();
    await expect(slot(page, 'plant-power')).toHaveAttribute('data-pool', 'pool-3');
    await expect
      .poll(async () => (await isolates(page)).find((i) => i.id === 'widget-plant-power')?.pool)
      .toBe('creator-pool-3');
    await drawn(slot(page, 'plant-power'), 'bar');
  });

  test('at 24 widgets Add is off', async ({ page, browserName }) => {
    needsFrames(browserName, 'isoloop');
    await open(page, 'isoloop');
    await startersDraw(page);
    const more: WidgetSpec[] = Array.from({ length: 18 }, (_, i) => ({
      id: `f${i}`,
      title: `Filler ${i}`,
      source: { topic: 'plant.scalars', key: 'T2' },
      operators: [
        { op: 'window', ms: 10_000 },
        { op: 'aggregate', fn: 'last', field: 'power' },
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
              { key: spec.id, value: { spec, added: Date.now() + 1_000 + i } },
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
    await page.evaluate(() => window.kernel.restart('widget-bearing-p95'));
    await drawn(slot(page, 'bearing-p95'), 'line');
    const snap = await isolates(page);
    for (const id of ['widget-plant-power', 'widget-t1-exhaust', 'widget-vib-heatmap']) {
      expect(
        snap.find((i) => i.id === id),
        id,
      ).toMatchObject({ state: 'running', restarts: 0 });
    }
    await expect(slot(page, 'health-scores').locator('[data-view="table"]')).toHaveAttribute(
      'data-rows',
      '8',
    );
  });
});
