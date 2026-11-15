import { defineConfig } from 'vitest/config';

// Unit tests sit next to the code in src/ and comparison/; e2e/ is Playwright's.
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'comparison/**/*.test.ts'] },
});
