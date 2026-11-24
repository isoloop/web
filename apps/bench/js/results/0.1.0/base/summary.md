# js-bench: base

## Findings

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

bench-machine-1 (AMD Ryzen 7 5825U with Radeon Graphics), 400–1996 MHz seen, cpuset `2,4,6,8`, cpu.max `max 100000`, balancer maxWorkers 4. `@isoloop/host` 0.1.0, js-bench `e5dcf86`, 2026-11-24T08:25Z. 3 round(s); figures are medians over rounds, with the min–max.

## chromium 158.0.8127.18

### cheap

Operations per second, all copies together (median, min–max). × columns: against native-main and native-worker at the same n. Lateness: the main thread's 100 ms timer, p95.

| workload | n | placement | ops/s | min–max | × main | × worker | op p50 µs | lateness p95 ms | moves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| array-push-pop-indexof | 1 | native-main | 1,263,661 | 1,261,187–1,268,286 | 1.00× | 1.00× | 0.8 | 10.4 |  |
| array-push-pop-indexof | 1 | native-worker | 1,268,952 | 1,209,854–1,271,332 | 1.00× | 1.00× | 0.8 | 0.3 |  |
| array-push-pop-indexof | 1 | isoloop-own | 1,267,696 | 1,266,269–1,268,667 | 1.00× | 1.00× | 0.8 | 0.2 |  |
| array-push-pop-indexof | 4 | native-main | 1,625,485 | 1,616,406–1,633,707 | 1.00× | 0.33× | 0.6 | 202 |  |
| array-push-pop-indexof | 4 | native-worker | 4,952,607 | 4,931,023–5,109,822 | 3.05× | 1.00× | 0.8 | 2.2 |  |
| array-push-pop-indexof | 4 | isoloop-own | 4,967,186 | 4,890,349–5,081,120 | 3.06× | 1.00× | 0.8 | 2.2 |  |
| array-push-pop-indexof | 4 | isoloop-one | 1,614,712 | 1,607,555–1,630,433 | 0.99× | 0.33× | 0.6 | 0.1 |  |
| array-push-pop-indexof | 4 | isoloop-balancer | 4,846,210 | 4,833,477–4,865,796 | 2.98× | 0.98× | 0.8 | 1.7 | 2, 5, 2 |
| map-get-set | 1 | native-main | 602,720 | 599,995–603,110 | 1.00× | 1.00× | 1.5 | 10.1 |  |
| map-get-set | 1 | native-worker | 604,721 | 604,437–605,552 | 1.00× | 1.00× | 1.5 | 0.2 |  |
| map-get-set | 1 | isoloop-own | 606,349 | 595,446–607,358 | 1.01× | 1.00× | 1.5 | 0.2 |  |
| map-get-set | 4 | native-main | 619,093 | 617,473–620,208 | 1.00× | 0.25× | 1.7 | 203 |  |
| map-get-set | 4 | native-worker | 2,430,537 | 2,425,785–2,433,679 | 3.93× | 1.00× | 1.5 | 2.7 |  |
| map-get-set | 4 | isoloop-own | 2,429,644 | 2,417,316–2,431,582 | 3.92× | 1.00× | 1.5 | 2.8 |  |
| map-get-set | 4 | isoloop-one | 615,402 | 614,641–615,491 | 0.99× | 0.25× | 1.7 | 0.1 |  |
| map-get-set | 4 | isoloop-balancer | 2,349,932 | 2,322,205–2,383,358 | 3.80× | 0.97× | 1.5 | 2.0 | 3, 2, 2 |
| object-read-write | 1 | native-main | 463,053 | 457,756–463,087 | 1.00× | 1.00× | 2.0 | 9.6 |  |
| object-read-write | 1 | native-worker | 464,202 | 463,515–465,467 | 1.00× | 1.00× | 2.0 | 0.3 |  |
| object-read-write | 1 | isoloop-own | 457,348 | 457,008–464,365 | 0.99× | 0.99× | 2.0 | 0.2 |  |
| object-read-write | 4 | native-main | 491,939 | 490,294–492,116 | 1.00× | 0.27× | 2.0 | 203 |  |
| object-read-write | 4 | native-worker | 1,831,859 | 1,824,168–1,840,502 | 3.72× | 1.00× | 2.0 | 2.8 |  |
| object-read-write | 4 | isoloop-own | 1,811,044 | 1,807,984–1,812,975 | 3.68× | 0.99× | 2.0 | 2.5 |  |
| object-read-write | 4 | isoloop-one | 492,599 | 490,838–492,980 | 1.00× | 0.27× | 2.0 | 0.1 |  |
| object-read-write | 4 | isoloop-balancer | 1,785,632 | 1,781,158–1,804,264 | 3.63× | 0.97× | 2.0 | 1.9 | 2, 2, 2 |
| set-add-has-delete | 1 | native-main | 194,253 | 193,313–194,310 | 1.00× | 1.00× | 4.5 | 10.2 |  |
| set-add-has-delete | 1 | native-worker | 193,757 | 193,707–194,017 | 1.00× | 1.00× | 4.5 | 0.2 |  |
| set-add-has-delete | 1 | isoloop-own | 194,390 | 194,287–194,407 | 1.00× | 1.00× | 4.5 | 0.2 |  |
| set-add-has-delete | 4 | native-main | 204,237 | 203,760–204,407 | 1.00× | 0.26× | 4.5 | 204 |  |
| set-add-has-delete | 4 | native-worker | 776,657 | 776,347–777,383 | 3.80× | 1.00× | 4.8 | 2.7 |  |
| set-add-has-delete | 4 | isoloop-own | 776,560 | 776,307–777,503 | 3.80× | 1.00× | 4.5 | 2.2 |  |
| set-add-has-delete | 4 | isoloop-one | 205,320 | 205,113–205,833 | 1.01× | 0.26× | 4.5 | 0.1 |  |
| set-add-has-delete | 4 | isoloop-balancer | 757,550 | 755,603–768,113 | 3.71× | 0.98× | 4.5 | 1.9 | 2, 0, 2 |
| small-filter-map | 1 | native-main | 651,849 | 645,646–653,028 | 1.00× | 1.03× | 1.4 | 10.1 |  |
| small-filter-map | 1 | native-worker | 633,213 | 632,531–1,080,147 | 0.97× | 1.00× | 1.4 | 0.3 |  |
| small-filter-map | 1 | isoloop-own | 618,392 | 616,457–624,641 | 0.95× | 0.98× | 1.4 | 0.2 |  |
| small-filter-map | 4 | native-main | 712,531 | 693,471–715,573 | 1.00× | 0.28× | 1.4 | 203 |  |
| small-filter-map | 4 | native-worker | 2,521,966 | 2,361,485–2,536,086 | 3.54× | 1.00× | 1.4 | 2.4 |  |
| small-filter-map | 4 | isoloop-own | 2,553,358 | 2,526,592–2,565,800 | 3.58× | 1.01× | 1.4 | 2.2 |  |
| small-filter-map | 4 | isoloop-one | 682,549 | 680,973–695,333 | 0.96× | 0.27× | 1.4 | 0.1 |  |
| small-filter-map | 4 | isoloop-balancer | 2,552,528 | 2,518,685–2,556,482 | 3.58× | 1.01× | 1.4 | 2.2 | 2, 2, 2 |

