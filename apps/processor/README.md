# Processor

Background work on Isoloop, as headless isolates (M3h). Two pages:

- **Playground** (`/`): add tasks, turn each one's CPU dial, block or crash it, and watch `@isoloop/balancer` place them. A pool whose tasks add up to 80 % of a core, or that lags over 50 ms for 3 s, loses its heaviest task; a task that blocks past 100 ms, or crashes, goes to quarantine and comes back after 30 s of quiet. There's one column per worker, with its lag from `isolate:beat` against the thresholds, and a log of every move. The placement switch runs the same tasks on the balancer, on a worker each (`own`), or in one pool (`one`).
- **File processor** (`/files/`): a generator makes synthetic files at a dialled rate, and groups of headless processors work through them, placed by the balancer, a worker each, or in one pool. The page shows the queue, jobs per second, p50 and p95 latency per file, each processor's worker and load, the latest results (with a filter), and every move.

Each task keeps `load` % of one core busy, in uninterrupted pieces of the page's "work chunk" (10 ms by default), and rests in between. Its dial is a record in the compacted `playground.tasks.v1` topic under its id, read from the start, so a task the balancer moves (stopped, then spawned in another pool) carries on as set.

A new task's dial is given to the balancer as its declared load, so it's placed at once; afterwards the balancer keeps its own measurements.

## The File processor

- **Files:** the generator (a headless isolate on its own worker) makes each file from a seed, so a run with the same seed and dials makes the same files in the same order. Four kinds, each real CPU work that grows with the file's size (1–4): **CSV** (make the text, parse it, sum per region), **Image** (a 2× box-filter downscale and three blur passes), **Archive** (an LZ77 pass with a lazy wider search) and **Hash** (SHA-256 in JavaScript, checked against `node:crypto`). Each kind's work yields every few hundred microseconds, so a processor runs it in slices of up to 8 ms and its loop keeps turning.
- **Dials:** files per second, and in a hundred files how many are **poison** (block the processor's loop for 2 s in one piece), **heavy** (ten times the work, still in slices) or **corrupt** (throw partway: the result says so, then the processor crashes as its own error).
- **Topics:** one job topic per kind (`files.jobs.<kind>.v1`), each read by a consumer group of two processors (`subscribe({ group, autoCommit: false, from: 'committed' })`); results go to `files.results.v1`; the dials are `files.dials.v1`.
- **No file is lost on a move.** A processor commits a file only after its result is published, and only up to just below the lowest file it still holds: a group's commit covers every offset at or below it that the member holds, and a file the group redelivers can arrive after a later one. When the balancer stops a processor, the bus hands what it hadn't committed to the group again. That still leaves one gap: a commit on its way can cross a redelivery and cover files the processor hasn't received yet, and the bus won't hand those out again. So a processor that stops, or crashes on a corrupt file, puts every file it still holds back on its topic. Delivery is at least once: a few files are done twice, and the page counts them as duplicates.
- **`from: 'committed'`**, not `earliest`: when every member of a group has left (both moved at once, or the placement switched), the next one resumes from the group's commits rather than the start of the topic.

## Notes

A task or processor stops its own loop in `onShutdown`. In a pool the worker outlives a stopped member, and in `0.0.0-next.g3322248` its timers and ports keep running, so without that every move would leave the old copy burning CPU in the pool it left. The runtime fix (isoloop#206) cancels them on stop; the workaround is harmless and stays until a prerelease with that fix is in the catalog.

Switching the placement waits until each one the balancer was moving is gone before spawning it again: the balancer's `stop` throws for one it's in the middle of moving, and the kernel won't spawn an id that's still stopping.

```sh
pnpm --filter processor dev      # http://localhost:5173/ (the File processor at /files/)
pnpm --filter processor test     # the four kinds
pnpm --filter processor e2e
```
