# The inspection feed's cost (M4b task 6)

`isoloop:matched` (A) against `isoloop:matched+inspect` (B): the same placement at 5 kHz, with B keeping a reader on `kernel.inspect()` for the whole run ([`src/isoloop/inspect.ts`](../../src/isoloop/inspect.ts)), as an open devtools panel or dev MCP would. 5 rounds, interleaved, one page at a time, `--hold 0`.

- **Machine:** the dedicated bench machine (AMD Ryzen 7 5825U), bench mode on (cores fixed at 2.0 GHz), the container pinned to `--cpuset-cpus=2,4,6,8`, image `mcr.microsoft.com/playwright:v1.65.0-noble`, 2026-11-18.
- **Library:** `isoloop/isoloop` main at `ce4dc9a`, packed locally, since `kernel.inspect()` wasn't on npm yet. It has the feed (#247, #248, #255) and memory per isolate (#259). `0.1.0-next.3` on npm, which this repo pins, is built from `730b148` (tag `v0.1.0-next.3`): `ce4dc9a` plus only its version commit, so the CI job and the command in [the comparison README](../README.md#the-inspection-feeds-cost) run the same library from the pin.
- **Plant:** this folder's recording PR (isoloop/web#170), at its first commit, `01512ba` before the rebase (`858ba47` after).
- **Two runs:**
  - [`coi-results/`](coi-results/summary.md): Chromium, cross-origin isolated (`PLANT_COI=1`, full Chromium), so B's feed also measures memory per isolate. Per run, rounds 1 to 5: 1, 1, 2, 2 and 2 measurements, with 105, 105, 210, 137 and 210 isolate figures, at Chromium's pace.
  - [`results/`](results/summary.md): Chromium (headless shell) and Firefox, not isolated, so no memory measurement.

| Figure, median gap B − A (spread) | Chromium, isolated | Chromium | Firefox |
| --- | --- | --- | --- |
| Main-thread CPU | −0 pp (−2 to +1) | +0 pp (0 to +0) | – |
| CPU, all threads | +1 pp (−7 to +1) | −3 pp (−13 to +7) | – |
| Memory, first reading, after GC | +1 MB (−9 to +4) | −1 MB (−3 to +10) | – |
| Typing (median of 5) | +8 ms (−9 to +25) | +1 ms (−10 to +24) | +16 ms (−33 to +33) |
| Late frames | 0 | 0 | +1 (−1 to +2) |
| Recovery after a 3 s block | +75 ms (−63 to +130) | +55 ms (−84 to +88) | −110 ms (−297 to −4) |

Each cell is the median of the 5 per-round gaps, B − A, with the lowest and highest round in brackets. Firefox reports no CPU or memory figures (Chromium on Linux only).

- **Spreads that straddle zero:** main-thread CPU, memory, late frames and Chromium's recovery, on every engine; all-thread CPU on headless Chromium; typing on every engine.
- **Leaning one way:** on isolated Chromium, all-thread CPU's median gap is +1 pp, the top of its spread (−7 to +1): most rounds had B at about +1 pp. Typing there is +8 ms (+31%) at the median, though its spread is −9 to +25 ms.
- **The other way, not explained:** on Firefox, recovery after the 3 s block was faster with the feed open in all 5 rounds (−297 to −4 ms, median −110 ms).

So at this load the open feed's cost is small next to the round-to-round spread on most figures, about +1 pp of total CPU on isolated Chromium. Five rounds aren't enough to separate a gap of that size from the spread.

**The ring buffer**, which every Isoloop run keeps whether anyone reads it: 200 events, about 18 KB as JSON on Chromium and 15 KB on Firefox, full within the first seconds of the page (plant's start-up alone sends more than 200 events).

The write-up is in review as [isoloop/isoloop#262](https://github.com/isoloop/isoloop/pull/262).
