import { isoloop } from '@isoloop/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [isoloop()],
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2024' },
});
