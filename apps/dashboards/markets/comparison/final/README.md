# Markets dashboard, final server run

The figures that ship with `markets-v0.3.0`: the M3f head-to-head, run on the bench server on 2026-11-15. They replace the [M3b and M3c recording](../README.md), which compared native on one thread with Isoloop on a worker per isolate.

## What we found

On four cores at 2.0 GHz, Isoloop keeps the main thread free. At Heavy it keeps every frame, where both native builds drop about a third. It costs 4–29 points of CPU, 33–52 MB of memory and 0.1–0.5 s more to first data.

1. **Where it makes a difference: Heavy.**
   - Both native builds fill the main thread: it's at 100% on Chromium.
   - They drop 172–231 of about 600 frames, on Chromium and on Firefox. Native + workers types in 150–156 ms.
   - Isoloop `one` and `matched` drop 0–1 frames. They type in 41 ms on Chromium and 81–129 ms on Firefox.
2. **Where it doesn't: Normal.**
   - On Chromium every build keeps every frame. Isoloop types 4–7 ms slower.
   - On Firefox the native builds drop 5–10 frames and Isoloop 0–1, and Isoloop types 16–44 ms faster.
3. **Native + workers doesn't free the main thread.**
   - At Normal on Chromium it's 86% busy with workers against 83% without, and both are at 100% at Heavy.
   - The widgets are the main-thread cost, and native + workers keeps them there. Isoloop moves them off: its main thread is at 21–23% in every placement but `own` at Heavy (35%).
4. **What it costs,** against the native build in its pair:
   - CPU across threads: +4 to +13 points at Normal, +12 to +29 points at Heavy.
   - Memory after GC: +33 to +52 MB.
   - First data: 125–212 ms later on Chromium, 376–506 ms later on Firefox.
   - Every widget filled: 52–426 ms later.
5. **Recovery after a 3 s block is a tie,** within about 130 ms on Chromium.
   - Markets sets no kill timeout, so every build waits out the full block, and this figure doesn't separate them.
   - Firefox is noisy here: single rounds reach +2 s.
6. **`own`, a worker per isolate, is the expensive placement.** It's the live page's default. Against `matched` it uses:
   - 22 or 30 workers instead of 7.
   - 87–132 MB more memory after GC.
   - 185% CPU across threads at Heavy instead of 143%.
   - 0.8–1.7 s to first data.

   That's the price of every widget in its own worker, and it's what lets a blocked chart stall only itself.
7. **These figures depend on the machine.**
   - On GitHub's 4-core runner, in the M3c recording, native's main thread was 42–59% busy at Normal and Heavy, and native kept every frame.
   - Here, with the cores fixed at 2.0 GHz, the same Heavy workload fills it.

## The pairs

