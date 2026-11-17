# File processor, placements compared again (M3i)

The File processor's comparison from M3h ([`../README.md`](../README.md)), run again on the M3i balancer: it moves a processor whose reported backlog keeps rising, packs a quiet one back to free a worker, limits its moves, and quarantines on a second spike within 60 s rather than the first ([isoloop ADR 0017](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), amended for M3i). The same 8 headless processors run on a worker each (`own`), all in one pool (`one`), or placed by the balancer, here with `maxWorkers: 2`, which is what its default gives a 4-core machine. The runs are in [`results/`](results/) (normal and faults, [`summary.md`](results/summary.md)) and [`calm-results/`](calm-results/) (faults, then calm, [`summary.md`](calm-results/summary.md)). Each run also has a per-second trace of every processor and its move log.

## What we found

On four cores at 2.0 GHz, at 50 files a second:

1. **Most of the processors' work is out of the busy time's sight, so the balancer reads them as nearly idle.**
   - A processor works on a file in slices, and resumes each slice after `await`. A promise continuation runs after the callback that resolved it has returned, so the runtime's busy time (`busyMs`) counts the first slice of each file and not the rest. This is in ADR 0017's list of what `busyMs` can't see.
   - In the traces, each processor measures 0 to 8 % of a core, while `own` uses 139 % of CPU across threads on Chromium. On Firefox, in one pool that can't keep up, every processor measures 0 %.
   - This explains M3h's Firefox case: the full-pool trigger (80 % of a core) never saw a full pool. It also explains the frequent bisects below: a pool lags, and nobody's busy time accounts for it.
2. **With no faults, the backlog trigger splits the one pool, on both engines.**
   - **Chromium:** the balancer moves 3 processors for a rising backlog into a second pool. Against `one`, that's 1 more worker and a p95 of 83 ms against 153 ms. Against `own`, it's 3 workers instead of 9 and 57 MB less memory, at a p95 of 83 ms against 39 ms.
   - **Firefox, the M3h case:** the balancer now does 49.5 files a second against `one`'s 43.8 and `own`'s 50.1, after 1 or 2 backlog moves. With `maxWorkers: 2` it has no third pool to use, so it reports `behind` 6 times a run, and its p95 is 15.5 s against `one`'s 9.1 s and `own`'s 50 ms. Its p50 is 1.2 s against `one`'s 3.4 s.
   - **So the Firefox case is partly fixed.** The balancer notices and moves, and gets close to the rate, but within 2 pools the backlog it builds while measuring the processors first drains slowly.
3. **Packing back never happened.** There were 0 packs in all 36 runs with the balancer, including the 6 that ran 60 s calm after the faults, where it ended on 4 workers as it did after the faults.
   - At the end of the calm phase, 4 to 7 of the 8 processors were still in quarantine pools, mostly put there by bisects. Packing only moves a member out of one of the balancer's own pools, and a quarantine member waits out its quiet window first.
   - A group's backlog is rarely exactly 0 while files keep coming, and packing skips a member with a backlog above 0, or a pool whose members have one.
4. **With faults, the balancer does more than one pool and less than a worker each.**
   - Files a second: 46.3 on Chromium and 33.4 on Firefox, against `one`'s 26.8 and 19.7 and `own`'s 50.1 and 50.3. Its p50 is 88 % and 86 % lower than `one`'s.
   - It uses 4 workers (2 pools and the quarantine) where `own` uses 9.
   - Most of its moves are bisects and quarantine moves: a median of 13 moves a run on Chromium and 25 on Firefox, of which at most 1 was for a backlog.
5. **3 of the 23 runs with the balancer and faults ended with files lost, and the kernel had given up on processors in each.**
   - Chromium, faults: 989 files without a result, 6 processors given up on. Firefox, faults: 262 and 2. Chromium, faults then calm: 1,067 and 2.
   - In each, bisects had gathered 5 to 7 of the 8 processors in the quarantine at some point, alongside processors that crash on corrupt files. The runs don't record which processors the kernel gave up on (more than 3 crashes in a minute), or whether restarts of a shared quarantine count against members that didn't crash, so the path to the loss isn't pinned down. The next run should record the given-up processors and their kinds.
   - `own` and `one` lost no file in any run.
6. **Duplicates come almost all from the group-commit workaround.**
   - With faults, the balancer did a median of 458 files twice on Chromium and 1,485 on Firefox, in runs of about 2,100 files; 4 and 54 with no faults.
   - A restart with no workaround repeats at most the file in progress, so at most one file per move. The runs had a median of 13 to 25 moves, which leaves about 440 and 1,460 from the workaround: a stopping processor puts every file it holds back on its topic, because a group's commit can cross a redelivery ([isoloop#211](https://github.com/isoloop/isoloop/issues/211)), and the bus hands its uncommitted files to the group again too.
