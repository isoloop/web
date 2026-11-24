// A copy of a workload as a headless isolate. It carries its count across a
// balancer move: the count and the window come back from the bus.
import { defineIsolate } from '@isoloop/runtime';
import { counts, ready, results, windowTopic } from '../contracts.ts';
import { prepare, runFor, wallNow, type BenchWindow } from '../harness.ts';

export interface BenchConfig {
  workload: string;
  seed: number;
  batch: number;
}

const PUBLISH_MS = 1000;

export default defineIsolate({
  start(ctx) {
    const cfg = ctx.config as BenchConfig;
    const life = Math.random().toString(36).slice(2, 10);
    let stopped = false;
    ctx.onShutdown(() => {
      stopped = true;
    });

    // What earlier lives counted: the largest count not from this life.
    let baseOps = 0;
    let baseIndex = 1;
    // Starts so far, this one included. The counts topic is compacted, so the
    // replay holds only the latest life's record, which carries its own count.
    let lives = 1;
    ctx.bus.subscribe(
      counts,
      (r) => {
        if (r.key !== ctx.id || r.value.life === life) return;
        lives = Math.max(lives, r.value.lives + 1);
        baseOps = Math.max(baseOps, r.value.ops);
        baseIndex = Math.max(baseIndex, r.value.index);
      },
      { from: 'earliest' },
    );

    const prepared = prepare(cfg.workload, cfg.seed);
    let running = false;
    const run = async (win: BenchWindow): Promise<void> => {
      if (running) return;
      running = true;
      let mine = 0;
      let lastPublish = 0;
      const publishCount = (ops: number, index: number): void => {
        mine = ops;
        void ctx.bus.publish(counts, {
          key: ctx.id,
          value: { life, lives, ops: baseOps + ops, index: baseIndex + index },
        });
      };
      const result = await runFor({
        prepared,
        batch: cfg.batch,
        window: win,
        stopped: () => stopped,
        onSlice(ops, index) {
          const t = wallNow();
          if (t - lastPublish >= PUBLISH_MS) {
            lastPublish = t;
            publishCount(ops, index);
          }
        },
      });
      if (stopped) return;
      publishCount(result.ops, 0);
      const ops = baseOps + mine;
      const windowMs = win.endAt - win.startAt;
      await ctx.bus.publish(results, {
        value: {
          id: ctx.id,
          life,
          lives,
          result: { ...result, ops, opsPerMin: (ops * 60_000) / windowMs },
        },
      });
    };

    ctx.bus.subscribe(
      windowTopic,
      (r) => {
        // Let the counts' replay land first, then run.
        setTimeout(() => void run(r.value), 0);
      },
      { from: 'earliest' },
    );
    void ctx.bus.publish(ready, { value: { id: ctx.id, life, checksum: prepared.checksum } });
  },
});