### regular

Operations per second, all copies together (median, min–max). × columns: against native-main and native-worker at the same n. Lateness: the main thread's 100 ms timer, p95.

| workload | n | placement | ops/s | min–max | × main | × worker | op p50 µs | lateness p95 ms | moves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| filter-map-reduce-10k | 1 | native-main | 2,600 | 2,598–2,604 | 1.00× | 1.00× | 367 | 10.7 |  |
| filter-map-reduce-10k | 1 | native-worker | 2,606 | 2,605–2,607 | 1.00× | 1.00× | 367 | 0.2 |  |
| filter-map-reduce-10k | 1 | isoloop-own | 2,608 | 2,603–2,608 | 1.00× | 1.00× | 367 | 0.1 |  |
| filter-map-reduce-10k | 4 | native-main | 2,806 | 2,799–2,825 | 1.00× | 0.27× | 367 | 203 |  |
| filter-map-reduce-10k | 4 | native-worker | 10,541 | 10,528–10,554 | 3.76× | 1.00× | 367 | 2.2 |  |
| filter-map-reduce-10k | 4 | isoloop-own | 10,529 | 10,509–10,530 | 3.75× | 1.00× | 367 | 2.3 |  |
| filter-map-reduce-10k | 4 | isoloop-one | 4,654 | 4,650–4,669 | 1.66× | 0.44× | 233 | 0.1 |  |
| filter-map-reduce-10k | 4 | isoloop-balancer | 16,533 | 14,931–16,825 | 5.89× | 1.57× | 233 | 2.4 | 2, 11, 2 |
| json-roundtrip-50kb | 1 | native-main | 3,236 | 3,220–3,237 | 1.00× | 1.03× | 267 | 10.0 |  |
| json-roundtrip-50kb | 1 | native-worker | 3,139 | 3,134–3,141 | 0.97× | 1.00× | 300 | 0.2 |  |
| json-roundtrip-50kb | 1 | isoloop-own | 3,108 | 3,091–3,125 | 0.96× | 0.99× | 300 | 0.2 |  |
| json-roundtrip-50kb | 4 | native-main | 3,492 | 3,470–3,496 | 1.00× | 0.28× | 300 | 203 |  |
| json-roundtrip-50kb | 4 | native-worker | 12,675 | 12,602–12,706 | 3.63× | 1.00× | 300 | 2.7 |  |
| json-roundtrip-50kb | 4 | isoloop-own | 12,474 | 12,467–12,544 | 3.57× | 0.98× | 300 | 2.4 |  |
| json-roundtrip-50kb | 4 | isoloop-one | 3,451 | 3,426–3,468 | 0.99× | 0.27× | 300 | 0.1 |  |
| json-roundtrip-50kb | 4 | isoloop-balancer | 12,444 | 12,304–12,517 | 3.56× | 0.98× | 300 | 2.1 | 2, 2, 2 |
| map-build-lookup-10k | 1 | native-main | 1,034 | 1,034–1,036 | 1.00× | 1.00× | 900 | 10.2 |  |
| map-build-lookup-10k | 1 | native-worker | 1,034 | 1,034–1,036 | 1.00× | 1.00× | 900 | 0.2 |  |
| map-build-lookup-10k | 1 | isoloop-own | 1,034 | 1,031–1,035 | 1.00× | 1.00× | 900 | 0.1 |  |
| map-build-lookup-10k | 4 | native-main | 1,119 | 1,119–1,126 | 1.00× | 0.27× | 900 | 203 |  |
| map-build-lookup-10k | 4 | native-worker | 4,069 | 4,047–4,076 | 3.64× | 1.00× | 900 | 2.6 |  |
| map-build-lookup-10k | 4 | isoloop-own | 4,051 | 4,046–4,059 | 3.62× | 1.00× | 900 | 2.5 |  |
| map-build-lookup-10k | 4 | isoloop-one | 1,114 | 1,113–1,116 | 1.00× | 0.27× | 900 | 0.1 |  |
| map-build-lookup-10k | 4 | isoloop-balancer | 3,979 | 3,952–4,005 | 3.56× | 0.98× | 900 | 2.3 | 2, 2, 2 |
| set-dedupe-groupby-10k | 1 | native-main | 1,137 | 1,137–1,140 | 1.00× | 1.00× | 800 | 10.6 |  |
| set-dedupe-groupby-10k | 1 | native-worker | 1,138 | 1,138–1,138 | 1.00× | 1.00× | 800 | 0.2 |  |
| set-dedupe-groupby-10k | 1 | isoloop-own | 1,139 | 1,136–1,140 | 1.00× | 1.00× | 800 | 0.1 |  |
| set-dedupe-groupby-10k | 4 | native-main | 1,237 | 1,234–1,242 | 1.00× | 0.27× | 800 | 203 |  |
| set-dedupe-groupby-10k | 4 | native-worker | 4,593 | 4,592–4,598 | 3.71× | 1.00× | 800 | 2.3 |  |
| set-dedupe-groupby-10k | 4 | isoloop-own | 4,569 | 4,565–4,569 | 3.69× | 0.99× | 800 | 2.5 |  |
| set-dedupe-groupby-10k | 4 | isoloop-one | 1,029 | 1,026–1,031 | 0.83× | 0.22× | 1,000 | 0.1 |  |
| set-dedupe-groupby-10k | 4 | isoloop-balancer | 3,685 | 3,671–3,716 | 2.98× | 0.80× | 1,000 | 2.4 | 4, 4, 5 |
| sort-numbers-10k | 1 | native-main | 228 | 227–229 | 1.00× | 1.00× | 4,000 | 14.7 |  |
| sort-numbers-10k | 1 | native-worker | 227 | 227–228 | 1.00× | 1.00× | 4,000 | 0.2 |  |
| sort-numbers-10k | 1 | isoloop-own | 227 | 226–227 | 1.00× | 1.00× | 4,100 | 0.2 |  |
| sort-numbers-10k | 4 | native-main | 247 | 247–248 | 1.00× | 0.27× | 4,000 | 216 |  |
| sort-numbers-10k | 4 | native-worker | 914 | 913–916 | 3.69× | 1.00× | 4,000 | 2.1 |  |
| sort-numbers-10k | 4 | isoloop-own | 910 | 906–911 | 3.68× | 1.00× | 4,050 | 2.6 |  |
| sort-numbers-10k | 4 | isoloop-one | 246 | 246–246 | 0.99× | 0.27× | 4,050 | 0.1 |  |
| sort-numbers-10k | 4 | isoloop-balancer | 858 | 842–864 | 3.47× | 0.94× | 4,000 | 2.2 | 12, 13, 13 |
| sort-objects-2k | 1 | native-main | 1,245 | 1,244–1,252 | 1.00× | 1.00× | 700 | 9.6 |  |
| sort-objects-2k | 1 | native-worker | 1,249 | 1,245–1,255 | 1.00× | 1.00× | 700 | 0.2 |  |
| sort-objects-2k | 1 | isoloop-own | 1,246 | 1,228–1,250 | 1.00× | 1.00× | 700 | 0.2 |  |
| sort-objects-2k | 4 | native-main | 1,346 | 1,345–1,350 | 1.00× | 0.27× | 700 | 203 |  |
| sort-objects-2k | 4 | native-worker | 4,974 | 4,971–4,999 | 3.70× | 1.00× | 700 | 2.1 |  |
| sort-objects-2k | 4 | isoloop-own | 5,010 | 5,009–5,030 | 3.72× | 1.01× | 700 | 2.3 |  |
| sort-objects-2k | 4 | isoloop-one | 1,344 | 1,335–1,349 | 1.00× | 0.27× | 700 | 0.1 |  |
| sort-objects-2k | 4 | isoloop-balancer | 4,913 | 4,878–4,959 | 3.65× | 0.99× | 700 | 2.3 | 2, 2, 2 |

