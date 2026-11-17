# Plant interactive page, native against Isoloop

M3e's head-to-head (decision 22), run on the bench server on 2026-11-16: plant's interactive page at 5 kHz, where a drawer creates widgets and adds them to the dashboard, built two ways.

- **Native** (`/interactive/native/`): the dashboard's widgets, the drawer and its preview all on the main thread.
- **Isoloop** (`/interactive/isoloop/`): each widget a visual isolate. The drawer's form and its preview each have a worker of their own, never pooled.

Both run the same widget code, which yields in 10 ms slices (web#126). The question has two directions: whether work in the drawer reaches the dashboard, and whether the dashboard's load reaches the drawer. The runner's tables are in [`summary.md`](summary.md).

## What we found

On four cores at 2.0 GHz, at 5 kHz:

1. **A heavy preview fills the native main thread. On Isoloop it runs on the preview's own worker.**
   - The heavy preview takes the 99th percentile of every raw vibration sample over 30 s, by machine, every second: about 1.2 million samples.
   - On native, the main thread was busy 93% of the time (Chromium). It dropped 25 frames over 25 ms on Chromium and 138 on Firefox, where the page ran at 26 fps.
   - On Isoloop the main thread was busy 3%, and neither browser dropped a frame.
   - In both builds every starter widget kept drawing, with no gap over 250 ms. The longest gap was 180 ms on native Chromium and 205 ms on native Firefox, against 106 ms and 121 ms on Isoloop.
2. **The heavy preview drew sooner on Isoloop:** 4.3 s after it was opened against 5.4 s on Chromium, and 2.9 s against 3.6 s on Firefox. On native the preview shares the main thread with the dashboard; on Isoloop it has a worker of its own.
3. **Running the preview on a worker of its own uses more CPU in total:** 127% of a core across all threads, against 100% on native (Chromium). With the drawer closed, the Isoloop page used 39% against 28%.
4. **The drawer answers in 30 to 50 ms on Isoloop, against 3 to 13 ms on native.**
   - With a light draft, typing took 43 ms (median) against 7 ms on Chromium, and 33 ms against 5 ms on Firefox. Clicks took 47 ms against 12 ms, and 28 ms against 4 ms.
   - On Isoloop each keystroke goes from the page to the drawer's worker and back before the form shows it. On native the form is on the main thread.
   - Under the heavy preview, native typing on Firefox rose to 27 ms (p95 63 ms), against Isoloop's 29 ms (p95 43 ms). On Chromium native stayed at 9 ms. Every keystroke was echoed on both builds.
5. **At 5 kHz the dashboard's own load didn't reach the drawer on either build.** With the drawer closed, native's main thread was busy 23% of the time (Chromium); with it open on a light draft, typing took 7 ms. On this machine the dashboard alone doesn't load the main thread enough for the drawer to wait.
6. **A typical preview made no difference to the dashboard.** The typical preview is a bearing temperature p95 over 2 minutes, about 4,800 records. Neither build dropped a frame or had a draw gap over 250 ms. The first draw's median gap was 6 ms on Chromium and 76 ms on Firefox, inside the rounds' spread on Chromium.
7. **This replaces the first server run** (`76efc0e`, 2026-11-16), which every Isoloop round stopped in. The heavy preview's first read then ran in one block for 3–4 s, over the page's 2 s `killAfterMs`, so the kernel took its worker for hung and gave up after the restarts. Slicing the widget work (web#126) fixed it, on both builds: in that first run the native heavy preview took 4.0 s to its first draw on Chromium, left a 5.4 s gap in the dashboard's draws, and only 6 of 20 keystrokes were sent (Firefox: 2.6 s, 3.4 s, and 8 of 20).

## The numbers

- **A negative Δ means Isoloop is lower.** Lower is better for every figure but keystrokes sent.
- **Δ is Isoloop − native:** the median, over the 5 rounds, of each round's gap. So it can differ by a little from subtracting the two columns, which are medians over the rounds.
- **CPU figures** are % of one core, Chromium only.
- **Draw gaps** are between two draws of a starter widget's canvas.
- **Frames** are the page's main-thread animation frames.

### Chromium

| Figure | Native | Isoloop | **Δ** |
| --- | --- | --- | --- |
| Drawer closed: main-thread CPU | 23% | 3% | **−20 points** |
| Drawer closed: longest draw gap | 101 ms | 108 ms | **+7 ms** |
| Light draft: typing, median | 7 ms | 43 ms | **+36 ms** |
| Light draft: typing, p95 | 10 ms | 48 ms | **+39 ms** |
| Light draft: clicks, median | 12 ms | 47 ms | **+36 ms** |
| Typical preview: first draw | 447 ms | 363 ms | **−6 ms** |
| Typical preview: frames over 25 ms | 0 | 0 | **0** |
| Typical preview: CPU, all threads | 31% | 44% | **+12 points** |
| Typical preview: typing, median | 10 ms | 43 ms | **+33 ms** |
| Heavy preview: first draw | 5,385 ms | 4,327 ms | **−1,055 ms** |
| Heavy preview: draw gaps over 250 ms | 0 | 0 | **0** |
| Heavy preview: longest draw gap | 180 ms | 106 ms | **−67 ms** |
| Heavy preview: frames over 25 ms | 25 | 0 | **−25** |
| Heavy preview: main-thread CPU | 93% | 3% | **−90 points** |
| Heavy preview: CPU, all threads | 100% | 127% | **+27 points** |
| Heavy preview: typing, median | 9 ms | 44 ms | **+35 ms** |
| Heavy preview: typing, p95 | 17 ms | 51 ms | **+33 ms** |
| Heavy preview: keystrokes sent (of 20) | 20 | 20 | **0** |

### Firefox

| Figure | Native | Isoloop | **Δ** |
| --- | --- | --- | --- |
| Drawer closed: longest draw gap | 118 ms | 118 ms | **0 ms** |
| Light draft: typing, median | 5 ms | 33 ms | **+27 ms** |
| Light draft: typing, p95 | 9 ms | 49 ms | **+37 ms** |
| Light draft: clicks, median | 4 ms | 28 ms | **+25 ms** |
| Typical preview: first draw | 638 ms | 503 ms | **−76 ms** |
| Typical preview: frames over 25 ms | 0 | 0 | **0** |
| Typical preview: typing, median | 3 ms | 29 ms | **+26 ms** |
| Heavy preview: first draw | 3,589 ms | 2,879 ms | **−618 ms** |
| Heavy preview: draw gaps over 250 ms | 0 | 0 | **0** |
| Heavy preview: longest draw gap | 205 ms | 121 ms | **−85 ms** |
| Heavy preview: frames over 25 ms | 138 | 0 | **−138** |
| Heavy preview: typing, median | 27 ms | 29 ms | **+1 ms** |
| Heavy preview: typing, p95 | 63 ms | 43 ms | **−17 ms** |
| Heavy preview: keystrokes sent (of 20) | 20 | 20 | **0** |

## Details

<details>
<summary>The run</summary>

- **Where:** the bench server, 4 cores fixed at 2.0 GHz, Docker `--cpuset-cpus=2,4,6,8`, the `plant-compare` image at Playwright 1.65.
- **What:** `a5562f0` with `@isoloop/*@0.0.0-next.g3322248`, seed 7, at 5 kHz.
- **How:** Chromium and Firefox, 5 rounds of native then Isoloop, one page at a time, a 6 s warm-up and a 10 s window. 20 runs, none stopped.
- **The command** and what each step of a run does are in [the comparison README](../../README.md#the-interactive-page-interactivets).

</details>

<details>
<summary>Notes on the figures</summary>

- **The drawer's windows**, in order:
  - the drawer closed;
  - the drawer open on its default draft, with 10 keystrokes and 10 clicks;
  - the typical preview;
  - the heavy preview.
  The two preview windows have a keystroke into the title every 500 ms, and each one rebuilds the preview's pipeline from its buffer.
- **Draw gaps** come from `data-drawn-at`, the time each draw ran, on the drawing thread's clock: the widget's worker on Isoloop, the main thread on native. Widgets read their pipeline every 100 ms, so about 100 ms is a widget drawing on time.
- **Typing** runs from the keydown's `timeStamp`, when the browser took the input, to the first animation frame after the form shows the new title. So time spent waiting behind a busy main thread counts. **Clicks** are timed the same way, to the form showing one condition more or fewer.
- **The first draw** of a preview is from choosing it in the drawer to its first canvas draw. The heavy preview's first read backfills 30 s of samples.
- **`plant.vib`** is each machine's raw vibration, also published to one topic keyed by machine. On the Isoloop page the feed isolates publish it all the time, so it's in every window's figures. On native it's read from the machines' streams only while a widget reads it.
- What every figure covers is in the header of [`../../../e2e/interactive-compare.spec.ts`](../../../e2e/interactive-compare.spec.ts).

</details>

<details>
<summary>Gaps with their spread across the 5 rounds</summary>

Gap Isoloop − native, median of 5 rounds, lowest to highest round in brackets. The full tables are in [`summary.md`](summary.md), and the raw figures in `chromium/*.json` and `firefox/*.json`.

| Figure | Chromium | Firefox |
| --- | --- | --- |
| Light draft: typing, median | +36 ms (+34 to +38) | +27 ms (+19 to +30) |
| Light draft: clicks, median | +36 ms (+35 to +36) | +25 ms (+24 to +28) |
| Heavy preview: first draw | −1,055 ms (−1,410 to −651) | −618 ms (−754 to −481) |
| Heavy preview: longest draw gap | −67 ms (−137 to −51) | −85 ms (−117 to −65) |
| Heavy preview: frames over 25 ms | −25 (−37 to −23) | −138 (−143 to −136) |
| Heavy preview: main-thread CPU | −90 points (−94 to −88) | – |
| Heavy preview: CPU, all threads | +27 points (+22 to +29) | – |
| Heavy preview: typing, p95 | +33 ms (+24 to +38) | −17 ms (−29 to +4) |

</details>
