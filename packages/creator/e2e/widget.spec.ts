import { expect, test, type Page } from '@playwright/test';
import type { WidgetSpec } from '../src/spec/types';
import type { WidgetMode } from '../src/widget/records';

// The widget isolate on a real kernel (M3e task 4): it draws from its source
// topic, reconfigures in place on an edit, flags an edit it can't take, and
// goes quiet on a tombstone. The preview reads the draft.

type Harness = {
  publish(spec: WidgetSpec, mode?: WidgetMode, key?: string): Promise<void>;
  tombstone(id: string): Promise<void>;
  spawn(spec: WidgetSpec, mode?: WidgetMode): string;
  native(spec: WidgetSpec): void;
  isolates(): { id: string; state: string; pool?: string; restarts?: number }[];
};

const line = (over: Partial<WidgetSpec> = {}): WidgetSpec => ({
  id: 'w1',
  title: 'm1 average',
  source: { topic: 'test.scalars.v1', key: 'm1' },
  operators: [
    { op: 'window', ms: 10_000 },
    { op: 'aggregate', fn: 'avg', field: 'temp', every: 250 },
  ],
  view: { type: 'line', size: 'm' },
  placement: { mode: 'manual', pool: 'pool-1' },
  ...over,
});

const stat = (over: Partial<WidgetSpec> = {}): WidgetSpec =>
  line({
    title: 'm2 max',
    source: { topic: 'test.scalars.v1', key: 'm2' },
    operators: [
      { op: 'window', ms: 10_000 },
      { op: 'aggregate', fn: 'max', field: 'temp' },
    ],
    view: { type: 'stat', size: 's' },
    ...over,
  });

async function open(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('body[data-ready]')).toBeAttached();
}

declare global {
  interface Window {
    harness: Harness;
  }
}

const widget = (page: Page, isolate: string) =>
  page.locator(`[data-isolate="${isolate}"] .creator-widget`);

test('a widget isolate draws its pipeline, in its pool', async ({ page }) => {
  await open(page);
  await page.evaluate((s) => window.harness.publish(s), line());
  const id = await page.evaluate((s) => window.harness.spawn(s), line());
  expect(id).toBe('widget-w1');
  await expect(widget(page, id)).toHaveAttribute('data-state', 'live');
  await expect(page.locator(`[data-isolate="${id}"] canvas[data-view="line"]`)).toHaveAttribute(
    'data-drawn',
    /^line:/,
  );
  const snap = await page.evaluate(() => window.harness.isolates());
  expect(snap.find((i) => i.id === id)).toMatchObject({ state: 'running', pool: 'creator-pool-1' });
});

test('an edit reconfigures in place; a new pool asks for a respawn; a tombstone empties it', async ({
  page,
}) => {
  await open(page);
  await page.evaluate((s) => window.harness.publish(s), line());
  const id = await page.evaluate((s) => window.harness.spawn(s), line());
  await expect(widget(page, id)).toHaveAttribute('data-state', 'live');

  // Same topic and pool: the running isolate shows the new spec, filled from what it kept.
  await page.evaluate((s) => window.harness.publish(s), stat({ id: 'w1' }));
  await expect(page.locator(`[data-isolate="${id}"] [data-view="stat"]`)).toHaveAttribute(
    'data-value',
    '100',
  );
  const after = await page.evaluate(() => window.harness.isolates());
  expect(after.find((i) => i.id === id)).toMatchObject({ state: 'running', restarts: 0 });

  await page.evaluate(
    (s) => window.harness.publish(s),
    stat({ id: 'w1', placement: { mode: 'manual', pool: 'pool-2' } }),
  );
  await expect(widget(page, id)).toHaveAttribute('data-state', 'respawn');
  await expect(page.locator(`[data-isolate="${id}"] [data-view="stat"]`)).toBeAttached();

  await page.evaluate(() => window.harness.tombstone('w1'));
  await expect(widget(page, id)).toHaveAttribute('data-state', 'deleted');
  await expect(page.locator(`[data-isolate="${id}"] [data-view]`)).toHaveCount(0);
});

test('a preview reads the draft, on its own worker, and follows its edits', async ({ page }) => {
  await open(page);
  const draft = line({ id: 'd1', title: 'Draft' });
  await page.evaluate((s) => window.harness.publish(s, 'draft'), draft);
  const id = await page.evaluate((s) => window.harness.spawn(s, 'draft'), draft);
  expect(id).toBe('preview-d1');
  await expect(page.locator(`[data-isolate="${id}"] canvas[data-view="line"]`)).toHaveAttribute(
    'data-drawn',
    /^line:/,
  );
  const snap = await page.evaluate(() => window.harness.isolates());
  expect(snap.find((i) => i.id === id)?.pool).toBeUndefined();

  // A placement change in the draft doesn't respawn a preview; a view change applies.
  const edited: WidgetSpec = {
    ...draft,
    view: { type: 'bar', size: 'm' },
    placement: { mode: 'manual', pool: 'pool-7' },
  };
  await page.evaluate((s) => window.harness.publish(s, 'draft'), edited);
  await expect(page.locator(`[data-isolate="${id}"] canvas[data-view="bar"]`)).toHaveAttribute(
    'data-drawn',
    /^bar:/,
  );
  await expect(widget(page, id)).toHaveAttribute('data-state', 'live');
});

test('the native widget runs the same code on the main thread', async ({ page }) => {
  await open(page);
  await page.evaluate((s) => window.harness.publish(s), line({ id: 'n1' }));
  await page.evaluate((s) => window.harness.native(s), line({ id: 'n1' }));
  const native = page.locator('[data-native="n1"]');
  await expect(native.locator('.creator-widget')).toHaveAttribute('data-state', 'live');
  await expect(native.locator('canvas[data-view="line"]')).toHaveAttribute('data-drawn', /^line:/);
  await page.evaluate((s) => window.harness.publish(s), stat({ id: 'n1' }));
  await expect(native.locator('[data-view="stat"]')).toHaveAttribute('data-value', '100');
});
