import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { defineConfig } from 'vite';

// The widget harness (e2e/harness): a minimal Isoloop page for widget.spec.ts.
export default defineConfig({
  root: fileURLToPath(new URL('./harness', import.meta.url)),
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  plugins: [isoloop()],
  base: './',
  worker: { format: 'es' },
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
});
