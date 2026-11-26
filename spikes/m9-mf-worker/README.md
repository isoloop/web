# M9 spike: Module Federation inside an Isoloop worker

Throwaway code for the spike in isoloop/isoloop `docs/plans/m9-module-federation.md`. It's never merged; the write-up is `docs/plans/m9-spike.md` in isoloop/isoloop.

- `remote-vite/`: a React remote built with `@module-federation/vite`, exposing `./Hello` and `./Hello.isolate` (`defineIsolate` around the same component).
- `remote-rsbuild/`: the same remote built with Rsbuild and `@module-federation/rsbuild-plugin`, as an ESM `remoteEntry.js` (`RS_ESM=0` builds the default `var` entry, which fails in a worker).
- `host/`: a Vite host with `@isoloop/vite`. `?mode=main` loads `./Hello` with the MF runtime on the page; `?mode=isolate` spawns `boot-vite.ts` or `boot-rsbuild.ts`, an isolate that starts the MF runtime in the worker and hands over the remote's `./Hello.isolate`. `?remote=plain` is a React isolate with no MF, as a baseline.
- `serve.mjs`: the three builds on ports 5180–5182 (and `cross/` on 5183), with the CSP as a header on the host. `WORKER_SRC_REMOTES=1` adds the remotes to `worker-src`; `CSP=off` sends none; `COI=1` makes the host cross-origin isolated for memory figures.

```sh
pnpm install --ignore-workspace
pnpm build
node serve.mjs &              # or WORKER_SRC_REMOTES=1 node serve.mjs
node probe.mjs                # every engine × remote × mode
node cross.mjs                # a plain cross-origin isolate, static and dynamic import
COI=1 WORKER_SRC_REMOTES=1 node serve.mjs & node mem.mjs   # memory per worker, Chromium
node timing.mjs               # time to first render
```
