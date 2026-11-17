---
'processor': minor
---

On the M3i balancer (`@isoloop/*@0.0.0-next.800569e`). The Playground gives each task a Jobs/s slider, shows its backlog, can hide a task's work from the busy time, and has a Calm button to watch quiet tasks pack back; its move log shows backlog and pack moves, noted spikes, `behind` events and what each move cost. The File processor reports each consumer group's backlog to the balancer.

The File processor's comparison is measured again on the M3i balancer, with `maxWorkers: 2` and a faults-then-calm mix: [`comparison/v0.2.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.2.0).
