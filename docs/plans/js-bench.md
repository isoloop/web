# js-bench: plain JavaScript work, measured each release

**Goal:** measure plain JavaScript work (no components, no DOM) on the main thread, in plain Workers and in Isoloop's placements, as operations per second. Run it before every minor and major release to see what the release changed, and show the latest minor or major release on `/benchmarks/`.

**Done when:** the tasks below are merged, `apps/bench/js/` holds the code and the 0.1.0 results, `/benchmarks/` has the **Plain JavaScript work** section on those results, and the private `isoloop/jsbench` repo is archived.

**The open cost:** `structuredClone` of a 5 MB object is 12–19 % slower in an Isoloop worker than in a plain Worker ([isoloop#441](https://github.com/isoloop/isoloop/issues/441)). The section names it and links the spike until the spike explains it.

## Decisions (2026-11-24, grilled Q1–Q22, maintainer, yes to all)

### The bench

1. **It moves to `apps/bench/js/`** in this repo, as the private package `js-bench`, ignored by Changesets, like `plant-bench`. It comes as a fresh copy of the private `isoloop/jsbench` (its history isn't kept), which is then archived with a pointer here.
2. **What it measures:**
   - **17 workloads in three tiers,** cheap (about 1–5 µs an op), regular (0.3–4 ms) and heavy (46–811 ms): Map, Set, array and object work, sorts, filter/map/reduce, JSON, `structuredClone`, a matrix multiply.
   - **Five placements:** the main thread, plain Workers, Isoloop with a worker each, Isoloop with all copies in one worker, and the balancer.
   - **One copy and four at once,** plus a balancer scenario of 2 heavy and 6 cheap copies.
   - **3 interleaved rounds** of a 10 s warm-up and a 60 s window, 30 s of warm-up for the balancer.
   - **The page's own 100 ms timer,** to show how late it fires during each run.
3. **Its code changes only at a generation,** as plant-bench's does (0.1.1 site plan, decision 3). A change to a workload or the harness means running the last release again before comparing.
4. **CI only checks that it still runs:** `check.yml` typechecks it and runs its unit tests, and `bench.yml` runs a smoke round of one workload per tier in Chromium, about 2 minutes. The real runs are only on the bench machine.
5. **It writes `summary.json`** next to `summary.md`, in a typed `Summary` shape. The site build validates it, as `build/benchmarks.ts` does for plant-bench, and draws the section from it.

### Runs and comparisons

6. **It runs before every minor and major release,** never for a patch (amended 2026-11-24), on bench machine 1 in the `base` profile (4 cores fixed at 2.0 GHz), on the maintainer's go. About 9 hours.
7. **`pnpm compare <before> <after>`** writes `compare-<before version>.md` in plain English, in operations per second:
   - A figure has changed when the difference is bigger than 3 % or the spread between its rounds, whichever is larger.
   - The native figures are the control, and each Isoloop figure is also given as a share of the plain Workers' rate.
   - It refuses to compare runs from two machines unless `--allow-machine-change` is given.
8. **Each run's results come in their own PR,** `apps/bench/js/results/<version>/base/` and the comparison only, on the maintainer's go.
9. **The CPU-limited profiles** (`two-core`, `quota`) stay internal: run when useful, never on the site.

### The machine

10. **The bench server is "bench machine 1"** (`bench-machine-1` in data). `server-run.sh` sets it, `run.json` records it, and no hostname goes into the repo. A new machine gets the next number, never a reused one. Its first run is the last release again, as its baseline.
11. **`apps/bench/machines.md`** has an entry per machine: CPU, memory, OS, the cores used, the fixed clock, and what bench mode does. Both benchmarks link it from their labels.
12. **The server's name leaves the current files** of both public repos, in a wording-only PR each: "bench machine 1" in place of the hostname and of "the bench server". The git history stays as it is.

### The site

13. **A section of its own on `/benchmarks/`, "Plain JavaScript work",** after the plant sections, with its own entry in the page's navigation (ADR 0002, amended 2026-11-24). The plant sections don't change, and "Raw results" lists both benchmarks.
14. **What the section shows:**
    - the label: "js-bench at `@isoloop/*@0.1.0`, 2026-11-24, Chromium 158, on bench machine 1, 4 cores fixed at 2.0 GHz";
    - what we found, in plain English, in operations per second;
    - one paired-bar chart per tier at four copies: plain Workers as the grey baseline, Isoloop with a worker each as the bar;
    - a table for one copy: the main thread, a plain Worker, Isoloop;
    - how late the page's timer fires, per placement;
    - the `structuredClone` cost, with a link to isoloop#441;
    - the method in short;
    - all five placements, folded under the charts as tables;
    - the balancer scenario, as one finding and a folded table, with no chart, since it's an experimental feature's behaviour.
15. **The page updates at minor and major releases only,** together with plant-bench. 0.1.0 is Chromium only, and says so. Firefox joins at the next minor.

## Tasks

| # | Task | Files | Review |
| --- | --- | --- | --- |
| J1 | This plan and the ADR 0002 amendment | `docs/plans/js-bench.md`, `docs/adr/0002-*` | maintainer |
| J2 | "bench machine 1" in place of the server's name and "the bench server" (decision 12) | the READMEs and docs that name it | maintainer (copy) |
| J2b | The same in `isoloop/isoloop`: the M3j plan's five lines | `docs/plans/m3j-balancer-gaps.md` | maintainer (docs) |
| J3 | `apps/bench/js/` from `isoloop/jsbench`: the machine id, `compare`'s machine check, `summary.json`, `apps/bench/machines.md`, CI | `apps/bench/js/`, `apps/bench/machines.md`, `.github/workflows/`, `.changeset/config.json` | self-merge on green, after J1 |
| J4 | The 0.1.0 results, with the hostname replaced by `bench-machine-1` | `apps/bench/js/results/0.1.0/base/` | maintainer's go |
| J5 | The **Plain JavaScript work** section | `apps/site/build/`, `src/pages/benchmarks.tsx`, `src/copy.ts`, `content/benchmarks.json` | maintainer (copy), after J1 and J4 |
| J6 | Archive `isoloop/jsbench` with a pointer here | — | after J3 |
