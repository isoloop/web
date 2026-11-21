import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../build/docs/pages.ts';
import { expectAccessible } from './accessible.ts';

// The docs layout (isoloop/isoloop M4c task 11; ADR 0006): every docs page and
// /docs/ at a desktop's and a phone's width, in both themes, plus the header's
// "Docs" item on every page of the site and the code blocks' Copy button.

const GUIDES = readManifest(
  fileURLToPath(new URL('../content/docs.json', import.meta.url)),
).sections.flatMap((s) => s.guides.flatMap((g) => ('slug' in g ? [`/docs/${g.slug}/`] : [])));
const DOCS = ['/docs/', ...GUIDES];
const SITE = ['/', '/features/', '/how-it-works/', '/examples/', '/changelog/', ...DOCS];

const WIDTHS = [
  { name: 'a desktop', width: 1440, height: 900 },
  { name: 'a phone', width: 390, height: 844 },
];

/** Console errors and page errors, collected from before the page loads. */
function watch(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return () => errors;
}

for (const path of DOCS) {
  for (const w of WIDTHS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${path} at ${w.name}'s width, ${theme}: accessible, nothing wider than the screen`, async ({
        page,
      }) => {
        const problems = watch(page);
        await page.setViewportSize({ width: w.width, height: w.height });
        const res = await page.goto(`${path}?theme=${theme}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectAccessible(page, { exclude: ['iframe'] });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        expect(problems()).toEqual([]);
      });
    }
  }
}

for (const path of SITE) {
  test(`${path} has Docs right after Home, and the version pill before GitHub`, async ({
    page,
  }) => {
    await page.goto(path);
    const links = page.getByRole('navigation', { name: 'Site' }).getByRole('link');
    await expect(links).toHaveText(['Home', 'Docs', 'Features', 'How it works', 'Examples']);
    const docs = links.nth(1);
    if (path.startsWith('/docs/')) await expect(docs).toHaveAttribute('aria-current', 'page');
    else await expect(docs).not.toHaveAttribute('aria-current', 'page');
    const version = page.locator('.ui-header-end > a').first();
    await expect(version).toHaveClass('ui-version');
    await expect(version).toHaveAttribute('href', '/changelog/');
    await expect(version).toHaveText(/^\d+\.\d+\.\d+/);
  });
}

const GUIDE = GUIDES[0] ?? '/docs/';

test('the sidebar and the contents fold away as the page narrows', async ({ page }) => {
  await page.goto(GUIDE);
  const wideSide = page.locator('.docs-only-wide .docs-side');
  const sideFold = page.locator('details.docs-only-narrow');
  const toc = page.locator('aside.docs-toc');
  const tocFold = page.locator('details.docs-toc-fold');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(wideSide).toBeVisible();
  await expect(wideSide.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(toc).toBeVisible();
  await expect(sideFold).toBeHidden();
  await expect(tocFold).toBeHidden();

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(wideSide).toBeVisible();
  await expect(toc).toBeHidden();
  await expect(tocFold).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(wideSide).toBeHidden();
  await expect(sideFold).toBeVisible();
  const link = sideFold.locator('a[aria-current="page"]');
  await expect(link).toBeHidden();
  await sideFold.locator('summary').click();
  await expect(link).toBeVisible();
});

test("a code block's Copy button copies its code", async ({ page, context, baseURL }) => {
  await context.grantPermissions(
    ['clipboard-read', 'clipboard-write'],
    baseURL ? { origin: baseURL } : {},
  );
  // The inspection guide opens with a code block.
  await page.goto('/docs/inspection/');
  const block = page.locator('.doc-code').first();
  // Located by its attribute: its accessible name changes to "Copied".
  const button = block.locator('button[data-copy]');
  await expect(button).toBeVisible();
  await expect(button).toHaveText('Copy');
  await button.click();
  await expect(button).toHaveText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(await block.locator('pre code').textContent());
});

test('without JS the docs read, and the Copy button stays hidden', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(GUIDE);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.docs-lead')).toBeVisible();
  await expect(page.locator('button[data-copy]').first()).toBeHidden();
  await context.close();
});

test('an experimental guide has the round mark in the sidebar and the full pill on its heading', async ({
  page,
}) => {
  const experimental = readManifest(
    fileURLToPath(new URL('../content/docs.json', import.meta.url)),
  ).sections.flatMap((s) => s.guides.flatMap((g) => ('slug' in g && g.experimental ? [g] : [])));
  const guide = experimental[0];
  expect(guide).toBeDefined();
  if (!guide) return;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/docs/${guide.slug}/`);
  const link = page.locator(`.docs-only-wide .docs-side a[href="/docs/${guide.slug}/"]`);
  const mark = link.locator('.ui-experimental-mark');
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute('title', 'Experimental');
  await expect(mark.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(link.locator('.ui-pill')).toHaveCount(0);
  // The accessible name carries it, so colour isn't the only signal.
  await expect(link).toHaveAccessibleName(/ Experimental$/);
  // The label is there for screen readers only: it takes no room.
  const box = await link.locator('.ui-sr-only').boundingBox();
  expect(box?.width).toBeLessThanOrEqual(1);
  // The heading keeps the full pill.
  await expect(page.getByRole('heading', { level: 1 }).locator('.ui-pill')).toHaveText(
    'Experimental',
  );
  // A stable guide has no mark.
  const stable = GUIDES.find((g) => g !== `/docs/${guide.slug}/`);
  await page.goto(stable ?? '/docs/');
  await expect(
    page.locator('.docs-only-wide .docs-side a[aria-current="page"] .ui-experimental-mark'),
  ).toHaveCount(0);
  // The index keeps the pill.
  await page.goto('/docs/');
  await expect(page.locator('.docs-index-section .ui-pill').first()).toBeVisible();
});

