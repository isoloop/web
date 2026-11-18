import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { expect, test, type Page } from '@playwright/test';
import { alertCreated, quoteReply, type QuoteReply } from '../src/core/schemas';
import { DEV_MCP, DEV_MCP_PORT, DEV_URL } from './dev-server';

// The markets tools through the dev MCP (M4a task 10): the official MCP SDK
// client ↔ the real `isoloop mcp` CLI ↔ the markets page in development,
// where it calls connectDevMCP. Chromium only: the CLI and the page side are
// the same code in every engine. The WebMCP side comes with M4a task 9.

// The CLI's bin, from the `isoloop` package this app depends on.
const CLI = createRequire(import.meta.url).resolve('isoloop/dist/cli.js');

test.describe.configure({ mode: 'serial' });

test.beforeAll(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'the dev MCP suite runs in Chromium');
});

type Text = { type: string; text?: string };
type CallResult = { content: Text[]; structuredContent?: unknown; isError?: boolean };

/** Starts `isoloop mcp` with an SDK client on its stdio. */
async function startCli(allowWrite: boolean): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI, 'mcp', '--port', String(DEV_MCP_PORT), ...(allowWrite ? ['--allow-write'] : [])],
    env: { ...process.env, ISOLOOP_MCP_TOKEN: DEV_MCP.token },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'markets-e2e', version: '0' });
  await client.connect(transport);
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the SDK's result type for tools/call
  (await client.callTool({ name, arguments: args })) as CallResult;

/** A tool's JSON text, as the shape the test expects (the assertions check it). */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- names the shape at each call
const json = <T>(r: CallResult): T =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the expect calls check the shape
  JSON.parse(r.content[0]?.text ?? 'null') as T;

/** Opens the page in development and waits until it's paired with the CLI. */
async function open(page: Page, client: Client): Promise<void> {
  await page.goto(`${DEV_URL}?size=lite&speed=10`);
  // The page is up once a widget shows (Vite may reload it once on a first
  // visit, while it optimizes dependencies), then it pairs.
  await expect(page.locator('[data-slot="alerts-panel"] .alerts')).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => json<{ pages: unknown[] }>(await call(client, 'isoloop_pages')).pages.length,
      {
        timeout: 30_000,
      },
    )
    .toBe(1);
}

/** Polls the quote tool until the aggregator has trades in its window. */
async function quote(client: Client) {
  let last: QuoteReply | undefined;
  await expect
    .poll(
      async () => {
        // A page that's reloading has no tools for a moment: try again.
        const r = await call(client, 'markets.quote.v1', { symbol: 'BTC-USD' }).catch(
          () => undefined,
        );
        if (r === undefined || r.isError) return 'error';
        last = quoteReply.parse(r.structuredContent);
        return last.aggregate === null ? 'empty' : 'ok';
      },
      { timeout: 30_000 },
    )
    .toBe('ok');
  return last;
}

test('lists both tools, answers a quote, and keeps create behind --allow-write', async ({
  page,
}) => {
  const client = await startCli(false);
  try {
    await open(page, client);
    const tools = (await client.listTools()).tools;
    const quoteTool = tools.find((t) => t.name === 'markets.quote.v1');
    expect(quoteTool?.annotations).toMatchObject({ readOnlyHint: true });
    expect(quoteTool?.inputSchema).toMatchObject({
      type: 'object',
      properties: { symbol: { enum: expect.arrayContaining(['BTC-USD']) } },
    });
    // Not read-only, so the CLI lists it only with --allow-write (M4a decision 12).
    expect(tools.map((t) => t.name)).not.toContain('markets.alerts.create.v1');

    const q = await quote(client);
    expect(q?.symbol).toBe('BTC-USD');
    expect(q?.aggregate?.vwap).toBeGreaterThan(0);
    expect(q?.prices.length).toBeGreaterThan(0);

    // The read tools see the page's isolates, including the two that answer.
    const isolates = json<{ isolates: { id: string; state: string }[] }>(
      await call(client, 'isoloop_isolates'),
    );
    const ids = isolates.isolates.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['aggregator', 'alerts']));
  } finally {
    await client.close();
  }
});

test('creates an alert rule that shows in the panel and fires', async ({ page }) => {
  const client = await startCli(true);
  try {
    await open(page, client);
    const tools = (await client.listTools()).tools;
    const create = tools.find((t) => t.name === 'markets.alerts.create.v1');
    expect(create?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });

    const r = await call(client, 'markets.alerts.create.v1', {
      symbol: 'BTC-USD',
      metric: 'price',
      op: 'above',
      threshold: 1,
    });
    expect(r.isError).toBeFalsy();
    const created = alertCreated.parse(r.structuredContent);
    expect(created.created).toBe(true);
    expect(created.id).toMatch(/^agent-/);

    // The rule is the alerts panel's like any other: listed, and it fires.
    const panel = page.locator('[data-slot="alerts-panel"] .alerts');
    await expect(panel.locator('.rules li')).toHaveCount(1);
    await expect(panel.locator('.fired li').first()).toContainText('BTC-USD price above 1', {
      timeout: 15_000,
    });

    // The request went through with `via: 'mcp'` (ADR 0018, decision 4).
    const recs = json<{ records: { req?: { via?: string } }[] }>(
      await call(client, 'isoloop_records', { topic: 'markets.alerts.create.v1', last: 5 }),
    );
    expect(recs.records.at(-1)?.req?.via).toBe('mcp');
  } finally {
    await client.close();
  }
});
