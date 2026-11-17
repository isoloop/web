---
'processor': minor
---

On `@isoloop/*@0.1.0-next.1` and M3j's balancer. Each task and each File processor times its own work and publishes the running total, and the page reports it to the balancer with the backlog (`report(id, { backlog, busyMs })`): work resumed after `await`, which the runtime's busy time doesn't see, now counts toward a pool's load. Injected faults (a task's Block, a poison file) stay out of that total, since the kernel already sees them as long tasks. The Playground's "hide work from busy time" switch becomes "after await", and applies to a task's plain CPU as well as its jobs; a second switch turns its busy-time report off; each card shows both figures, the kernel's and the reported one; and the move log shows a task the kernel gave up on.
