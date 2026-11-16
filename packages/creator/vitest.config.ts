import { defineConfig } from 'vitest/config';

// Unit tests sit next to the code in src/.
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] } });
