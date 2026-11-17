# processor

## 0.2.0

### Minor Changes

- 3e9a310: On the M3i balancer (`@isoloop/*@0.0.0-next.800569e`). The Playground gives each task a Jobs/s slider, shows its backlog, can hide a task's work from the busy time, and has a Calm button to watch quiet tasks pack back; its move log shows backlog and pack moves, noted spikes, `behind` events and what each move cost. The File processor reports each consumer group's backlog to the balancer.
  
  The File processor's comparison is measured again on the M3i balancer, with `maxWorkers: 2` and a faults-then-calm mix: [`comparison/v0.2.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.2.0).

### Patch Changes

- 072c5dd: The examples page describes the M3i measurement: what the balancer does with a backlog on Chromium and Firefox, with faults, and what it didn't do yet (packing back, and the runs that lost files). Its results link goes to [`comparison/v0.2.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.2.0).
- fb9d461: On `@isoloop/*@0.1.0-next.0`, which fixes a consumer group's commit crossing a redelivery (isoloop#211). The File processor's processors no longer put the files they hold back on the topic when they stop, subscribe from `committed`, or commit only below the lowest file held: what a processor hadn't committed goes back to its group, and a group that has committed resumes after its commits.

## Earlier releases

Each release is tagged `processor-v<version>` and deployed to isoloop.dev from that tag. Releases up to `processor-v0.1.0` are listed by their [tags](https://github.com/isoloop/web/tags); their history as of that release is added in a later entry ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8).
