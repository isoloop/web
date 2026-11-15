# Markets dashboard, final server run

The M3f head-to-head, run on the bench server on 2026-11-15. This page records how it was run; the write-up comes separately. The tables are in [`results/summary.md`](results/summary.md) and the raw figures in `results/<engine>/*.json`.

## The pairs

- **native** (everything on the main thread) against **Isoloop `one`** (every isolate in one pool): 0 workers against 1 + bus.
- **native + workers** (the replay, the aggregator, alerts and the three engines in a worker each, the widgets on the main thread) against **Isoloop `matched`** (those six as their own workers, plus one visual pool for every widget): 6 workers against 7 + bus.
- **Isoloop `own`** (a worker per isolate, the live page's default) measured alongside: 22 + bus at Normal, 30 + bus at Heavy.

## How it was measured

- **Machine:** the same home server as the plant's [final run](../../../plant/comparison/final/README.md), doing nothing else: AMD Ryzen 7 5825U (8 cores, 16 threads), 30 GB, Ubuntu 24.04.3, kernel 6.8.0-147, Docker 28.5.1. The other containers were paused, the governor was set to `performance`, and every core was fixed at 2.0 GHz.
- **Container:** Playwright's official image `v1.64.1-noble` with Node 26.13.0 and pnpm 12.16.1 ([the plant's Dockerfile](../../../plant/comparison/Dockerfile)), pinned with `--cpuset-cpus=2,4,6,8` to four physical cores, one thread each.
- **Code:** `isoloop/web` at `5770597` (#100), with `@isoloop/*@0.0.0-next.b8ffdcf`, the libraries `plant-v0.1.0` ships.
- **Runs:** [`../run.ts`](../run.ts) on `packages/compare`, 5 rounds, each pair interleaved (A, B, A, B…), one page at a time; the gap is B − A within each round. Chromium and Firefox, Normal and Heavy, the replay at its own rate (`speed=1`), seed 7. No 10-minute hold. 100 runs, none stopped; about 46 minutes.
- **What each figure covers:** the header of [`../../e2e/comparison.spec.ts`](../../e2e/comparison.spec.ts). Recovery is from the click on the price chart's block control (a 3 s busy loop in the chart's own code) until the chart's first draw after the pause; markets sets no `heartbeat.killAfterMs`, so every build waits the 3 s out. Memory and CPU are Chromium only.

To rerun it, from a clone of `isoloop/web`:

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g \
  -v "$PWD":/work -w /work plant-compare \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/dashboards/markets compare:pairs \
    --pair native=isoloop:one --pair native-workers=isoloop:matched \
    --extra isoloop:own --sizes normal,heavy --rounds 5 --hold 0 \
    --engines chromium,firefox --out comparison/final/results'
```
