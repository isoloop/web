# Markets dashboard, federated comparison

M3g's head-to-head, run on the bench server on 2026-11-16: the dashboard built from two teams' parts, natively and on Isoloop. The React team owns the charts and tables; the Preact team ships the filters and the alerts panel, built apart and loaded at run time.

- **native + workers, React and Preact** (`/native-mixed/`): the native + workers build, with the Preact part loaded by `import()` from its own manifest, as teams combine parts today. The data runs in six hand-written workers, the widgets on the main thread. Each part has its own error boundary; nothing restarts a part.
- **Isoloop `mixed`** (`/mixed/`): the same split, each widget an isolate, in three placements:
  - `matched`: the data on its own workers, plus one pool for every widget, both teams' (7 workers).
  - `teams`: the data on its own workers, plus a pool per team (8 workers).
  - `own`: a worker per isolate (22 at Normal, 30 at Heavy).

Native + workers against `matched` is the pair; `teams` and `own` were measured alongside.

## What we found

On four cores at 2.0 GHz, one team's blocked part stalls the other team's widgets on the native build and in `matched`, and doesn't in `teams` or `own`. A crashed part stays down on native and is back in 1.3–1.8 s on Isoloop. Isoloop loads 61 KB more JavaScript, gzipped, and costs 34–49 MB of memory, 5–29 points of CPU and 0.15–0.37 s more to first data.

1. **A blocked part: what it takes down depends on what shares its thread.** The Preact team's alerts panel ran a 3 s busy loop.
   - On native + workers the main thread is blocked, so the React team's widgets got none of their updates. Their longest silence was 3.2–4.0 s.
   - In `matched` the panel shares the widgets' pool with every React widget, so the result was the same: no updates, 3.5–3.9 s of silence.
   - In `teams` the React widgets kept 91–98% of their updates and in `own` 92–99%, with no silence longer than their once-a-second report (1.0–1.1 s).
2. **A crashed part: native contains it, Isoloop also brings it back.** The alerts panel threw while rendering.
   - On native + workers its error boundary caught it. The other widgets kept 97–100% of their updates, and the panel stayed down in all 20 runs: nothing restarts it.
   - On Isoloop the other widgets kept 88–101% in every placement, and the panel was back in 1.30–1.41 s on Chromium and 1.36–1.82 s on Firefox.
3. **What the second runtime and Isoloop cost,** `matched` against native + workers:
   - JS loaded, gzipped: 212 KB against 151 KB (+61 KB), the same in every placement.
   - Memory after GC (Chromium): +34 MB at Normal, +49 MB at Heavy.
   - CPU across threads (Chromium): +5 points at Normal, +29 points at Heavy.
   - First data: 148–267 ms later on Chromium, 336–366 ms later on Firefox.
   - Typing at Normal on Chromium: 40 ms against 20 ms.
4. **A pool per team costs little over one pool.** Against `matched`, `teams` used one more worker, 2–6 MB more memory and 1–2 points more CPU on Chromium, with first data within 50 ms there. On Firefox at Heavy its first data was 265 ms later (970 ms against 705 ms). `own` used 81–137 MB more than `matched` on Chromium and reached first data 0.37–1.04 s later.
5. **At Heavy the native build fills the main thread,** as M3f found for the React-only builds: 100% on Chromium, 207 late frames of about 600 on Chromium and 232 on Firefox. `matched` and `teams` dropped 0–1. `own` dropped none on Chromium and 81 on Firefox.
6. **These figures depend on the machine,** as M3f's do: with the cores fixed at 2.0 GHz, the Heavy workload fills the native main thread.

## The numbers

- Lower is better for every figure but "updates kept". **A negative Δ means Isoloop is lower.**
- Δ is `matched` − native + workers: the median, over the 5 rounds, of each round's gap. So it can differ by a little from subtracting the two columns.
- The other columns are medians over the rounds.
- "The other widgets" are every widget but the Preact team's two, the filters and the alerts panel. "Updates kept" compares their renders and draws in the block's last 2 s, or the 2 s after the crash, with the 2 s before.

### Chromium, Normal

| Figure | native + workers | Isoloop `matched` | **Δ** | `teams` | `own` |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 6 | 7 | +1 | 8 | 22 |
| JS loaded, gzipped | 151 KB | 212 KB | **+61 KB** | 212 KB | 212 KB |
| Blocked panel: other widgets' updates kept | 0% | 0% | **0 points** | 98% | 99% |
| Blocked panel: other widgets' longest silence | 3.21 s | 3.49 s | **+308 ms** | 1.01 s | 1.00 s |
| Crashed panel: other widgets' updates kept | 97% | 95% | **−1 point** | 95% | 96% |
| Crashed panel: back after | not back | 1.33 s | – | 1.31 s | 1.36 s |
| Late frames (of about 600) | 0 | 0 | **0** | 0 | 0 |
| Typing | 20 ms | 40 ms | **+17 ms** | 39 ms | 41 ms |
| Main-thread CPU | 87% | 21% | **−66 points** | 22% | 20% |
| CPU, all threads | 103% | 108% | **+5 points** | 109% | 115% |
| Memory after GC (16 s) | 190 MB | 225 MB | **+34 MB** | 227 MB | 306 MB |
| First data | 302 ms | 453 ms | **+148 ms** | 423 ms | 823 ms |
| All widgets with data | 4.29 s | 4.36 s | **+68 ms** | 4.37 s | 4.36 s |

