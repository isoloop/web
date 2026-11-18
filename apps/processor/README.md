# Processor

Background work on Isoloop, as headless isolates (M3h). Two pages:

- **Playground** (`/`): add tasks, turn each one's CPU dial, block or crash it, and watch `@isoloop/balancer` place them. A pool whose tasks add up to 80 % of a core, or that lags over 50 ms for 3 s, loses its heaviest task; a task that blocks past 100 ms twice within a minute, or crashes, goes to quarantine and comes back after 30 s of quiet (a first long task is only noted). There's one column per worker, with its lag from `isolate:beat` against the thresholds, and a log of every move. The placement switch runs the same tasks on the balancer, on a worker each (`own`), or in one pool (`one`).
- **File processor** (`/files/`): a generator makes synthetic files at a dialled rate, and groups of headless processors work through them, placed by the balancer, a worker each, or in one pool. The page shows the queue, jobs per second, p50 and p95 latency per file, each processor's worker and load, the latest results (with a filter), and every move.

Each task keeps `load` % of one core busy, in uninterrupted pieces of the page's "work chunk" (10 ms by default), and rests in between. Its dial is a record in the compacted `playground.tasks.v1` topic under its id, read from the start, so a task the balancer moves (stopped, then spawned in another pool) carries on as set.

Give a task **jobs** (M3i) and its CPU dial becomes what they need: jobs arrive at its Jobs/s rate and each costs `load × 10 ÷ rate` ms. The task publishes how many it has done to the compacted `playground.done.v1`, so a moved task carries on from its count, and the page reports its backlog (arrived − done) to the balancer every second with `balancer.report`. A backlog that keeps rising, over two 10 s windows in a row (M3j), moves the task where it gets more CPU, or raises `behind` when there's nowhere. **After await** (M3j) runs the task's work, its plain CPU and its jobs alike, in promise continuations, which the runtime's busy time can't see: the card's **kernel** figure drops towards 0 %. Each task also times its own work and publishes the running total, in ms since it started, to the compacted `processor.busy.v1`, and the page passes it to the balancer with the backlog, `balancer.report(id, { backlog, busyMs })`. The balancer counts the larger of the kernel's busy time and the reported one, so work after `await` still counts toward the pool's load; the card's **reported** figure, and the thin line along the bottom of its meter, show what the balancer has from the report. A task's Block stays out of that total, since the kernel already sees it as a long task. With **after await** on, turn **report its busy time** off and the backlog is the only sign the task is short of CPU. **Calm** sets every slider back to idle; after a minute steady, a pool's tasks pack back into another pool that has room for all of them, one a minute, freeing a worker once the last is in (M3j). The move log shows each move's cost, from the stop to the moved task's first beat (`arrived`). A task that crashes past the kernel's restart limit (3 restarts in 60 s, so its 4th crash in a minute in one place; a move starts the count again) is given up: the move log shows it as `given up`, its card as failed, and the balancer leaves it where it is, never moving or restarting it.

A new task's dial is given to the balancer as its declared load, so it's placed at once; afterwards the balancer keeps its own measurements.

## Measured

The File processor, run on a worker per processor, in one pool and placed by the balancer, on the bench server: [comparison/README.md](comparison/README.md). The comparison itself is [`comparison/run.ts`](comparison/run.ts) and [`e2e/comparison.spec.ts`](e2e/comparison.spec.ts).

## The File processor

- **Files:** the generator (a headless isolate on its own worker) makes each file from a seed, so a run with the same seed and dials makes the same files in the same order. Four kinds, each real CPU work that grows with the file's size (1–4): **CSV** (make the text, parse it, sum per region), **Image** (a 2× box-filter downscale and three blur passes), **Archive** (an LZ77 pass with a lazy wider search) and **Hash** (SHA-256 in JavaScript, checked against `node:crypto`). Each kind's work yields every few hundred microseconds, so a processor runs it in slices of up to 8 ms and its loop keeps turning.
- **Dials:** files per second, and in a hundred files how many are **poison** (block the processor's loop for 2 s in one piece), **heavy** (ten times the work, still in slices) or **corrupt** (throw partway: the result says so, then the processor crashes as its own error).
- **Topics:** one job topic per kind (`files.jobs.<kind>.v1`), each read by a consumer group of two processors (`subscribe({ group, autoCommit: false, from: 'committed' })`); results go to `files.results.v1`; the dials are `files.dials.v1`.
- **No file is lost on a move.** A processor commits a file only after its result is published. Files wait in its queue after the handler returns, so it commits by hand: each commit settles that file and every one delivered before it (isoloop ADR 0016, point 15), and files are done one at a time in the order they came. When the balancer stops a processor, or one crashes, the bus hands what it hadn't committed to the group again. Delivery is at least once: a file whose result went out just before a stop, but whose commit didn't, is done twice, and the page counts it as a duplicate.
- **Busy time** (M3j): each processor times its own slices, every one after the first resumed after `await`, and publishes the running total to `processor.busy.v1` every half second while it grows; the page reports it to the balancer as `busyMs`, and each processor's row in `window.files.trace()` carries the balancer's figure as `reportedPct`. A poison file's 2 s block isn't counted, since the kernel sees it as a long task.
- **Given up:** a processor the kernel stops restarting gets a `failed` entry in the move log, and is listed by `window.files.givenUp()` with its id, kind, reason and pool; the faults E2E records them when a file is left without a result, and the comparison lists them with each run. The bus hands the files it hadn't committed to the rest of its group.
- **`from: 'earliest'`** applies only to a group's first join: a group that has committed resumes after its commits, even when every member has left (ADR 0016, point 14).
- Until `@isoloop/*@0.1.0-next.0` (isoloop#224, the fix for #211), a group's commit could cross a redelivery and cover files the processor hadn't received, so processors put every file they held back on the topic when they stopped, subscribed `from: 'committed'`, and committed only below the lowest file held. The M3h and M3i measurements ran with those workarounds.

## Notes

A stopped task or processor needs no clean-up of its own: since isoloop#206, a stopped pool member's timers and ports never run again, so its loop ends with it.

Switching the placement stops every one first: mid-move, the balancer's `stop` cancels the move and resolves once the old copy is gone (isoloop#209), so the next spawn of the same id never meets it.

```sh
pnpm --filter processor dev      # http://localhost:5173/ (the File processor at /files/)
pnpm --filter processor test     # the four kinds
pnpm --filter processor e2e
```
