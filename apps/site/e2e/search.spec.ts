import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// What search engines read, on the assembled site (ADR 0002, decision 9, as
// amended): the example apps' pages aren't part of the site's own build.

const ORIGIN = 'https://isoloop.dev';
const REFRESH = /<meta http-equiv="refresh"/i;
const CANONICAL = /<link rel="canonical" href="([^"]+)"/;

const locations = (xml: string): string[] =>
  [...xml.matchAll(/<loc>https:\/\/isoloop\.dev(\/[^<]*)<\/loc>/g)].map((m) => m[1] ?? '');

test('every URL in the sitemap is a page to index, at its own address', async ({ request }) => {
  const paths = locations(await (await request.get('/sitemap.xml')).text());
  expect(paths.length).toBeGreaterThan(30);
  await Promise.all(
    paths.map(async (path) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, `${path} is a redirect`).not.toMatch(REFRESH);
      expect(html, `${path} says noindex`).not.toContain('<meta name="robots"');
      expect(html, `${path} has no title`).toMatch(/<title>[^<]+<\/title>/);
      expect(html, `${path} has no description`).toMatch(
        /<meta\s+name="description"\s+content="[^"]+"/,
      );
      expect(CANONICAL.exec(html)?.[1], `${path}'s canonical`).toBe(ORIGIN + path);
      expect(html, `${path} has no preview`).toContain('property="og:image"');
    }),
  );
});

test('every other page says noindex or redirects, and no two pages share a title', () => {
  const root = fileURLToPath(new URL('../../../site', import.meta.url));
  const listed = new Set(locations(readFileSync(`${root}/sitemap.xml`, 'utf8')));
  const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => `/${file}`);
  const unmarked: string[] = [];
  const titles: string[] = [];
  for (const file of files) {
    const html = readFileSync(root + file, 'utf8');
    if (REFRESH.test(html)) continue;
    titles.push(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? file);
    if (listed.has(file.replace(/index\.html$/, ''))) continue;
    const noindex = html.includes('<meta name="robots" content="noindex');
    if (!noindex || CANONICAL.test(html)) unmarked.push(file);
  }
  expect(unmarked).toEqual([]);
  expect(titles.filter((title, i) => titles.indexOf(title) !== i)).toEqual([]);
});

test('the home page names the site and who publishes it', async ({ page, request }) => {
  await page.goto('/');
  const text = await page.locator('script[type="application/ld+json"]').textContent();
  const data: unknown = JSON.parse(text ?? '');
  expect(data).toMatchObject({
    '@graph': [
      { '@type': 'WebSite', name: 'Isoloop', url: `${ORIGIN}/` },
      { '@type': 'Organization', name: 'Isoloop', logo: `${ORIGIN}/brand/logo-400.png` },
    ],
  });
  expect((await request.get('/brand/logo-400.png')).headers()['content-type']).toBe('image/png');
});

test("an experimental page's heading keeps its pill a word apart", async ({ page }) => {
  await page.goto('/docs/api/balancer/');
  await expect(page.locator('main h1')).toHaveText('@isoloop/balancer Experimental');
});

test('/features/ has an h2 before its first h3', async ({ page }) => {
  await page.goto('/features/');
  const levels = await page
    .locator('main :is(h2, h3)')
    .evaluateAll((all) => all.map((h) => h.tagName));
  expect(levels[0]).toBe('H2');
});