### Chromium, Heavy

| Figure | native + workers | Isoloop `matched` | **Δ** | `teams` | `own` |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 6 | 7 | +1 | 8 | 30 |
| JS loaded, gzipped | 151 KB | 212 KB | **+61 KB** | 212 KB | 212 KB |
| Blocked panel: other widgets' updates kept | 0% | 0% | **0 points** | 94% | 97% |
| Blocked panel: other widgets' longest silence | 4.00 s | 3.90 s | **−83 ms** | 1.04 s | 1.02 s |
| Crashed panel: other widgets' updates kept | 100% | 100% | **+1 point** | 100% | 101% |
| Crashed panel: back after | not back | 1.41 s | – | 1.30 s | 1.39 s |
| Late frames (of about 600) | 207 | 0 | **−207** | 0 | 0 |
| Typing | 149 ms | 43 ms | **−106 ms** | 37 ms | 34 ms |
| Main-thread CPU | 100% | 23% | **−76 points** | 23% | 30% |
| CPU, all threads | 115% | 144% | **+29 points** | 145% | 181% |
| Memory after GC (16 s) | 251 MB | 298 MB | **+49 MB** | 304 MB | 435 MB |
| First data | 315 ms | 581 ms | **+267 ms** | 531 ms | 1.02 s |
| All widgets with data | 4.33 s | 4.47 s | **+77 ms** | 4.38 s | 4.48 s |

### Firefox, Normal

Firefox gives no CPU or memory figures.

| Figure | native + workers | Isoloop `matched` | **Δ** | `teams` | `own` |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 6 | 7 | +1 | 8 | 22 |
| JS loaded, gzipped | 151 KB | 212 KB | **+61 KB** | 212 KB | 212 KB |
| Blocked panel: other widgets' updates kept | 0% | 0% | **0 points** | 91% | 92% |
| Blocked panel: other widgets' longest silence | 3.36 s | 3.81 s | **+372 ms** | 1.04 s | 1.03 s |
| Crashed panel: other widgets' updates kept | 98% | 88% | **−15 points**¹ | 93% | 92% |
| Crashed panel: back after | not back | 1.44 s | – | 1.36 s | 1.51 s |
| Late frames (of about 600) | 13 | 0 | **−13** | 0 | 4 |
| Typing | 107 ms | 82 ms | **−17 ms** | 50 ms | 63 ms |
| First data | 410 ms | 788 ms | **+366 ms** | 788 ms | 1.26 s |
| All widgets with data | 4.41 s | 4.63 s | **+188 ms** | 4.65 s | 5.01 s |

¹ Noisy: across the 5 rounds this gap ran from −97 to −8 points. In one round the native build's figure read 190%, from reports delayed past the window's start.

### Firefox, Heavy

| Figure | native + workers | Isoloop `matched` | **Δ** | `teams` | `own` |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 6 | 7 | +1 | 8 | 30 |
| JS loaded, gzipped | 151 KB | 212 KB | **+61 KB** | 212 KB | 212 KB |
| Blocked panel: other widgets' updates kept | 0% | 0% | **0 points** | 97% | 95% |
| Blocked panel: other widgets' longest silence | 3.66 s | 3.68 s | **+57 ms** | 1.10 s | 1.10 s |
| Crashed panel: other widgets' updates kept | 98% | 94% | **−2 points** | 96% | 94% |
| Crashed panel: back after | not back | 1.55 s | – | 1.36 s | 1.82 s |
| Late frames (of about 600) | 232 | 0 | **−232** | 0 | 81 |
| Typing | 132 ms | 132 ms | **−21 ms** | 53 ms | 135 ms |
| First data | 387 ms | 705 ms | **+336 ms** | 970 ms | 1.74 s |
| All widgets with data | 4.47 s | 4.73 s | **+254 ms** | 4.76 s | 5.55 s |

## Details

<details>
<summary>Notes on the figures</summary>

- **The faults** are the alerts panel's own stress controls, in its own code: `block` is a 3 s busy loop, `crash` throws while rendering. On native they run on the main thread. On Isoloop they run on the panel's thread: in `matched` the pool every widget shares, in `teams` the Preact team's pool, in `own` the panel's worker.
- **Updates kept** counts the other widgets' renders and canvas draws from their own reports, sent once a second from each widget's thread. A widget whose thread is blocked sends none until it's free, so on native and in `matched` the block's window gets no reports at all. A value over 100% is a report from before the window landing late inside it.
- **Longest silence** is the longest time between two reports of any of the other widgets, from 1.5 s before the block to 3 s after it. About 1 s means they kept running.
- **Back after** is from the crash click to the first report from a run of the panel's code that started after the click. "Not back" means none came within 10 s. Native + workers has no restart, so its panel stays on its error boundary's message.
- **JS loaded** is every JavaScript file the page and its workers requested, each once, sized from the build output and gzipped: what a server would send. Isoloop loads the same files in every placement. For reference, the build output of native + workers, React only, is 116 KB gzipped (`dist/native-workers/build-stats.json`), so the separately built Preact part adds about 35 KB to it.
- **Typing** is the median of 5 keystrokes into the alerts panel, from keystroke to the panel re-rendering. In these builds the panel is the Preact part.
- **Late frames** are gaps over 25 ms between the ticker tape's animation frames, on the page's main thread, in a 10 s window with no input.
- What every figure covers is in the header of [`../../e2e/comparison.spec.ts`](../../e2e/comparison.spec.ts).

