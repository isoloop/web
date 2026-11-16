import { expect, test, type Locator, type Page } from '@playwright/test';
import type { WidgetSpec } from '../src/spec/types';

// The interactive board (M3e task 5) on the harness: the starters, the
// drawer's form and preview, add, edit (in place and respawned), delete,
// reset, the cap, reload, a widget restarting alone and a bus restart, on
// the Isoloop page; the same flow on the native page.

type BoardApi = {
  publishSpecs(specs: WidgetSpec[]): Promise<void>;
  flushSpecs(): Promise<void>;
  restart(id: string): Promise<void>;
  crashBus(): void;
  busReady: number;
  isolates(): Snapshot[];
};

type Snapshot = { id: string; state: string; pool?: string; restarts?: number };

declare global {
  interface Window {
    board: BoardApi;
  }
}

const PAGES = [
  ['isoloop', './?board=isoloop'],
  ['native', './native.html'],
] as const;

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
}

const slot = (page: Page, id: string): Locator =>
  page.locator(`.creator-slot[data-widget="${id}"]`);
const slots = (page: Page): Locator => page.locator('.creator-slot');
const drawer = (page: Page): Locator => page.locator('.creator-drawer');
const form = (page: Page): Locator => page.locator('.creator-drawer-form');
const field = (page: Page, name: string): Locator => form(page).locator(`[name="${name}"]`);
const action = (page: Page, name: string): Locator => form(page).locator(`[data-action="${name}"]`);

async function isolates(page: Page): Promise<Snapshot[]> {
  return page.evaluate(() => window.board.isolates());
}

/** Builds "avg of temp every second, by machine" in the open form, as a line. */
/**
 * Waits until the creator's specs are on disk. The grid follows delivery, but
 * a persistent topic acknowledges a publish once its batch is on disk
 * (ADR 0007), and a later publish to the same topic is flushed after the
 * earlier ones: wait for one, so a reload doesn't race the last write.
 */
async function flushSpecs(page: Page): Promise<void> {
  await page.evaluate(() => window.board.flushSpecs());
}

async function buildLine(page: Page): Promise<void> {
  await field(page, 'fn').selectOption('avg');
  // An aggregate needs a window: the form says so on the window field, and Add is off.
  await expect(form(page).locator('[data-error-for="window"]')).toBeVisible();
  await expect(action(page, 'add')).toBeDisabled();
  await field(page, 'window-by').selectOption('seconds');
  await field(page, 'window-value').fill('30');
  await field(page, 'every').fill('1');
  await field(page, 'group-by').selectOption('$key');
  await field(page, 'view').selectOption('line');
  await field(page, 'title').fill('Temperature by machine');
  await expect(form(page)).toHaveAttribute('data-valid', 'true');
}

