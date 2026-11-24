# js-bench

It measures plain JavaScript work (no components, no DOM) on the main thread, in plain Workers and in each Isoloop placement, as operations per second. It runs before every Isoloop release, on [bench machine 1](../machines.md), to show what the release changed. Its `summary.json` is for a section of the site's `/benchmarks/` page, which is to show the latest minor or major release (the plan's decisions 13–15). These are measurements, reported whichever way they go. It's never deployed. The plan is [`docs/plans/js-bench.md`](../../../docs/plans/js-bench.md).

## The rules

1. **A private package, pinned exactly.** Every dependency in `package.json` is an exact version, with no `catalog:` and no workspace package. Changesets ignores it. The browsers come from the Playwright image at `playwright`'s version, with Node and pnpm pinned there too ([`Dockerfile`](Dockerfile)).
2. **The code changes only at a generation,** as plant-bench's does. A change to a workload, the harness (`src/`), the Docker image or `calibration.json` means running the last release again before comparing with it. Between generations, only the runner (`runner/`) changes, and never what it measures.
3. **CI only checks that it still runs:** `check.yml` typechecks it and runs its unit tests, and [`bench.yml`](../../../.github/workflows/bench.yml) runs a smoke round of one workload per tier in Chromium, about 2 minutes, and fails if a page stops. The real runs are only on bench machine 1.
4. **It runs before every minor and major release,** never for a patch, on the release candidate, on bench machine 1 in the `base` profile, on the maintainer's go ([below](#before-a-minor-or-major-release)).
5. **Each run's results come in their own PR:** `results/<version>/base/` and the comparison with the last release, nothing else.
6. **The CPU-limited profiles** (`two-core`, `quota`) are internal: run them when useful, never on the site.

## What it measures

**Workloads** (`src/workloads/`), in three tiers. The per-op times are from the calibration on bench machine 1 at 2.0 GHz ([`calibration.json`](calibration.json)).

| Tier | Per op | Workloads |
| --- | --- | --- |
| cheap | 0.9–5 µs | Map get/set, Set add/has/delete, array push/pop/indexOf, object read/write + `Object.keys`, a small filter/map/reduce |
| regular | 0.3–4 ms | sorting 10k numbers, sorting 2k objects on two keys, filter→map→reduce on 10k, building and reading a 10k Map, Set dedupe + `Object.groupBy`, a 50 KB JSON round trip |
| heavy | 46–811 ms | sorting 1M numbers (plain array and Float64Array), sorting 200k objects, 1M Map inserts, `structuredClone` of 5 MB, a 300×300 matrix multiply |

Each op is deterministic from a seed. It returns a number that goes into a sink, so the engine can't drop the work. Sorts work on a copy, and the copy counts as part of the op.

**Placements** (`src/page/`). Each runs the same harness, `src/harness.ts`.

