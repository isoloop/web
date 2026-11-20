// The docs for agents, as the assembled site serves them (M4c, decision 16):
// every docs page is in llms.txt, and each of its links reaches a Markdown
// copy that starts with the page's title.
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { readManifest } from '../build/docs/pages.ts';

const ORIGIN = 'https://isoloop.dev';
const slugs = readManifest(
  fileURLToPath(new URL('../content/docs.json', import.meta.url)),
).sections.flatMap((s) => s.guides.flatMap((g) => ('slug' in g ? [g.slug] : [])));

test('llms.txt lists every docs page, and each link reaches its Markdown copy', async ({
  request,
}) => {
  const res = await request.get('/llms.txt');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^text\/plain/);
  const txt = await res.text();
  expect(txt.startsWith('# Isoloop\n\n> ')).toBe(true);

  const links = [
    ...txt.matchAll(/\]\((https:\/\/isoloop\.dev\/docs\/(?:api\/)?[a-z0-9-]+\.md)\)/g),
  ].map((m) => m[1] ?? '');
  expect(links.map((l) => l.slice(`${ORIGIN}/docs/`.length, -3)).toSorted()).toEqual(
    slugs.toSorted(),
  );
  const copies = await Promise.all(
    links.map(async (link) => {
      const md = await request.get(link.slice(ORIGIN.length));
      return {
        link,
        status: md.status(),
        type: md.headers()['content-type'],
        text: await md.text(),
      };
    }),
  );
  for (const c of copies) {
    expect(c.status, c.link).toBe(200);
    expect(c.type, c.link).toMatch(/^text\/markdown/);
    expect(c.text, c.link).toMatch(/^# \S/);
  }
});

test('llms-full.txt holds every docs page, in nav order', async ({ request }) => {
  const res = await request.get('/llms-full.txt');
  expect(res.status()).toBe(200);
  const full = await res.text();
  const at = slugs.map((s) => full.indexOf(`Source: ${ORIGIN}/docs/${s}.md\n`));
  expect(at.every((i) => i > 0)).toBe(true);
  expect(at).toEqual(at.toSorted((a, b) => a - b));
});