- **native** (everything on the main thread) against **Isoloop `one`** (every isolate in one pool): 0 workers against 1.
- **native + workers** (the replay, the aggregator, alerts and the three engines in a worker each, the widgets on the main thread) against **Isoloop `matched`** (those six as their own workers, plus one pool for every widget): 6 workers against 7.
- **Isoloop `own`** (a worker per isolate, the live page's default), measured alongside: 22 workers at Normal, 30 at Heavy.

Isoloop also runs the bus's worker, which these counts leave out.

## The numbers

- Lower is better for every figure. **A negative Δ means Isoloop is lower.**
- Δ is B − A: the median, over the 5 rounds, of each round's gap. So it can differ by a little from subtracting the two columns.
- The other columns are medians over the rounds.

### Chromium, Normal

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 0 | 1 | +1 | 6 | 7 | +1 |
| Late frames (of about 600) | 0 | 0 | **0** | 0 | 0 | **0** |
| Typing | 32 ms | 38 ms | **+4 ms** | 35 ms | 41 ms | **+7 ms** |
| Main-thread CPU | 83% | 22% | **−61 points** | 86% | 21% | **−65 points** |
| CPU, all threads | 95% | 107% | **+13 points** | 103% | 108% | **+4 points** |
| Memory after GC (16 s) | 166 MB | 203 MB | **+34 MB** | 188 MB | 222 MB | **+33 MB** |
| First data | 166 ms | 358 ms | **+184 ms** | 249 ms | 383 ms | **+125 ms** |
| All widgets with data | 4.18 s | 4.42 s | **+241 ms** | 4.28 s | 4.34 s | **+64 ms** |
| Recovery after a 3 s block | 3.08 s | 3.16 s | **+75 ms** | 3.14 s | 3.09 s | **−62 ms** |

### Chromium, Heavy

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 0 | 1 | +1 | 6 | 7 | +1 |
| Late frames (of about 600) | 172 | 0 | **−172** | 205 | 0 | **−205** |
| Typing | 52 ms | 41 ms | **−12 ms** | 156 ms | 41 ms | **−115 ms** |
| Main-thread CPU | 100% | 22% | **−78 points** | 100% | 23% | **−77 points** |
| CPU, all threads | 111% | 122% | **+12 points** | 114% | 143% | **+29 points** |
| Memory after GC (16 s) | 220 MB | 271 MB | **+51 MB** | 246 MB | 301 MB | **+52 MB** |
| First data | 174 ms | 350 ms | **+175 ms** | 362 ms | 527 ms | **+212 ms** |
| All widgets with data | 4.23 s | 4.43 s | **+210 ms** | 4.34 s | 4.44 s | **+52 ms** |
| Recovery after a 3 s block | 3.17 s | 3.31 s | **+127 ms** | 3.26 s | 3.14 s | **−112 ms** |

### Firefox, Normal

Firefox gives no CPU or memory figures.

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Late frames (of about 600) | 5 | 0 | **−5** | 10 | 1 | **−10** |
| Typing | 120 ms | 79 ms | **−44 ms** | 103 ms | 82 ms | **−16 ms** |
| First data | 236 ms | 645 ms | **+376 ms** | 386 ms | 767 ms | **+384 ms** |
| All widgets with data | 4.24 s | 4.54 s | **+300 ms** | 4.46 s | 4.61 s | **+127 ms** |
| Recovery after a 3 s block | 3.11 s | 3.14 s | **+76 ms** | 3.18 s | 3.11 s | **−75 ms** |

### Firefox, Heavy

| Figure | native | Isoloop `one` | **Δ** | native + workers | Isoloop `matched` | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Late frames (of about 600) | 206 | 0 | **−206** | 231 | 1 | **−229** |
| Typing | 176 ms | 81 ms | **−98 ms** | 150 ms | 129 ms | **−25 ms** |
| First data | 237 ms | 700 ms | **+408 ms** | 386 ms | 915 ms | **+506 ms** |
| All widgets with data | 4.26 s | 4.67 s | **+426 ms** | 4.46 s | 4.71 s | **+253 ms** |
| Recovery after a 3 s block | 3.25 s | 4.43 s | **+1.19 s**¹ | 3.27 s | 3.15 s | **−123 ms** |

¹ Noisy: across the 5 rounds this gap ran from −0.15 s to +2.04 s.

### `own` against `matched`

What it costs to give every widget its own worker. These are medians over the rounds, measured alongside the pairs, not interleaved with each other.

| Figure | Normal: `matched` | Normal: `own` | Heavy: `matched` | Heavy: `own` |
| --- | --- | --- | --- | --- |
| Workers (bus excluded) | 7 | 22 | 7 | 30 |
| Late frames, Chromium | 0 | 0 | 0 | 0 |
| Late frames, Firefox | 1 | 5 | 1 | 106 |
| Typing, Chromium | 41 ms | 42 ms | 41 ms | 41 ms |
| Main-thread CPU, Chromium | 21% | 21% | 23% | 35% |
| CPU, all threads, Chromium | 108% | 113% | 143% | 185% |
| Memory after GC (16 s), Chromium | 222 MB | 309 MB | 301 MB | 433 MB |
| First data, Chromium | 383 ms | 799 ms | 527 ms | 963 ms |
| First data, Firefox | 767 ms | 1.23 s | 915 ms | 1.73 s |

## Details

### Notes on the figures

- **"All widgets with data" takes 4.2–5.0 s on every build.** It's the slowest widget's first update, so only the gaps between builds carry information.
- **Recovery** is from the click on the price chart's block control (a 3 s busy loop in the chart's own code) to the chart's first draw after the pause. Markets sets no `heartbeat.killAfterMs`, so every build waits the 3 s out.
- **Late frames** are gaps over 25 ms between the ticker tape's animation frames, in a 10 s window with no input.
- **Typing** is the median of 5 keystrokes into the alerts panel, from keystroke to the panel re-rendering.
- What every figure covers is in the header of [`../../e2e/comparison.spec.ts`](../../e2e/comparison.spec.ts).

