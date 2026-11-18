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
/** The served size: half resolution, for the hub's cards. */
const OUT = { width: 960, height: 600 };

/** Where each example opens, and how long it fills before the shot. */
const SHOTS: { id: string; path: string; waitMs: number }[] = [
  { id: 'basic', path: '/examples/basic/', waitMs: 4_000 },
  { id: 'dashboards/plant', path: '/examples/dashboards/plant/', waitMs: 10_000 },
  { id: 'dashboards/markets', path: '/examples/dashboards/markets/', waitMs: 10_000 },
  { id: 'processor', path: '/examples/processor/', waitMs: 8_000 },
];
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const server = spawn(
  'node',
  [fileURLToPath(new URL('serve.ts', import.meta.url)), `${repo}site`, String(PORT)],
  { stdio: 'inherit' },
);
await new Promise((r) => setTimeout(r, 500));

const browser = await chromium.launch();

async function take(shot: (typeof SHOTS)[number], theme: Theme): Promise<void> {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
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
  await page.waitForTimeout(shot.waitMs);
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
      return c.toDataURL('image/webp', 0.82).split(',')[1] ?? '';
    },
    { data: png.toString('base64'), out: OUT },
  );
  await blank.close();
  const file = `${repo}apps/${shot.id}/screenshot-${theme}.webp`;
  writeFileSync(file, Buffer.from(webp, 'base64'));
  console.log(`${file} (${Math.round(readFileSync(file).byteLength / 1024)} KB)`);
}

try {
  // One app at a time: each fills its own page, and they'd compete for the CPU.
  const jobs = SHOTS.flatMap((shot) => THEMES.map((theme) => [shot, theme] as const));
  await jobs.reduce((done, [shot, theme]) => done.then(() => take(shot, theme)), Promise.resolve());
} finally {
  await browser.close();
  server.kill();
}