### heavy

Operations per second, all copies together (median, min–max). × columns: against native-main and native-worker at the same n. Lateness: the main thread's 100 ms timer, p95.

| workload | n | placement | ops/s | min–max | × main | × worker | op p50 µs | lateness p95 ms | moves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| map-insert-iterate-1m | 1 | native-main | 9.2 | 9.2–9.2 | 1.00× | 1.00× | 98,600 | 22.6 |  |
| map-insert-iterate-1m | 1 | native-worker | 9.2 | 9.2–9.2 | 1.00× | 1.00× | 98,500 | 0.1 |  |
| map-insert-iterate-1m | 1 | isoloop-own | 9.2 | 9.1–9.2 | 1.00× | 0.99× | 99,100 | 0.1 |  |
| map-insert-iterate-1m | 4 | native-main | 8.8 | 8.8–8.9 | 1.00× | 0.32× | 115,550 | 395 |  |
| map-insert-iterate-1m | 4 | native-worker | 27.3 | 27.1–27.3 | 3.10× | 1.00× | 139,400 | 2.1 |  |
| map-insert-iterate-1m | 4 | isoloop-own | 27.0 | 26.9–27.0 | 3.07× | 0.99× | 140,450 | 2.0 |  |
| map-insert-iterate-1m | 4 | isoloop-one | 8.6 | 8.6–8.7 | 0.98× | 0.32× | 117,000 | 0.1 |  |
| map-insert-iterate-1m | 4 | isoloop-balancer | 26.3 | 26.0–26.9 | 2.99× | 0.96× | 139,900 | 0.7 | 9, 7, 4 |
| matmul-300 | 1 | native-main | 21.8 | 21.8–21.8 | 1.00× | 1.00× | 43,700 | 83.7 |  |
| matmul-300 | 1 | native-worker | 21.8 | 21.8–21.8 | 1.00× | 1.00× | 43,700 | 0.1 |  |
| matmul-300 | 1 | isoloop-own | 21.8 | 21.6–21.8 | 1.00× | 1.00× | 43,700 | 0.1 |  |
| matmul-300 | 4 | native-main | 22.8 | 22.7–22.9 | 1.00× | 0.26× | 43,700 | 336 |  |
| matmul-300 | 4 | native-worker | 87.5 | 87.5–87.8 | 3.83× | 1.00× | 43,550 | 1.8 |  |
| matmul-300 | 4 | isoloop-own | 87.7 | 87.7–87.7 | 3.84× | 1.00× | 43,500 | 1.8 |  |
| matmul-300 | 4 | isoloop-one | 22.8 | 22.6–22.8 | 1.00× | 0.26× | 43,900 | 0.1 |  |
| matmul-300 | 4 | isoloop-balancer | 86.6 | 86.3–87.4 | 3.79× | 0.99× | 43,500 | 2.0 | 2, 0, 4 |
| sort-numbers-1m | 1 | native-main | 1.3 | 1.2–1.3 | 1.00× | 1.00× | 795,500 | 707 |  |
| sort-numbers-1m | 1 | native-worker | 1.3 | 1.3–1.3 | 1.00× | 1.00× | 791,200 | 0.1 |  |
| sort-numbers-1m | 1 | isoloop-own | 1.3 | 1.2–1.3 | 1.00× | 1.00× | 796,300 | 0.1 |  |
| sort-numbers-1m | 4 | native-main | 1.3 | 1.2–1.3 | 1.00× | 0.27× | 799,050 | 3,954 |  |
| sort-numbers-1m | 4 | native-worker | 4.7 | 4.6–4.7 | 3.75× | 1.00× | 842,650 | 1.5 |  |
| sort-numbers-1m | 4 | isoloop-own | 4.7 | 4.7–4.7 | 3.76× | 1.00× | 842,800 | 0.7 |  |
| sort-numbers-1m | 4 | isoloop-one | 1.2 | 1.2–1.2 | 0.97× | 0.26× | 812,300 | 0.1 |  |
| sort-numbers-1m | 4 | isoloop-balancer | 4.7 | 4.6–4.7 | 3.73× | 1.00× | 844,100 | 0.9 | 0, 0, 0 |
| sort-objects-200k | 1 | native-main | 7.0 | 7.0–7.0 | 1.00× | 1.01× | 137,800 | 46.1 |  |
| sort-objects-200k | 1 | native-worker | 6.9 | 6.9–7.0 | 0.99× | 1.00× | 138,200 | 0.1 |  |
| sort-objects-200k | 1 | isoloop-own | 6.9 | 6.9–6.9 | 0.99× | 1.00× | 138,800 | 0.1 |  |
| sort-objects-200k | 4 | native-main | 7.3 | 7.2–7.3 | 1.00× | 0.30× | 137,650 | 459 |  |
| sort-objects-200k | 4 | native-worker | 24.3 | 24.0–24.6 | 3.35× | 1.00× | 158,550 | 2.2 |  |
| sort-objects-200k | 4 | isoloop-own | 24.3 | 24.2–24.3 | 3.34× | 1.00× | 158,350 | 2.0 |  |
| sort-objects-200k | 4 | isoloop-one | 7.1 | 7.1–7.1 | 0.98× | 0.29× | 139,300 | 0.1 |  |
| sort-objects-200k | 4 | isoloop-balancer | 23.9 | 23.8–24.3 | 3.30× | 0.98× | 159,550 | 1.3 | 0, 2, 0 |
| sort-typed-1m | 1 | native-main | 4.7 | 4.6–4.7 | 1.00× | 1.00× | 210,900 | 117 |  |
| sort-typed-1m | 1 | native-worker | 4.7 | 4.6–4.7 | 1.00× | 1.00× | 211,000 | 0.1 |  |
| sort-typed-1m | 1 | isoloop-own | 4.7 | 4.6–4.7 | 1.00× | 1.00× | 211,100 | 0.1 |  |
| sort-typed-1m | 4 | native-main | 4.7 | 4.7–4.7 | 1.00× | 0.26× | 211,800 | 760 |  |
| sort-typed-1m | 4 | native-worker | 18.5 | 18.5–18.5 | 3.92× | 1.00× | 211,300 | 1.7 |  |
| sort-typed-1m | 4 | isoloop-own | 18.5 | 18.5–18.5 | 3.92× | 1.00× | 211,250 | 0.6 |  |
| sort-typed-1m | 4 | isoloop-one | 4.7 | 4.7–4.7 | 1.00× | 0.25× | 211,600 | 0.1 |  |
| sort-typed-1m | 4 | isoloop-balancer | 18.5 | 18.5–18.5 | 3.92× | 1.00× | 211,400 | 1.0 | 0, 0, 0 |
| structured-clone-5mb | 1 | native-main | 7.3 | 7.2–7.3 | 1.00× | 1.00× | 125,000 | 86.9 |  |
| structured-clone-5mb | 1 | native-worker | 7.3 | 7.2–7.3 | 1.00× | 1.00× | 124,900 | 0.1 |  |
| structured-clone-5mb | 1 | isoloop-own | 6.4 | 6.3–6.4 | 0.88× | 0.87× | 150,300 | 0.3 |  |
| structured-clone-5mb | 4 | native-main | 7.7 | 7.7–7.8 | 1.00× | 0.31× | 127,400 | 469 |  |
| structured-clone-5mb | 4 | native-worker | 25.1 | 25.0–25.2 | 3.27× | 1.00× | 144,400 | 2.8 |  |
| structured-clone-5mb | 4 | isoloop-own | 20.5 | 20.5–20.5 | 2.66× | 0.81× | 186,100 | 2.3 |  |
| structured-clone-5mb | 4 | isoloop-one | 6.7 | 6.7–6.7 | 0.87× | 0.27× | 148,250 | 0.5 |  |
| structured-clone-5mb | 4 | isoloop-balancer | 20.5 | 20.4–20.5 | 2.66× | 0.81× | 186,450 | 2.2 | 0, 0, 0 |

