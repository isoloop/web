# Markets dashboard, final server run

The figures that ship with `markets-v0.3.0`: the M3f head-to-head, run on the bench server on 2026-11-15. The full tables are in [`results/summary.md`](results/summary.md) and the raw figures in `results/<engine>/*.json`. They replace the [M3b and M3c recording](../README.md), which compared native on one thread with Isoloop on a worker per isolate.

## TL;DR

- **What Isoloop gains:** a free main thread, 21–23% busy against 83–100%. At Heavy that's the difference between dropping a third of the frames and dropping none. Typing improves by 12–115 ms at Heavy; at Normal on Chromium it's 4–7 ms slower.
- **What it costs, every time:**
  - CPU across threads: +4 to +29 points.
  - Memory after GC: +33 to +52 MB.
  - First data: 125–506 ms later.
  - Every widget filled: 52–426 ms later.
- **Native + workers doesn't help native's main thread.** It's at 86% against 83%, and still 100% at Heavy, because the widgets stay on the main thread.
- **Recovery after a block is a tie, within about 130 ms on Chromium.** Every build waits out the full 3 s block, so this figure doesn't separate them. The one exception is Firefox `one` at Heavy, which is noisy.
- **`own` is the expensive placement:**
  - Memory: 87–132 MB more than `matched`.
  - CPU at Heavy: 185% against 143%.
  - First data: 0.8–1.7 s.

  That's the price of every widget in its own worker. It's what lets a blocked chart stall only itself.

## The pairs

