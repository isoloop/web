// The Module Federation instance, used by the page and by each isolate's
// bootstrap. The host provides React to the share scope, so a remote that
// shares React uses this copy instead of downloading its own.
import { createInstance } from '@module-federation/runtime';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';

export const REMOTES = {
  vite: { name: 'vite_remote', entry: 'http://localhost:5181/remoteEntry.js', type: 'module' },
  rsbuild: {
    name: 'rsbuild_remote',
    entry: (import.meta.env.VITE_RSBUILD_ENTRY as string | undefined) ?? 'http://localhost:5182/remoteEntry.js',
    type: (import.meta.env.VITE_RSBUILD_TYPE as string | undefined) ?? 'module',
  },
} as const;

const share = (lib: unknown) => ({
  version: React.version,
  lib: () => lib,
  shareConfig: { singleton: true, requiredVersion: '^19.3.0' },
});

export function federation(which: keyof typeof REMOTES) {
  const r = REMOTES[which];
  return createInstance({
    name: 'shop_host',
    remotes: [{ name: r.name, entry: r.entry, type: r.type }],
    shared: {
      react: share(React),
      'react-dom': share(ReactDOM),
      'react-dom/client': share(ReactDOMClient),
      'react/jsx-runtime': share(JsxRuntime),
    },
  });
}
