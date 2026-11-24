import { defineConfig, devices } from '@playwright/test';

// The three builds, served by `vite preview` from dist/ (/isoloop/, /native/,
// /native-workers/). One spec, e2e/comparison.spec.ts, run by run.ts one page
// at a time, once per engine. Playwright's browsers come from the image
// (Dockerfile), at @playwright/test's exact version.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4793' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4793 --strictPort',
    timeout: 180_000,
    url: 'http://localhost:4793',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'comparison', use: { ...devices['Desktop Chrome'] } },
    { name: 'comparison-firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'comparison-webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
