import { defineConfig, devices } from '@playwright/test';

// The widget isolate on a real kernel (e2e/harness), served by `vite preview`,
// in all three engines. The `-load` projects exist because CI runs one per
// engine; there are no timing tests here.
const ENGINES = [
  ['chromium', 'Desktop Chrome'],
  ['firefox', 'Desktop Firefox'],
  ['webkit', 'Desktop Safari'],
] as const;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4794/' },
  webServer: {
    command: 'pnpm build:harness && pnpm preview:harness --port 4794 --strictPort',
    timeout: 120_000,
    url: 'http://localhost:4794/',
    reuseExistingServer: !process.env['CI'],
  },
  projects: ENGINES.flatMap(([name, device]) => [
    { name, use: { ...devices[device] } },
    { name: `${name}-load`, use: { ...devices[device] }, testMatch: /^$/ },
  ]),
});
