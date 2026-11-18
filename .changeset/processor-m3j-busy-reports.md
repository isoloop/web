---
'processor': minor
---

Work a task or processor does after `await` now counts toward its pool's load. Each task and each File processor times its own work and publishes the running total, and the page reports it to the balancer with the backlog (`report(id, { backlog, busyMs })`), so work the runtime's busy time doesn't see still counts. Injected faults (a task's Block, a poison file) stay out of that total, since the kernel already sees them as long tasks. The Playground's "hide work from busy time" switch becomes "after await", and applies to a task's plain CPU as well as its jobs; a second switch turns its busy-time report off; each card shows both figures, the kernel's and the reported one; and the move log shows a task the kernel gave up on. On the File processor, a processor the kernel gives up on is shown as failed, with a `given up` entry in the move log.