</details>

<details>
<summary>Gaps with their spread across the 5 rounds</summary>

Gap `matched` − native + workers, median of 5 rounds, lowest to highest round in brackets. The runner's tables are in [`results/summary.md`](results/summary.md), and the raw figures are in `results/<engine>/*.json`.

**Chromium**

| Figure | Normal | Heavy |
| --- | --- | --- |
| JS loaded, gzipped | +61 KB (+61 to +61) | +61 KB (+61 to +61) |
| Blocked panel: other widgets' updates kept | 0 points (0 to 0) | 0 points (0 to 0) |
| Blocked panel: other widgets' longest silence | +308 ms (−301 to +382) | −83 ms (−263 to +464) |
| Crashed panel: other widgets' updates kept | −1 point (−3 to −1) | +1 point (−5 to +6) |
| Late frames | 0 (−1 to 0) | −207 (−209 to −204) |
| Typing | +17 ms (+9 to +24) | −106 ms (−133 to 0) |
| Main-thread CPU | −66 points (−66 to −64) | −76 points (−76 to −76) |
| CPU, all threads | +5 points (+2 to +6) | +29 points (+28 to +30) |
| Memory after GC (16 s) | +34 MB (+28 to +39) | +49 MB (+41 to +54) |
| First data | +148 ms (+116 to +166) | +267 ms (+169 to +368) |
| All widgets with data | +68 ms (+28 to +209) | +77 ms (+61 to +183) |

**Firefox**

| Figure | Normal | Heavy |
| --- | --- | --- |
| JS loaded, gzipped | +61 KB (+61 to +61) | +61 KB (+61 to +61) |
| Blocked panel: other widgets' updates kept | 0 points (0 to 0) | 0 points (0 to 0) |
| Blocked panel: other widgets' longest silence | +372 ms (+326 to +575) | +57 ms (−298 to +1,867) |
| Crashed panel: other widgets' updates kept | −15 points (−97 to −8) | −2 points (−7 to +98) |
| Late frames | −13 (−14 to −8) | −232 (−234 to −230) |
| Typing | −17 ms (−38 to +24) | −21 ms (−40 to +29) |
| First data | +366 ms (+87 to +387) | +336 ms (+268 to +496) |
| All widgets with data | +188 ms (−74 to +251) | +254 ms (+192 to +315) |

</details>

<details>
<summary>How it was measured</summary>

- **Machine:** the same home server as the [final run](../final/README.md), doing nothing else.
  - AMD Ryzen 7 5825U (8 cores, 16 threads), 30 GB.
  - Ubuntu 24.04.3, kernel 6.8.0-147, Docker 28.5.1.
  - The other containers were paused, the governor was set to `performance`, and every core was fixed at 2.0 GHz.
- **Container:** Playwright's official image `v1.64.1-noble` with Node 26.13.0 and pnpm 12.16.1 ([the plant's Dockerfile](../../../plant/comparison/Dockerfile)), pinned with `--cpuset-cpus=2,4,6,8` to four physical cores, one thread each.
- **Code:** `isoloop/web` at `dccf33e`, whose markets and `packages/compare` code merged unchanged as `96e0ab1` (#117), with `@isoloop/*@0.0.0-next.b8ffdcf`.
- **Runs:** [`../run.ts`](../run.ts) on `packages/compare`, with `COMPARE_FAULT=alerts`.
  - 5 rounds. Each round ran native + workers, `matched`, `teams` and `own` once, one page at a time, so the pair is interleaved. The gap is B − A within each round.
  - Chromium and Firefox, Normal and Heavy, the replay at its own rate (`speed=1`), seed 7.
  - No 10-minute hold.
  - 80 runs, none stopped, 53 minutes.
- Memory and CPU are Chromium only.
- An earlier run that day was stopped and replaced: its "back after" figure counted a late report from the crashed panel's own run as the panel coming back (#117).

To rerun it, from a clone of `isoloop/web`:

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g -e COMPARE_FAULT=alerts \
  -v "$PWD":/work -w /work plant-compare \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/dashboards/markets compare:pairs \
    --pair native-mixed=mixed:matched --extra mixed:teams --extra mixed:own \
    --sizes normal,heavy --rounds 5 --hold 0 \
    --engines chromium,firefox --out comparison/federated/results'
```

</details>
