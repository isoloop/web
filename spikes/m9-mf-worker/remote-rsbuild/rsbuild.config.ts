import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  root: import.meta.dirname,
  source: { entry: { index: './src/empty.ts' } },
  output: { assetPrefix: 'http://localhost:5182/', distPath: { root: 'dist' }, cleanDistPath: true, module: process.env.RS_ESM !== '0' },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'rsbuild_remote',
      filename: 'remoteEntry.js',
      ...(process.env.RS_ESM !== '0' ? { library: { type: 'module' } } : {}),
      exposes: { './Hello': './src/Hello.tsx', './Hello.isolate': './src/Hello.isolate.tsx' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.3.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.3.0' },
        // @isoloop/react imports react-dom/client; without this the isolate
        // downloads its own copy (208 kB) instead of the host's.
        ...(process.env.RS_SHARE_CLIENT === '0' ? {} : { 'react-dom/client': { singleton: true, requiredVersion: '^19.3.0' }, 'react/jsx-runtime': { singleton: true, requiredVersion: '^19.3.0' } }),
      },
    }),
  ],
});
