import { expect, test, type Page } from '@playwright/test';

// M3f decision 3: the Isoloop build in each placement. The same isolates and
// data; only where they run changes. Worker counts leave the bus's worker out.
const PLACEMENTS = ['own', 'matched', 'one'] as const;
type Placement = (typeof PLACEMENTS)[number];

/** Workers at Lite (6 widgets; the replay, the aggregator and the alerts) and at Normal (16 widgets, plus three engines). */
const WORKERS: Record<Placement, { lite: number; normal: number }> = {
  own: { lite: 9, normal: 22 },
  matched: { lite: 4, normal: 7 },
  one: { lite: 1, normal: 1 },
};
const POOL: Record<Placement, { widget: string | null; data: string | null }> = {
  own: { widget: null, data: null },
  matched: { widget: 'widgets', data: null },
  one: { widget: 'all', data: 'all' },
};

const any = { '~standard': {} };
const url = (p: Placement, size: string): string =>
  `/isoloop/?size=${size}&speed=1${p === 'own' ? '' : `&placement=${p}`}`;
const workers = (page: Page) => page.locator('[data-metric="workers"] dd');

for (const placement of PLACEMENTS) {
  test(`${placement}: the dashboard runs, each isolate where the placement puts it`, async ({
    page,
  }) => {
    await page.goto(url(placement, 'lite'));
    await expect(page.locator('.build')).toHaveAttribute('data-placement', placement);
    await expect(page.locator('.page > .description[data-placement-note]')).toContainText(
      placement,
    );
    await expect(workers(page)).toHaveText(String(WORKERS[placement].lite), { timeout: 15_000 });
    const pools = await page.evaluate(() =>
      Object.fromEntries(window.kernel.isolates().map((i) => [i.id, i.pool ?? null])),
    );
    expect(pools['price']).toBe(POOL[placement].widget);
    expect(pools['filters']).toBe(POOL[placement].widget);
    expect(pools['replay']).toBe(POOL[placement].data);
    expect(pools['aggregator']).toBe(POOL[placement].data);
    // Data reaches the widgets.
    await expect(page.locator('[data-slot="trades"] .trade').first()).toBeVisible({
      timeout: 15_000,
    });
    // The switcher marks this placement and links the others.
    const nav = page.getByRole('navigation', { name: 'Placement' });
    await expect(nav.locator('[aria-current="page"]')).toHaveText(placement);
    await expect(nav.getByRole('link')).toHaveCount(PLACEMENTS.length - 1);
  });

  test(`${placement} at Normal: the workers it runs`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Worker counts are the same in every engine');
    await page.goto(url(placement, 'normal'));
    await expect(workers(page)).toHaveText(String(WORKERS[placement].normal), { timeout: 20_000 });
  });
}

test('matched: a blocked widget stalls the widgets’ pool, and the data keeps flowing', async ({
  page,
}) => {
  await page.goto(url('matched', 'lite'));
  const trades = page.locator('[data-slot="trades"] [data-head="updates"]');
  await expect
    .poll(async () => Number((await trades.innerText()).replace(/\D+/g, '') || 0), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  // Count aggregates published while the block lasts: the aggregator has its own worker.
  await page.evaluate((schema) => {
    window.aggregatesSeen = 0;
    window.kernel.subscribe({ name: 'aggregates.v1', schema }, () => {
      window.aggregatesSeen++;
    });
  }, any);
  await page.locator('[data-slot="price"] button[name="stress-block"]').click();
  // The trades table shares the blocked pool, so its header shows the stall.
  await expect(trades).toHaveText('0 updates/s', { timeout: 2_900 });
  const during = await page.evaluate(() => window.aggregatesSeen);
  expect(during).toBeGreaterThan(0);
  // And it counts again once the pool's loop is free.
  await expect
    .poll(async () => Number((await trades.innerText()).replace(/\D+/g, '') || 0), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});

declare global {
  interface Window {
    aggregatesSeen: number;
  }
}

// M3g decision 7: `teams`, on `/mixed` only. The data on its own workers, as
// in `matched`, and a pool per team: the React widgets', the Preact widgets'.
const teams = (size: string): string => `/mixed/?size=${size}&speed=1&placement=teams`;

test('teams: each team’s widgets share a pool of their own, the data its own workers', async ({
  page,
}) => {
  await page.goto(teams('lite'));
  await expect(page.locator('.build')).toHaveAttribute('data-placement', 'teams');
  await expect(page.locator('.page > .description')).toContainText(
    "A blocked widget stalls its own team's widgets only.",
  );
  // Lite: the replay, the aggregator and the alerts, plus the two teams' pools.
  await expect(workers(page)).toHaveText('5', { timeout: 15_000 });
  const pools = await page.evaluate(() =>
    Object.fromEntries(window.kernel.isolates().map((i) => [i.id, i.pool ?? null])),
  );
  expect(pools['price']).toBe('react');
  expect(pools['filters']).toBe('preact');
  expect(pools['alerts-panel']).toBe('preact');
  expect(pools['replay']).toBe(null);
  await expect(page.locator('[data-slot="price"] [data-head="where"]')).toHaveText(
    'pool react · React',
  );
  await expect(page.locator('[data-slot="filters"] [data-head="where"]')).toHaveText(
    'pool preact · Preact',
  );
  await expect(page.locator('[data-slot="trades"] .trade').first()).toBeVisible({
    timeout: 15_000,
  });
  const nav = page.getByRole('navigation', { name: 'Placement' });
  await expect(nav.locator('[aria-current="page"]')).toHaveText('teams');
});

test('teams at Normal: 8 workers', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Worker counts are the same in every engine');
  await page.goto(teams('normal'));
  await expect(workers(page)).toHaveText('8', { timeout: 20_000 });
});

test('teams: a blocked Preact widget leaves the React team’s widgets updating', async ({
  page,
}) => {
  await page.goto(teams('lite'));
  const trades = page.locator('[data-slot="trades"] [data-head="updates"]');
  const filters = page.locator('[data-slot="filters"] [data-head="updates"]');
  const n = async (l: typeof trades): Promise<number> =>
    Number((await l.innerText()).replace(/\D+/g, '') || 0);
  await expect.poll(() => n(trades), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.locator('[data-slot="alerts-panel"] button[name="stress-block"]').click();
  // The filters share the blocked pool; the trades table is on the React team's.
  await expect(filters).toHaveText('0 updates/s', { timeout: 2_900 });
  expect(await n(trades)).toBeGreaterThan(0);
});

test('teams is offered on /mixed only', async ({ page }) => {
  await page.goto('/isoloop/?size=lite&speed=1&placement=teams');
  // Not a placement of the React build: it falls back to the default.
  await expect(page.locator('.build')).toHaveAttribute('data-placement', 'own');
  const nav = page.getByRole('navigation', { name: 'Placement' });
  await expect(nav.getByText('teams')).toHaveCount(0);
  await page.goto('/mixed/?size=lite&speed=1');
  await expect(nav.getByRole('link', { name: 'teams' })).toBeVisible();
});
