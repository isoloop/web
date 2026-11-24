// The Isoloop placements: own pools, one pool, or the balancer. Loaded only
// for these, so the native pages start no kernel and no bus worker.
import { createBalancer } from '@isoloop/balancer';
import { createKernel } from '@isoloop/host';
import workers from 'virtual:isoloop/workers';
import list, { counts, ready, results, TOPIC_NAMES } from '../contracts.ts';
import contractsUrl from '../contracts.ts?isolate';
import benchSrc from '../isolates/bench.ts?isolate';
import { wallNow, type CopyResult } from '../harness.ts';
import type { BalancerEvent, CopySpec, Placement, Runner } from './types.ts';
import { windowTopic } from '../contracts.ts';

const ONE = 'bench-one';

export function isoloop(placement: Placement, copies: CopySpec[], maxWorkers: number): Runner {
  const kernel = createKernel({
    contracts: { url: contractsUrl, list },
    workers,
    // Heavy ops hold a loop for hundreds of ms; never kill a busy pool.
    heartbeat: { killAfterMs: 30_000 },
    routing: false,
  });
  const balancer =
    placement === 'isoloop-balancer' ? createBalancer(kernel, { maxWorkers }) : undefined;
  const events: BalancerEvent[] = [];
  let startAt = Number.NaN;
  const at = (): number => wallNow() - startAt;
  const ev = (kind: BalancerEvent['kind'], id: string, detail: Record<string, unknown>): void => {
    events.push({ at: Number.isNaN(startAt) ? Number.NEGATIVE_INFINITY : at(), kind, id, detail });
  };
  if (balancer) {
    balancer.on('move', (e) => ev('move', e.id, { from: e.from, to: e.to, reason: e.reason }));
    balancer.on('arrived', (e) =>
      ev('arrived', e.id, { from: e.from, to: e.to, costMs: e.costMs }),
    );
    balancer.on('spike', (e) =>
      ev('spike', e.id, { pool: e.pool, lagMs: e.lagMs, action: e.action }),
    );
    balancer.on('behind', (e) => ev('behind', e.id, { pool: e.pool, backlog: e.backlog }));
    balancer.on('failed', (e) => ev('failed', e.id, { pool: e.pool, reason: e.reason }));
  }
  kernel.on('isolate:crash', (e) =>
    ev('crash', e.id, { reason: e.reason, pool: e.pool, message: e.message }),
  );
  const warmStart = wallNow();
  // Starts per copy, the first included: every move or restart fires another.
  const starts = new Map<string, number>();
  kernel.on('isolate:ready', (e) => starts.set(e.id, (starts.get(e.id) ?? 0) + 1));

  const checksums = new Map<string, number>();
  const finals = new Map<string, { lives: number; result: CopyResult }>();
  const lastCount = new Map<string, number>();
  let onReady: (() => void) | undefined;
  let onFinal: (() => void) | undefined;
  kernel.subscribe(
    ready,
    (r) => {
      if (!checksums.has(r.value.id)) checksums.set(r.value.id, r.value.checksum);
      if (checksums.size === copies.length) onReady?.();
    },
    { from: 'earliest' },
  );
  kernel.subscribe(
    results,
    (r) => {
      finals.set(r.value.id, { lives: r.value.lives, result: r.value.result });
      if (finals.size === copies.length) onFinal?.();
    },
    { from: 'earliest' },
  );
  kernel.subscribe(
    counts,
    (r) => {
      if (r.key) lastCount.set(r.key, r.value.ops);
    },
    { from: 'latest' },
  );

  for (const c of copies) {
    const manifest = {
      id: c.id,
      src: benchSrc,
      config: { workload: c.workload, seed: c.seed, batch: c.batch },
      grants: { publish: TOPIC_NAMES, subscribe: TOPIC_NAMES },
    };
    if (balancer) balancer.spawn(manifest);
    else if (placement === 'isoloop-one') kernel.spawn({ ...manifest, pool: ONE });
    else kernel.spawn(manifest);
  }

  const pools: Record<string, string> = {};
  return {
    events,
    poolsAtEnd: () => pools,
    ready() {
      return new Promise((resolve) => {
        const done = (): void => resolve(copies.map((c) => checksums.get(c.id) ?? Number.NaN));
        onReady = done;
        if (checksums.size === copies.length) done();
      });
    },
    async run(window) {
      startAt = window.startAt;
      for (const e of events) if (e.at === Number.NEGATIVE_INFINITY) e.at = warmStart - startAt;
      await kernel.publish(windowTopic, { key: 'window', value: window });
      await new Promise<void>((resolve) => {
        onFinal = resolve;
        if (finals.size === copies.length) resolve();
        // A copy moved or restarted near the end may never send its final: fall back to its count.
        setTimeout(resolve, window.endAt - wallNow() + 20_000);
      });
      if (balancer) for (const p of balancer.placements()) pools[p.id] = p.pool;
      else for (const c of copies) pools[c.id] = placement === 'isoloop-one' ? ONE : c.id;
      const windowMs = window.endAt - window.startAt;
      return copies.map((c) => {
        const f = finals.get(c.id);
        if (f) return { result: f.result, lives: starts.get(c.id) ?? f.lives };
        const ops = lastCount.get(c.id);
        return {
          lives: starts.get(c.id) ?? 0,
          result:
            ops === undefined
              ? null
              : {
                  ops,
                  opsPerMin: (ops * 60_000) / windowMs,
                  opP50Us: null,
                  opP95Us: null,
                  batches: 0,
                  checksum: Number.NaN,
                },
        };
      });
    },
  };
}
