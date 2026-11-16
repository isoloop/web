# Processor

Background work on Isoloop, as headless isolates (M3h). Two pages:

- **Playground** (`/`): add tasks, turn each one's CPU dial, block or crash it, and watch `@isoloop/balancer` place them. A pool whose tasks add up to 80 % of a core, or that lags over 50 ms for 3 s, loses its heaviest task; a task that blocks past 100 ms, or crashes, goes to quarantine and comes back after 30 s of quiet. There's one column per worker, with its lag from `isolate:beat` against the thresholds, and a log of every move. The placement switch runs the same tasks on the balancer, on a worker each (`own`), or in one pool (`one`).
- **File processor** (`/files/`): to come. A seeded stream of simulated files processed by groups of headless isolates.

Each task keeps `load` % of one core busy, in uninterrupted pieces of the page's "work chunk" (10 ms by default), and rests in between. Its dial is a record in the compacted `playground.tasks.v1` topic under its id, read from the start, so a task the balancer moves (stopped, then spawned in another pool) carries on as set.

A new task's dial is given to the balancer as its declared load, so it's placed at once; afterwards the balancer keeps its own measurements.

A task stops its own loop in `onShutdown`. In a pool the worker outlives a stopped member, and in `0.0.0-next.g3322248` its timers and ports keep running, so without that every move would leave the old copy burning CPU in the pool it left. The runtime fix (isoloop#206) cancels them on stop; the workaround is harmless and stays until a prerelease with that fix is in the catalog.

```sh
pnpm --filter processor dev      # http://localhost:5173/
pnpm --filter processor e2e
```
