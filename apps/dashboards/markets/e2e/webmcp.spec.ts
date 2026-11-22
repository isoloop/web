import { expect, test, type Browser, type BrowserType } from '@playwright/test';

// The markets tools through the browser's own WebMCP (M4a, ADR 0018
// decision 8; M4b task 11): the Isoloop build calls `connectWebMCP` when the
// browser has WebMCP, and Playwright reads the tools the way a browser agent
// would. WebMCP is behind a flag in both engines that have it, so each test
// launches its own browser with it on: Chromium with `--enable-features=WebMCP`,
// Firefox with `dom.modelcontext.enabled` (and the testing pref Playwright's
// `page.webmcp` uses). WebKit has no WebMCP.

async function launch(
  browserName: string,
  playwright: { chromium: BrowserType; firefox: BrowserType },
): Promise<Browser> {
  if (browserName === 'chromium') {
    return playwright.chromium.launch({ args: ['--enable-features=WebMCP'] });
  }
  return playwright.firefox.launch({
    firefoxUserPrefs: {
      'dom.modelcontext.enabled': true,
      'dom.modelcontext.testing.enabled': true,
    },
  });
}

test('the two markets tools are listed to the browser agent', async ({
  browserName,
  playwright,
  baseURL,
}) => {
  test.skip(browserName === 'webkit', 'WebKit has no WebMCP');
  const browser = await launch(browserName, playwright);
  try {
    const page = await browser.newPage(baseURL === undefined ? {} : { baseURL });
    await page.goto('/isoloop/?size=lite&speed=10');
    await expect
      .poll(async () => (await page.webmcp.tools()).map((t) => t.name).toSorted())
      .toEqual(['markets.alerts.create.v1', 'markets.quote.v1']);
    const tools = await page.webmcp.tools();
    const quote = tools.find((t) => t.name === 'markets.quote.v1');
    expect(quote?.annotations?.readOnly).toBe(true);
    // The aggregator answers once the replay has priced the symbol.
    await expect
      .poll(async () => {
        try {
          const r: unknown = await page.webmcp.callTool('markets.quote.v1', { symbol: 'ETH-USD' });
          return JSON.stringify(r);
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      })
      .toContain('ETH-USD');
  } finally {
    await browser.close();
  }
});

test('without WebMCP the page loads no WebMCP code', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  const fetched: string[] = [];
  page.on('request', (r) => fetched.push(r.url()));
  await page.goto('/isoloop/?size=lite&speed=10');
  await expect.poll(() => page.evaluate(() => window.kernel.isolates().length)).toBeGreaterThan(0);
  expect(fetched.filter((u) => u.includes('opt-in-'))).toEqual([]);
});
