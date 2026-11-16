import { defineConfig, devices } from '@playwright/test';

// processor, served by `vite preview` from dist/, in all three engines. LIVE_URL
// runs the smoke test against the deployed copy instead (after each deploy).
// The `-load` projects exist because CI runs one per engine for every app;
// processor has no timing-under-load tests.
const ENGINES = [
  ['chromium', 'Desktop Chrome'],
  ['firefox', 'Desktop Firefox'],
  ['webkit', 'Desktop Safari'],
] as const;
const SMOKE = /smoke\.spec\.ts$/;
const COMPARISON = /comparison\.spec\.ts$/;
const LIVE = process.env['LIVE_URL'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: LIVE ?? 'http://localhost:4796/' },
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: 'pnpm build && pnpm preview --port 4796 --strictPort',
          timeout: 120_000,
          url: 'http://localhost:4796/',
          reuseExistingServer: !process.env['CI'],
        },
      }),
  projects: [
    ...ENGINES.flatMap(([name, device]) => [
      { name, use: { ...devices[device] }, testIgnore: [SMOKE, COMPARISON] },
      { name: `${name}-load`, use: { ...devices[device] }, testMatch: /^$/ },
    ]),
    { name: 'live', use: { ...devices['Desktop Chrome'] }, testMatch: SMOKE },
    // The placements compared (M3h decision 23, comparison/run.ts): one page
    // at a time, on demand, never in the default run.
    { name: 'comparison', use: { ...devices['Desktop Chrome'] }, testMatch: COMPARISON },
    {
      name: 'comparison-firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: COMPARISON,
    },
  ],
});
