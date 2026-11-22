import { defineConfig } from 'vitest/config';

// Unit tests for the build-time code (build/): the pages, hub and diagrams
// plugins. Pages are Preact, rendered at build time only (ADR 0003). And the
// pure modules the pages' scripts use (src/search: the docs' search).
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  test: { include: ['build/**/*.test.ts', 'build/**/*.test.tsx', 'src/search/**/*.test.ts'] },
});
