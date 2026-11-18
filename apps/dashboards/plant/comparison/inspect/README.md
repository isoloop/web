# The inspection feed's cost (M4b task 6)

`isoloop:matched` (A) against `isoloop:matched+inspect` (B): the same placement at 5 kHz, with B keeping a reader on `kernel.inspect()` for the whole run ([`src/isoloop/inspect.ts`](../../src/isoloop/inspect.ts)), as an open devtools panel or dev MCP would. 5 rounds, interleaved, one page at a time, `--hold 0`.

- **Machine:** the dedicated bench machine (AMD Ryzen 7 5825U), bench mode on (cores fixed at 2.0 GHz), the container pinned to `--cpuset-cpus=2,4,6,8`, image `mcr.microsoft.com/playwright:v1.65.0-noble`, 2026-11-18.
- **Library:** `isoloop/isoloop` main at `ce4dc9a`, packed locally, since `kernel.inspect()` wasn't on npm yet. It has the feed (#247, #248, #255) and memory per isolate (#259).
- **Two runs:**
  - [`coi-results/`](coi-results/summary.md): Chromium, cross-origin isolated (`PLANT_COI=1`, full Chromium), so B's feed also measures memory per isolate. It got 1 or 2 measurements per run (105 to 210 isolate figures), at Chromium's pace.
  - [`results/`](results/summary.md): Chromium (headless shell) and Firefox, not isolated, so no memory measurement.

| Figure, median gap B − A (spread) | Chromium, isolated | Chromium | Firefox |
| --- | --- | --- | --- |
| Main-thread CPU | −0 pp (−2 to +1) | +0 pp (0 to +0) | – |
| CPU, all threads | +1 pp (−7 to +1) | −3 pp (−13 to +7) | – |
| Memory, first reading, after GC | +1 MB (−9 to +4) | −1 MB (−3 to +10) | – |
| Typing (median of 5) | +8 ms (−9 to +25) | +1 ms (−10 to +24) | +16 ms (−33 to +33) |
| Late frames | 0 | 0 | +1 (−1 to +2) |
| Recovery after a 3 s block | +75 ms (−63 to +130) | +55 ms (−84 to +88) | −110 ms (−297 to −4) |

Every gap is inside its own round spread: on this machine, at this load, the open feed's cost is below what the comparison can tell apart. Firefox reports no CPU or memory figures (Chromium on Linux only).

**The ring buffer**, which every Isoloop run keeps whether anyone reads it: 200 events, about 18 KB as JSON on Chromium and 15 KB on Firefox, full within the first seconds of the page (plant's start-up alone sends more than 200 events).

The write-up is [`docs/investigations/inspect-feed-cost.md`](https://github.com/isoloop/isoloop/blob/main/docs/investigations/inspect-feed-cost.md) in `isoloop/isoloop`.
