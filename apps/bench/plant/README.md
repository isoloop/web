# plant-bench

The benchmark build: a frozen copy of the [plant dashboard](../../dashboards/plant/README.md), measured at every minor and major Isoloop release on bench machine 1. Its results are the figures the site publishes (`/benchmarks/` and the landing page). It's never deployed. The plan is [`docs/plans/0.1.1-site.md`](../../../docs/plans/0.1.1-site.md), decisions 1–8.

## The rules

1. **Plant, not markets.** Plant has the full matrix: native, native + workers, and Isoloop in `one`, `matched` and `split`. Markets stays for feature benchmarks.
2. **A copy, pinned exactly.** This is plant at `plant-v0.4.2` (`4dd421c`), the plant tag built on `@isoloop/*@0.1.0`. Every dependency in `package.json` is an exact version, with no `catalog:` and no workspace package. The browsers come from the Playwright image at `@playwright/test`'s version ([`Dockerfile`](Dockerfile)), with Node and pnpm pinned there too. The live plant example stays free to change; nothing here follows it.
3. **The code changes only at a generation:** 0.1 now, then 1.0 and 2.0. Between those, `main` never changes it. A bump of `@isoloop/*` for a run happens on the run's branch and is never merged (rule 4).
4. **A run:**
   1. Open a branch and bump every `@isoloop/*` in `package.json` to the release, then `pnpm install`.
   2. If the release breaks an API the bench uses, run `isoloop migrate` on this folder, never a hand fix. If the codemod fails here, that blocks the release. If it changed anything, say what in `results/<version>/ADAPTED.md` (one paragraph); the summary prints it.
   3. Run it on bench machine 1 ([below](#on-bench-machine-1)).
   4. Open a PR to `main` with only `results/<version>/`: the raw JSON, `summary.md`, `summary.json`, `environment.json` (the exact versions, the browser builds, the machine) and `run.json` (the arguments). Never the bump.
   5. Delete the branch.
5. **When:** at every minor and major release (0.1.0 as the baseline, then 0.2.0, 0.3.0 … 1.0.0), never at a patch. Always on bench machine 1, on the maintainer's go.
6. **The matrix is fixed** in [`run.ts`](run.ts) and takes no arguments:
   - builds: native, native + workers, Isoloop `one`, `matched` and `split`, as two pairs (native against `one`, native + workers against `matched`) and `split` alongside;
   - load: 1 and 5 kHz;
   - figures: main-thread busy, CPU across all threads, typing median, first data, all 72 widgets with data, recovery after a 3 s block, memory after GC;
   - engines: Chromium for every figure; Firefox and WebKit for the timings they can read (typing, first data, all widgets, recovery);
   - 5 interleaved rounds, on the server's 4 cores fixed at 2.0 GHz.
7. **Regressions:** the benchmarks page shows each figure across versions and flags a change beyond the run's own spread. There's no CI gate, since the server run is manual. CI only checks that plant-bench still runs: `check.yml` builds it, and [`bench.yml`](../../../.github/workflows/bench.yml) runs one short round.
8. **A new feature gets its own `apps/bench/<feature>/`,** under the same rules from its first run. plant-bench is never extended.

## What's different from plant

The pages under measurement are plant's at `plant-v0.4.2`, with these changes, none of them on the measured path:

- **No site bar and no search tags** (`packages/ui`'s Vite plugin), since the bench is never deployed. With the bar goes the devtools switch it held (`src/isoloop/devtools.ts`) and the `@isoloop/devtools` dependency; the measured runs never opened devtools.
- **Not copied:** the interactive page, the architecture diagrams, the recorded comparisons, every E2E spec but `e2e/comparison.spec.ts`, and `@isoloop/balancer`, which plant listed but didn't import.
- **Copied in:** the comparison runner and probes (`packages/compare`, in `lib/compare/`), and the browser check (`shared/`, in `lib/shared/`), so nothing on `main` reaches the bench. The runner gained one option, `summary`, so the bench writes its own summary (`summary.ts`).
- **Its own `tsconfig.json`,** with the repo's settings copied in.
- The agent-call build flag (`PLANT_AGENT_COST`) is fixed off, which compiles that code out as in plant's default builds.

## Running it

```bash
pnpm --filter ./apps/bench/plant bench          # the full matrix, into results/<version>/
pnpm --filter ./apps/bench/plant bench:smoke    # one short round, Chromium, 1 kHz, into results-smoke/ (gitignored)
node apps/bench/plant/run.ts --summary-only --out results/0.1.0   # rebuild summary.md and summary.json
```

`<version>` is the `@isoloop/*` version installed; the run refuses if the packages resolve to more than one, or if `results/<version>/` already holds a run. The full matrix is 5 configurations × 2 rates × 5 rounds × 3 engines = 150 pages, about a minute each: about 2.5 hours, plus a build per engine.

Each page: load, 6 s of warm-up, a 10 s window with no input (frames, CPU), 5 keystrokes into a widget's filter (typing), memory after a forced GC in the page and every worker (Chromium on Linux only), then a 3 s block of one machine's gauges (recovery). What each figure covers is at the top of [`e2e/comparison.spec.ts`](e2e/comparison.spec.ts).

### On bench machine 1

The machine, its cores and its clock: [`../machines.md`](../machines.md).

From a clone used only for this, with the server in bench mode and the lock held. Build the image first; rebuild it whenever the Dockerfile changes.

```bash
docker build -t plant-bench apps/bench/plant
docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g \
  -v "$PWD":/work -w /work plant-bench \
  bash -lc 'pnpm install --frozen-lockfile && pnpm --filter ./apps/bench/plant bench'
```

- `--cpuset-cpus=2,4,6,8` pins the run to 4 physical cores, one thread each. On a machine with two threads per core, `lscpu -e=CPU,CORE` shows the pairing. Core 0 is left out because it takes most interrupts.
- `--shm-size=2g` gives Chromium enough shared memory; Docker's default of 64 MB is too small.
- The results land in `apps/bench/plant/results/<version>/`, owned by root, because the container runs as root.

## The results

`results/<version>/`:

| File | What it holds |
| --- | --- |
| `<engine>/<config>-<rate>khz-run<N>.json` | one page's raw figures, or why it stopped |
| `summary.md` | what we found, then the A \| B \| Δ tables ("Lower is better"), then the spreads, `split`, stopped pages, the method and the command, folded |
| `summary.json` | the same figures as data, for the site's charts: `Summary` in [`summary.ts`](summary.ts) |
| `environment.json` | the exact package versions, the browser builds, the machine (CPU, allowed CPUs, clock, memory, OS, Node, image) |
| `run.json` | the arguments and the CPUs the run was allowed |
| `ADAPTED.md` | only when a codemod changed the bench for this release |

In the summary, Δ is B − A within each round and its median over the rounds. A difference in a % figure is in points. Durations from 1000 ms are in seconds.
