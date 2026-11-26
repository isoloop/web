// Time from navigation start until the component is on screen, 7 runs per case.
import { chromium, firefox, webkit } from '@playwright/test';
const engines = { chromium, firefox, webkit };
const cases = [['plain', 'isolate'], ['vite', 'isolate'], ['rsbuild', 'isolate'], ['vite', 'main'], ['rsbuild', 'main']];
const out = {};
for (const name of (process.env.ENGINES ?? 'chromium,firefox,webkit').split(',')) {
  const b = await engines[name].launch();
  for (const [remote, mode] of cases) {
    const ms = [];
    for (let i = 0; i < 8; i++) {
      const p = await b.newPage();
      await p.addInitScript(() => {
        const seen = (root) => {
          new MutationObserver((_, o) => {
            if (root.querySelector('[data-where]')) {
              window.__shown ??= performance.now();
              o.disconnect();
            }
          }).observe(root, { subtree: true, childList: true, characterData: true });
        };
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (init) {
          const r = attach.call(this, init);
          seen(r);
          return r;
        };
        seen(document);
      });
      await p.goto(`http://localhost:5180/?mode=${mode}&remote=${remote}`);
      await p.locator('#slot [data-where]').waitFor({ timeout: 15000 });
      const t = await p.evaluate(() => window.__shown);
      if (i > 0) ms.push(Math.round(t)); // first run warms the HTTP cache path
      await p.close();
    }
    ms.sort((a, b) => a - b);
    out[`${name} ${remote} ${mode}`] = { median: ms[Math.floor(ms.length / 2)], min: ms[0], max: ms.at(-1) };
  }
  await b.close();
}
console.log(JSON.stringify(out, null, 1));
