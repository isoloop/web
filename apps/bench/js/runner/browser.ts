import { chromium, firefox, type Browser } from 'playwright';

export const ENGINES = ['chromium', 'firefox'] as const;
export type Engine = (typeof ENGINES)[number];

export async function launch(engine: Engine): Promise<Browser> {
  return engine === 'firefox' ? firefox.launch() : chromium.launch();
}

/** Opens `url` in a fresh context and waits for `window.__bench` to settle. */
export async function runPage(browser: Browser, url: string, timeoutMs: number) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const console: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => console.push(`pageerror: ${e.message}`));
  try {
    await page.goto(url);
    // oxlint-disable-next-line no-underscore-dangle -- the page's result, window.__bench (src/page/main.ts)
    await page.waitForFunction(() => window.__bench?.state !== 'running', null, {
      timeout: timeoutMs,
      polling: 1000,
    });
    // oxlint-disable-next-line no-underscore-dangle -- as above
    const bench = await page.evaluate(() => window.__bench);
    return { ...bench, console };
  } catch (e) {
    return { state: 'error' as const, error: e instanceof Error ? e.message : String(e), console };
  } finally {
    // A crashed page can take its context with it; the next run gets a new one.
    await context.close().catch(() => {});
  }
}
