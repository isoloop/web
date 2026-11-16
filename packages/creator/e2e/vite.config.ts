import { fileURLToPath } from 'node:url';
import { isoloop } from '@isoloop/vite';
import { defineConfig } from 'vite';

// The harness (e2e/harness): a minimal Isoloop page for widget.spec.ts and
// board.spec.ts (index.html), and the board's native page (native.html).
export default defineConfig({
  root: fileURLToPath(new URL('./harness', import.meta.url)),
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  plugins: [isoloop()],
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./harness/index.html', import.meta.url)),
        native: fileURLToPath(new URL('./harness/native.html', import.meta.url)),
      },
    },
  },
});
