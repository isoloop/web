import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { DIAGRAM_ORDER } from '../build/diagrams.ts';
import { readManifest } from '../build/docs/pages.ts';
import { expectAccessible } from './accessible.ts';

declare global {
  interface Window {
    cspViolations?: string[];
  }
}

// The site's smoke test (ADR 0002, decision 11), against the assembled site as
// it's deployed (scripts/assemble-site.sh with SITE=1), served the way GitHub
// Pages serves it (scripts/serve.ts), plus ui's specimens under /__specimens/.

/** Console errors and CSP violations on a page, collected from before it loads. */
async function watch(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const seen: string[] = [];
    window.cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (e) => {
      seen.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`);
    });
  });
  return async () => {
    const csp = await page.evaluate(() => window.cspViolations ?? []);
    return [...errors, ...csp.map((v) => `CSP ${v}`)];
  };
}

/** The docs pages, one per guide in content/docs.json (build/docs/pages.ts). */
const DOCS = readManifest(
  fileURLToPath(new URL('../content/docs.json', import.meta.url)),
).sections.flatMap((s) => s.guides.map((g) => `/docs/${g.slug}/`));

const PAGES = [
  '/',
  '/features/',
  '/how-it-works/',
  '/examples/',
  '/changelog/',
  '/__specimens/',
  ...DOCS,
];

for (const path of PAGES) {
  test(`${path} loads cleanly and is accessible`, async ({ page }) => {
    const problems = await watch(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    // The iframes are checked as pages of their own (basic in its own E2E,
    // the diagrams below); here axe looks at this page's markup.
    await expectAccessible(page, { exclude: ['iframe'] });
    expect(await problems()).toEqual([]);
  });
}

// The costs table has a second form below 881px (src/pages/delta.tsx), so
// the pages that show it are checked at a phone's width too.
for (const path of ['/', '/features/']) {
  test(`${path} is accessible at a phone's width, with nothing wider than the screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // On /features/ the costs table is in the Cost tab (ADR 0005).
    await page.goto(path === '/features/' ? '/features/#costs' : path);
    await expect(page.locator('.ui-delta-narrow table').first()).toBeVisible();
    await expect(page.locator('.ui-delta-wide')).toBeHidden();
    await expectAccessible(page, { exclude: ['iframe'] });
    const widest = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll('.ui-delta-narrow table')].map(
          (t) => t.scrollWidth - (t.parentElement?.clientWidth ?? 0),
        ),
      ),
    );
    expect(widest).toBeLessThanOrEqual(0);
  });
}

test('the code behind the landing demo folds out of the recording, as tabs', async ({ page }) => {
  await page.goto('/');
  const fold = page.locator('.ui-recording details.ui-demo-code');
  const host = page.getByRole('tabpanel', { name: 'main.ts' });
  await expect(host).toBeHidden();
  await fold.locator('summary').click();
  await expect(host).toBeVisible();
  await expect(host.locator('.tok-keyword').first()).toHaveText('import');
  await expect(host).toContainText("pool: 'shared'");
  const counterTab = page.getByRole('tab', { name: 'counter.ts' });
  await page.getByRole('tab', { name: 'main.ts' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(counterTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'counter.ts' })).toContainText(
    "from: 'earliest'",
  );
  await expect(host).toBeHidden();
  await expectAccessible(page, { exclude: ['iframe'] });
});

