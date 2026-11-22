import { expect, test, type Frame, type Page } from '@playwright/test';
import { steadyLoop } from '../../../shared/steady-loop.ts';

// isoloop-demo@1 (src/demo.ts, README): basic embedded in a same-origin parent
// reports what really happens and takes the demo's controls; anything from
// elsewhere, or in another shape, is ignored. The parent page here stands in
// for the site's: served on basic's own origin by a route, it iframes basic
// with ?embed=1 and records every message it gets.

const PROTOCOL = 'isoloop-demo@1';

type Got = { origin: string; data: Record<string, unknown> };

function parentHtml(src: string): string {
  return `<!doctype html><meta charset="utf-8"><title>parent</title>
<iframe id="f" src="${src}" style="width:960px;height:720px;border:0"></iframe>
<script>
  window.got = [];
  addEventListener('message', (e) => {
    if (e.data && e.data.v === '${PROTOCOL}') window.got.push({ origin: e.origin, data: e.data });
  });
</script>`;
}

async function openParent(page: Page, parentUrl: string, src: string): Promise<void> {
  await page.route('**/demo-parent.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: parentHtml(src) }),
  );
  await page.goto(parentUrl);
}

const isGot = (x: unknown): x is Got[] => Array.isArray(x);

const got = async (page: Page): Promise<Got[]> => {
  const list: unknown = await page.evaluate(() => Reflect.get(window, 'got') as unknown);
  return isGot(list) ? list : [];
};

const ofType = async (page: Page, type: string): Promise<Record<string, unknown>[]> =>
  (await got(page)).map((g) => g.data).filter((d) => d['type'] === type);

const command = (page: Page, message: unknown): Promise<void> =>
  page.evaluate((m) => {
    const frame = document.querySelector('iframe');
    frame?.contentWindow?.postMessage(m, '*');
  }, message);

const basicFrame = (page: Page): Frame => {
  const frame = page.frames().find((f) => f.parentFrame() !== null);
  if (!frame) throw new Error("basic's frame isn't there");
  return frame;
};

const restartsIn = (page: Page, id: string): Promise<number> =>
  page
    .frameLocator('#f')
    .locator(`section[data-isolate="${id}"] .restarts`)
    .textContent()
    .then((t) => Number((t ?? '').replace(/\D/g, '') || '0'));

