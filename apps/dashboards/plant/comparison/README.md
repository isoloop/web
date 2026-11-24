# The recorded comparison

## Recorded runs, newest first

- [`agent-cost/`](agent-cost/README.md): one `kernel.request`'s cost (M4a task 13), on an idle page and at 5 kHz, on the dedicated machine with `@isoloop/*@0.1.0-next.5`.
- [`inspect/`](inspect/README.md): the inspection feed's cost (M4b task 6), `matched` at 5 kHz with a reader on `kernel.inspect()` against without, on the dedicated machine with `isoloop/isoloop` main at `ce4dc9a`.
- [`interactive/final/`](interactive/final/README.md): the interactive page's head-to-head (M3e), written up, native against Isoloop at 5 kHz, on the dedicated machine at `a5562f0` with `@isoloop/*@0.0.0-next.g3322248`. How it runs is [below](#the-interactive-page-interactivets).
- [`final/`](final/README.md): the figures that ship with `plant-v0.1.0`, on the dedicated machine with `@isoloop/*@0.0.0-next.b8ffdcf`.
- [`phone/ikko-mindone-focus156/`](phone/ikko-mindone-focus156/README.md): a mid-range phone, Firefox Focus 156.
- [`phone/galaxy-fold6-chrome157/`](phone/galaxy-fold6-chrome157/README.md): a flagship phone, Chrome 157.
- [`matched-v2/`](matched-v2/README.md): the dedicated machine with combined commits. Includes the 10-minute memory figures.
- [`cpu-baseline/`](cpu-baseline/README.md): the per-thread CPU probe after the metrics sampler fix.
- [`matched-q6/`](matched-q6/README.md): after the timings fix.
- [`matched/`](matched/README.md): the first matched head-to-head on the dedicated machine.
- [`desktop-4core/`](desktop-4core/summary.md): the first local run, described below.


The plant dashboard (M3d task 11). It compares native, native + workers and the Isoloop build in each placement, at 1, 2 and 5 kHz vibration. Results are measured on Chromium, Firefox and WebKit, one page at a time.

**This recording:** a local desktop under WSL2, restricted to 4 cores with `taskset -c 0-3` to stand in for decision 10's 4-core desktop. Playwright 1.64.1, headless, no GPU, seed 7, 2026-11-09. The raw numbers are in [`desktop-4core/`](desktop-4core/) and the tables in [`desktop-4core/summary.md`](desktop-4core/summary.md).

To rerun it:

- On CI, the *Comparison (plant)* workflow (`.github/workflows/comparison-plant.yml`): GitHub's 4-core runner, one job per engine.
- Locally: `pnpm --filter ./apps/dashboards/plant compare`. To use 4 cores, prefix it with `taskset -c 0-3`.

What each run does, and what each figure covers, is in [`e2e/comparison.spec.ts`](../e2e/comparison.spec.ts):

1. 6 s of warm-up.
2. A 10 s window with no input, for frames, long tasks and CPU.
3. 5 keystrokes into T1's event-log filter (a widget).
4. A 3 s block of T3's gauges, for the fault figures.

## Head-to-head runs (`run.ts`)

`run.ts` runs pairs of configurations against each other, a native build (A) and an Isoloop placement (B), interleaved: A, B, A, B, for N rounds, one page at a time. In each round it reads memory twice, once after the measuring window (about 16 s after navigation) and once at the hold (10 min by default), each time before and after a forced GC in the page and every worker. It writes each run's JSON and `summary.md`, with the median gap B − A per round, as a share of A, and the gap's spread across rounds.

The two pairs it was written for:

- `native` vs `isoloop:one`: everything on one thread against everything in one worker.
- `native-workers` vs `isoloop:matched`: one data worker per machine and one for the fleet on both sides. Isoloop adds one worker for all 72 widgets, plus the bus's worker, which the worker counts leave out.

```bash
pnpm --filter ./apps/dashboards/plant compare:pairs \
  --pair native=isoloop:one --pair native-workers=isoloop:matched \
  --extra isoloop:split --rates 1,5 --rounds 5 --hold 600 \
  --engines chromium,firefox --out comparison/matched/results
```

Arguments are in the header of [`run.ts`](run.ts). `--summary-only` rebuilds `summary.md` from the JSON already in `--out`.

The runner itself is shared with the markets dashboard: [`packages/compare`](../../../../packages/compare/README.md). `run.ts` gives it the plant's projects, its load knob (`--rates`) and its figures; `run.test.ts` checks that it rebuilds the recorded summaries unchanged. The spec's CPU, memory and GC readings come from the same package (`compare/probes`).

Durations: each run takes about 1 minute plus the hold. The command above has 5 configurations × 2 rates × 5 rounds × 2 engines = 100 runs, at about 11 minutes each, so roughly 18 hours. `--hold 0` skips the 10-minute reading, at about 1 minute a run.

