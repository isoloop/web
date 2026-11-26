// The bootstrap isolate for the rsbuild remote: the kernel imports this module in
// the worker; it starts the Module Federation runtime there, loads the
// remote's `./Hello.isolate` and hands its definition to the runtime.
import { federation, REMOTES } from './federation';

const t0 = performance.now();
const mf = federation('rsbuild');
const mod = await mf.loadRemote<{ default: { start(ctx: unknown): unknown; requires?: string } }>(
  `${REMOTES.rsbuild.name}/Hello.isolate`,
);
if (!mod) throw new Error('loadRemote returned nothing');
const loadMs = performance.now() - t0;
const def = mod.default;
export default {
  ...(def.requires ? { requires: def.requires } : {}),
  start(ctx: unknown) {
    (self as unknown as { __mfLoadMs: number }).__mfLoadMs = loadMs;
    return def.start(ctx);
  },
};
