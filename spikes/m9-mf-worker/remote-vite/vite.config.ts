import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: 'http://localhost:5181/',
  plugins: [
    federation({
      name: 'vite_remote',
      filename: 'remoteEntry.js',
      exposes: { './Hello': './src/Hello.tsx', './Hello.isolate': './src/Hello.isolate.tsx' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.3.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.3.0' },
      },
    }),
  ],
  build: { outDir: 'dist', target: 'es2023', minify: true, emptyOutDir: true },
});
