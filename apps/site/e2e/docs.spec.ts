import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../build/docs/pages.ts';
import { expectAccessible } from './accessible.ts';

// The docs layout (isoloop/isoloop M4c task 11; ADR 0006): every docs page and
// /docs/ at a desktop's and a phone's width, in both themes, plus the header's
// "Docs" item on every page of the site and the code blocks' Copy button.

const GUIDES = readManifest(
  fileURLToPath(new URL('../content/docs.json', import.meta.url)),
).sections.flatMap((s) => s.guides.map((g) => `/docs/${g.slug}/`));
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
  test(`${path} has Docs as the last of the site's pages in the header`, async ({ page }) => {
    await page.goto(path);
    const links = page.getByRole('navigation', { name: 'Site' }).getByRole('link');
    await expect(links).toHaveText(['Home', 'Features', 'How it works', 'Examples', 'Docs']);
    const docs = links.last();
    if (path.startsWith('/docs/')) await expect(docs).toHaveAttribute('aria-current', 'page');
    else await expect(docs).not.toHaveAttribute('aria-current', 'page');
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
