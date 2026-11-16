# File processor, placements compared

The processor's File processor run three ways on the bench server (M3h, decision 23): the same 8 headless processors on a worker each (`own`), all in one pool (`one`), and placed by `@isoloop/balancer`. The question is placement, so there's no native build. The runs are in [`final/results/`](final/results/), with [`summary.md`](final/results/summary.md).

## What we found

On four cores at 2.0 GHz, at 50 files a second:

1. **When nothing goes wrong, the balancer runs the processors as one pool.**
   - On Chromium the 8 processors fit in one pool, so the balancer puts them all there and never moves them. Its figures match `one` within a few milliseconds and a point of CPU.
   - Against `own` that's 2 workers instead of 9, 17 points less CPU across threads and 47 MB less memory. The latency per file is higher: a p50 of 61 ms against 19 ms, and a p95 of 158 ms against 39 ms.
2. **On Firefox the one pool doesn't keep up, and the balancer doesn't move anything.**
   - `one` and the balancer both do about 44 files a second of the 50, and a queue builds. The p95 latency is 8.9 s for `one` and 11.5 s for the balancer, against 51 ms for `own`.
   - The balancer made no move in any round. This run didn't record each processor's measured load, so it doesn't show whether the full-pool trigger (80 % of a core) wasn't reached as measured, or something else held it back. On a faster desktop, both browsers report the same per-processor load. The next run should record the loads.
   - Its latency is above `one`'s by 2.3 s at p50, from the backlog its first placements leave. It measures every processor in its quarantine first, then moves each one out, and 33 files are done twice.
3. **With faults, the balancer separates processors and gets more done than one pool.**
   - The faults are, in a thousand files, 2 that block their processor for 2 s, 100 at ten times the work, and 1 that crashes it.
   - In `one`, a blocked file holds every processor, and the pool does 27 files a second on Chromium and 20 on Firefox.
   - The balancer moves 7 to 10 processors a window, into 4 workers on Chromium and 9 on Firefox. It does 44 and 43 files a second, and its p50 latency is 84 % and 92 % lower than `one`'s.
   - `own` still has the lowest latency: a p50 of 28 and 46 ms, and a p95 under a second. The balancer's p95 is 16 to 18 s, from the files waiting while a processor is moved.