7. **A move costs about 0.2 s on Chromium and 1.1 s on Firefox,** from the stop to the processor's first beat in its new pool (medians over the runs).
8. **The balancer's own cost is still within the spread.** One pool with an idle balancer and one pool with none differ by 0 to 1 point of CPU, a few MB and a few milliseconds of typing.

## The numbers

- **A negative Δ means the balancer is lower.** Lower is better for every figure except files done per second.
- **Δ is B − A:** the median, over the rounds, of each round's gap. So it can differ a little from subtracting the two columns, which are medians over the rounds.
- **The figures are medians over the rounds,** so a figure that was 0 in most rounds shows 0: see the summaries' spread column, and finding 5, for the runs that lost files.
- **Workers** count the generator's worker and every pool, but not the bus's.
- **CPU and memory** are Chromium only.
- **Faults, then calm:** 3 rounds; its window is the last 20 s of 60 s calm after 60 s of faults.

### Chromium, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.0 | 50.2 | **+0.1** | 50.2 | 50.2 | **0.0** |
| Latency per file, p50 | 19 ms | 33 ms | **+14 ms** | 60 ms | 33 ms | **-26 ms** |
| Latency per file, p95 | 39 ms | 83 ms | **+44 ms** | 153 ms | 83 ms | **-69 ms** |
| Typing (median of 5) | 21 ms | 19 ms | **-3 ms** | 17 ms | 19 ms | **+2 ms** |
| Moves in the whole run | 0 | 11 | **+11** | 0 | 11 | **+11** |
| Moves for a rising backlog | 0 | 3 | **+3** | 0 | 3 | **+3** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 251 ms | **–** | – | 251 ms | **–** |
| Spikes only noted | 0 | 0 | **0** | 0 | 0 | **0** |
| Behind events | 0 | 0 | **0** | 0 | 0 | **0** |
| Queue when the generator stops | 0 | 3 | **+2** | 3 | 3 | **0** |
| Drain after the generator stops | 260 ms | 259 ms | **+6 ms** | 257 ms | 259 ms | **+10 ms** |
| Files done twice | 0 | 4 | **+4** | 0 | 4 | **+4** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Main-thread CPU | 20% | 17% | **-4 pp** | 14% | 17% | **+3 pp** |
| CPU, all threads | 139% | 128% | **-11 pp** | 122% | 128% | **+7 pp** |
| Memory after GC | 223 MB | 166 MB | **-57 MB** | 170 MB | 166 MB | **-4 MB** |

### Chromium, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.1 | 46.3 | **-3.7** | 26.8 | 46.3 | **+20.0** |
| Latency per file, p50 | 28 ms | 1855 ms | **+1825 ms** | 15722 ms | 1855 ms | **-13771 ms** |
| Latency per file, p95 | 383 ms | 17368 ms | **+16994 ms** | 20845 ms | 17368 ms | **-3482 ms** |
| Typing (median of 5) | 57 ms | 29 ms | **-24 ms** | 16 ms | 29 ms | **+12 ms** |
| Moves in the whole run | 0 | 13 | **+13** | 0 | 13 | **+13** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 204 ms | **–** | – | 204 ms | **–** |
| Spikes only noted | 0 | 2 | **+2** | 0 | 2 | **+2** |
| Behind events | 0 | 3 | **+3** | 0 | 3 | **+3** |
| Queue when the generator stops | 14 | 318 | **+304** | 1119 | 318 | **-814** |
| Drain after the generator stops | 1032 ms | 14092 ms | **+13066 ms** | 45879 ms | 14092 ms | **-32044 ms** |
| Files done twice | 0 | 458 | **+458** | 2 | 458 | **+456** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |
| Main-thread CPU | 25% | 21% | **-6 pp** | 7% | 21% | **+15 pp** |
| CPU, all threads | 255% | 290% | **+36 pp** | 122% | 290% | **+168 pp** |
| Memory after GC | 256 MB | 269 MB | **-37 MB** | 176 MB | 269 MB | **+118 MB** |

### Firefox, Normal

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | **-6** | 2 | 3 | **+1** |
| Files done per second | 50.1 | 49.5 | **-0.5** | 43.8 | 49.5 | **+6.3** |
| Latency per file, p50 | 24 ms | 1162 ms | **+1138 ms** | 3403 ms | 1162 ms | **-2747 ms** |
| Latency per file, p95 | 50 ms | 15515 ms | **+15465 ms** | 9050 ms | 15515 ms | **+6465 ms** |
| Typing (median of 5) | 55 ms | 40 ms | **-17 ms** | 30 ms | 40 ms | **+6 ms** |
| Moves in the whole run | 0 | 9 | **+9** | 0 | 9 | **+9** |
| Moves for a rising backlog | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 1129 ms | **–** | – | 1129 ms | **–** |
| Spikes only noted | 0 | 0 | **0** | 0 | 0 | **0** |
| Behind events | 0 | 6 | **+6** | 0 | 6 | **+6** |
| Queue when the generator stops | 2 | 198 | **+198** | 296 | 198 | **-108** |
| Drain after the generator stops | 270 ms | 5604 ms | **+5587 ms** | 8148 ms | 5604 ms | **-2544 ms** |
| Files done twice | 0 | 54 | **+54** | 0 | 54 | **+54** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |

### Firefox, With faults

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.3 | 33.4 | **-16.8** | 19.7 | 33.4 | **+14.3** |
| Latency per file, p50 | 45 ms | 2527 ms | **+2482 ms** | 19887 ms | 2527 ms | **-17136 ms** |
| Latency per file, p95 | 586 ms | 21653 ms | **+21061 ms** | 27699 ms | 21653 ms | **-6197 ms** |
| Typing (median of 5) | 74 ms | 65 ms | **-9 ms** | 32 ms | 65 ms | **+32 ms** |
| Moves in the whole run | 0 | 25 | **+25** | 0 | 25 | **+25** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 1042 ms | **–** | – | 1042 ms | **–** |
| Spikes only noted | 0 | 4 | **+4** | 0 | 4 | **+4** |
| Behind events | 0 | 2 | **+2** | 0 | 2 | **+2** |
| Queue when the generator stops | 4 | 788 | **+782** | 1254 | 788 | **-477** |
| Drain after the generator stops | 1804 ms | 56538 ms | **+54741 ms** | 66171 ms | 56538 ms | **-9584 ms** |
| Files done twice | 0 | 1485 | **+1485** | 9 | 1485 | **+1477** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |

### Chromium, faults then calm

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers after the faults (faults, then calm) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers at the end of the window | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.0 | 47.5 | **-2.5** | 26.0 | 47.5 | **+21.5** |
| Latency per file, p50 | 20 ms | 45 ms | **+24 ms** | 54791 ms | 45 ms | **-54753 ms** |
| Latency per file, p95 | 35 ms | 54892 ms | **+54857 ms** | 64193 ms | 54892 ms | **-9532 ms** |
| Typing (median of 5) | 19 ms | 19 ms | **0 ms** | 17 ms | 19 ms | **+2 ms** |
| Moves in the whole run | 0 | 24 | **+24** | 0 | 24 | **+24** |
| Moves for a rising backlog | 0 | 7 | **+7** | 0 | 7 | **+7** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 197 ms | **–** | – | 197 ms | **–** |
| Spikes only noted | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Behind events | 0 | 5 | **+5** | 0 | 5 | **+5** |
| Queue when the generator stops | 1 | 1068 | **+1068** | 3057 | 1068 | **-1989** |
| Drain after the generator stops | 6 ms | 33918 ms | **+33786 ms** | 65756 ms | 33918 ms | **-32370 ms** |
| Files done twice | 0 | 1945 | **+1945** | 304 | 1945 | **+1641** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 1 | **+1** | 0 | 1 | **+1** |
| Main-thread CPU | 22% | 20% | **-2 pp** | 7% | 20% | **+13 pp** |
| CPU, all threads | 136% | 186% | **+51 pp** | 119% | 186% | **+67 pp** |
| Memory after GC | 239 MB | 231 MB | **-8 MB** | 178 MB | 231 MB | **+54 MB** |

### Firefox, faults then calm

| Figure | `own` | balancer | **Δ** | `one` | balancer | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| Workers after the faults (faults, then calm) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers at the end of the window | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Workers (bus excluded) | 9 | 4 | **-5** | 2 | 4 | **+2** |
| Files done per second | 50.1 | 50.8 | **+0.7** | 17.2 | 50.8 | **+32.3** |
| Latency per file, p50 | 24 ms | 79 ms | **+55 ms** | 66363 ms | 79 ms | **-66234 ms** |
| Latency per file, p95 | 49 ms | 39397 ms | **+39348 ms** | 78118 ms | 39397 ms | **-37671 ms** |
| Typing (median of 5) | 54 ms | 51 ms | **-4 ms** | 31 ms | 51 ms | **+20 ms** |
| Moves in the whole run | 0 | 18 | **+18** | 0 | 18 | **+18** |
| Moves for a rising backlog | 0 | 0 | **0** | 0 | 0 | **0** |
| Packs back | 0 | 0 | **0** | 0 | 0 | **0** |
| Move cost, median (stop to first beat) | – | 1067 ms | **–** | – | 1067 ms | **–** |
| Spikes only noted | 0 | 3 | **+3** | 0 | 3 | **+3** |
| Behind events | 0 | 10 | **+10** | 0 | 10 | **+10** |
| Queue when the generator stops | 1 | 670 | **+669** | 3721 | 670 | **-3011** |
| Drain after the generator stops | 265 ms | 32205 ms | **+32184 ms** | 118581 ms | 32205 ms | **-85147 ms** |
| Files done twice | 0 | 1251 | **+1251** | 447 | 1251 | **+810** |
| Files without a result 2 min after the generator stops | 0 | 0 | **0** | 0 | 0 | **0** |
| Processors the kernel gave up on | 0 | 0 | **0** | 0 | 0 | **0** |