Memory figures (renderer PSS from `/proc`) are Chromium on Linux only. Firefox runs report frames, typing, start-up and the fault figures.

### In Docker, on a dedicated machine

[`Dockerfile`](Dockerfile) is Playwright's official image at the repo's Playwright version (1.64.1, with its browsers), plus Node 26 and pnpm (installed with npm; Node 25+ no longer ships corepack). From a clone of `isoloop/examples` used only for this:

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g \
  -v "$PWD":/work -w /work plant-compare \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/dashboards/plant compare:pairs \
    --pair native=isoloop:one --pair native-workers=isoloop:matched \
    --extra isoloop:split --rates 1,5 --rounds 5 --hold 600 \
    --engines chromium,firefox --out comparison/matched/results'
```

- `--cpuset-cpus=2,4,6,8` pins the run to 4 physical cores, one thread each, as `taskset` does locally. On a machine with two threads per core, CPUs 0–3 are only 2 physical cores; `lscpu -e=CPU,CORE` shows the pairing. Core 0 is left out because it takes most interrupts. Drop the flag to use the whole machine.
- `--shm-size=2g` gives Chromium enough shared memory; Docker's default of 64 MB is too small for it.
- The results land in `apps/dashboards/plant/comparison/matched/results/`, owned by root, because the container runs as root.
- `run.json` there records the arguments and the CPUs the run was allowed.

## The inspection feed's cost

M4b task 6 ([ADR 0020](https://github.com/isoloop/isoloop/blob/main/docs/adr/0020-inspection-feed.md)): what an open devtools panel or dev MCP costs the page. The configuration `isoloop:matched+inspect` is `matched` with `?inspect=1`, which keeps a reader on `kernel.inspect()` for the whole run ([`src/isoloop/inspect.ts`](../src/isoloop/inspect.ts)), so a pair against plain `isoloop:matched` gives the feed's cost. Every Isoloop run also records the ring buffer's size as JSON (`ringJsonKb`, with the feed's message counts under `inspect`), since the kernel keeps it whether anyone reads it.

`PLANT_COI=1` makes the preview server cross-origin isolated (COOP/COEP) and runs the Chromium project in full Chromium instead of the headless shell, so the feed also measures memory per isolate. Both sides of the pair then run isolated, so it measures the feed, not the headers.

```bash
PLANT_COI=1 pnpm --filter ./apps/dashboards/plant compare:pairs \
  --pair isoloop:matched=isoloop:matched+inspect --rates 5 --rounds 3 --hold 0 \
  --engines chromium --out comparison/inspect/results
```

CI runs it in the *Comparison (plant)* workflow's `inspect` job (Chromium isolated, Firefox without the headers), report-only.

## The agent-call cost

M4a task 13 ([decision 20](https://github.com/isoloop/isoloop/blob/main/docs/plans/m4a-agents.md)): what one `kernel.request` from the main thread costs, the call every agent transport makes (the dev MCP and WebMCP add their own hop, which isn't measured here). Plant has no requestable topic, so a build made with `PLANT_AGENT_COST=1` adds one, `plant.bench.ping.v1`, and a headless isolate that answers each call with its own value: the round trip is host → bus → isolate → bus → host with no handler work. Without the flag the topic, the isolate and the runner are compiled out; the Isoloop, native and interactive builds are byte for byte what they were before ([`src/isoloop/agent-cost.ts`](../src/isoloop/agent-cost.ts)).

[`e2e/agent-cost.spec.ts`](../e2e/agent-cost.spec.ts) runs two pages per round, interleaved, one at a time: `?agent=idle` (the kernel, the bus and the ping isolate only) and the Isoloop build at 5 kHz in `matched`. Per page, with 1 call in flight and then 8, it records each call's round trip; on Chromium, the main thread's time per call (CDP `TaskDuration` over the calls, less the page's own rate in the quiet windows beside them); and on both engines the time issuing one call holds the main thread, from 1,000 calls issued back to back.

```bash
AGENT_COST_ROUNDS=5 AGENT_COST_OUT=comparison/agent-cost/results \
  pnpm --filter ./apps/dashboards/plant compare:agent-cost