4. **Moves repeat work.**
   - With faults, the balancer does about 950 files twice on Chromium and 800 on Firefox (medians; 312 to 3,113 across the rounds), in runs of about 2,080 files. `own` does none twice, and `one` 1 to 9.
   - Each move stops a processor, and it puts back on its topic every file it still held. That's needed because a consumer group's commit can cross a redelivery and cover files the processor never received (see the processor's README). A crash puts them back too.
   - Delivery is at least once by design.
5. **In 2 of the 80 runs, files had no result 2 minutes after the generator stopped.** Both were the balancer with faults, on Firefox.
   - In one, the kernel gave up on 2 processors (more than 3 crashes in a minute), and 368 files had no result. Moving a crashed processor to the quarantine starts it again, but one that keeps getting corrupt files can still run out of restarts.
   - In the other, no processor was given up on, but 65 files had no result, and 3,113 files had been done twice. The put-backs kept the queue going. The run doesn't tell whether those 65 were lost or still waiting.
   - Every other run, `own` and `one` included, ended with every file done.
6. **The balancer's own cost is within the spread.**
   - `one-off` is one pool with no balancer on the page; `one` has a balancer that watches every beat but never moves anything. The two differ by 0 to 1 point of CPU, a few MB, and a few milliseconds of typing, within the rounds' spread on every figure.
7. **Typing on the main thread is 15 to 80 ms everywhere but one case.** That case is the balancer with faults on Firefox, at 140 ms.

## The numbers

- **A negative Δ means the balancer is lower.** Lower is better for every figure except files done per second.
- **Δ is B − A:** the median, over the 5 rounds, of each round's gap. So it can differ a little from subtracting the two columns, which are medians over the rounds.
- **Workers** count the generator's worker and every pool, but not the bus's.
- **CPU and memory** are Chromium only.

### Chromium, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 2 | **−7** | 2 | 2 | **0** |
| Files done per second (of 50) | 50.1 | 50.2 | **+0.1** | 50.2 | 50.2 | **0.0** |
| Latency per file, p50 | 19 ms | 61 ms | **+42 ms** | 57 ms | 61 ms | **+4 ms** |
| Latency per file, p95 | 39 ms | 158 ms | **+119 ms** | 145 ms | 158 ms | **+7 ms** |
| Typing | 21 ms | 17 ms | **−4 ms** | 15 ms | 17 ms | **+1 ms** |
| Moves in the 20 s window | 0 | 0 | **0** | 0 | 0 | **0** |
| Queue when the generator stops | 1 | 3 | **+3** | 4 | 3 | **−1** |
| Drain after it stops | 260 ms | 258 ms | **−3 ms** | 257 ms | 258 ms | **−1 ms** |
| Files done twice | 0 | 3 | **+3** | 0 | 3 | **+3** |
| Files without a result 2 min later | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Main-thread CPU | 21% | 14% | **−6 points** | 14% | 14% | **+1 point** |
| CPU, all threads | 139% | 122% | **−17 points** | 121% | 122% | **+1 point** |
| Memory after GC | 225 MB | 177 MB | **−47 MB** | 173 MB | 177 MB | **+2 MB** |

### Chromium, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | **−5** | 2 | 4 | **+2** |
| Files done per second (of 50) | 50.0 | 43.8 | **−6.2** | 26.6 | 43.8 | **+16.9** |
| Latency per file, p50 | 28 ms | 3.1 s | **+3.1 s** | 15.6 s | 3.1 s | **−13.2 s** |
| Latency per file, p95 | 380 ms | 18.3 s | **+17.9 s** | 20.7 s | 18.3 s | **−2.5 s** |
| Typing | 30 ms | 23 ms | **−12 ms** | 16 ms | 23 ms | **+9 ms** |
| Moves in the 20 s window | 0 | 7 | **+7** | 0 | 7 | **+7** |
| Queue when the generator stops | 9 | 489 | **+480** | 1061 | 489 | **−569** |
| Drain after it stops | 1.5 s | 39.6 s | **+38.3 s** | 44.4 s | 39.6 s | **−4.8 s** |
| Files done twice | 0 | 950 | **+950** | 2 | 950 | **+948** |
| Files without a result 2 min later | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Main-thread CPU | 24% | 18% | **−6 points** | 6% | 18% | **+11 points** |
| CPU, all threads | 254% | 246% | **−8 points** | 122% | 246% | **+124 points** |
| Memory after GC | 330 MB | 231 MB | **−94 MB** | 167 MB | 231 MB | **+77 MB** |

### Firefox, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 2 | **−7** | 2 | 2 | **0** |
| Files done per second (of 50) | 50.2 | 43.8 | **−6.4** | 44.0 | 43.8 | **−0.5** |
| Latency per file, p50 | 24 ms | 5.6 s | **+5.6 s** | 3.4 s | 5.6 s | **+2.3 s** |
| Latency per file, p95 | 51 ms | 11.5 s | **+11.5 s** | 8.9 s | 11.5 s | **+2.6 s** |
| Typing | 56 ms | 30 ms | **−26 ms** | 33 ms | 30 ms | **−2 ms** |
| Moves in the 20 s window | 0 | 0 | **0** | 0 | 0 | **0** |
| Queue when the generator stops | 2 | 376 | **+374** | 298 | 376 | **+80** |
| Drain after it stops | 263 ms | 10.2 s | **+9.9 s** | 7.9 s | 10.2 s | **+2.3 s** |
| Files done twice | 0 | 33 | **+33** | 0 | 33 | **+33** |
| Files without a result 2 min later | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors given up on | 0 | 0 | **0** | 0 | 0 | **0** |

### Firefox, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 9 | **0** | 2 | 9 | **+7** |
| Files done per second (of 50) | 50.2 | 43.4 | **−6.8** | 19.6 | 43.4 | **+22.1** |
| Latency per file, p50 | 46 ms | 1.1 s | **+1.0 s** | 19.4 s | 1.1 s | **−17.8 s** |
| Latency per file, p95 | 602 ms | 16.2 s | **+15.5 s** | 27.5 s | 16.2 s | **−10.5 s** |
| Typing | 80 ms | 140 ms | **+48 ms** | 29 ms | 140 ms | **+107 ms** |
| Moves in the 20 s window | 0 | 10 | **+10** | 0 | 10 | **+10** |
| Queue when the generator stops | 10 | 362 | **+351** | 1247 | 362 | **−860** |
| Drain after it stops | 518 ms | 21.6 s | **+21.0 s** | 65.6 s | 21.6 s | **−44.3 s** |
| Files done twice | 0 | 802 | **+802** | 8 | 802 | **+793** |
| Files without a result 2 min later | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors given up on | 0 | 0 | **0** | 0 | 0 | **0** |

### The balancer's own cost: `one-off` against `one`


| Figure | Engine, mix | `one-off` | `one` | **Δ** | Spread |
| --- | --- | --- | --- | --- | --- |
| Files done per second | Chromium, Normal | 50.2 | 50.2 | **0.0** | −0.1 to +0.1 |
| Latency p95 | Chromium, Normal | 149 ms | 145 ms | **−4 ms** | −17 ms to +9 ms |
| Typing | Chromium, Normal | 18 ms | 15 ms | **−2 ms** | −5 ms to +1 ms |
| Main-thread CPU | Chromium, Normal | 14% | 14% | **0 points** | 0 points to +0 points |
| CPU, all threads | Chromium, Normal | 121% | 121% | **0 points** | 0 points to +1 point |
| Memory after GC | Chromium, Normal | 167 MB | 173 MB | **+6 MB** | −8 MB to +18 MB |
| Files done per second | Chromium, With faults | 26.4 | 26.6 | **+0.1** | 0.0 to +0.2 |
| Latency p95 | Chromium, With faults | 20.3 s | 20.7 s | **+407 ms** | +56 ms to +543 ms |
| Typing | Chromium, With faults | 16 ms | 16 ms | **−1 ms** | −2 ms to 0 ms |
| Main-thread CPU | Chromium, With faults | 6% | 6% | **0 points** | 0 points to +0 points |
| CPU, all threads | Chromium, With faults | 121% | 122% | **+1 point** | −1 point to +2 points |
| Memory after GC | Chromium, With faults | 183 MB | 167 MB | **−16 MB** | −58 MB to +3 MB |
| Files done per second | Firefox, Normal | 44.3 | 44.0 | **−0.5** | −1.1 to +0.4 |
| Latency p95 | Firefox, Normal | 8.9 s | 8.9 s | **−44 ms** | −452 ms to +632 ms |
| Typing | Firefox, Normal | 33 ms | 33 ms | **−2 ms** | −4 ms to +2 ms |
| Files done per second | Firefox, With faults | 19.8 | 19.6 | **+0.5** | −0.4 to +1.5 |
| Latency p95 | Firefox, With faults | 27.4 s | 27.5 s | **+120 ms** | −978 ms to +470 ms |
| Typing | Firefox, With faults | 28 ms | 29 ms | **+1 ms** | −2 ms to +7 ms |

<details>
<summary>How it was measured</summary>

### The runs

- **The page:** `/files/?placement=<p>&rate=50&seed=7&start=1`, plus `&poison=0.2&heavy=10&corrupt=0.1` with faults. The generator starts at once and makes the same files in the same order in every run.
- **A run:**
  1. A 20 s warm-up, which covers the balancer measuring each processor in its quarantine and placing it.
  2. A 20 s window: files done, latency per file from being made to its result, workers, moves, and CPU and memory on Chromium.
  3. Five keystrokes into the latest results' filter, each timed until the table is drawn with it.
  4. The generator stops, and the files still without a result are counted after up to 2 minutes, with the processors the kernel gave up on and the files done twice.
- **Pairs**, interleaved (A, B, A, B…), one page at a time: `own` against the balancer, `one` against the balancer, and `one-off` against `one`.
- **Rounds:** 5, on Chromium and Firefox, normal and with faults. That's 80 runs, none stopped, in 85 minutes.
- **The spec and runner:** [`e2e/comparison.spec.ts`](../e2e/comparison.spec.ts) and [`run.ts`](run.ts), on `packages/compare`.
- **A first attempt was stopped and its results discarded.** Its faults (1 in a hundred corrupt, 1 in a hundred poison) crashed processors past the kernel's 3 restarts a minute, and its 8 s warm-up ended before the balancer's first placements had drained.

### The machine

- **The bench server**, doing nothing else: an AMD Ryzen 7 5825U (8 cores, 16 threads), 30 GB, Ubuntu 24.04.3. The other containers were paused, and every core was fixed at 2.0 GHz.
- **The container:** Playwright's `v1.65.0-noble` image with Node 26 and pnpm 12.16.1 ([the plant's Dockerfile](../../dashboards/plant/comparison/Dockerfile)), pinned with `--cpuset-cpus=2,4,6,8` to four physical cores.
  - The balancer's allowance follows `navigator.hardwareConcurrency`, which the cpuset doesn't limit. It used at most 8 pools here.
- **The code:** `isoloop/web` at `8b57f23`, with `@isoloop/*@0.0.0-next.g3322248`.
  - That prerelease doesn't have isoloop#206 (a stopped pool member's callbacks no longer run) or #209 (a stop during a move cancels it). The processors stop their own loops on shutdown, and the page treats a stop that throws during a move as done.

### To run it again

From a clone of `isoloop/web`:

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g \
  -v "$PWD":/work -w /work plant-compare \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/processor compare:pairs \
    --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
    --pair isoloop:one-off=isoloop:one --mixes normal,faults --rounds 5 --hold 0 \
    --warm 20 --window 20 --engines chromium,firefox --out comparison/final/results'
```

</details>
