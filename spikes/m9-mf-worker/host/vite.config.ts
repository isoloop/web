import { isoloop } from '@isoloop/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [isoloop()],
  worker: { format: 'es' },
  build: { outDir: 'dist', target: 'es2023', emptyOutDir: true },
});
