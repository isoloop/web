import { chromium, firefox, webkit } from '@playwright/test';
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch();
  for (const f of ['x.js', 'z.js']) {
    const p = await b.newPage();
    await p.goto(`http://localhost:5180/?mode=isolate&src=${encodeURIComponent('http://localhost:5183/' + f)}`);
    const ok = await p.locator('#slot [data-where]').waitFor({ timeout: 8000 }).then(() => 'rendered', () => 'not rendered');
    console.log(n, f, ok, (await p.textContent('#status')).slice(0, 160).replace(/\n/g, ' '));
    await p.close();
  }
  await b.close();
}
