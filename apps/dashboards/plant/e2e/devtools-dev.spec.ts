import { expect, test } from '@playwright/test';
import { DEV_URL } from './dev-server';

// The devtools panel under Vite's development server (M4b task 11): with
// `@isoloop/vite`, `@isoloop/devtools` stays out of dependency pre-bundling,
// so the panel's worker loads from the package's own `panel.js`, not from a
// missing file in Vite's deps cache. Chromium only: it checks the dev server,
// not the engine.
test('the panel loads and lists itself under the dev server', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the dev server check runs in Chromium');
  // The panel isolate's module, fetched by its worker (the worker itself runs
  // the runtime's entry).
  const fetched: string[] = [];
  page.context().on('request', (r) => fetched.push(r.url()));
  await page.goto(`${DEV_URL}?devtools=1`);
  const panel = page.locator('[data-isoloop-devtools]');
  await panel.locator('button[data-health]').click({ timeout: 60_000 });
  await expect(panel.locator('tr[data-isolate="isoloop-devtools"]')).toHaveAttribute(
    'data-state',
    'running',
  );
  const panelModule = fetched.find((u) => /@isoloop\/devtools\/dist\/panel\.js/.test(u));
  expect(panelModule, fetched.filter((u) => u.includes('devtools')).join('\n')).toBeDefined();
  expect(fetched.some((u) => u.includes('.vite/deps') && u.includes('panel'))).toBe(false);
});
