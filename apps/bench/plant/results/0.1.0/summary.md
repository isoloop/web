# plant-bench on Isoloop 0.1.0

- **Isoloop:** `@isoloop/*@0.1.0`, React 19.3.1, Playwright 1.65.0.
- **Machine:** An x64 CPU, CPUs 2,4,6,8 at 2.0 GHz, 31 GB; Ubuntu 24.04.5 LTS; in `mcr.microsoft.com/playwright:v1.65.0-noble, Node 26.13.0, pnpm 12.16.1`; Node 26.13.0.
- **Browsers:** Chromium 158.0.8127.18, Firefox 159.0, WebKit 27.2.
- **Run:** started 2026-11-24T15:41:15.912Z, 5 interleaved rounds per configuration.

## What we found

Chromium at 5 kHz, the heavier load. Medians over the rounds; each difference is the Isoloop side against its native build, round by round.

**Isoloop `one` against native:**

- Main-thread busy: 22% against 80%, 58 points lower (better), in all 5 rounds.
- CPU, all threads: 106% against 91%, 15 points higher (worse), in all 5 rounds.
- Typing, median of 5: 38 ms against 65 ms, 32 ms (49%) lower (better), in all 5 rounds.
- First data: 504 ms against 222 ms, 276 ms (124%) higher (worse), in all 5 rounds.
- All 72 widgets with data: 2.4 s against 1.2 s, 1.2 s (102%) higher (worse), in all 5 rounds.
- Recovery after a 3 s block: 3.4 s against 3.2 s, 250 ms (8%) higher (worse), in all 5 rounds.
- Memory after GC: 207 MB against 168 MB, 39 MB (23%) higher (worse), in all 5 rounds.

**Isoloop `matched` against native + workers:**

- Main-thread busy: 24% against 78%, 54 points lower (better), in all 5 rounds.
- CPU, all threads: 112% against 97%, 19 points higher (worse), in all 5 rounds.
- Typing, median of 5: 41 ms against 58 ms, 18 ms (31%) lower (better); the rounds ranged from −40 ms to +1 ms.
- First data: 557 ms against 366 ms, 207 ms (57%) higher (worse), in all 5 rounds.
- All 72 widgets with data: 1.5 s against 2.3 s, 787 ms (34%) lower (better); the rounds ranged from −813 ms to +157 ms.
- Recovery after a 3 s block: 2.9 s against 3.2 s, 248 ms (8%) lower (better), in all 5 rounds.
- Memory after GC: 272 MB against 227 MB, 46 MB (20%) higher (worse), in all 5 rounds.

- 1 page stopped before a result; it's listed under the details and left out of every figure.

## The figures

Lower is better. A is the native build, B the Isoloop placement; Δ is B − A within each round, its median over the rounds.