### The balancer scenario: 2 heavy copies + 6 cheap

Operations per second per copy (median over rounds), and the moves inside the window.

| copy | isoloop-balancer | isoloop-one | isoloop-own |
| --- | --- | --- | --- |
| c1-sort-typed-1m | 3.8 | 1.5 | 2.5 |
| c2-structured-clone-5mb | 4.3 | 1.5 | 3.2 |
| c3-map-get-set | 283,253 | 49,609 | 305,905 |
| c4-set-add-has-delete | 61,478 | 15,547 | 99,507 |
| c5-array-push-pop-indexof | 778,930 | 133,614 | 634,514 |
| c6-object-read-write | 132,535 | 35,680 | 224,458 |
| c7-small-filter-map | 289,601 | 50,369 | 321,040 |
| c8-map-get-set | 290,333 | 49,100 | 306,781 |
| workers at the end (pools) | 5.0 | 1.0 | 8.0 |
| main-thread lateness p95 ms | 1.6 | 0.1 | 0.1 |

<details><summary>Balancer events and pools at the end</summary>

Round 1: pools {"c1-sort-typed-1m":"balancer-quarantine-2","c2-structured-clone-5mb":"balancer-quarantine-1","c3-map-get-set":"balancer-1","c4-set-add-has-delete":"balancer-1","c5-array-push-pop-indexof":"balancer-quarantine-4","c6-object-read-write":"balancer-1","c7-small-filter-map":"balancer-quarantine-3","c8-map-get-set":"balancer-quarantine-3"}

