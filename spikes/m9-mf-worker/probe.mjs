// Runs every browser × remote × mode once and prints what happened.
import { chromium, firefox, webkit } from '@playwright/test';

const engines = { chromium, firefox, webkit };
const only = process.env.ENGINES?.split(',') ?? Object.keys(engines);
const out = [];
for (const name of only) {
  const browser = await engines[name].launch();
  for (const remote of ['vite', 'rsbuild']) {
    for (const mode of ['main', 'isolate']) {
      const page = await browser.newPage();
      const msgs = [];
      const bytes = {};
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') msgs.push(m.text().slice(0, 300));
      });
      page.on('pageerror', (e) => msgs.push('pageerror: ' + e.message.slice(0, 300)));
      page.on('requestfinished', async (req) => {
        const u = new URL(req.url());
        const s = await req.sizes().catch(() => null);
        const key = `${u.port}${u.pathname}`;
        bytes[key] = s ? s.responseBodySize : 0;
      });
      await page.goto(`http://localhost:5180/?mode=${mode}&remote=${remote}`);
      let result = 'timeout';
      try {
        const where = page.locator('#slot [data-where]');
        await Promise.race([
          where.waitFor({ timeout: 15000 }),
          page.waitForSelector('#status[data-crash]', { timeout: 15000 }),
        ]);
        if (await where.count()) {
          result = `rendered on ${await where.textContent()}`;
          await page.locator('#slot button').click();
          await page.locator('#slot [data-count]', { hasText: '1' }).waitFor({ timeout: 5000 });
          result += ', click ok';
        } else result = 'crash';
      } catch (e) {
        result += ' (' + String(e.message).split('\n')[0].slice(0, 80) + ')';
      }
      const status = await page.textContent('#status');
      await page.waitForTimeout(300);
      const js = Object.entries(bytes).filter(([k]) => k.endsWith('.js'));
      const total = js.reduce((a, [, v]) => a + v, 0);
      const reactChunks = js.filter(([k]) => /react|prebuild|q\.|7\.|z\.|4\./.test(k)).map(([k, v]) => `${k}:${v}`);
      out.push({ engine: name, remote, mode, result, status, jsBytes: total, files: js.length, msgs: msgs.slice(0, 6), reactChunks });
      await page.close();
    }
  }
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
