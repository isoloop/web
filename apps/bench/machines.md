# The bench machines

The machines the benchmarks under `apps/bench/` run on. Each has a number, and its id in the results is `bench-machine-<N>`. A new machine gets the next number, never a reused one, and its first run is the last release again, as its baseline: figures from two machines aren't compared (js-bench's `compare` refuses them).

The benchmarks' labels link here: [plant-bench](plant/README.md) and [js-bench](js/README.md).

## Bench machine 1

`bench-machine-1`, since 2026-11 (the 0.1.0 baselines).

| | |
| --- | --- |
| CPU | AMD Ryzen 7 5825U: 8 cores, 16 threads, x64 |
| Memory | 30 GB |
| OS | Ubuntu 24.04 |
| Cores used | 2, 4, 6 and 8: 4 physical cores, one thread each (`--cpuset-cpus=2,4,6,8`). Core 0 is left out because it takes most interrupts. |
| Clock | fixed at 2.0 GHz on every core |

**Bench mode,** on for every run and off after it, whatever happens:

- pauses the machine's other services, so nothing else runs during a measurement;
- fixes every core's clock at 2.0 GHz, so boost and power saving don't move the figures;
- a lock file keeps two bench runs from overlapping.

The runs happen in Docker, from a clone of this repo used only for bench runs: Playwright's image, with its browsers, at the benchmark's pinned version.
