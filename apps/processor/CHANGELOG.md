# processor

## 0.3.0

### Minor Changes

- f2e4767: Work a task or processor does after `await` now counts toward its pool's load. Each task and each File processor times its own work and publishes the running total, and the page reports it to the balancer with the backlog (`report(id, { backlog, busyMs })`), so work the runtime's busy time doesn't see still counts. Injected faults (a task's Block, a poison file) stay out of that total, since the kernel already sees them as long tasks. The Playground's "hide work from busy time" switch becomes "after await", and applies to a task's plain CPU as well as its jobs; a second switch turns its busy-time report off; each card shows both figures, the kernel's and the reported one; and the move log shows a task the kernel gave up on. On the File processor, a processor the kernel gives up on is shown as failed, with a `given up` entry in the move log.

### Patch Changes

- 9d6989b: The site's header: GitHub moves out of the page links to sit beside the theme switch, as the mark alone on a phone.
- a7c0654: On `@isoloop/*@0.1.0-next.4`. When a member sharing a pool falls behind and the worker cap leaves it nowhere to go, the balancer folds a second quarantine pool of offenders into the first, so the member gets that worker. On the interactive boards a widget moved this way shows "moved to Quarantine: making room for a widget falling behind", and in the File processor the move log says "making room".
- c4503e5: On `@isoloop/*@0.1.0-next.5`. The balancer counts a pool toward `maxWorkers` from the moment a move claims it, so two moves in one decision can't open a pool past the cap. A second quarantine pool folds into the first like with like: offenders join offenders, and the other half of a bisect joins its first half.
- 718f2c0: On `@isoloop/*@0.1.0-next.6`. A pool's worker stays open until the host ends it after its last member, so an isolate that starts in a pool while the others are leaving it starts normally.
- c4503e5: `window.files.crashes()` lists every processor crash in order, with its time, reason, pool and message. The comparison writes them into each run's JSON, so a processor the kernel gave up on can be traced to the crashes before it.
- 26265e5: The File processor's comparison records more for M3j: the workers every second, each processor's reported busy time in the trace, and the processors the kernel gave up on, with their kinds and when. Its "faults, then calm" mix now runs 5 minutes of calm (60 s in M3i), and its summary gains the fewest workers in the calm and the kinds left with every processor given up on.
- a313a4a: The File processor's comparison is measured again on the M3j balancer, on `@isoloop/*@0.1.0-next.6` (web `718f2c0`, a 4-core bench server at 2.0 GHz): no file lost and no processor given up on in 26 balancer runs, with the normal, faults and faults-then-calm mixes, on Chromium and Firefox: [`comparison/v0.3.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.3.0).
- 7cc0b55: The examples page shows the M3j measurement of the File processor, on `@isoloop/*@0.1.0-next.6` (a 4-core bench server at 2.0 GHz): three tables, for no faults, with faults, and faults then calm, each against a worker per processor and one pool, with the Firefox figures in a sentence under each. Its results link to [`comparison/v0.3.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.3.0).
- 601bfb8: On `@isoloop/*@0.1.0-next.2`, with three balancer fixes from M3j:
  
  - A never-measured isolate's first way out of the quarantine, where it starts, no longer counts toward its move budget.
  - A quiet pool of several isolates packs back into another, one isolate a minute.
  - A backlog has to rise over two 10 s windows in a row before anything moves.
- 2b7e4d6: On `@isoloop/*@0.1.0-next.3`. A consumer-group member that crashes partway through a batched delivery keeps the records it settled, so they aren't sent to the next member again (ADR 0016, point 17). Before, a corrupt file that crashed its processor after the files before it in the batch were settled came back until the kernel gave up on every processor of its kind.

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