node apps/dashboards/plant/comparison/agent-cost.ts apps/dashboards/plant/comparison/agent-cost/results
```

## The interactive page (`interactive.ts`)

M3e decision 22: on plant's interactive page (`/interactive/native/` against `/interactive/isoloop/`, at 5 kHz), whether work in the drawer reaches the dashboard, and whether the dashboard's load reaches the drawer. [`e2e/interactive-compare.spec.ts`](../e2e/interactive-compare.spec.ts) runs one page per run:

1. Load, wait until the starters draw, warm up (`--warm`).
2. An idle window (`--window`), drawer closed: the reference.
3. **Dashboard → drawer:** the drawer open on its default draft (light). 10 keystrokes into the title and 10 clicks (add a condition, remove it), one at a time.
4. **Drawer → dashboard, typical:** the draft made a typical widget (`plant.scalars`, bearing temp p95 over 120 s, every 1 s, by machine, a line: about 4,800 records), then a window with a keystroke into the title every 500 ms; each one makes the preview rebuild its pipeline from its buffer.
5. **Drawer → dashboard, heavy:** the drawer's "Try a heavy widget" preset (`plant.vib`, the 99th percentile of every raw vibration sample over 30 s, every 1 s, by machine, a line). At 5 kHz that's about 1.2 million samples, sorted into eight percentiles each second, and each rebuild backfills the 30 s; then the same typed window. On native it runs on the main thread, on Isoloop in the preview's own worker.

**Widget work yields in slices** (`packages/creator`, `SLICE_MS` = 10 ms), on both pages, with the same code. A widget's pipeline advances in units (one aggregate, for one group at one tick), and the widget hands its thread back after each 10 ms slice and goes on in the next task. The first heavy read replays all 30 s, about 1.3 s of sorting on a fast core and 3–4 s on bench machine 1's 2.0 GHz cores. In one block, that's longer than the page's heartbeat `killAfterMs` (2 s), so the kernel took the preview's worker for hung: `blocked`, then `crashed` (`unresponsive`), restarted it into the same work, and after the restart limit left it `failed`. The first server run (`76efc0e`, 2026-11-16) stopped every Isoloop round there for that reason. Slicing costs the same work in total; the largest unit is one sort of one machine's 30 s (about 150k samples, ~15 ms on a fast core). On the native page it also breaks the main thread's long tasks up: on a 4-core dev slice, the heavy preview's 11 long tasks (the longest 1.2 s) became none over 50 ms.

`plant.vib` is each machine's raw vibration chunks, also published to one topic keyed by machine. On the Isoloop page the feed isolates publish that copy at all times, so it's in every window's figures, drawer open or closed; on the native page the merged topic is read from the machines' own streams only while a widget reads it.

The figures:

- **Draw gaps:** the time between two draws of a starter canvas (line, heatmap, bar), from `data-drawn-at`, the time each draw ran, on the drawing thread's clock (the widget's worker on Isoloop, the main thread on native). Widgets read their pipeline every 100 ms; a gap over 250 ms is counted.
- **Main-thread frames:** gaps between the page's animation frames; over 25 ms is counted.
- **Typing:** from the keydown on the page to the first animation frame after the drawer's form has rendered the new title (`data-title`, set by the drawer, in its own worker on Isoloop). The keydown's time is the event's `timeStamp`, when the browser took the input, so time spent waiting behind a busy main thread counts. In the typed windows, the keystrokes sent (of 20, one per 500 ms) are reported too: fewer means each press waited for the page.
- **Clicks:** from the click (its `timeStamp`) to the first animation frame after the form shows one condition more or fewer.
- **CPU:** main thread and all renderer threads, % of one core, Chromium only.

The page is timed from inside itself, by an init script that also watches the isolates' shadow roots, so Playwright's polling isn't in the figures.

```bash
pnpm --filter ./apps/dashboards/plant compare:interactive \
  --pair native=isoloop --rates 5 --rounds 5 --hold 0 \
  --engines chromium,firefox --out comparison/interactive/final
```

On CI, the `interactive` job of *Comparison (plant)* runs 3 rounds per engine, report-only. With a preview already on port 4792 from another checkout, serve this one elsewhere and pass `LIVE_URL=http://localhost:<port>`, so the runs don't measure the other build.

On bench machine 1, as above, after `sudo ~/bench-mode on`, holding the lock other runs on that machine take:

```bash
cd ~/bench/web && git fetch origin && git checkout --detach origin/main
docker build -t plant-compare apps/dashboards/plant/comparison
flock ~/bench/.lock docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g \
  -v "$PWD":/work -w /work plant-compare \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/dashboards/plant compare:interactive \
    --pair native=isoloop --rates 5 --rounds 5 --hold 0 \
    --engines chromium,firefox --out comparison/interactive/final'
```

2 pages × 5 rounds × 2 engines = 20 runs of about a minute and a half each.

## Chromium, 4 cores, 1 kHz and 5 kHz