test('a missing page gets the 404 page', async ({ page }) => {
  const problems = await watch(page);
  const res = await page.goto('/no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('doesn’t exist');
  await expectAccessible(page);
  // The browser logs the 404 itself; nothing else may go wrong.
  expect((await problems()).filter((e) => !/status of 404/.test(e))).toEqual([]);
});

for (const name of DIAGRAM_ORDER) {
  test(`the ${name} diagram runs under the site's policy`, async ({ page }) => {
    const problems = await watch(page);
    const res = await page.goto(`/how-it-works/diagrams/${name}.html`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('svg').first()).toBeVisible();
    // The theme script is there and in charge of data-theme.
    await page.evaluate(() => localStorage.setItem('isoloop-theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await problems()).toEqual([]);
  });
}

const OFFSTAGE = 'iframe.ui-offstage[src="/examples/basic/?embed=1"]';

test('the landing recording draws what basic reports, and its controls reach basic', async ({
  page,
}) => {
  const problems = await watch(page);
  await page.goto('/');
  const rec = page.locator('[data-demo="recording"]');
  await rec.scrollIntoViewIfNeeded();
  // basic starts out of view, inert and hidden from assistive tech.
  await expect(page.locator(OFFSTAGE)).toHaveAttribute('aria-hidden', 'true');
  const status = rec.locator('.ui-status');
  await expect(status).toHaveText('Recording. Everything is running.', { timeout: 15_000 });
  const blockC = rec.getByRole('button', { name: 'Block C for 3 s' });
  await expect(blockC).toBeEnabled({ timeout: 15_000 });
  await blockC.click();
  await expect(status).toContainText('C is stuck', { timeout: 5_000 });
  await expect(status).toContainText('the pool was stopped and started again', { timeout: 10_000 });
  // It really happened in basic: C and D restarted, A didn't.
  const basic = page.frameLocator(OFFSTAGE);
  const restarts = (id: string) => basic.locator(`section[data-isolate="${id}"] .restarts`);
  await expect(restarts('C')).toHaveText('restarts: 1');
  await expect(restarts('D')).toHaveText('restarts: 1');
  await expect(restarts('A')).toHaveText('restarts: 0');
  // The isolates' errors are the crash basic was asked for; nothing else may go wrong.
  expect((await problems()).filter((e) => !/crash|unresponsive/i.test(e))).toEqual([]);
});

test('the bus track draws only the app’s records, and reactions link to their sender', async ({
  page,
}) => {
  const problems = await watch(page);
  // Count what basic sends this page: records of the app's topics, and rejected publishes.
  await page.addInitScript(() => {
    const seen = { records: 0, rejected: 0, activity: 0 };
    Reflect.set(window, 'seen', seen);
    addEventListener('message', (e) => {
      const d: unknown = e.data;
      if (typeof d !== 'object' || d === null || Reflect.get(d, 'v') !== 'isoloop-demo@1') return;
      const type: unknown = Reflect.get(d, 'type');
      if (type === 'record') seen.records++;
      if (type === 'activity') {
        seen.activity++;
        if (Reflect.get(d, 'kind') === 'rejected') seen.rejected++;
      }
    });
  });
  await page.goto('/');
  const rec = page.locator('[data-demo="recording"]');
  await rec.scrollIntoViewIfNeeded();
  await expect(rec.locator('.ui-status')).toHaveText('Recording. Everything is running.', {
    timeout: 15_000,
  });
  // A reaction (C or D reading A's count) gets a link back to A.
  await expect
    .poll(async () => Number((await rec.getAttribute('data-links')) ?? '0'), { timeout: 10_000 })
    .toBeGreaterThan(0);
  // Every bus tick is an app record or a rejected publish; the activity reports draw none.
  const counts = await page.evaluate(() => {
    const seen: unknown = Reflect.get(window, 'seen');
    const n = (k: string): number => {
      const v: unknown = typeof seen === 'object' && seen !== null ? Reflect.get(seen, k) : 0;
      return typeof v === 'number' ? v : 0;
    };
    const root = document.querySelector<HTMLElement>('[data-demo="recording"]');
    return {
      records: n('records'),
      rejected: n('rejected'),
      activity: n('activity'),
      bus: Number(root?.dataset['busTicks'] ?? '0'),
    };
  });
  expect(counts.activity).toBeGreaterThan(counts.records);
  expect(counts.bus).toBe(counts.records + counts.rejected);
  await expect(rec.locator('.ui-legend')).toContainText('A hollow tick is a reaction to a record');
  await expect(rec.locator('.ui-legend')).toContainText('measurement records aren’t drawn');
  // While A is down, C's and D's rows say they wait for its count; then they don't.
  const crashA = rec.getByRole('button', { name: /^Crash A/ });
  await expect(crashA).toBeEnabled({ timeout: 15_000 });
  await crashA.click();
  await expect(rec).toHaveAttribute('data-waiting', 'A', { timeout: 5_000 });
  await expect(rec).not.toHaveAttribute('data-waiting', 'A', { timeout: 10_000 });
  expect((await problems()).filter((e) => !/crash/i.test(e))).toEqual([]);
});

test('past the crash-loop guard the recording shows A failed, and Restart A brings it back', async ({
  page,
}) => {
  const problems = await watch(page);
  await page.goto('/');
  const rec = page.locator('[data-demo="recording"]');
  await rec.scrollIntoViewIfNeeded();
  const status = rec.locator('.ui-status');
  await expect(status).toHaveText('Recording. Everything is running.', { timeout: 15_000 });
  const crashA = rec.getByRole('button', { name: 'Crash A' });
  const basic = page.frameLocator(OFFSTAGE);
  const aStatus = basic.locator('section[data-isolate="A"] .status');
  // One crash after another: each waits for A to run again.
  const crash = async (n: number): Promise<void> => {
    await expect(crashA).toBeEnabled({ timeout: 15_000 });
    if (n > 1) await expect(aStatus).toContainText('loop ok', { timeout: 10_000 });
    await crashA.click();
    if (n === 4) return;
    await expect(basic.locator('section[data-isolate="A"] .restarts')).toHaveText(
      `restarts: ${n}`,
      { timeout: 8_000 },
    );
    // The button counts the restarts used this minute, in its name too.
    await expect(crashA).toHaveText(`Crash A · ${n}/3`, { timeout: 3_000 });
    if (n === 2) {
      await expect(crashA).toHaveAccessibleName('Crash A · 2/3 restarts used this minute');
      await expect(status).toContainText('2 of 3 restarts used this minute');
    }
    await crash(n + 1);
  };
  await crash(1);
  await expect(status).toContainText('crash-loop guard', { timeout: 5_000 });
  // The same button is now Restart A.
  const restart = rec.getByRole('button', { name: 'Restart A' });
  await expect(restart).toBeVisible();
  await expect(rec.locator('.ui-note')).toContainText('more than 3 times within a minute');
  await restart.click();
  await expect(status).toContainText('restarted with kernel.restart()', { timeout: 5_000 });
  await expect(restart).toBeHidden();
  await expect(crashA).toHaveText('Crash A · 0/3', { timeout: 5_000 });
  await expect(aStatus).toContainText('loop ok', { timeout: 10_000 });
  expect((await problems()).filter((e) => !/crash|failed/i.test(e))).toEqual([]);
});

test('the recording ignores a message that is not from its own basic', async ({ page }) => {
  await page.goto('/');
  const rec = page.locator('[data-demo="recording"]');
  await rec.scrollIntoViewIfNeeded();
  const status = rec.locator('.ui-status');
  await expect(status).toHaveText('Recording. Everything is running.', { timeout: 15_000 });
  // A sandboxed frame (another origin, another window) claims A crashed.
  await page.evaluate(() => {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.srcdoc =
      "<script>parent.postMessage({ v: 'isoloop-demo@1', type: 'crash', id: 'A', pool: null, at: Date.now() }, '*');</" +
      'script>';
    document.body.append(f);
  });
  // And the page itself posts one: right origin, wrong window.
  await page.evaluate(() => {
    window.postMessage(
      { v: 'isoloop-demo@1', type: 'crash', id: 'A', pool: null, at: Date.now() },
      '*',
    );
  });
  await page.waitForTimeout(1_000);
  await expect(status).not.toContainText('A crashed');
});

test('/features/ shows basic’s real records, reads and a replay after a crash', async ({
  page,
}) => {
  const problems = await watch(page);
  // The bus and the replay are in the Bus tab (ADR 0005).
  await page.goto('/features/#messaging');
  const bus = page.locator('[data-demo="bus"]');
  await bus.scrollIntoViewIfNeeded();
  await expect(bus.locator('.topic[data-topic="count.v1"] .rec').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(bus.locator('.topic[data-topic="note.v1"] .rec').first()).toBeVisible({
    timeout: 15_000,
  });
  // D's reads are tagged on the records it read.
  await expect(bus.locator('.rec .tags b[data-reader="D"]').first()).toBeVisible({
    timeout: 10_000,
  });

  const replay = page.locator('[data-demo="replay"]');
  await replay.scrollIntoViewIfNeeded();
  await expect(replay.locator('.tape-cells li.read').first()).toBeVisible({ timeout: 15_000 });
  const crashD = replay.getByRole('button', { name: 'Crash D' });
  await expect(crashD).toBeEnabled();
  await crashD.click();
  const status = replay.locator('.ui-status');
  await expect(status).toContainText(/D read \d+ notes? again/, { timeout: 10_000 });
  await expect(replay.locator('.tape-cells li.again').first()).toBeVisible();
  expect((await problems()).filter((e) => !/crash/i.test(e))).toEqual([]);
});

test('/features/ shows one tab of features at a time, and a feature link opens its tab', async ({
  page,
}) => {
  await page.goto('/features/');
  const tabs = page.getByRole('navigation', { name: 'Features, by group' });
  await expect(tabs.getByRole('link', { name: 'Isolation' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(page.locator('#containment')).toBeVisible();
  await expect(page.locator('#balancer')).toBeHidden();
  // From the notes: a feature in another tab opens that tab.
  await page.locator('.fnotes a[href="#balancer"]').click();
  await expect(page.locator('#balancer')).toBeVisible();
  await expect(page.locator('#containment')).toBeHidden();
  await expect(tabs.getByRole('link', { name: 'Placement' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(
    page.getByRole('heading', { name: 'Automatic placement Experimental' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator('#containment')).toBeVisible();
});

test('the framework tabs work with the keyboard', async ({ page }) => {
  await page.goto('/features/#frameworks');
  const react = page.getByRole('tab', { name: 'React', exact: true });
  await expect(react).toHaveAttribute('aria-selected', 'true');
  await react.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Preact', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#panel-preact')).toBeVisible();
  await expect(page.locator('#panel-react')).toBeHidden();
});

test('the theme switch changes the page and the diagram frames live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/how-it-works/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const first = page.locator('iframe[src^="/how-it-works/diagrams/"]').first();
  const frame = first.contentFrame();
  await first.scrollIntoViewIfNeeded();
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
  const toggle = page.getByRole('switch', { name: 'Dark theme' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('how it works shows one step at a time, kept in the URL', async ({ page }) => {
  await page.goto('/how-it-works/');
  const steps = page.locator('[data-step]');
  const nav = page.getByRole('navigation', { name: 'Steps' });
  await expect(steps.and(page.locator(':visible'))).toHaveCount(1);
  await expect(page.locator('#overview')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'step');
  await nav.getByRole('link', { name: 'Bus', exact: true }).click();
  await expect(page).toHaveURL(/#bus$/);
  await expect(page.locator('#bus')).toBeVisible();
  await expect(page.locator('#overview')).toBeHidden();
  await expect(
    page.locator('#bus iframe[src="/how-it-works/diagrams/bus-publish.html?embed=1"]'),
  ).toHaveCount(1);
  await page
    .locator('#bus')
    .getByRole('link', { name: /Next: Rendering/ })
    .click();
  await expect(page.locator('#render')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#bus')).toBeVisible();
  // On the page a diagram is the drawing alone; full size, the presentation stage.
  const frame = page.locator('#bus iframe').contentFrame();
  await expect(frame.locator('html')).toHaveAttribute('data-embed', 'true');
  await expect(frame.locator('.toolbar')).toBeHidden();
  await expect(page.locator('#bus a[href$="bus-publish.html?present=1"]')).toHaveCount(1);
  await page.goto('/how-it-works/#restart');
  await expect(page.locator('#restart')).toBeVisible();
  await expect(page.locator('#restart iframe')).toHaveCount(2);
});

for (const width of [1440, 390]) {
  test(`the step tabs never scroll vertically at ${String(width)}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/how-it-works/');
    const list = page.locator('.steps-nav ol');
    const [scroll, client] = await list.evaluate((el) => [el.scrollHeight, el.clientHeight]);
    expect(scroll).toBeLessThanOrEqual(client);
  });
}

test('robots.txt points at a sitemap whose every page is served', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap: https://isoloop.dev/sitemap.xml');
  const xml = await (await request.get('/sitemap.xml')).text();
  const paths = [...xml.matchAll(/<loc>https:\/\/isoloop\.dev(\/[^<]*)<\/loc>/g)].map(
    (m) => m[1] ?? '',
  );
  expect(paths.length).toBeGreaterThan(5);
  const statuses = await Promise.all(
    paths.map(async (path) => [path, (await request.get(path)).status()] as const),
  );
  expect(statuses.filter(([, status]) => status !== 200)).toEqual([]);
});
