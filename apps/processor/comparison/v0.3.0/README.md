# File processor, placements compared again (M3j)

The File processor's comparison from M3h ([`../README.md`](../README.md)) and M3i ([`../v0.2.0/`](../v0.2.0/README.md)), run again on the M3j balancer ([isoloop ADR 0017](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), amended for M3j):
- each processor reports the busy time it measures itself, including work after `await`;
- members pack back while their backlog isn't rising;
- offences decay, and the quiet window is capped at 2 minutes;
- a bisect needs a quarantine pool to itself;
- a member the kernel gave up on is `failed`, and no move restarts it.

The processor also runs without its workarounds for [isoloop#211](https://github.com/isoloop/isoloop/issues/211) (`0.1.0-next.0` fixed it), and "faults, then calm" now has 5 minutes of calm. The same 8 headless processors run on a worker each (`own`), all in one pool (`one`), or placed by the balancer with `maxWorkers: 2`, which is what its default gives a 4-core machine.

Every run here is on `@isoloop/*@0.1.0-next.6`. The runs are in [`normal/`](normal/) ([`summary.md`](normal/summary.md)), [`faults/`](faults/) ([`summary.md`](faults/summary.md)) and [`calm/`](calm/) (faults, then calm, [`summary.md`](calm/summary.md)). Each run has a per-second trace of every processor, its move log, and every crash with its reason. Four earlier runs of this measurement, on `0.1.0-next.2` to `0.1.0-next.5`, each found a problem, which was fixed before this run. They're in the details at the end.

## What we found

On four cores at 2.0 GHz, at 50 files a second:

1. **No file was lost, and the kernel gave up on no processor,** in any of the 26 runs with the balancer (10 normal, 10 with faults, 6 faults then calm), on either engine. M3i lost files in 3 of its 23 balancer runs with faults. `own` and `one` lost none here either.
2. **With the processors reporting their own busy time, the full-pool trigger works.**
   - In the calm window, the processors together report about twice the busy time the runtime measures: 97 to 101 % of a core against 46 to 49 % on Chromium, 122 to 128 % against 50 to 53 % on Firefox. The difference is the work after `await`, which `busyMs` can't see.
   - The full-pool trigger moved processors in every normal run (2 `full` moves a run on Chromium and 3 on Firefox, of 10 and 11 moves in all) and in 8 of the 10 fault runs. In M3i it never fired.
   - Bisects fell: 7 bisect moves over the 5 fault runs on Chromium and 29 on Firefox, against 30 and 55 in M3i. Firefox still bisects the most.
3. **With no faults, the balancer splits the one pool into two and keeps up on both engines.**
   - **Chromium:** 3 workers against `own`'s 9, with 57 MB less memory and 8 points less CPU across threads, at a p95 of 74 ms against 39 ms. Against `one`, 1 more worker and a p95 of 74 ms against 148 ms.
   - **Firefox, the M3h and M3i case:** 50.1 files a second, against `one`'s 43.9 and `own`'s 50.1, with a p95 of 94 ms against `own`'s 51 ms. `one` falls behind, with a p95 of 9.0 s. In M3i the balancer's p95 here was 15.5 s: it split the pool with a backlog move, once a backlog had built, and within 2 pools that backlog drained slowly.
   - It made no backlog move in 8 of the 10 runs and reported `behind` in none.
4. **With faults, the balancer does about as many files a second as `own`, on fewer than half the workers, with a much higher latency.**
   - Files a second: 52.5 on Chromium and 47.9 on Firefox, against `own`'s 50.0 and 50.3 and `one`'s 26.5 and 20.8. In M3i the balancer did 46.3 and 33.4.
   - Its p95 is 12.7 s and 15.2 s, against `own`'s 378 and 622 ms and `one`'s 20.5 and 24.5 s. Its p50 is 5.8 s and 1.2 s.
   - It uses 4 workers where `own` uses 9.
   - A second quarantine pool held a worker for part of 9 of the 10 runs: a bisect's suspects never share a quarantine pool with offenders. While it does, the cap leaves the balancer one pool of its own, and it reported `behind` a median of 7 and 8 times a run.
5. **Faults, then calm: the balancer ends on 3 workers and keeps up.**
   - After 60 s with faults and 5 minutes of calm, it does 50.1 and 50.0 files a second, with a p95 of 60 ms and 87 ms, against `own`'s 37 and 50 ms. That's on 3 workers against 9, with 52 MB less memory on Chromium.
   - In every run it went from 4 workers after the faults to 3 by the window: every processor had left the quarantine, and its worker was freed.
   - `one` didn't recover in the window: a p95 of 89 s on Chromium and 193 s on Firefox. On Firefox, 6,147 files were queued when the generator stopped, and 1,347 still had no result 2 minutes later.
6. **Packing back never happened, because the two pools don't fit in one.** There were 0 packs in the 6 calm runs. In the window, the two pools carry 44 to 57 % of a core each on Chromium and 53 to 75 % on Firefox, by the reported busy time. A pool takes another only if it stays under 40 % with all of it. On the reported figure, `one` would be 97 to 128 % of a core, and on Firefox it falls behind.
7. **An offender can stay in the quarantine past the 2-minute cap, held by its move budget.**
   - In 5 of the 6 calm runs, one or two processors were still in the quarantine 4 to 4.6 minutes into the calm. Each left at the moment its third move in 5 minutes aged out.
   - Every move counts toward the budget of 3 in 5 minutes, crash, spike, bisect and fold moves included, though only moves for load and the way out of the quarantine are limited by it. ADR 0017 (decision 6) says so: an isolate that has used its budget can stay in the quarantine longer than its quiet window.
8. **Files done twice are down to a few dozen a run, now that the #211 workarounds are gone.**
   - With faults: 20 on Chromium and 28 on Firefox, in runs of about 2,100 files. In M3i, with the workarounds, 458 and 1,485.
   - With no faults: 4 and 9. Faults, then calm: 27 and 38.
   - A restart repeats at most the files its processor hadn't committed. Delivery is at least once by design.
9. **A move costs about 0.2 s on both engines,** from the stop to the processor's first beat in its new pool. The medians over the runs are 118 to 228 ms. In M3i it was 1.1 s on Firefox. In 3 of the 26 runs, some moves took 1.0 to 1.5 s, and no failed start followed any of them.
10. **The balancer's own cost is still within the spread.** One pool with an idle balancer and one pool with none differ by 0 to 0.3 files a second, 0 points of CPU, a few MB and a few milliseconds of typing.

### Known limits

- **A record that crashes every member before it's settled** still comes back to each of them until the kernel gives up on all of them (ADR 0016, point 18). The File processor's corrupt files crash a processor only after their result is out, so this run doesn't hit it. A dead-letter topic is in isoloop's [would-like](https://github.com/isoloop/isoloop/blob/main/docs/would-like.md).
- **Under faults, the first backlog move comes about 25 s in.** A backlog move needs the backlog to rise over two 10 s windows in a row. In the runs with faults that made one, it came at 24 to 25 s on Chromium and 25 to 39 s on Firefox. On `0.1.0-next.4`, most of the p95 came from the files queued until then. Shorter windows under faults are in would-like.
- **A bisect's suspects never share a quarantine pool with offenders.** When both are in quarantine, the second quarantine pool holds a worker under `maxWorkers`, and the other processors share what's left (finding 4).
- **The move budget can keep an offender in the quarantine past its quiet window** (finding 7).

## The numbers

- **A negative Δ means the balancer is lower.** Lower is better for every figure except files done per second.
- **Δ is B − A:** the median, over the rounds, of each round's gap. So it can differ a little from subtracting the two columns, which are medians over the rounds.
- **Workers** count the generator's worker and every pool, but not the bus's.
- **CPU and memory** are Chromium only.
- **Files done per second** can be above the 50 a second produced: the window also clears files that queued before it.
- **Faults, then calm:** 3 rounds. Its window is the last 20 s of 5 minutes of calm, after 60 s of faults.

### Chromium, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.1 | 50.1 | **0.0** | 50.2 | 50.1 | **-0.1** |
| Latency per file, p50 | 19 ms | 33 ms | **+14 ms** | 59 ms | 33 ms | **-29 ms** |
| Latency per file, p95 | 39 ms | 74 ms | **+36 ms** | 148 ms | 74 ms | **-82 ms** |
| Typing (median of 5) | 20 ms | 18 ms | **-2 ms** | 17 ms | 18 ms | **+2 ms** |
| Workers at the end of the window | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Moves in the whole run | 0 | 10 | **+10** | 0 | 10 | **+10** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 186 ms | **–** | – | 186 ms | **–** |
| Spikes only noted | 0 | 0 | **0** | 0 | 0 | **0** |
| Behind events | 0 | 0 | **0** | 0 | 0 | **0** |
| Queue when the generator stops | 1 | 2 | **+1** | 1 | 2 | **+2** |
| Drain after the generator stops | 6 ms | 258 ms | **+1 ms** | 3 ms | 258 ms | **+9 ms** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 4 | **+4** | 0 | 4 | **+4** |
| Main-thread CPU | 20% | 17% | **-4 points** | 14% | 17% | **+3 points** |
| CPU, all threads | 138% | 130% | **-8 points** | 122% | 130% | **+8 points** |
| Memory after GC | 225 MB | 167 MB | **-57 MB** | 170 MB | 167 MB | **-2 MB** |

### Chromium, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.0 | 52.5 | **+2.5** | 26.5 | 52.5 | **+26.2** |
| Latency per file, p50 | 28 ms | 5.8 s | **+5.7 s** | 16.2 s | 5.8 s | **-10.4 s** |
| Latency per file, p95 | 378 ms | 12.7 s | **+12.3 s** | 20.5 s | 12.7 s | **-7.8 s** |
| Typing (median of 5) | 48 ms | 30 ms | **-22 ms** | 15 ms | 30 ms | **+15 ms** |
| Workers at the end of the window | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Moves in the whole run | 0 | 13 | **+13** | 0 | 13 | **+13** |
| Moves for a rising backlog | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 216 ms | **–** | – | 216 ms | **–** |
| Spikes only noted | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Behind events | 0 | 7 | **+7** | 0 | 7 | **+7** |
| Queue when the generator stops | 12 | 167 | **+156** | 1080 | 167 | **-914** |
| Drain after the generator stops | 1.0 s | 7.6 s | **+6.6 s** | 44.6 s | 7.6 s | **-37.3 s** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 20 | **+20** | 0 | 20 | **+20** |
| Main-thread CPU | 23% | 20% | **-4 points** | 7% | 20% | **+14 points** |
| CPU, all threads | 255% | 260% | **+6 points** | 122% | 260% | **+138 points** |
| Memory after GC | 257 MB | 270 MB | **+9 MB** | 152 MB | 270 MB | **+105 MB** |

### Firefox, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.1 | 50.1 | **-0.1** | 43.9 | 50.1 | **+6.2** |
| Latency per file, p50 | 24 ms | 38 ms | **+13 ms** | 3.5 s | 38 ms | **-3.4 s** |
| Latency per file, p95 | 51 ms | 94 ms | **+44 ms** | 9.0 s | 94 ms | **-8.9 s** |
| Typing (median of 5) | 60 ms | 44 ms | **-14 ms** | 33 ms | 44 ms | **+9 ms** |
| Workers at the end of the window | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Moves in the whole run | 0 | 11 | **+11** | 0 | 11 | **+11** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 228 ms | **–** | – | 228 ms | **–** |
| Spikes only noted | 0 | 0 | **0** | 0 | 0 | **0** |
| Behind events | 0 | 0 | **0** | 0 | 0 | **0** |
| Queue when the generator stops | 1 | 2 | **0** | 304 | 2 | **-302** |
| Drain after the generator stops | 260 ms | 262 ms | **+1 ms** | 8.4 s | 262 ms | **-8.1 s** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 9 | **+9** | 0 | 9 | **+9** |

### Firefox, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.3 | 47.9 | **-2.3** | 20.8 | 47.9 | **+27.1** |
| Latency per file, p50 | 47 ms | 1.2 s | **+1.1 s** | 19.3 s | 1.2 s | **-18.1 s** |
| Latency per file, p95 | 622 ms | 15.2 s | **+14.6 s** | 24.5 s | 15.2 s | **-9.5 s** |
| Typing (median of 5) | 82 ms | 53 ms | **-29 ms** | 34 ms | 53 ms | **+19 ms** |
| Workers at the end of the window | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Moves in the whole run | 0 | 14 | **+14** | 0 | 14 | **+14** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 220 ms | **–** | – | 220 ms | **–** |
| Spikes only noted | 0 | 3 | **+3** | 0 | 3 | **+3** |
| Behind events | 0 | 8 | **+8** | 0 | 8 | **+8** |
| Queue when the generator stops | 5 | 415 | **+409** | 1223 | 415 | **-811** |
| Drain after the generator stops | 1.8 s | 13.2 s | **+11.2 s** | 65.4 s | 13.2 s | **-52.4 s** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 28 | **+28** | 0 | 28 | **+28** |

### Chromium, Faults, then calm

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.1 | 50.1 | **0.0** | 54.3 | 50.1 | **-4.2** |
| Latency per file, p50 | 20 ms | 27 ms | **+7 ms** | 48.0 s | 27 ms | **-48.0 s** |
| Latency per file, p95 | 37 ms | 60 ms | **+23 ms** | 89.4 s | 60 ms | **-89.3 s** |
| Typing (median of 5) | 19 ms | 17 ms | **-2 ms** | 16 ms | 17 ms | **+4 ms** |
| Workers after the faults (faults, then calm) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers at the end of the window | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Fewest workers in the calm (faults, then calm) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Moves in the whole run | 0 | 25 | **+25** | 0 | 25 | **+25** |
| Moves for a rising backlog | 0 | 5 | **+5** | 0 | 5 | **+5** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 118 ms | **–** | – | 118 ms | **–** |
| Spikes only noted | 0 | 2 | **+2** | 0 | 2 | **+2** |
| Behind events | 0 | 19 | **+19** | 0 | 19 | **+19** |
| Queue when the generator stops | 1 | 0 | **0** | 2328 | 0 | **-2326** |
| Drain after the generator stops | 264 ms | 5 ms | **-260 ms** | 44.4 s | 5 ms | **-44.3 s** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 27 | **+27** | 0 | 27 | **+27** |
| Main-thread CPU | 22% | 19% | **-2 points** | 9% | 19% | **+10 points** |
| CPU, all threads | 139% | 132% | **-7 points** | 119% | 132% | **+14 points** |
| Memory after GC | 245 MB | 194 MB | **-52 MB** | 177 MB | 194 MB | **+19 MB** |

### Firefox, Faults, then calm

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.0 | 50.0 | **-0.1** | 43.3 | 50.0 | **+6.7** |
| Latency per file, p50 | 25 ms | 36 ms | **+12 ms** | 130.3 s | 36 ms | **-130.2 s** |
| Latency per file, p95 | 50 ms | 87 ms | **+38 ms** | 192.6 s | 87 ms | **-192.5 s** |
| Typing (median of 5) | 57 ms | 42 ms | **-15 ms** | 30 ms | 42 ms | **+13 ms** |
| Workers after the faults (faults, then calm) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers at the end of the window | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Fewest workers in the calm (faults, then calm) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Moves in the whole run | 0 | 30 | **+30** | 0 | 30 | **+30** |
| Moves for a rising backlog | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 174 ms | **–** | – | 174 ms | **–** |
| Spikes only noted | 0 | 4 | **+4** | 0 | 4 | **+4** |
| Behind events | 0 | 22 | **+22** | 0 | 22 | **+22** |
| Queue when the generator stops | 2 | 2 | **0** | 6147 | 2 | **-6145** |
| Drain after the generator stops | 271 ms | 268 ms | **-3 ms** | – | 268 ms | **–** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 1347 | 0 | **-1347** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Kinds with every processor given up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Files done twice | 0 | 38 | **+38** | 0 | 38 | **+38** |

### The balancer's own cost: `one-off` against `one`

Δ here too is the median of each round's gap, so with a wide spread across rounds it can differ from the two columns by more than usual: memory on Chromium with faults, for one.

| Figure | Engine, mix | `one-off` | `one` | **Δ** |
| --- | --- | --- | --- | --- |
| Files done per second | Chromium, Normal | 50.2 | 50.2 | **0.0** |
| Latency per file, p95 | Chromium, Normal | 147 ms | 148 ms | **+7 ms** |
| Typing (median of 5) | Chromium, Normal | 16 ms | 17 ms | **0 ms** |
| Main-thread CPU | Chromium, Normal | 14% | 14% | **0 points** |
| CPU, all threads | Chromium, Normal | 122% | 122% | **+0 points** |
| Memory after GC | Chromium, Normal | 169 MB | 170 MB | **+1 MB** |
| Files done per second | Firefox, Normal | 43.9 | 43.9 | **+0.1** |
| Latency per file, p95 | Firefox, Normal | 9.2 s | 9.0 s | **-89 ms** |
| Typing (median of 5) | Firefox, Normal | 36 ms | 33 ms | **-1 ms** |
| Files done per second | Chromium, With faults | 26.3 | 26.5 | **+0.3** |
| Latency per file, p95 | Chromium, With faults | 20.4 s | 20.5 s | **+395 ms** |
| Typing (median of 5) | Chromium, With faults | 15 ms | 15 ms | **0 ms** |
| Main-thread CPU | Chromium, With faults | 7% | 7% | **-0 points** |
| CPU, all threads | Chromium, With faults | 123% | 122% | **-0 points** |
| Memory after GC | Chromium, With faults | 168 MB | 152 MB | **-4 MB** |
| Files done per second | Firefox, With faults | 20.9 | 20.8 | **-0.2** |
| Latency per file, p95 | Firefox, With faults | 24.5 s | 24.5 s | **+242 ms** |
| Typing (median of 5) | Firefox, With faults | 30 ms | 34 ms | **+2 ms** |

<details>
<summary>How it was measured</summary>

### The runs

- **As in M3i:** the page `/files/?placement=<p>&rate=50&seed=7&start=1&maxWorkers=2`, plus `&poison=0.2&heavy=10&corrupt=0.1` with faults. A run has a 20 s warm-up, a 20 s window and five timed keystrokes. Then the generator stops, and the files without a result are counted after up to 2 minutes.
- **New for M3j:**
  - the processor reports each processor's busy time to the balancer with its group's backlog (`report(id, { backlog, busyMs })`);
  - no #211 workarounds ([web#151](https://github.com/isoloop/web/pull/151)): a processor that stops or crashes leaves its uncommitted files to the bus, which hands them to the group again;
  - faults, then calm: 60 s with faults, then 5 minutes calm, with the 20 s window at its end;
  - per run, the workers once a second, each processor's busy time both ways (the beat's and the reported one), every crash with its reason, and the processors the kernel gave up on, with their kinds.
- **Pairs**, interleaved: `own` against the balancer, `one` against the balancer, and `one-off` against `one` (normal and faults only).
- **Rounds:** 5 for normal and faults (80 runs), 3 for faults then calm (18 runs). None stopped.

### The machine

- **The same bench server as M3h and M3i:** an AMD Ryzen 7 5825U, every core fixed at 2.0 GHz, other containers paused, the container pinned with `--cpuset-cpus=2,4,6,8` to four physical cores.
- **The code:** `isoloop/web` at `718f2c0`, with `@isoloop/*@0.1.0-next.6`.
- **When:** 2026-11-19. Faults from 17:38 to 18:27 UTC, faults then calm from 18:27 to 20:24 UTC, and normal from 20:27 to 20:57 UTC.

### The runs before this one

M3j measured the File processor five times. Each of the first four found a problem, which was fixed and released before the next run. Their results aren't published here; the [M3j plan](https://github.com/isoloop/isoloop/blob/main/docs/plans/m3j-balancer-gaps.md) has their figures.

1. **`0.1.0-next.2`** (web `601bfb8`, 2026-11-18): the balancer lost files in all 16 of its runs with faults.
   - The kernel gave up on both image processors within about 10 s in each, after a corrupt file came back to them 8 or 9 times.
   - The cause was in the bus (ADR 0016, point 12): a group commit covered a delivery only once all its records were settled. A processor running behind got its files in batches, and when the corrupt file was settled first in its batch, its commit covered nothing, so the batch went back to the group.
   - Fixed in `0.1.0-next.3` ([isoloop#256](https://github.com/isoloop/isoloop/pull/256)): a commit also covers the settled first records of a partly settled delivery.
2. **`0.1.0-next.3`** (web `2b7e4d6`, 2026-11-18): no file lost, but the fault runs were slow, with a p95 of 8.5 to 20 s.
   - A bisect's second quarantine pool counted toward `maxWorkers: 2`, and with `balancer-1` filled the cap. The other processors were left sharing one worker, all six of them in 4 of the 10 fault runs.
   - Fixed in `0.1.0-next.4` ([isoloop#268](https://github.com/isoloop/isoloop/pull/268)): a quarantine pool beyond the first folds into the first when a rising backlog needs the worker.
3. **`0.1.0-next.4`** (web `a7c0654`, 2026-11-19): the cap broke. In each Chromium run, a `full` move and a `backlog` move each took a new pool in the same decision, which made three of the balancer's own pools. The cap counted only pools whose worker ran. On Firefox, a bisect's two halves held both quarantine pools, with no offender, and the fold took only offenders.
   - Fixed in `0.1.0-next.5` ([isoloop#279](https://github.com/isoloop/isoloop/pull/279)): the cap counts a pool a move has claimed, and the fold goes like with like.
4. **`0.1.0-next.5`** (web `c4503e5`, 2026-11-19): no file lost, and the cap held. But in 3 of the 15 balancer runs, on both engines, the kernel gave up on an image processor with `ready-timeout`: restarted into `balancer-quarantine-1`, it sent no `ready` within 10 s, again and again, until the kernel gave up on it.
   - The cause was in the runtime: a pool's worker closed itself when its last member left its table, while other members were still shutting down. Their `bye` was lost, so their stops waited out the 1 s grace, and the host's loader, which still counted them, sent the next start into the closed worker. In each of the 3 runs, the last two moves out of that pool before it cost 1.07 to 1.10 s, against about 0.2 s for the others.
   - Fixed in `0.1.0-next.6` ([isoloop#285](https://github.com/isoloop/isoloop/pull/285)): a pool's worker stays open until the loader ends it after its last member.
   - This run shows no `ready-timeout` and no move at the 1 s grace in that pattern (finding 9).

### To run it again

From a clone of `isoloop/web`, as `m3j-normal.sh`, `m3j-faults.sh` and `m3j-calm.sh` ran it on the server. They wrote to `normal-next6/`, `faults-next6/` and `calm-next6/`, the folder names each `summary.md` still shows; here they're `normal/`, `faults/` and `calm/`.

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
run() {
  docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g -v "$PWD":/work -w /work plant-compare \
    bash -lc "pnpm install --frozen-lockfile && pnpm --filter ./apps/processor compare:pairs $*"
}
for mix in normal faults; do
  run --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
    --pair isoloop:one-off=isoloop:one --mixes $mix --rounds 5 --hold 0 \
    --warm 20 --window 20 --engines chromium,firefox --out comparison/v0.3.0/$mix
done
run --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
  --mixes faults-calm --rounds 3 --hold 0 --warm 20 --window 20 \
  --engines chromium,firefox --out comparison/v0.3.0/calm
```

</details>
