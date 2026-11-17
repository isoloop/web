# processor

## 0.2.0

### Minor Changes

- 3e9a310: On the M3i balancer (`@isoloop/*@0.0.0-next.800569e`). The Playground gives each task a Jobs/s slider, shows its backlog, can hide a task's work from the busy time, and has a Calm button to watch quiet tasks pack back; its move log shows backlog and pack moves, noted spikes, `behind` events and what each move cost. The File processor reports each consumer group's backlog to the balancer.
  
  The File processor's comparison is measured again on the M3i balancer, with `maxWorkers: 2` and a faults-then-calm mix: [`comparison/v0.2.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.2.0).

### Patch Changes

- 072c5dd: The examples page describes the M3i measurement: what the balancer does with a backlog on Chromium and Firefox, with faults, and what it didn't do yet (packing back, and the runs that lost files). Its results link goes to [`comparison/v0.2.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.2.0).
- fb9d461: On `@isoloop/*@0.1.0-next.0`, which fixes a consumer group's commit crossing a redelivery (isoloop#211). The File processor's processors no longer put the files they hold back on the topic when they stop, subscribe from `committed`, or commit only below the lowest file held: what a processor hadn't committed goes back to its group, and a group that has committed resumes after its commits.

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes the sections above them. Each release is tagged `processor-v<version>` and deployed to isoloop.dev from that tag.

## 0.1.0

Tagged 2026-11-17 (M3h), the first release.

- A new example, at `isoloop.dev/examples/processor/`: background work as headless isolates, placed by [`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md) (experimental) ([web#128](https://github.com/isoloop/web/pull/128), [web#131](https://github.com/isoloop/web/pull/131)).
- The Playground: each task is a headless isolate with a CPU dial and Block 2 s, Crash and Remove buttons, and one column per worker shows its loop lag, its load, and a badge on each moved task naming why it moved ([web#128](https://github.com/isoloop/web/pull/128)).
- The File processor, at `/files/`: a seeded generator makes synthetic files (CSV, image, archive and hash work), read by a consumer group of two headless processors per kind, with dials for the rate and for poison, heavy and corrupt files ([web#130](https://github.com/isoloop/web/pull/130)).
- The File processor's comparison: each processor on its own worker, everything in one pool, and the balancer, recorded on the bench server and written up in [`comparison/`](https://github.com/isoloop/web/tree/processor-v0.1.0/apps/processor/comparison) ([web#132](https://github.com/isoloop/web/pull/132), [web#133](https://github.com/isoloop/web/pull/133)).