| Placement | What runs where |
| --- | --- |
| `native-main` | the page's main thread, with copies interleaved slice by slice |
| `native-worker` | one plain module `Worker` per copy, using postMessage and no Isoloop |
| `isoloop-own` | one isolate per copy, each in its own pool (the kernel's default) |
| `isoloop-one` | all copies in one pool |
| `isoloop-balancer` | `@isoloop/balancer` places the copies, with `maxWorkers` set from the CPU profile |

`n` is how many copies run at once: 1 or 4. At n=1, `own` and `one` are the same and the balancer has nothing to place, so only `native-main`, `native-worker` and `isoloop-own` run.

**The balancer scenario** (`--scenario`): 2 heavy copies (`sort-typed-1m`, `structured-clone-5mb`) and 6 cheap ones run at once, as `own`, `one` and `balancer`. It records each copy's operations and every balancer event.

### How a run counts

- **Batches:** ops run in batches between clock reads, sized by `pnpm calibrate` to about 1 ms each. Batches run in slices of about 50 ms, and the loop yields between slices, so every event loop keeps turning (bus, heartbeats, the page). Every placement uses the same batch sizes.
- **One shared window:** the page waits until every copy is ready. Then it publishes one wall-clock window (`performance.timeOrigin + performance.now()`): the warm-up, then the measured part. A batch counts when it ends inside the measured part.
- **Isolates publish their running count** on the bus once a second (`jsbench.counts.v1`). After a balancer move, a copy reads its count back and carries on. The time a move takes counts against the copy. Up to 1 s of ops since its last publish is lost per move. A copy's `lives` in the results is how many times it started, counted from the kernel's `isolate:ready` events.
- **Main-thread lateness:** a 100 ms `setInterval` on the page records how late it fires during the window, as p50, p95 and max. That's the cost to the page, which the operation count alone doesn't show.
- **Rounds are interleaved:** each round runs every workload's configs, in an order rotated per round.
- **Checksums:** each copy's first op on fresh inputs gives a checksum. The summary flags any copy whose checksum differs between placements.

The raw result files store operations per minute (`opsPerMin`); the summaries show operations per second.

## Running it

From the repo root:

```bash
pnpm --filter js-bench test          # workloads are deterministic; the harness counts correctly
pnpm --filter js-bench bench:smoke   # the CI smoke, into results-smoke/ (gitignored)
pnpm --filter js-bench bench --quick --workloads map-get-set,sort-objects-2k,sort-typed-1m   # a quick local run
pnpm --filter js-bench summary results/0.1.0/base   # rewrite summary.md and summary.json
```

`pnpm bench` options are in the header of [`runner/run.ts`](runner/run.ts). The defaults are all tiers, n=1 and 4, Chromium, 3 rounds, a 10 s warm-up (30 s for the balancer) and a 60 s window. The scenario has a 30 s warm-up and a 120 s window. `--quick` makes it 5 + 10 s in 1 round. The command prints the run count and an estimate of the time before it starts, and exits with 1 when any page stopped.

**`--resume`** skips runs whose JSON already exists. A stopped run carries on with the same command plus `--resume --out results/<version>/base`.

**Run time** (from the schedule, before page setup time):

| Run | Runs | Time |
| --- | --- | --- |
| all tiers (default) | 408 | 8.6 h |
| one tier | 120–144 | 2.5–3.0 h |
| all tiers, `--n 1` | 153 | 3.1 h |
| `--tier regular --scenario` | 153 | 3.4 h |
| `--scenario-only` | 9 | 0.4 h |

## Before a minor or major release

Before each minor or major Isoloop release, run js-bench on the release candidate and compare it with the last one. Patch releases aren't run. On the maintainer's go.

1. **Open a branch and set the version** (a prerelease such as `0.2.0-next.3`, or the release itself). The bump is for the run only, and is never merged:
   ```bash
   pnpm --filter js-bench set-isoloop 0.2.0-next.3
   ```
2. **Run it on bench machine 1** in the `base` profile, from the bench clone with the branch checked out, overnight: about 9 hours with `--scenario`. It's safe to log out.
   ```bash
   nohup apps/bench/js/scripts/server-run.sh base --scenario >/dev/null 2>&1 &
   ```
   Results go to `apps/bench/js/results/<version>/base/`. If the run stops, the same command with `--resume --out results/<version>/base` carries on.
3. **Bring `results/<version>/base/` back and compare:**
   ```bash
   pnpm --filter js-bench compare results/0.1.0/base results/0.2.0-next.3/base
   ```
   This writes `compare-<before version>.md` next to the new results:
   - first, in plain words, how many Isoloop figures changed beyond the noise, and whether the native figures held;
   - then each change in operations per second;
   - then every figure.
4. **Write `findings.md`** by hand, in plain English, in operations per second, and run `pnpm --filter js-bench summary results/<version>/base` again.
5. **Open a PR to `main` with only `results/<version>/base/`,** comparison included. Never the bump. Delete the branch. The release's results become the baseline for the next one.

**How a change is judged:**
- **The threshold:** a figure has changed only when the difference is bigger than 3 % (`--threshold`) or the spread between its rounds, whichever is larger.
- **Natives as the control:** the native rows don't use Isoloop, so when they move too, the machine or the browser changed, not Isoloop. For that case each Isoloop row also shows its share of the plain Workers' rate, which cancels out such drift.
- **One machine:** `compare` refuses two runs from different machines unless given `--allow-machine-change`. A new machine's first run is the last release again, as its baseline.
- **Keep everything else fixed:** the same profile, the same `calibration.json` (batch sizes), the same Docker image and browser. The comparison warns when any of these differ.

## On bench machine 1

The machine, its cores and its clock: [`../machines.md`](../machines.md). From the bench clone:

```bash
apps/bench/js/scripts/server-run.sh base calibrate                   # once per machine; commit calibration.json
apps/bench/js/scripts/server-run.sh base --quick --tier cheap        # a smoke run
nohup apps/bench/js/scripts/server-run.sh base --scenario >/dev/null 2>&1 &   # a full run; safe to log out
apps/bench/js/scripts/server-run.sh base --scenario --resume --out results/<version>/base   # carry on a stopped run
```

`server-run.sh` takes `~/bench/.lock`, turns bench mode on (it pauses the other services and fixes every core at 2.0 GHz) and always turns it off at the end. It builds the Docker image and runs the bench in it under the profile's CPU limits, with `JSBENCH_MACHINE=bench-machine-1`, which `run.json` records. The log goes to `~/bench/js-bench-<profile>.log`.

| Profile | Docker flags | Balancer `maxWorkers` |
| --- | --- | --- |
| `base` | `--cpuset-cpus=2,4,6,8` (4 physical cores) | 4 |
| `two-core` | `--cpuset-cpus=2,4` (n=4 oversubscribes) | 2 |
| `quota` | `--cpuset-cpus=2,4,6,8 --cpus=1.5` (CFS throttling) | 4 |

`navigator.hardwareConcurrency` doesn't follow the cpuset, so the balancer's cap is passed in explicitly. `two-core` and `quota` are internal (rule 6).

## The results

`results/<version>/<profile>/`:

| File | What it holds |
| --- | --- |
| `<engine>/<workload>-n<N>--<placement>--r<round>.json` | one page's raw figures, or why it stopped |
| `run.json` | the arguments, the calibration, the machine id, the CPU and clocks seen, the cgroup limits, the `@isoloop/*` versions and the git SHA |
| `findings.md` | what we found, written by hand |
| `summary.md` | the findings, then a table per tier, then the scenario, in operations per second |
| `summary.json` | the same figures as data, for the site's section: `Summary` in [`runner/summary.ts`](runner/summary.ts) |
| `compare-<version>.md` | what changed against the last release |