- **native** (everything on the main thread) against **Isoloop `one`** (every isolate in one pool): 0 workers against 1 + bus.
- **native + workers** (the replay, the aggregator, alerts and the three engines in a worker each, the widgets on the main thread) against **Isoloop `matched`** (those six as their own workers, plus one visual pool for every widget): 6 workers against 7 + bus.
- **Isoloop `own`** (a worker per isolate, the live page's default) measured alongside: 22 + bus at Normal, 30 + bus at Heavy.

## The figures, side by side

- Lower is better for every figure.
- Each Δ is B − A: the median, over the 5 rounds, of that round's gap. So it can differ by a few units from subtracting the two columns. For example, typing at Chromium Normal shows 38 − 32 = 6 ms in the columns, but the Δ is +4 ms.
- The other columns are medians of the runs.
- Late frames are out of about 600. Memory is after GC, at 16 s.
- The spread of each Δ is in the [gap tables](#gaps-and-their-spread-chromium) below.

### Chromium, Normal

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** | Isoloop `own` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 0 | 1 | +1 | 6 | 7 | +1 | 22 |
| Late frames | 0 | 0 | **0** | 0 | 0 | **0** | 0 |
| Typing | 32 ms | 38 ms | **+4 ms** | 35 ms | 41 ms | **+7 ms** | 42 ms |
| Main-thread CPU | 83% | 22% | **−61 pp** | 86% | 21% | **−65 pp** | 21% |
| CPU, all threads | 95% | 107% | **+13 pp** | 103% | 108% | **+4 pp** | 113% |
| Memory | 166 MB | 203 MB | **+34 MB** | 188 MB | 222 MB | **+33 MB** | 309 MB |
| First data | 166 ms | 358 ms | **+184 ms** | 249 ms | 383 ms | **+125 ms** | 799 ms |
| All widgets with data | 4178 ms | 4416 ms | **+241 ms** | 4275 ms | 4339 ms | **+64 ms** | 4395 ms |
| Recovery after a 3 s block | 3075 ms | 3162 ms | **+75 ms** | 3143 ms | 3090 ms | **−62 ms** | 3044 ms |

### Chromium, Heavy

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** | Isoloop `own` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 0 | 1 | +1 | 6 | 7 | +1 | 30 |
| Late frames | 172 | 0 | **−172** | 205 | 0 | **−205** | 0 |
| Typing | 52 ms | 41 ms | **−12 ms** | 156 ms | 41 ms | **−115 ms** | 41 ms |
| Main-thread CPU | 100% | 22% | **−78 pp** | 100% | 23% | **−77 pp** | 35% |
| CPU, all threads | 111% | 122% | **+12 pp** | 114% | 143% | **+29 pp** | 185% |
| Memory | 220 MB | 271 MB | **+51 MB** | 246 MB | 301 MB | **+52 MB** | 433 MB |
| First data | 174 ms | 350 ms | **+175 ms** | 362 ms | 527 ms | **+212 ms** | 963 ms |
| All widgets with data | 4228 ms | 4434 ms | **+210 ms** | 4335 ms | 4443 ms | **+52 ms** | 4450 ms |
| Recovery after a 3 s block | 3166 ms | 3312 ms | **+127 ms** | 3256 ms | 3143 ms | **−112 ms** | 3059 ms |

### Firefox, Normal

Firefox gives no CPU or memory figures.

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** | Isoloop `own` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Late frames | 5 | 0 | **−5** | 10 | 1 | **−10** | 5 |
| Typing | 120 ms | 79 ms | **−44 ms** | 103 ms | 82 ms | **−16 ms** | 67 ms |
| First data | 236 ms | 645 ms | **+376 ms** | 386 ms | 767 ms | **+384 ms** | 1226 ms |
| All widgets with data | 4235 ms | 4535 ms | **+300 ms** | 4464 ms | 4611 ms | **+127 ms** | 5007 ms |
| Recovery after a 3 s block | 3111 ms | 3143 ms | **+76 ms** | 3179 ms | 3107 ms | **−75 ms** | 3104 ms |

### Firefox, Heavy

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** | Isoloop `own` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Late frames | 206 | 0 | **−206** | 231 | 1 | **−229** | 106 |
| Typing | 176 ms | 81 ms | **−98 ms** | 150 ms | 129 ms | **−25 ms** | 127 ms |
| First data | 237 ms | 700 ms | **+408 ms** | 386 ms | 915 ms | **+506 ms** | 1725 ms |
| All widgets with data | 4257 ms | 4668 ms | **+426 ms** | 4455 ms | 4706 ms | **+253 ms** | 4913 ms |
| Recovery after a 3 s block | 3245 ms | 4434 ms | **+1189 ms**¹ | 3266 ms | 3148 ms | **−123 ms** | 3248 ms |

¹ This one is noisy: across the 5 rounds the gap ran from −149 ms to +2037 ms. Every other Δ here has a narrow spread.

## What the numbers show

On this machine (four cores at 2.0 GHz), Chromium and Firefox:

- **At Normal, neither pair differs in frames or typing on Chromium.** Every build keeps every frame. Isoloop types 4–7 ms slower, with spreads of +2 to +18 ms and 0 to +25 ms. On Firefox, the native builds drop 5–10 frames and Isoloop 0–1, and Isoloop types 16–44 ms faster.
- **At Heavy, both native builds fill the main thread.** On Chromium it's at 100%. Each native build drops 172–231 of about 600 frames, on both engines, and native + workers types in 150–156 ms. Isoloop `one` and `matched` drop 0–1 frames and type in 41 ms on Chromium, 81–129 ms on Firefox.
- **Moving the data work into workers doesn't lighten native's main thread here.** At Normal on Chromium it's 86% with workers against 83% without. The widgets are the main-thread cost, and native + workers keeps them on the main thread. Isoloop moves them off too: its main thread is at 21–23% in every placement but `own` at Heavy (35%).
- **What Isoloop costs** against the native build in its pair:
  - CPU across threads: +4 to +13 points at Normal, +12 to +29 points at Heavy.
  - Memory after GC: +33 to +52 MB.
  - First data: +125 to +212 ms on Chromium, +376 to +506 ms on Firefox.
  - All widgets with data: +52 to +426 ms.
- **Recovery after a 3 s block** is within ±130 ms of native on Chromium. Markets sets no kill timeout, so every build waits the block out. Firefox's spreads are wide: up to +2 s in single rounds.
- **"All widgets with data" takes 4.2–5.0 s on every build.** It's the slowest widget's first update. Only the gaps between builds carry information.
- **`own`, a worker per isolate (the live page's default),** costs more than `matched`, for the containment of each widget:
  - Workers: 22 and 30, against 7.
  - Memory after GC: 309 and 433 MB, against 222 and 301 MB.
  - CPU across threads at Heavy: 185% against 143%.
  - First data: 0.8–1.7 s.
  - On Firefox at Heavy, it drops 106 frames.

How these compare with the M3c recording: on GitHub's 4-core runner, native's main thread was 42–59% busy at Normal and Heavy and kept every frame. Here, with the cores fixed at 2.0 GHz, the same Heavy workload fills it. Whether native drops frames at Heavy depends on the machine.

## Gaps and their spread: Chromium

Gap B − A, median of 5 rounds, spread in brackets.

| Figure | Normal: native vs `one` | Normal: native + workers vs `matched` | Heavy: native vs `one` | Heavy: native + workers vs `matched` |
| --- | --- | --- | --- | --- |
| Workers (bus excluded) | 0 vs 1 | 6 vs 7 | 0 vs 1 | 6 vs 7 |
| Late frames | 0 (0 to 0) | 0 (−1 to 0) | −172 (−174 to −170) | −205 (−210 to −202) |
| Typing | +4 ms (+2 to +18) | +7 ms (0 to +25) | −12 ms (−56 to +19) | −115 ms (−130 to −77) |
| Main-thread CPU | −61 pp (−62 to −60) | −65 pp (−66 to −65) | −78 pp (−78 to −77) | −77 pp (−77 to −77) |
| CPU, all threads | +13 pp (+9 to +13) | +4 pp (+3 to +6) | +12 pp (+10 to +13) | +29 pp (+27 to +29) |
| Memory after GC | +34 MB (+32 to +41) | +33 MB (+30 to +34) | +51 MB (+44 to +56) | +52 MB (+51 to +55) |
| First data | +184 ms (+156 to +195) | +125 ms (+93 to +174) | +175 ms (+152 to +207) | +212 ms (+78 to +253) |
| All widgets with data | +241 ms (+230 to +252) | +64 ms (+53 to +75) | +210 ms (+206 to +247) | +52 ms (+28 to +112) |
| Recovery after a 3 s block | +75 ms (+39 to +94) | −62 ms (−87 to −53) | +127 ms (+117 to +201) | −112 ms (−151 to −94) |

## Gaps and their spread: Firefox

No CPU or memory figures on Firefox.

| Figure | Normal: native vs `one` | Normal: native + workers vs `matched` | Heavy: native vs `one` | Heavy: native + workers vs `matched` |
| --- | --- | --- | --- | --- |
| Late frames | −5 (−11 to −3) | −10 (−14 to −8) | −206 (−228 to −203) | −229 (−231 to −227) |
| Typing | −44 ms (−50 to +11) | −16 ms (−50 to 0) | −98 ms (−100 to −74) | −25 ms (−68 to +15) |
| First data | +376 ms (+234 to +452) | +384 ms (+353 to +413) | +408 ms (+320 to +543) | +506 ms (+492 to +533) |
| All widgets with data | +300 ms (+102 to +379) | +127 ms (+69 to +293) | +426 ms (+381 to +491) | +253 ms (+207 to +287) |
| Recovery after a 3 s block | +76 ms (−26 to +1024) | −75 ms (−105 to −2) | +1189 ms (−149 to +2037) | −123 ms (−217 to +1206) |

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