### The balancer's own cost: `one-off` against `one`

| Figure | Engine, mix | `one-off` | `one` | **Δ** |
| --- | --- | --- | --- | --- |
| Files done per second | Chromium, Normal | 50.1 | 50.2 | **0.0** |
| Latency per file, p95 | Chromium, Normal | 152 ms | 153 ms | **+5 ms** |
| Typing (median of 5) | Chromium, Normal | 16 ms | 17 ms | **0 ms** |
| Main-thread CPU | Chromium, Normal | 14% | 14% | **0 pp** |
| CPU, all threads | Chromium, Normal | 121% | 122% | **+1 pp** |
| Memory after GC | Chromium, Normal | 174 MB | 170 MB | **-4 MB** |
| Files done per second | Chromium, With faults | 26.5 | 26.8 | **+0.2** |
| Latency per file, p95 | Chromium, With faults | 20251 ms | 20845 ms | **+594 ms** |
| Typing (median of 5) | Chromium, With faults | 17 ms | 16 ms | **-1 ms** |
| Main-thread CPU | Chromium, With faults | 6% | 7% | **+0 pp** |
| CPU, all threads | Chromium, With faults | 122% | 122% | **-0 pp** |
| Memory after GC | Chromium, With faults | 188 MB | 176 MB | **+6 MB** |
| Files done per second | Firefox, Normal | 44.0 | 43.8 | **-0.1** |
| Latency per file, p95 | Firefox, Normal | 9492 ms | 9050 ms | **-57 ms** |
| Typing (median of 5) | Firefox, Normal | 31 ms | 30 ms | **0 ms** |
| Files done per second | Firefox, With faults | 19.6 | 19.7 | **+0.2** |
| Latency per file, p95 | Firefox, With faults | 27478 ms | 27699 ms | **-27 ms** |
| Typing (median of 5) | Firefox, With faults | 34 ms | 32 ms | **-2 ms** |

<details>
<summary>How it was measured</summary>

### The runs

- **As in M3h:** the page `/files/?placement=<p>&rate=50&seed=7&start=1&maxWorkers=2`, plus `&poison=0.2&heavy=10&corrupt=0.1` with faults. A run has a 20 s warm-up, a 20 s window, five timed keystrokes, then the generator stops and the files without a result are counted after up to 2 minutes.
- **New for M3i:**
  - `maxWorkers=2`;
  - the faults-then-calm mix: 60 s with faults, then the faults stop, 40 s calm, and the 20 s window;
  - per run, a trace once a second of every processor's pool, its load as the balancer and the beats see it, and its kind's backlog; every move with its reason and cost; noted spikes and `behind` events.
- **Pairs**, interleaved: `own` against the balancer, `one` against the balancer, and `one-off` against `one` (normal and faults only).
- **Rounds:** 5 for normal and faults (80 runs), 3 for faults then calm (36 runs). None stopped.
- **The page reports** each kind's backlog (files made and not done) on both processors of its group, every second.

### The machine

- **The same bench server as M3h:** an AMD Ryzen 7 5825U, every core fixed at 2.0 GHz, other containers paused, the container pinned with `--cpuset-cpus=2,4,6,8` to four physical cores.
- **The code:** `isoloop/web` at `0a1f9b9`, with `@isoloop/*@0.0.0-next.800569e` (isoloop#206, #208, #209 and the M3i balancer, #214).

### To run it again

From a clone of `isoloop/web`, as `m3i-run.sh` ran it on the server:

```bash
docker build -t plant-compare apps/dashboards/plant/comparison
run() {
  docker run --rm --init --cpuset-cpus=2,4,6,8 --shm-size=2g -v "$PWD":/work -w /work plant-compare \
    bash -lc "pnpm install --frozen-lockfile && pnpm --filter ./apps/processor compare:pairs $*"
}
run --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
  --pair isoloop:one-off=isoloop:one --mixes normal,faults --rounds 5 --hold 0 \
  --warm 20 --window 20 --engines chromium,firefox --out comparison/v0.2.0/results
run --pair isoloop:own=isoloop:balancer --pair isoloop:one=isoloop:balancer \
  --mixes faults-calm --rounds 3 --hold 0 --warm 20 --window 20 \
  --engines chromium,firefox --out comparison/v0.2.0/calm-results
```

</details>
