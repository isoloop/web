import { defineConfig, devices } from '@playwright/test';

// The three builds, served by `vite preview` from dist/ (/isoloop/, /native/,
// /native-workers/), in all three engines.
const ENGINES = [
  ['chromium', 'Desktop Chrome'],
  ['firefox', 'Desktop Firefox'],
  ['webkit', 'Desktop Safari'],
] as const;
const LOAD = /(budget)\.spec\.ts$/;
const COMPARISON = /comparison\.spec\.ts$/;
// The interactive page's measured run (M3e decision 22), on demand too.
const INTERACTIVE = /interactive-compare\.spec\.ts$/;
const LIVE = process.env['LIVE_URL'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  // LIVE_URL runs the smoke test against a deployed copy (after each deploy)
  // instead of the local build.
  use: { baseURL: LIVE ?? 'http://localhost:4792' },
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: 'pnpm build && pnpm preview --port 4792 --strictPort',
          timeout: 180_000,
          url: 'http://localhost:4792',
          reuseExistingServer: !process.env['CI'],
        },
      }),
  // As in the markets app: `<engine>-load` holds the tests that measure timing
  // under load; CI runs it alone with --workers=1 after the rest. `comparison`
  // is the recorded comparison (M3d task 11), on demand, never in the default
  // run.
  projects: [
    ...ENGINES.flatMap(([name, device]) => [
      { name, use: { ...devices[device] }, testIgnore: [LOAD, COMPARISON, INTERACTIVE] },
      { name: `${name}-load`, use: { ...devices[device] }, testMatch: LOAD },
    ]),
    // With `PLANT_COI=1` (the inspection feed's cost, M4b task 6) the run uses
    // full Chromium rather than the headless shell, which has no
    // `measureUserAgentSpecificMemory()`, so the feed measures memory.
    {
      name: 'comparison',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env['PLANT_COI'] === '1' ? { channel: 'chromium' } : {}),
      },
      testMatch: COMPARISON,
    },
    {
      name: 'comparison-firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: COMPARISON,
    },
    { name: 'comparison-webkit', use: { ...devices['Desktop Safari'] }, testMatch: COMPARISON },
    {
      name: 'interactive-comparison',
      use: { ...devices['Desktop Chrome'] },
      testMatch: INTERACTIVE,
    },
    {
      name: 'interactive-comparison-firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: INTERACTIVE,
    },
    { name: 'live', use: { ...devices['Desktop Chrome'] }, testMatch: /smoke\.spec\.ts$/ },
  ],
});