for (const [kind, url] of PAGES) {
  test.describe(kind, () => {
    test('the starters are seeded on a first visit and draw', async ({ page }) => {
      await open(page, url);
      await expect(slots(page)).toHaveCount(2);
      await expect(slot(page, 's1').locator('canvas[data-view="line"]')).toHaveAttribute(
        'data-drawn',
        /^line:/,
      );
      await expect(slot(page, 's2').locator('[data-view="stat"]')).toHaveAttribute(
        'data-value',
        '100',
      );
      await expect(slot(page, 's1').locator('.creator-slot-where')).toHaveText(
        kind === 'isoloop' ? 'Pool 1' : 'main thread',
      );
    });

    test('add: the preview follows the form, errors sit on their field, Add puts it on the grid', async ({
      page,
    }) => {
      await open(page, url);
      await page.locator('.creator-toolbar [data-action="add"]').click();
      await expect(drawer(page)).toBeVisible();
      await expect(form(page)).toHaveAttribute('data-mode', 'add');
      // The new form: the first topic's records, in a table, in the preview.
      const preview = page.locator('.creator-drawer-preview');
      await expect(preview.locator('[data-view="table"]')).not.toHaveAttribute('data-rows', '0');

      await buildLine(page);
      await expect(preview.locator('canvas[data-view="line"]')).toHaveAttribute(
        'data-drawn',
        /^line:/,
      );
      if (kind === 'native') {
        await expect(field(page, 'pool')).toBeDisabled();
        await expect(field(page, 'pool')).toHaveText('Not used');
      } else {
        await expect(field(page, 'pool')).toBeEnabled();
      }

      await action(page, 'add').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slots(page)).toHaveCount(3);
      const added = slots(page).nth(2);
      await expect(added.locator('.creator-slot-title')).toHaveText('Temperature by machine');
      await expect(added.locator('canvas[data-view="line"]')).toHaveAttribute(
        'data-drawn',
        /^line:/,
      );
      if (kind === 'isoloop') {
        // The preview stopped with the drawer; the new widget runs in the pool it was given.
        await expect
          .poll(async () => (await isolates(page)).some((i) => i.id.startsWith('preview-')))
          .toBe(false);
      }
    });

    test('the widgets are still there after a reload', async ({ page, browserName }) => {
      test.skip(
        kind === 'isoloop' && browserName === 'webkit',
        "Playwright's WebKit has no OPFS: creator.specs.v1 runs in memory",
      );
      await open(page, url);
      await slot(page, 's1').locator('[data-action="edit"]').click();
      await field(page, 'title').fill('Kept');
      await action(page, 'save').click();
      await slot(page, 's2').locator('[data-action="delete"]').click();
      await expect(slots(page)).toHaveCount(1);
      if (kind === 'isoloop') await flushSpecs(page);
      await page.reload();
      await expect(page.locator('.creator-board[data-ready]')).toBeAttached();
      await expect(slots(page)).toHaveCount(1);
      await expect(slot(page, 's1').locator('.creator-slot-title')).toHaveText('Kept');
    });

    test('edit in place, then delete, then reset to the starters', async ({ page }) => {
      await open(page, url);
      await slot(page, 's2').locator('[data-action="edit"]').click();
      await expect(form(page)).toHaveAttribute('data-mode', 'edit');
      await expect(field(page, 'title')).toHaveValue('m2 max');
      await field(page, 'title').fill('m2 highest');
      await action(page, 'save').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slot(page, 's2').locator('.creator-slot-title')).toHaveText('m2 highest');
      await expect(slot(page, 's2').locator('.creator-view-title')).toHaveText('m2 highest');
      if (kind === 'isoloop') {
        const s = (await isolates(page)).find((i) => i.id === 'widget-s2');
        expect(s).toMatchObject({ state: 'running', restarts: 0, pool: 'creator-pool-2' });
      }

      await slot(page, 's1').locator('[data-action="delete"]').click();
      await expect(slot(page, 's1')).toHaveCount(0);
      if (kind === 'isoloop') {
        await expect
          .poll(async () => (await isolates(page)).some((i) => i.id === 'widget-s1'))
          .toBe(false);
      }

      await page.locator('.creator-toolbar [data-action="reset"]').click();
      await expect(slots(page)).toHaveCount(2);
      await expect(slot(page, 's2').locator('.creator-slot-title')).toHaveText('m2 max');
      await expect(slot(page, 's1').locator('canvas[data-view="line"]')).toHaveAttribute(
        'data-drawn',
        /^line:/,
      );
    });

    test('the form can delete the widget it edits, and cancel closes it', async ({ page }) => {
      await open(page, url);
      await slot(page, 's1').locator('[data-action="edit"]').click();
      await action(page, 'cancel').click();
      await expect(drawer(page)).toBeHidden();
      await slot(page, 's1').locator('[data-action="edit"]').click();
      await action(page, 'delete').click();
      await expect(drawer(page)).toBeHidden();
      await expect(slot(page, 's1')).toHaveCount(0);
    });
  });
}

