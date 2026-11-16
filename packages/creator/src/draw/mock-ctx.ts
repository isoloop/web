// A 2D context that records what is drawn, for tests.
import type { Ctx2D } from './ctx';

export interface Recorded {
  ctx: Ctx2D;
  calls: { name: string; args: unknown[]; fillStyle: unknown }[];
  /** The calls named `name`. */
  named: (name: string) => unknown[][];
}

export function recordingCtx(): Recorded {
  const calls: Recorded['calls'] = [];
  const state: Record<string, unknown> = {};
  const proxy = new Proxy(state, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push({ name: key, args, fillStyle: target['fillStyle'] });
      };
    },
    set(target, key, value) {
      if (typeof key === 'string') target[key] = value;
      return true;
    },
  });
  return {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the proxy answers every method a 2D context has
    ctx: proxy as unknown as Ctx2D,
    calls,
    named: (name) => calls.filter((c) => c.name === name).map((c) => c.args),
  };
}
