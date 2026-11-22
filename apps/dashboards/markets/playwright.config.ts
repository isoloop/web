import { defineConfig, devices } from '@playwright/test';
import { DEV_MCP, DEV_MCP_PORT, DEV_PORT, DEV_URL } from './e2e/dev-server';

// Both builds, served by `vite preview` from dist/ (/isoloop/ and /native/), in
// all three engines.
const ENGINES = [
  ['chromium', 'Desktop Chrome'],
  ['firefox', 'Desktop Firefox'],
  ['webkit', 'Desktop Safari'],
] as const;
const LOAD = /(stress|table|budget)\.spec\.ts$/;
const COMPARISON = /comparison\.spec\.ts$/;
const LIVE = process.env['LIVE_URL'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  // LIVE_URL runs the smoke test against a deployed copy (after each deploy)
  // instead of the local build.
  use: { baseURL: LIVE ?? 'http://localhost:4791' },
  ...(LIVE
    ? {}
    : {
        webServer: [
          {
            command: 'pnpm build && pnpm preview --port 4791 --strictPort',
            timeout: 120_000,
            url: 'http://localhost:4791',
            reuseExistingServer: !process.env['CI'],
          },
          // The dev MCP suite's development server, paired with the CLI it starts.
          {
            command: `pnpm dev --port ${DEV_PORT} --strictPort`,
            timeout: 120_000,
            url: DEV_URL,
            reuseExistingServer: !process.env['CI'],
            env: {
              VITE_ISOLOOP_MCP_TOKEN: DEV_MCP.token,
              VITE_ISOLOOP_MCP_URL: `ws://127.0.0.1:${DEV_MCP_PORT}`,
            },
          },
        ],
      }),
  // Each engine has two projects. `<engine>-load` holds the tests that measure
  // timing under load (input latency within the 200 ms budget, the table at
  // 3,000 trades/s). CI runs it alone with --workers=1 after the rest, so those
  // tests don't share the runner's cores with other pages.
  // `comparison` and `comparison-firefox` are the head-to-head comparison
  // (M3f, comparison/run.ts): one page at a time, on demand
  // (.github/workflows/comparison.yml), never in the default run.
  projects: [
    ...ENGINES.flatMap(([name, device]) => [
      { name, use: { ...devices[device] }, testIgnore: [LOAD, COMPARISON] },
      { name: `${name}-load`, use: { ...devices[device] }, testMatch: LOAD },
    ]),
    { name: 'comparison', use: { ...devices['Desktop Chrome'] }, testMatch: COMPARISON },
    {
      name: 'comparison-firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: COMPARISON,
    },
    { name: 'live', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke\.spec\.ts$/ },
  ],
});