### Chromium, 1 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Main-thread busy | 66% | 23% | −43 points |
| CPU, all threads | 75% | 92% | +11 points |
| Typing, median of 5 | 34 ms | 24 ms | −10 ms (−29%) |
| First data | 287 ms | 484 ms | +225 ms (+78%) |
| All 72 widgets with data | 1.4 s | 2.4 s | +1.0 s (+74%) |
| Recovery after a 3 s block | 3.2 s | 3.5 s | +288 ms (+9%) |
| Memory after GC | 158 MB | 193 MB | +36 MB (+23%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Main-thread busy | 65% | 25% | −41 points |
| CPU, all threads | 80% | 93% | +13 points |
| Typing, median of 5 | 33 ms | 26 ms | −11 ms (−33%) |
| First data | 434 ms | 603 ms | +210 ms (+48%) |
| All 72 widgets with data | 2.3 s | 1.6 s | −678 ms (−30%) |
| Recovery after a 3 s block | 3.2 s | 2.9 s | −286 ms (−9%) |
| Memory after GC | 199 MB | 238 MB | +39 MB (+20%) |

### Chromium, 5 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Main-thread busy | 80% | 22% | −58 points |
| CPU, all threads | 91% | 106% | +15 points |
| Typing, median of 5 | 65 ms | 38 ms | −32 ms (−49%) |
| First data | 222 ms | 504 ms | +276 ms (+124%) |
| All 72 widgets with data | 1.2 s | 2.4 s | +1.2 s (+102%) |
| Recovery after a 3 s block | 3.2 s | 3.4 s | +250 ms (+8%) |
| Memory after GC | 168 MB | 207 MB | +39 MB (+23%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Main-thread busy | 78% | 24% | −54 points |
| CPU, all threads | 97% | 112% | +19 points |
| Typing, median of 5 | 58 ms | 41 ms | −18 ms (−31%) |
| First data | 366 ms | 557 ms | +207 ms (+57%) |
| All 72 widgets with data | 2.3 s | 1.5 s | −787 ms (−34%) |
| Recovery after a 3 s block | 3.2 s | 2.9 s | −248 ms (−8%) |
| Memory after GC | 227 MB | 272 MB | +46 MB (+20%) |

### Firefox, 1 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 118 ms | 76 ms | −31 ms (−26%) |
| First data | 333 ms | 761 ms | +417 ms (+125%) |
| All 72 widgets with data | 1.3 s | 2.5 s | +1.1 s (+79%) |
| Recovery after a 3 s block | 3.4 s | 3.6 s | +287 ms (+9%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 114 ms | 80 ms | −34 ms (−30%) |
| First data | 475 ms | 1.1 s | +599 ms (+126%) |
| All 72 widgets with data | 2.4 s | 2.0 s | −320 ms (−13%) |
| Recovery after a 3 s block | 3.4 s | 3.7 s | +343 ms (+10%) |

### Firefox, 5 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 129 ms | 109 ms | −14 ms (−11%) |
| First data | 350 ms | 834 ms | +482 ms (+138%) |
| All 72 widgets with data | 1.2 s | 2.7 s | +1.4 s (+114%) |
| Recovery after a 3 s block | 3.4 s | 3.7 s | +307 ms (+9%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 134 ms | 82 ms | −52 ms (−39%) |
| First data | 418 ms | 1.0 s | +558 ms (+133%) |
| All 72 widgets with data | 1.5 s | 1.9 s | +377 ms (+25%) |
| Recovery after a 3 s block | 3.4 s | 3.7 s | +320 ms (+9%) |

### WebKit, 1 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 23 ms | 117 ms | +94 ms (+409%) |
| First data | 361 ms | 722 ms | +293 ms (+81%) |
| All 72 widgets with data | 1.5 s | 2.8 s | +1.3 s (+88%) |
| Recovery after a 3 s block | 3.5 s | 3.8 s | +247 ms (+7%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 31 ms | 231 ms | +182 ms (+585%) |
| First data | 376 ms | 994 ms | +623 ms (+166%) |
| All 72 widgets with data | 1.5 s | 2.4 s | +468 ms (+30%) |
| Recovery after a 3 s block | 3.5 s | 3.6 s | +114 ms (+3%) |

### WebKit, 5 kHz

**native (A) and Isoloop `one` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 29 ms | 224 ms | +198 ms (+683%) |
| First data | 366 ms | 700 ms | +335 ms (+92%) |
| All 72 widgets with data | 1.3 s | 2.9 s | +1.6 s (+125%) |
| Recovery after a 3 s block | 3.5 s | 4.0 s | +457 ms (+13%) |

**native + workers (A) and Isoloop `matched` (B)**

| Figure | A | B | Δ (B − A) |
| --- | --- | --- | --- |
| Typing, median of 5 | 26 ms | 234 ms | +211 ms (+812%) |
| First data | 379 ms | 957 ms | +578 ms (+153%) |
| All 72 widgets with data | 2.3 s | 2.2 s | +514 ms (+22%) |
| Recovery after a 3 s block | 3.5 s | 3.3 s | −118 ms (−3%) |

## Details

<details>
<summary>Each Δ’s spread over the rounds</summary>

**Chromium, 1 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Main-thread busy | 5 | −50 points | −40 points |
| CPU, all threads | 5 | +5 points | +22 points |
| Typing, median of 5 | 5 | −32 ms | +12 ms |
| First data | 5 | +147 ms | +291 ms |
| All 72 widgets with data | 5 | +288 ms | +1.1 s |
| Recovery after a 3 s block | 5 | +279 ms | +398 ms |
| Memory after GC | 5 | +34 MB | +39 MB |

**Chromium, 1 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Main-thread busy | 5 | −48 points | −38 points |
| CPU, all threads | 5 | +11 points | +16 points |
| Typing, median of 5 | 5 | −12 ms | +11 ms |
| First data | 5 | +126 ms | +353 ms |
| All 72 widgets with data | 5 | −696 ms | −473 ms |
| Recovery after a 3 s block | 5 | −487 ms | −203 ms |
| Memory after GC | 5 | +35 MB | +43 MB |

**Chromium, 5 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Main-thread busy | 5 | −60 points | −56 points |
| CPU, all threads | 5 | +14 points | +26 points |
| Typing, median of 5 | 5 | −49 ms | −16 ms |
| First data | 5 | +221 ms | +284 ms |
| All 72 widgets with data | 5 | +1.1 s | +1.3 s |
| Recovery after a 3 s block | 5 | +175 ms | +321 ms |
| Memory after GC | 5 | +33 MB | +42 MB |

**Chromium, 5 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Main-thread busy | 5 | −61 points | −51 points |
| CPU, all threads | 5 | +8 points | +22 points |
| Typing, median of 5 | 5 | −40 ms | +1 ms |
| First data | 5 | +84 ms | +308 ms |
| All 72 widgets with data | 5 | −813 ms | +157 ms |
| Recovery after a 3 s block | 5 | −296 ms | −86 ms |
| Memory after GC | 5 | +42 MB | +49 MB |

**Firefox, 1 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | −49 ms | −30 ms |
| First data | 5 | +162 ms | +501 ms |
| All 72 widgets with data | 5 | +351 ms | +1.2 s |
| Recovery after a 3 s block | 5 | +210 ms | +402 ms |

**Firefox, 1 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | −43 ms | −14 ms |
| First data | 5 | +489 ms | +721 ms |
| All 72 widgets with data | 5 | −409 ms | +409 ms |
| Recovery after a 3 s block | 5 | +77 ms | +374 ms |

**Firefox, 5 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | −28 ms | +2 ms |
| First data | 5 | +353 ms | +546 ms |
| All 72 widgets with data | 5 | +1.4 s | +1.5 s |
| Recovery after a 3 s block | 5 | +222 ms | +415 ms |

**Firefox, 5 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | −63 ms | −9 ms |
| First data | 5 | +541 ms | +672 ms |
| All 72 widgets with data | 5 | −606 ms | +1.3 s |
| Recovery after a 3 s block | 5 | +313 ms | +401 ms |

**WebKit, 1 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | +61 ms | +206 ms |
| First data | 5 | −93 ms | +551 ms |
| All 72 widgets with data | 5 | −209 ms | +1.3 s |
| Recovery after a 3 s block | 5 | +208 ms | +469 ms |

**WebKit, 1 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 4 | +96 ms | +209 ms |
| First data | 4 | +439 ms | +821 ms |
| All 72 widgets with data | 4 | −480 ms | +1.2 s |
| Recovery after a 3 s block | 4 | −310 ms | +325 ms |

**WebKit, 5 kHz: native (A) and Isoloop `one` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | +158 ms | +204 ms |
| First data | 5 | +301 ms | +378 ms |
| All 72 widgets with data | 5 | +588 ms | +1.7 s |
| Recovery after a 3 s block | 5 | +134 ms | +573 ms |

**WebKit, 5 kHz: native + workers (A) and Isoloop `matched` (B)**

| Figure | Rounds | Lowest Δ | Highest Δ |
| --- | --- | --- | --- |
| Typing, median of 5 | 5 | +194 ms | +219 ms |
| First data | 5 | +497 ms | +611 ms |
| All 72 widgets with data | 5 | −142 ms | +663 ms |
| Recovery after a 3 s block | 5 | −288 ms | +718 ms |

</details>

<details>
<summary>Measured alongside, without a pair</summary>

| | Chromium, 1 kHz | Chromium, 5 kHz | Firefox, 1 kHz | Firefox, 5 kHz | WebKit, 1 kHz | WebKit, 5 kHz |
| --- | --- | --- | --- | --- | --- | --- |
| Isoloop `split`: Main-thread busy | 27% | 27% | – | – | – | – |
| Isoloop `split`: CPU, all threads | 114% | 129% | – | – | – | – |
| Isoloop `split`: Typing, median of 5 | 24 ms | 43 ms | 76 ms | 96 ms | 228 ms | 234 ms |
| Isoloop `split`: First data | 815 ms | 886 ms | 1.3 s | 1.3 s | 1.3 s | 1.3 s |
| Isoloop `split`: All 72 widgets with data | 1.8 s | 1.6 s | 2.6 s | 2.2 s | 2.8 s | 2.8 s |
| Isoloop `split`: Recovery after a 3 s block | 3.3 s | 3.4 s | 3.4 s | 3.5 s | 3.7 s | 3.8 s |
| Isoloop `split`: Memory after GC | 293 MB | 331 MB | – | – | – | – |

</details>

<details>
<summary>Stopped pages (1)</summary>

- WebKit, 1 kHz, round 3, Isoloop `matched`: page stopped during warm-up (page.waitForTimeout: Page crashed).

</details>

<details>
<summary>Method, and how to run it again</summary>

Each configuration runs one page at a time, interleaved: round 1 runs every configuration once, then round 2, so drift on the machine falls on both sides of a pair. On each page: 6 s of warm-up, a 10 s window with no input (main-thread busy is CDP `TaskDuration`, all-thread CPU is the renderer’s, both as a share of one core), 5 keystrokes into a widget’s filter (typing), memory after a forced GC in the page and every worker (renderer PSS, Chromium on Linux), then a 3 s block of one machine’s gauges (recovery: until every affected widget shows data from after the click). Firefox and WebKit report the timings only. Raw results are the JSON files beside this one, one per page; `run.json` and `environment.json` hold the arguments, the machine and the versions.

```bash
pnpm --filter ./apps/bench/plant bench
```

</details>