test('an API page shows the Experimental pill on an experimental export, and no generator note', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto('/docs/api/balancer/');
  expect(res?.status()).toBe(200);
  const pill = page.locator('.doc h3 + p.doc-experimental .ui-pill').first();
  await expect(pill).toHaveText('Experimental');
  await expect(page.locator('.doc')).not.toContainText('Generated by');
  await expect(page.locator('.doc')).not.toContainText('<!--');
});

test('Kernel config in the sidebar goes to KernelConfig on the host API page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/');
  await page
    .locator('.docs-only-wide .docs-side')
    .getByRole('link', { name: 'Kernel config' })
    .click();
  await expect(page).toHaveURL(/\/docs\/api\/host\/#kernelconfig$/);
  await expect(page.locator('#kernelconfig')).toBeVisible();
});

// The docs' search (src/demos/search.ts, /docs/search.json): hidden without
// JS, the index loaded on first use, found by words and code identifiers,
// keyboard to a result and its heading, accessible with the panel open.
test.describe('the docs search', () => {
  const box = '.docs-only-wide .docs-search input';
  test.use({ viewport: { width: 1440, height: 900 } });

  test('loads its index on first use, finds words and identifiers, and says when nothing matches', async ({
    page,
  }) => {
    let loads = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/docs/search.json')) loads++;
    });
    await page.goto('/docs/contracts/');
    await expect(page.locator(box)).toBeVisible();
    expect(loads).toBe(0);
    await page.keyboard.press('/');
    await expect(page.locator(box)).toBeFocused();
    const panel = page.locator('.docs-only-wide .docs-search-panel');
    for (const [q, title] of [
      ['spawn', 'Getting started'],
      ['busyMs', 'Automatic placement: the balancer'],
      ['quarantine', 'Automatic placement: the balancer'],
      ['grants', 'Contracts and grants'],
      ['llms', 'Docs'],
    ] as const) {
      // One query after another, in the same box.
      // oxlint-disable-next-line no-await-in-loop -- each query in turn, on one input
      await page.fill(box, q);
      // oxlint-disable-next-line no-await-in-loop -- each query in turn, on one input
      await expect(panel.locator('[role="option"]').first()).toContainText(title);
    }
    expect(loads).toBe(1);
    await page.fill(box, 'zzqxv');
    await expect(panel.locator('.docs-search-empty')).toHaveText('No results for “zzqxv”');
    await expect(panel.locator('[role="option"]')).toHaveCount(0);
  });

  test('moves through the results by keyboard and lands on the chosen heading', async ({
    page,
  }) => {
    await page.goto('/docs/contracts/');
    await page.fill(box, 'quarantine');
    const input = page.locator(box);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'search-side-list-1');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/docs\/balancer\/#when-to-use-it$/);
    await expect(page.locator('#when-to-use-it')).toBeInViewport();
  });

  test('closes on Escape and is accessible open', async ({ page }) => {
    await page.goto('/docs/contracts/');
    await page.fill(box, 'pool');
    await expect(page.locator(box)).toHaveAttribute('aria-expanded', 'true');
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(box)).toHaveAttribute('aria-expanded', 'false');
  });

  test('is hidden without JS', async ({ browser }) => {
    const page = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await page.goto('/docs/contracts/');
    await expect(page.locator('.docs-search').first()).toBeHidden();
  });
});