- -29.2 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-1","lagMs":675.0999999046326,"action":"noted"}
- -26.5 s move c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.5 s move c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.5 s move c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.5 s move c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.2 s move c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.2 s move c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.1 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.1 s move c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.0 s arrived c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1506.4000000953674}
- -26.0 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1506.2000002861023}
- -26.0 s arrived c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1506.2000002861023}
- -26.0 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1506.0999999046326}
- -26.0 s arrived c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":845.5999999046326}
- -26.0 s arrived c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":845.5999999046326}
- -25.8 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-1","costMs":769.0999999046326}
- -25.8 s arrived c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","costMs":768.9000000953674}
- -25.6 s move c7-small-filter-map {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","reason":"bisect"}
- -25.4 s arrived c7-small-filter-map {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","costMs":405.69999980926514}
- -25.3 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-2","lagMs":575,"action":"quarantined"}
- -25.3 s move c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -25.1 s arrived c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","costMs":247.30000019073486}
- -24.1 s behind c1-sort-typed-1m {"pool":"balancer-quarantine-2","backlog":0}
- -24.1 s behind c2-structured-clone-5mb {"pool":"balancer-quarantine-2","backlog":0}
- -24.1 s behind c3-map-get-set {"pool":"balancer-quarantine-2","backlog":0}
- -24.1 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-2","backlog":0}
- -23.0 s move c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- -23.0 s arrived c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","costMs":39.90000009536743}
- -22.6 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"spike"}
- -22.6 s move c7-small-filter-map {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -22.5 s arrived c7-small-filter-map {"from":"balancer-quarantine-4","to":"balancer-1","costMs":48.19999980926514}
- -22.4 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":454.90000009536743}
- -22.3 s move c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.3 s move c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.3 s move c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.3 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","costMs":752.9000000953674}
- -22.3 s arrived c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","costMs":752.8000001907349}
- -22.3 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","costMs":752.8000001907349}
- -22.1 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -21.8 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-1","costMs":264.5}
- -21.8 s spike c2-structured-clone-5mb {"pool":"balancer-1","lagMs":258.09999990463257,"action":"noted"}
- -21.4 s spike c2-structured-clone-5mb {"pool":"balancer-1","lagMs":296.2000002861023,"action":"quarantined"}
- -21.1 s move c2-structured-clone-5mb {"from":"balancer-1","to":"balancer-quarantine-1","reason":"spike"}
- -20.8 s arrived c2-structured-clone-5mb {"from":"balancer-1","to":"balancer-quarantine-1","costMs":596}
- -20.8 s move c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -20.8 s move c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -20.5 s move c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -20.5 s arrived c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-4","costMs":416.2999997138977}
- -20.5 s arrived c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-4","costMs":416.19999980926514}
- -20.5 s arrived c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-4","costMs":416.19999980926514}
- -19.8 s behind c5-array-push-pop-indexof {"pool":"balancer-quarantine-4","backlog":0}
- -19.4 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- -19.4 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- -17.4 s move c3-map-get-set {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -17.4 s move c4-set-add-has-delete {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -17.2 s arrived c3-map-get-set {"from":"balancer-quarantine-4","to":"balancer-1","costMs":328.59999990463257}
- -17.2 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-4","to":"balancer-1","costMs":328.59999990463257}
- 5.9 s behind c3-map-get-set {"pool":"balancer-1","backlog":0}
- 5.9 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 7.5 s move c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- 7.5 s arrived c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","costMs":100.40000009536743}
- 7.7 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 7.9 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":346.40000009536743}
- 7.9 s move c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 7.9 s move c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.0 s arrived c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","costMs":448.09999990463257}
- 8.0 s arrived c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-3","costMs":448}
- 8.5 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 10.7 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 10.7 s behind c7-small-filter-map {"pool":"balancer-quarantine-3","backlog":0}
- 11.0 s move c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- 11.2 s arrived c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","costMs":239.59999990463257}
- 36.2 s behind c3-map-get-set {"pool":"balancer-1","backlog":0}
- 36.2 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 39.3 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 40.8 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 42.5 s behind c7-small-filter-map {"pool":"balancer-quarantine-3","backlog":0}
- 66.4 s behind c3-map-get-set {"pool":"balancer-1","backlog":0}
- 66.4 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 69.3 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 70.9 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 75.4 s behind c7-small-filter-map {"pool":"balancer-quarantine-3","backlog":0}
- 96.4 s behind c3-map-get-set {"pool":"balancer-1","backlog":0}
- 96.4 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 100.9 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 101.4 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 108.8 s behind c7-small-filter-map {"pool":"balancer-quarantine-3","backlog":0}

Round 2: pools {"c1-sort-typed-1m":"balancer-quarantine-2","c2-structured-clone-5mb":"balancer-1","c3-map-get-set":"balancer-quarantine-3","c4-set-add-has-delete":"balancer-1","c5-array-push-pop-indexof":"balancer-quarantine-1","c6-object-read-write":"balancer-1","c7-small-filter-map":"balancer-quarantine-4","c8-map-get-set":"balancer-quarantine-3"}

- -29.2 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-1","lagMs":684.0999999046326,"action":"noted"}
- -26.7 s move c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.4 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.4 s move c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.2 s arrived c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1502.1999998092651}
- -26.2 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1502.0999999046326}
- -26.2 s arrived c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1504.7999997138977}
- -26.2 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1504.6999998092651}
- -26.2 s move c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.2 s move c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.2 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":677.5999999046326}
- -26.2 s arrived c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":677.5999999046326}
- -26.0 s arrived c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-1","costMs":566.6999998092651}
- -26.0 s arrived c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","costMs":566.6000003814697}
- -25.8 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","reason":"bisect"}
- -25.6 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","costMs":403}
- -25.5 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-2","lagMs":600.1999998092651,"action":"quarantined"}
- -24.4 s behind c1-sort-typed-1m {"pool":"balancer-quarantine-2","backlog":0}
- -24.4 s behind c2-structured-clone-5mb {"pool":"balancer-quarantine-2","backlog":0}
- -24.4 s behind c3-map-get-set {"pool":"balancer-quarantine-2","backlog":0}
- -24.4 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-2","backlog":0}
- -24.0 s move c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -23.8 s arrived c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-1","costMs":253.7999997138977}
- -23.1 s move c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- -22.9 s move c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.9 s arrived c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","costMs":199.89999961853027}
- -22.9 s arrived c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","costMs":200.2000002861023}
- -22.7 s move c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.7 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","costMs":351.80000019073486}
- -22.7 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"spike"}
- -22.5 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -22.5 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":404.40000009536743}
- -22.4 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-4","to":"balancer-1","costMs":156}
- -22.2 s move c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.1 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","costMs":914.5}
- -22.0 s move c2-structured-clone-5mb {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -22.0 s move c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -21.6 s arrived c2-structured-clone-5mb {"from":"balancer-1","to":"balancer-quarantine-4","costMs":509.90000009536743}
- -21.6 s arrived c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-4","costMs":509.90000009536743}
- -21.5 s move c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-4","reason":"bisect"}
- -21.5 s behind c5-array-push-pop-indexof {"pool":"balancer-1","backlog":0}
- -21.5 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- -21.2 s arrived c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-4","costMs":995.3000001907349}
- -21.2 s spike c2-structured-clone-5mb {"pool":"balancer-quarantine-4","lagMs":385.2999997138977,"action":"noted"}
- -20.5 s move c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -20.4 s arrived c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-1","costMs":117.2999997138977}
- -19.6 s move c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -19.6 s move c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -19.4 s arrived c7-small-filter-map {"from":"balancer-1","to":"balancer-quarantine-1","costMs":449.69999980926514}
- -19.4 s arrived c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","costMs":449.8999996185303}
- -19.0 s behind c7-small-filter-map {"pool":"balancer-quarantine-1","backlog":0}
- -18.2 s move c2-structured-clone-5mb {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -18.2 s move c3-map-get-set {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -18.0 s move c4-set-add-has-delete {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -17.9 s move c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","reason":"bisect"}
- -17.8 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-4","to":"balancer-1","costMs":719.2999997138977}
- -17.8 s arrived c3-map-get-set {"from":"balancer-quarantine-4","to":"balancer-1","costMs":719.1999998092651}
- -17.8 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-4","to":"balancer-1","costMs":219.39999961853027}
- -17.7 s arrived c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","costMs":309.5}
- 5.8 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 5.8 s behind c3-map-get-set {"pool":"balancer-1","backlog":0}
- 5.8 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 7.5 s move c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- 7.7 s arrived c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","costMs":270.2999997138977}
- 8.0 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.2 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":503.59999990463257}
- 8.4 s move c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.4 s move c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.4 s arrived c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","costMs":658.8999996185303}
- 8.4 s arrived c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":658.7999997138977}
- 8.8 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 8.8 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 11.6 s move c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- 11.6 s arrived c6-object-read-write {"from":"balancer-quarantine-3","to":"balancer-1","costMs":186.69999980926514}
- 35.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 35.9 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 38.2 s behind c3-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 38.9 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 41.3 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 65.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 65.9 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 68.9 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 69.0 s behind c3-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 72.7 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 95.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 95.9 s behind c4-set-add-has-delete {"pool":"balancer-1","backlog":0}
- 98.9 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- 100.0 s behind c3-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 103.7 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}

Round 3: pools {"c1-sort-typed-1m":"balancer-quarantine-2","c2-structured-clone-5mb":"balancer-1","c3-map-get-set":"balancer-quarantine-4","c4-set-add-has-delete":"balancer-quarantine-4","c5-array-push-pop-indexof":"balancer-quarantine-1","c6-object-read-write":"balancer-quarantine-3","c7-small-filter-map":"balancer-1","c8-map-get-set":"balancer-quarantine-3"}

- -29.2 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-1","lagMs":685.5999999046326,"action":"noted"}
- -26.7 s move c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.7 s move c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","reason":"bisect"}
- -26.4 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.4 s move c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","reason":"bisect"}
- -26.2 s move c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.2 s move c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -26.2 s arrived c1-sort-typed-1m {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1520.9000000953674}
- -26.2 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1520.6999998092651}
- -26.2 s arrived c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1520.7999997138977}
- -26.2 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-2","costMs":1520.6999998092651}
- -26.2 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":684.2999997138977}
- -26.2 s arrived c7-small-filter-map {"from":"balancer-quarantine-1","to":"balancer-quarantine-3","costMs":684.1999998092651}
- -26.0 s arrived c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-1","costMs":566.9000000953674}
- -26.0 s arrived c8-map-get-set {"from":"balancer-quarantine-1","to":"balancer-1","costMs":566.7000002861023}
- -25.8 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","reason":"bisect"}
- -25.6 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-3","to":"balancer-quarantine-4","costMs":403.5}
- -25.5 s spike c1-sort-typed-1m {"pool":"balancer-quarantine-2","lagMs":583.3000001907349,"action":"quarantined"}
- -25.5 s move c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -25.3 s arrived c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-1","costMs":248.19999980926514}
- -24.3 s behind c1-sort-typed-1m {"pool":"balancer-quarantine-2","backlog":0}
- -24.3 s behind c2-structured-clone-5mb {"pool":"balancer-quarantine-2","backlog":0}
- -24.3 s behind c3-map-get-set {"pool":"balancer-quarantine-2","backlog":0}
- -24.3 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-2","backlog":0}
- -23.1 s move c7-small-filter-map {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- -22.9 s arrived c7-small-filter-map {"from":"balancer-quarantine-3","to":"balancer-1","costMs":165.5}
- -22.8 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"spike"}
- -22.8 s move c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.8 s move c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.7 s arrived c3-map-get-set {"from":"balancer-quarantine-2","to":"balancer-1","costMs":366.59999990463257}
- -22.7 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-2","to":"balancer-1","costMs":366.7000002861023}
- -22.6 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":251.59999990463257}
- -22.5 s move c5-array-push-pop-indexof {"from":"balancer-quarantine-4","to":"balancer-1","reason":"steady"}
- -22.5 s move c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-1","reason":"steady"}
- -22.4 s arrived c5-array-push-pop-indexof {"from":"balancer-quarantine-4","to":"balancer-1","costMs":129.59999990463257}
- -22.4 s arrived c6-object-read-write {"from":"balancer-quarantine-1","to":"balancer-1","costMs":129.59999990463257}
- -22.3 s move c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -22.2 s move c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -22.2 s move c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-1","reason":"bisect"}
- -22.1 s arrived c5-array-push-pop-indexof {"from":"balancer-1","to":"balancer-quarantine-1","costMs":307.30000019073486}
- -22.1 s arrived c4-set-add-has-delete {"from":"balancer-1","to":"balancer-quarantine-1","costMs":307.40000009536743}
- -22.1 s arrived c3-map-get-set {"from":"balancer-1","to":"balancer-quarantine-1","costMs":307.40000009536743}
- -22.1 s move c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","reason":"steady"}
- -22.0 s arrived c2-structured-clone-5mb {"from":"balancer-quarantine-2","to":"balancer-1","costMs":1085.5999999046326}
- -21.5 s spike c2-structured-clone-5mb {"pool":"balancer-1","lagMs":346.09999990463257,"action":"noted"}
- -21.4 s move c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","reason":"bisect"}
- -21.3 s move c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","reason":"bisect"}
- -21.2 s arrived c4-set-add-has-delete {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","costMs":353}
- -21.2 s arrived c3-map-get-set {"from":"balancer-quarantine-1","to":"balancer-quarantine-4","costMs":353.09999990463257}
- -21.0 s behind c6-object-read-write {"pool":"balancer-1","backlog":0}
- -21.0 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- 5.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 6.6 s behind c3-map-get-set {"pool":"balancer-quarantine-4","backlog":0}
- 6.6 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-4","backlog":0}
- 7.5 s move c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","reason":"steady"}
- 7.6 s arrived c8-map-get-set {"from":"balancer-quarantine-3","to":"balancer-1","costMs":119.59999990463257}
- 8.0 s move c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.2 s arrived c8-map-get-set {"from":"balancer-1","to":"balancer-quarantine-3","costMs":402.69999980926514}
- 8.2 s move c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","reason":"bisect"}
- 8.3 s arrived c6-object-read-write {"from":"balancer-1","to":"balancer-quarantine-3","costMs":504.19999980926514}
- 9.3 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 9.3 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 9.8 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- 35.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 39.0 s behind c3-map-get-set {"pool":"balancer-quarantine-4","backlog":0}
- 39.0 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-4","backlog":0}
- 39.9 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- 40.5 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 40.5 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 65.9 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 69.9 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- 70.9 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 70.9 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 73.5 s behind c3-map-get-set {"pool":"balancer-quarantine-4","backlog":0}
- 73.5 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-4","backlog":0}
- 96.3 s behind c2-structured-clone-5mb {"pool":"balancer-1","backlog":0}
- 100.4 s behind c7-small-filter-map {"pool":"balancer-1","backlog":0}
- 101.5 s behind c6-object-read-write {"pool":"balancer-quarantine-3","backlog":0}
- 101.5 s behind c8-map-get-set {"pool":"balancer-quarantine-3","backlog":0}
- 104.0 s behind c3-map-get-set {"pool":"balancer-quarantine-4","backlog":0}
- 104.0 s behind c4-set-add-has-delete {"pool":"balancer-quarantine-4","backlog":0}

</details>