| Rate | Build | Workers | Late frames (of 600) | Typing (median) | Main-thread CPU | Renderer CPU, all threads | Renderer memory | Recovery after a 3 s block | Data gap, T3 | Data gap, other machines |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 kHz | Native | 0 | 0 | 15 ms | 28% | 34% | 205 MB | 3.2 s | 3.8 s | 3.8 s |
| 1 kHz | Native + workers | 9 | 5 | 12 ms | 37% | 45% | 248 MB | 3.1 s | 0 | 0 |
| 1 kHz | Isoloop, split | 18 | 0 | 32 ms | 18% | 73% | 465 MB | 3.2 s | 0 | 0 |
| 1 kHz | Isoloop, machine | 10 | 0 | 32 ms | 13% | 57% | 451 MB | 3.4 s | 3.3 s | 0 |
| 1 kHz | Isoloop, shared-engines | 12 | 0 | 31 ms | 11% | 53% | 430 MB | 3.4 s | 0 | 0 |
| 1 kHz | Isoloop, own | 105 | 0 | 33 ms | 15% | 76% | 820 MB | 2.4 s | 0 | 0 |
| 5 kHz | Native | 0 | 0 | 15 ms | 35% | 41% | 217 MB | 3.1 s | 3.0 s | 3.0 s |
| 5 kHz | Native + workers | 9 | 0 | 13 ms | 34% | 45% | 268 MB | 3.1 s | 0 | 0 |
| 5 kHz | Isoloop, split | 18 | 0 | 32 ms | 15% | 74% | 558 MB | 2.6 s | 0 | 0 |
| 5 kHz | Isoloop, own | 105 | 0 | 31 ms | 18% | 100% | 949 MB | 2.5 s | 0 | 0 |

The 2 kHz rows, the other placements and Firefox and WebKit are in [`summary.md`](desktop-4core/summary.md).

## What the numbers show, on this machine

- **The hypothesis (decision 10) doesn't hold on this desktop.** It was that native would drop frames and type slower than 100 ms, with Isoloop closer to 60 fps and under 100 ms.
  - On Chromium and Firefox, every build keeps 60 fps at every rate: 0 to 5 late frames of 600.
  - Typing stays under 100 ms everywhere: native 14–23 ms, native + workers 6–21 ms, Isoloop 21–50 ms.
  - Native keeps headroom, so the hypothesis is falsified for this machine, as decision 10 allows. Against native + workers, Isoloop does no better on frames or typing.
- **Isoloop moves work off the main thread and uses more in total.** On Chromium, Isoloop's main thread runs 11–18% against native's 28–35%. Across all threads it uses 53–76% of a core in its pooled placements against native's 34–41%, and 100% in `own` at 5 kHz. Memory is 430–560 MB pooled and 820–950 MB in `own`, against native's 205–220 MB.
- **Typing costs Isoloop about 15–30 ms more:** the keystroke goes to the widget's worker and back (engine constraint 3).
- **Pools cut what own workers cost.** `machine` (10 workers) and `shared-engines` (12) use less CPU and memory than `split` (18), and much less than `own` (105).
- **Faults show where each placement draws its lines:**
  - **Native:** a 3 s block stalls the whole page. Every machine loses 3–4 s of data, because the feeds on the main thread can't run.
  - **Native + workers:** the page stalls too, but the data workers keep producing, so there's no data gap.
  - **Isoloop:** the kernel kills the blocked pool after 2 s and it restarts. In `split`, `shared-engines` and `own` only widgets restart, and no data is lost. In `machine` the machine's feed is in the pool, so T3 alone loses about 3 s of data. Recovery is 2.4–3.5 s on every build; on Isoloop it is the kill delay plus the restart.
- **WebKit (Playwright, Linux, no GPU):**
  - The Isoloop page stops in every placement: engine constraint 2, with 8 waveforms scrolling every frame in workers.
  - Native and native + workers run at 39–52 fps there, with 85–186 late frames.
  - Not checked in Safari on macOS or iOS.
- Start-up: first data at 170–320 ms on native builds and 290–1,100 ms on Isoloop (`own` is slowest). All 72 widgets show data within 1.1–2.5 s on every build.

These are one run per configuration on one machine. CI's runner will give different absolute numbers.

## Phone run (manual, not yet recorded)

Decision 11 asks for a mid-range phone. To record one:

1. Build and serve on the local network:

   ```bash
   pnpm --filter ./apps/dashboards/plant build
   pnpm --filter ./apps/dashboards/plant preview --host --port 4792
   ```

2. On the phone, open `http://<computer's LAN address>:4792/<build>/?rate=1`. Do it for `native`, `native-workers` and `isoloop` (with `&placement=split`, then each other placement).
3. Wait about 10 s. Open **Record 10 s**, press **Record**, and type into the *Type here* box until it finishes.
4. Copy the JSON it shows into `comparison/phone/<build>-<placement>-<rate>khz.json`. Note the phone's model and browser.
5. `own` may not run on a phone. If it doesn't, record that as the result (decision 6).
