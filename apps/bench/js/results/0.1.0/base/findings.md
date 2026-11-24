**The 0.1.0 baseline.** 417 runs over 3 rounds, every copy reported. On 4 cores at 2.0 GHz, Chromium 158, `@isoloop/*` 0.1.0. The run was stopped once after 107 runs by an SSH logout (fixed in `server-run.sh`) and resumed with `--resume`, on the same machine, image and calibration. All figures are operations per second, the median of 3 rounds.

1. **One copy runs at the same speed wherever it runs**, on 16 of the 17 workloads: main thread, plain Worker and Isoloop are within 5 % of each other, and within 1 % on 11 of them.
   - Map get/set: 602,720 / 604,721 / 606,349.
   - Sorting 10k numbers: 228 / 227 / 227.
   - The odd 1,080,147 for small filter/map on a plain Worker came up in one round only; the median is 633,213.

2. **The exception is `structuredClone` of a 5 MB object: Isoloop is slower**, in every round:
   - one copy: 6.4 against 7.3 on the main thread and on a plain Worker (12 % fewer);
   - four copies: 20.5 against 25.1 on plain Workers (19 % fewer), and the balancer is the same 20.5.

   It's the only workload where Isoloop's worker differs from a plain one. The cause isn't measured yet: an engine profile of the isolate's worker against a plain Worker would show it.

3. **Four copies, one worker each: Isoloop does what plain Workers do**, within 2 % on 16 of 17 workloads. That's about 3 to 4 times the main thread, which runs the copies one at a time.
   - Map get/set: 2,429,644 against 2,430,537 (main thread 619,093).
   - Sorting 2k objects: 5,010 against 4,974 (main thread 1,346).
   - Matrix multiply: 87.7 against 87.5 (main thread 22.8).

4. **All four copies in one Isoloop worker do about what the main thread does**, since both have one core. Two workloads differ when copies share a worker:
   - filter/map/reduce on 10k objects is faster: 4,654 against 2,806;
   - dedupe + group 10k is slower: 1,029 against 1,237.

   The balancer, which also puts copies together, shows the same two effects. The cause isn't measured.

5. **The balancer gets 94–101 % of plain Workers on 14 of 17 workloads.** It measures every copy first and moves it, and most runs still make about 2 moves inside the 60 s window. The other three, and the lowest of the 14:
   - filter/map/reduce: 16,533 against 10,541 (more, from sharing; point 4);
   - dedupe + group: 3,685 against 4,593 (80 %, 4 to 5 moves a run);
   - structured clone: 20.5 against 25.1 (point 2);
   - sorting 10k numbers: 858 against 914 (94 %, 12 to 13 moves a run).

6. **The mixed scenario (2 heavy copies and 6 cheap ones at once), all copies together:**

   | | ops/s | workers |
   | --- | ---: | ---: |
   | Isoloop, a worker each | 1,889,581 | 8 |
   | Isoloop balancer | 1,734,621 | 5 |
   | Isoloop, one shared worker | 333,995 | 1 |

   - The balancer uses 5 workers instead of 8 and gets 8 % fewer operations in total.
   - The heavy copies get more with the balancer than with a worker each: sorting 3.8 against 2.5, cloning 4.3 against 3.2. With a worker each, 8 workers share 4 cores.
   - The heavy ops hold their worker for 100–200 ms, which the balancer counts as spikes. So it keeps the heavy copies in quarantine pools, and some cheap ones end up there too. It still made 3 to 5 moves inside the measured window.

7. **The page stays responsive whenever the work is off the main thread.** The page's 100 ms timer, p95 of how late it fired:
   - main thread with 1 copy: about 10 ms; with 4 copies: about 203 ms; with heavy work, up to 4 s (four copies of sorting 1M numbers);
   - plain Workers and Isoloop: under 3 ms in every case;
   - in the mixed scenario: 0.1 ms with a worker each, 1.6 ms with the balancer.

**Not measured here:** start-up time, memory per worker, and the cost of the bus. These figures are throughput only.