test.describe('embedded in a same-origin parent', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const base = baseURL ?? 'http://localhost:4793/';
    await openParent(page, new URL('demo-parent.html', base).href, './?embed=1');
    await expect.poll(async () => (await ofType(page, 'ready')).length).toBe(1);
  });

  test('reports activity from every isolate, the records, kernel events and frames', async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4793/').origin;
    await expect
      .poll(async () => new Set((await ofType(page, 'activity')).map((a) => a['id'])).size, {
        timeout: 15_000,
      })
      .toBe(4);
    await expect
      .poll(async () => (await ofType(page, 'record')).some((r) => r['topic'] === 'count.v1'))
      .toBe(true);
    await expect.poll(async () => (await ofType(page, 'frames')).length).toBeGreaterThan(0);
    await expect
      .poll(async () => (await ofType(page, 'state')).some((s) => s['state'] === 'running'))
      .toBe(true);
    // Every message came from basic's own origin.
    expect(new Set((await got(page)).map((g) => g.origin))).toEqual(new Set([origin]));
    // D's reads carry the topic and offset the replay demo shades.
    await expect
      .poll(async () =>
        (await ofType(page, 'activity')).some(
          (a) => a['id'] === 'D' && a['kind'] === 'read' && typeof a['offset'] === 'number',
        ),
      )
      .toBe(true);
  });

  test('a read names its cause: the record it handled and who published it', async ({ page }) => {
    // C and D react to A's count: each read carries count.v1, the record's
    // offset and from: 'A', and a record with that topic and offset came from A.
    await expect
      .poll(
        async () => {
          const records = await ofType(page, 'record');
          return (await ofType(page, 'activity')).some(
            (a) =>
              (a['id'] === 'C' || a['id'] === 'D') &&
              a['kind'] === 'read' &&
              a['topic'] === 'count.v1' &&
              a['from'] === 'A' &&
              records.some(
                (r) =>
                  r['topic'] === 'count.v1' && r['offset'] === a['offset'] && r['producer'] === 'A',
              ),
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('block-c blocks C and D, which restart together; A and B carry on', async ({ page }) => {
    await expect
      .poll(async () => new Set((await ofType(page, 'activity')).map((a) => a['id'])).size, {
        timeout: 15_000,
      })
      .toBe(4);
    await steadyLoop(basicFrame(page), 'C');
    await command(page, { v: PROTOCOL, type: 'command', act: 'block-c' });
    await expect
      .poll(
        async () =>
          new Set(
            (await ofType(page, 'state'))
              .filter((s) => s['state'] === 'blocked')
              .map((s) => s['id']),
          ),
        { timeout: 5_000 },
      )
      .toEqual(new Set(['C', 'D']));
    await expect
      .poll(async () => new Set((await ofType(page, 'crash')).map((c) => c['id'])), {
        timeout: 8_000,
      })
      .toEqual(new Set(['C', 'D']));
    const crashes = await ofType(page, 'crash');
    expect(crashes.every((c) => c['reason'] === 'unresponsive' && c['pool'] === 'shared')).toBe(
      true,
    );
    expect(await restartsIn(page, 'A')).toBe(0);
    expect(await restartsIn(page, 'B')).toBe(0);
  });

  test('crash-a restarts only A', async ({ page }) => {
    // A takes commands once it runs and has subscribed: its first report says so.
    await expect
      .poll(async () => (await ofType(page, 'activity')).some((a) => a['id'] === 'A'), {
        timeout: 15_000,
      })
      .toBe(true);
    await command(page, { v: PROTOCOL, type: 'command', act: 'crash-a' });
    await expect
      .poll(async () => (await ofType(page, 'crash')).map((c) => c['id']), { timeout: 5_000 })
      .toEqual(['A']);
    expect((await ofType(page, 'crash'))[0]?.['reason']).toBe('error');
  });

  test('reports failed past the crash-loop guard, and restart brings it back', async ({ page }) => {
    const aReports = async (): Promise<number> =>
      (await ofType(page, 'activity')).filter((a) => a['id'] === 'A').length;
    await expect.poll(aReports, { timeout: 15_000 }).toBeGreaterThan(0);
    // One crash after another: A takes commands again once it reports.
    const crash = async (n: number): Promise<void> => {
      const seen = await aReports();
      if (n > 1) await expect.poll(aReports, { timeout: 10_000 }).toBeGreaterThan(seen);
      await command(page, { v: PROTOCOL, type: 'command', act: 'crash-a' });
      await expect
        .poll(async () => (await ofType(page, 'crash')).length, { timeout: 5_000 })
        .toBe(n);
      if (n < 4) await crash(n + 1);
    };
    await crash(1);
    await expect
      .poll(async () => (await ofType(page, 'failed')).map((f) => f['id']), { timeout: 5_000 })
      .toEqual(['A']);
    // The count went up with each restart: 1, 2, 3 of 3.
    const budgets = (await ofType(page, 'budget')).filter(
      (b) => b['id'] === 'A' && b['cause'] === 'crash',
    );
    expect(budgets.map((b) => b['used'])).toEqual([1, 2, 3]);
    // A restart naming an unknown isolate is ignored; one naming A brings it back.
    await command(page, { v: PROTOCOL, type: 'command', act: 'restart', id: 'Z' });
    await command(page, { v: PROTOCOL, type: 'command', act: 'restart' });
    const before = await aReports();
    await command(page, { v: PROTOCOL, type: 'command', act: 'restart', id: 'A' });
    await expect
      .poll(
        async () =>
          (await ofType(page, 'state')).some(
            (s) => s['id'] === 'A' && s['prev'] === 'failed' && s['state'] === 'restarting',
          ),
        { timeout: 5_000 },
      )
      .toBe(true);
    await expect.poll(aReports, { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test('ignores commands in another shape', async ({ page }) => {
    await expect
      .poll(async () => (await ofType(page, 'activity')).some((a) => a['id'] === 'A'), {
        timeout: 15_000,
      })
      .toBe(true);
    await command(page, { v: PROTOCOL, type: 'command', act: 'rm -rf' });
    await command(page, { type: 'command', act: 'crash-a' });
    await command(page, { v: 'isoloop-demo@2', type: 'command', act: 'crash-a' });
    await command(page, 'crash-a');
    await page.waitForTimeout(1_500);
    expect(await ofType(page, 'crash')).toEqual([]);
    expect(await restartsIn(page, 'A')).toBe(0);
  });

  test('reports a publish the bus rejected', async ({ page }) => {
    // D sends an empty note every 11 s; the schema needs at least one character.
    await expect
      .poll(
        async () =>
          (await ofType(page, 'activity')).some(
            (a) => a['id'] === 'D' && a['kind'] === 'rejected' && a['topic'] === 'note.v1',
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});

test('ignores a well-formed command from another origin', async ({ page, baseURL }) => {
  const base = baseURL ?? 'http://localhost:4793/';
  await openParent(page, new URL('demo-parent.html', base).href, './?embed=1');
  await expect.poll(async () => (await ofType(page, 'ready')).length).toBe(1);
  await expect
    .poll(async () => (await ofType(page, 'activity')).some((a) => a['id'] === 'A'), {
      timeout: 15_000,
    })
    .toBe(true);
  // A sandboxed frame has an opaque origin ("null") and isn't basic's parent:
  // its command fails both checks.
  await page.evaluate((protocol) => {
    const sandbox = document.createElement('iframe');
    sandbox.setAttribute('sandbox', 'allow-scripts');
    sandbox.srcdoc =
      `<script>parent.frames[0].postMessage({ v: '${protocol}', type: 'command', act: 'crash-a' }, '*');</` +
      `script>`;
    document.body.append(sandbox);
  }, PROTOCOL);
  await page.waitForTimeout(2_000);
  expect(await ofType(page, 'crash')).toEqual([]);
  expect(await restartsIn(page, 'A')).toBe(0);
});

test('standalone, basic reports nothing and its isolates wait for clicks', async ({ page }) => {
  await page.goto('./');
  const a = page.locator('section[data-isolate="A"]');
  await expect(a.locator('.status')).toContainText('loop ok', { timeout: 15_000 });
  await page.waitForTimeout(1_500);
  await expect(a.locator('.big')).toHaveText('0');
});