test.describe('isoloop', () => {
  test('edit to a new pool respawns the widget there', async ({ page }) => {
    await open(page, './?board=isoloop');
    await slot(page, 's1').locator('[data-action="edit"]').click();
    await expect(field(page, 'pool')).toHaveValue('pool-1');
    // The pools the page has, with their widgets and lag, then "Create new".
    await expect(field(page, 'pool').locator('option')).toHaveText([
      /^Pool 1 · 1 widget/,
      /^Pool 2 · 1 widget/,
      'Create new',
    ]);
    await field(page, 'pool').selectOption('$new');
    await expect(field(page, 'pool')).toHaveValue('pool-3');
    await action(page, 'save').click();
    await expect(slot(page, 's1')).toHaveAttribute('data-pool', 'pool-3');
    await expect(slot(page, 's1').locator('.creator-slot-where')).toHaveText('Pool 3');
    await expect
      .poll(async () => (await isolates(page)).find((i) => i.id === 'widget-s1')?.pool)
      .toBe('creator-pool-3');
    await expect(slot(page, 's1').locator('canvas[data-view="line"]')).toHaveAttribute(
      'data-drawn',
      /^line:/,
    );
    // A new widget starts in the pool used last.
    await page.locator('.creator-toolbar [data-action="add"]').click();
    await expect(field(page, 'pool')).toHaveValue('pool-2');
  });

  test('at 24 widgets Add is off, on the page and in the form', async ({ page }) => {
    await open(page, './?board=isoloop');
    await page.locator('.creator-toolbar [data-action="add"]').click();
    await expect(form(page)).toHaveAttribute('data-mode', 'add');
    const more: WidgetSpec[] = Array.from({ length: 22 }, (_, i) => ({
      id: `f${i}`,
      title: `Filler ${i}`,
      source: { topic: 'test.scalars.v1', key: 'm1' },
      operators: [
        { op: 'window', ms: 10_000 },
        { op: 'aggregate', fn: 'last', field: 'temp' },
      ],
      view: { type: 'stat', size: 's' },
      placement: { mode: 'manual', pool: 'pool-1' },
    }));
    await page.evaluate((s) => window.board.publishSpecs(s), more);
    await expect(slots(page)).toHaveCount(24);
    await expect(page.locator('.creator-count')).toHaveText('24 / 24 widgets');
    await expect(page.locator('.creator-toolbar [data-action="add"]')).toBeDisabled();
    await expect(form(page).locator('[data-error-for="cap"]')).toBeVisible();
    await expect(action(page, 'add')).toBeDisabled();
  });

  test('a restarted widget comes back alone; the others keep drawing', async ({ page }) => {
    await open(page, './?board=isoloop');
    const stat = slot(page, 's2').locator('[data-view="stat"]');
    await expect(stat).toHaveAttribute('data-value', '100');
    await page.evaluate(() => window.board.restart('widget-s1'));
    await expect(slot(page, 's1').locator('canvas[data-view="line"]')).toHaveAttribute(
      'data-drawn',
      /^line:/,
    );
    const snap = await isolates(page);
    expect(snap.find((i) => i.id === 'widget-s2')).toMatchObject({ state: 'running', restarts: 0 });
    await expect(stat).toHaveAttribute('data-value', '100');
  });

  test('after a bus restart the widgets and the preview come back', async ({ page }) => {
    await open(page, './?board=isoloop');
    await page.locator('.creator-toolbar [data-action="add"]').click();
    const preview = page.locator('.creator-drawer-preview');
    await expect(preview.locator('[data-view="table"]')).not.toHaveAttribute('data-rows', '0');
    const before = await page.evaluate(() => window.board.busReady);
    await page.evaluate(() => window.board.crashBus());
    await expect.poll(() => page.evaluate(() => window.board.busReady)).toBeGreaterThan(before);
    // The draft went with the memory topics; the form published it again.
    await field(page, 'size').selectOption('l');
    await expect(preview.locator('[data-view="table"]')).toHaveAttribute('data-size', 'l');
    await expect(preview.locator('[data-view="table"]')).not.toHaveAttribute('data-rows', '0');
    await expect(slot(page, 's2').locator('[data-view="stat"]')).toHaveAttribute(
      'data-value',
      '100',
    );
    await expect(slot(page, 's1').locator('canvas[data-view="line"]')).toHaveAttribute(
      'data-drawn',
      /^line:/,
    );
  });
});