### Gaps with their spread

<details>
<summary>Gaps with their spread across the 5 rounds (Chromium and Firefox)</summary>

Gap B − A, median of 5 rounds, lowest to highest round in brackets. The full tables, `own` included, are in [`results/summary.md`](results/summary.md), and the raw figures are in `results/<engine>/*.json`.

**Chromium**

| Figure | Normal: native vs `one` | Normal: native + workers vs `matched` | Heavy: native vs `one` | Heavy: native + workers vs `matched` |
| --- | --- | --- | --- | --- |
| Late frames | 0 (0 to 0) | 0 (−1 to 0) | −172 (−174 to −170) | −205 (−210 to −202) |
| Typing | +4 ms (+2 to +18) | +7 ms (0 to +25) | −12 ms (−56 to +19) | −115 ms (−130 to −77) |
| Main-thread CPU | −61 points (−62 to −60) | −65 points (−66 to −65) | −78 points (−78 to −77) | −77 points (−77 to −77) |
| CPU, all threads | +13 points (+9 to +13) | +4 points (+3 to +6) | +12 points (+10 to +13) | +29 points (+27 to +29) |
| Memory after GC (16 s) | +34 MB (+32 to +41) | +33 MB (+30 to +34) | +51 MB (+44 to +56) | +52 MB (+51 to +55) |
| First data | +184 ms (+156 to +195) | +125 ms (+93 to +174) | +175 ms (+152 to +207) | +212 ms (+78 to +253) |
| All widgets with data | +241 ms (+230 to +252) | +64 ms (+53 to +75) | +210 ms (+206 to +247) | +52 ms (+28 to +112) |
| Recovery after a 3 s block | +75 ms (+39 to +94) | −62 ms (−87 to −53) | +127 ms (+117 to +201) | −112 ms (−151 to −94) |

**Firefox**

| Figure | Normal: native vs `one` | Normal: native + workers vs `matched` | Heavy: native vs `one` | Heavy: native + workers vs `matched` |
| --- | --- | --- | --- | --- |
| Late frames | −5 (−11 to −3) | −10 (−14 to −8) | −206 (−228 to −203) | −229 (−231 to −227) |
| Typing | −44 ms (−50 to +11) | −16 ms (−50 to 0) | −98 ms (−100 to −74) | −25 ms (−68 to +15) |
| First data | +376 ms (+234 to +452) | +384 ms (+353 to +413) | +408 ms (+320 to +543) | +506 ms (+492 to +533) |
| All widgets with data | +300 ms (+102 to +379) | +127 ms (+69 to +293) | +426 ms (+381 to +491) | +253 ms (+207 to +287) |
| Recovery after a 3 s block | +0.08 s (−0.03 to +1.02) | −0.08 s (−0.11 to −0.00) | +1.19 s (−0.15 to +2.04) | −0.12 s (−0.22 to +1.21) |

</details>

### How it was measured

- **Machine:** the same home server as the plant's [final run](../../../plant/comparison/final/README.md), doing nothing else.
  - AMD Ryzen 7 5825U (8 cores, 16 threads), 30 GB.
  - Ubuntu 24.04.3, kernel 6.8.0-147, Docker 28.5.1.
  - The other containers were paused, the governor was set to `performance`, and every core was fixed at 2.0 GHz.
- **Container:** Playwright's official image `v1.64.1-noble` with Node 26.13.0 and pnpm 12.16.1 ([the plant's Dockerfile](../../../plant/comparison/Dockerfile)). It was pinned with `--cpuset-cpus=2,4,6,8` to four physical cores, one thread each.
- **Code:** `isoloop/web` at `5770597` (#100), with `@isoloop/*@0.0.0-next.b8ffdcf`, the libraries `plant-v0.1.0` ships.
- **Runs:** [`../run.ts`](../run.ts) on `packages/compare`.
  - 5 rounds, each pair interleaved (A, B, A, B…), one page at a time. The gap is B − A within each round.
  - Chromium and Firefox, Normal and Heavy, the replay at its own rate (`speed=1`), seed 7.
  - No 10-minute hold.
  - 100 runs, none stopped, about 46 minutes.
- Memory and CPU are Chromium only.

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
