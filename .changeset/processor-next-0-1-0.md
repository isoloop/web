---
'processor': patch
---

On `@isoloop/*@0.1.0-next.0`, which fixes a consumer group's commit crossing a redelivery (isoloop#211). The File processor's processors no longer put the files they hold back on the topic when they stop, subscribe from `committed`, or commit only below the lowest file held: what a processor hadn't committed goes back to its group, and a group that has committed resumes after its commits.
