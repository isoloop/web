// `pnpm screenshots` (ADR 0002, decision 5): a screenshot of each example for
// the hub, one per theme, written as screenshot-light.webp and
// screenshot-dark.webp next to its example.json. Run by hand
// when an app changes, against the assembled site (`scripts/assemble-site.sh`
// from the repo root, after building the apps), and commit the images. Not in
// CI: the dashboards' live data makes every run's images differ.
//
// Each app is opened at a fixed state: a 1280×800 window, the theme set the
// way the site sets it (localStorage['isoloop-theme'] and the colour scheme),
// and a wait long enough for it to fill. An app that looks the same in both
// themes names only screenshot-light.webp in its example.json. Chromium encodes the WebP itself (canvas
// toDataURL), so no image library is needed.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
/** `SCREENSHOTS_PORT` when 4798 is taken. */
const PORT = Number(process.env['SCREENSHOTS_PORT'] ?? 4798);
const WIDTH = 1280;
const HEIGHT = 800;
/** Pixel density: 2×, so the full-width image on /examples/ stays sharp on high-density screens. */
const SCALE = 2;
const OUT = { width: WIDTH * SCALE, height: HEIGHT * SCALE };

/** Where each example opens, and how long it fills before the shot. */
const SHOTS: {
  id: string;
  path: string;
  waitMs: number;
  /** A button to press first, so the shot shows the app at work. */
  press?: string;
  /** Leave the site's header out: on /examples/ the image sits under the site's own. */
  noHeader?: true;
  /** Apps with one look in both themes: one shot, screenshot.webp. */
  oneTheme?: true;
}[] = [
  { id: 'basic', path: '/examples/basic/', waitMs: 4_000, noHeader: true },
  {
    id: 'dashboards/plant',
    path: '/examples/dashboards/plant/isoloop/',
    waitMs: 10_000,
    oneTheme: true,
  },
  {
    id: 'dashboards/markets',
    path: '/examples/dashboards/markets/isoloop/',
    waitMs: 10_000,
    oneTheme: true,
  },
  {
    id: 'processor',
    path: '/examples/processor/',
    waitMs: 8_000,
    press: 'Add 5 light tasks',
    noHeader: true,
  },
];
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const server = spawn(
  'node',
  [fileURLToPath(new URL('serve.ts', import.meta.url)), `${repo}site`, String(PORT)],
  { stdio: 'inherit' },
);
await new Promise((r) => setTimeout(r, 500));
// Its own server, or nothing: a port another server holds would give blank shots.
if (server.exitCode !== null) {
  throw new Error(`the server couldn't start on ${String(PORT)}: set SCREENSHOTS_PORT`);
}

const browser = await chromium.launch();

async function take(shot: (typeof SHOTS)[number], theme: Theme): Promise<void> {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme: theme,
  });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('isoloop-theme', t);
    } catch {
      // no storage: the colour scheme still decides
    }
  }, theme);
  await page.goto(`http://localhost:${PORT}${shot.path}`);
  if (shot.press) await page.getByRole('button', { name: shot.press }).click();
  await page.waitForTimeout(shot.waitMs);
  if (shot.noHeader) {
    // Through the CSSOM, which the page's policy allows (an injected <style> it wouldn't).
    await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>('.ui-header')) {
        el.style.display = 'none';
      }
    });
  }
  const png = await page.screenshot({ type: 'png' });
  await page.close();
  // Encoded on a blank page: the app's own policy might not allow a data: image.
  const blank = await browser.newPage();
  const webp = await blank.evaluate(
    async ({ data, out }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = out.width;
      c.height = out.height;
      c.getContext('2d')?.drawImage(img, 0, 0, out.width, out.height);
      return c.toDataURL('image/webp', 0.86).split(',')[1] ?? '';
    },
    { data: png.toString('base64'), out: OUT },
  );
  await blank.close();
  const file = `${repo}apps/${shot.id}/${shot.oneTheme ? 'screenshot' : `screenshot-${theme}`}.webp`;
  writeFileSync(file, Buffer.from(webp, 'base64'));
  console.log(`${file} (${Math.round(readFileSync(file).byteLength / 1024)} KB)`);
}

try {
  // One app at a time: each fills its own page, and they'd compete for the CPU.
  const jobs = SHOTS.flatMap((shot) =>
    (shot.oneTheme ? (['dark'] as const) : THEMES).map((theme) => [shot, theme] as const),
  );
  await jobs.reduce((done, [shot, theme]) => done.then(() => take(shot, theme)), Promise.resolve());
} finally {
  await browser.close();
  server.kill();
}
