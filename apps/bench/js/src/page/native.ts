import { prepare, runFor, type Prepared } from '../harness.ts';
import type { CopySpec, Runner } from './types.ts';

/** Every copy on the page's main thread, interleaved slice by slice. */
export function nativeMain(copies: CopySpec[]): Runner {
  let prepared: Prepared[] = [];
  return {
    events: [],
    poolsAtEnd: () => ({}),
    async ready() {
      prepared = copies.map((c) => prepare(c.workload, c.seed));
      return prepared.map((p) => p.checksum);
    },
    async run(window) {
      const results = await Promise.all(
        prepared.map((p, k) => runFor({ prepared: p, batch: copies[k]!.batch, window })),
      );
      return results.map((result) => ({ result, lives: 1 }));
    },
  };
}

/** One plain module Worker per copy. */
export function nativeWorker(copies: CopySpec[]): Runner {
  const workers = copies.map(
    () => new Worker(new URL('./native-worker.ts', import.meta.url), { type: 'module' }),
  );
  const next = (w: Worker, kind: string): Promise<any> =>
    new Promise((resolve, reject) => {
      const on = (e: MessageEvent): void => {
        if (e.data?.kind !== kind) return;
        w.removeEventListener('message', on);
        resolve(e.data);
      };
      w.addEventListener('message', on);
      w.addEventListener('error', (e) => reject(new Error(e.message)), { once: true });
    });
  return {
    events: [],
    poolsAtEnd: () => ({}),
    async ready() {
      const replies = workers.map((w, k) => {
        const p = next(w, 'ready');
        const c = copies[k]!;
        w.postMessage({ kind: 'prepare', workload: c.workload, seed: c.seed, batch: c.batch });
        return p;
      });
      return (await Promise.all(replies)).map((r: { checksum: number }) => r.checksum);
    },
    async run(window) {
      const replies = workers.map((w) => {
        const p = next(w, 'result');
        w.postMessage({ kind: 'run', window });
        return p;
      });
      const out = await Promise.all(replies);
      for (const w of workers) w.terminate();
      return out.map((r: { result: any }) => ({ result: r.result, lives: 1 }));
    },
  };
}
