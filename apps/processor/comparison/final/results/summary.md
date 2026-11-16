# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-16T21:25:15.870Z",
  "args": {
    "pair": [
      "isoloop:own=isoloop:balancer",
      "isoloop:one=isoloop:balancer",
      "isoloop:one-off=isoloop:one"
    ],
    "mixes": "normal,faults",
    "rounds": "5",
    "hold": "0",
    "warm": "20",
    "window": "20",
    "engines": "chromium,firefox",
    "out": "comparison/final/results",
    "extra": [],
    "summary-only": false
  },
  "configs": [
    "isoloop:own",
    "isoloop:balancer",
    "isoloop:one",
    "isoloop:one-off"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, Normal

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 2 | -7 | -78% | -7 to -7 |
| Files done per second | 50.1 | 50.2 | +0.1 | +0% | +0.1 to +0.2 |
| Latency per file, p50 | 19 ms | 61 ms | +42 ms | +221% | +40 ms to +43 ms |
| Latency per file, p95 | 39 ms | 158 ms | +119 ms | +305% | +110 ms to +129 ms |
| Typing (median of 5) | 21 ms | 17 ms | -4 ms | -19% | -7 ms to 0 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1 | 3 | +3 | +300% | +1 to +3 |
| Drain after the generator stops | 260 ms | 258 ms | -3 ms | -1% | -10 ms to +257 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 3 | +3 | – | +3 to +9 |
| Main-thread CPU | 21% | 14% | -6 pp | -31% | -7 pp to -6 pp |
| CPU, all threads | 139% | 122% | -17 pp | -12% | -18 pp to -16 pp |
| Memory after GC | 225 MB | 177 MB | -47 MB | -21% | -57 MB to -42 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 50.2 | 50.2 | 0.0 | 0% | 0.0 to +0.1 |
| Latency per file, p50 | 57 ms | 61 ms | +4 ms | +7% | +2 ms to +7 ms |
| Latency per file, p95 | 145 ms | 158 ms | +7 ms | +5% | -9 ms to +25 ms |
| Typing (median of 5) | 15 ms | 17 ms | +1 ms | +7% | 0 ms to +4 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 4 | 3 | -1 | -25% | -2 to +1 |
| Drain after the generator stops | 257 ms | 258 ms | -1 ms | 0% | -3 ms to +3 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 3 | +3 | – | +3 to +9 |
| Main-thread CPU | 14% | 14% | +1 pp | +5% | +1 pp to +1 pp |
| CPU, all threads | 121% | 122% | +1 pp | +1% | +0 pp to +2 pp |
| Memory after GC | 173 MB | 177 MB | +2 MB | +1% | -4 MB to +20 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 50.2 | 50.2 | 0.0 | 0% | -0.1 to +0.1 |
| Latency per file, p50 | 58 ms | 57 ms | -1 ms | -2% | -8 ms to 0 ms |
| Latency per file, p95 | 149 ms | 145 ms | -4 ms | -3% | -17 ms to +9 ms |
| Typing (median of 5) | 18 ms | 15 ms | -2 ms | -11% | -5 ms to +1 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 3 | 4 | +1 | +33% | -1 to +3 |
| Drain after the generator stops | 258 ms | 257 ms | +2 ms | +1% | -2 ms to +238 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |
| Main-thread CPU | 14% | 14% | 0 pp | 0% | 0 pp to +0 pp |
| CPU, all threads | 121% | 121% | 0 pp | 0% | -0 pp to +1 pp |
| Memory after GC | 167 MB | 173 MB | +6 MB | +4% | -8 MB to +18 MB |

## chromium, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.0 | 43.8 | -6.2 | -12% | -20.7 to +3.6 |
| Latency per file, p50 | 28 ms | 3111 ms | +3083 ms | +11011% | +1049 ms to +7760 ms |
| Latency per file, p95 | 380 ms | 18311 ms | +17939 ms | +4721% | +11516 ms to +20735 ms |
| Typing (median of 5) | 30 ms | 23 ms | -12 ms | -40% | -31 ms to 0 ms |
| Moves in the window | 0 | 7 | +7 | – | 0 to +12 |
| Queue when the generator stops | 9 | 489 | +480 | +5333% | +168 to +768 |
| Drain after the generator stops | 1537 ms | 39565 ms | +38279 ms | +2491% | +25872 ms to +57084 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 950 | +950 | – | +312 to +2091 |
| Main-thread CPU | 24% | 18% | -6 pp | -23% | -8 pp to -3 pp |
| CPU, all threads | 254% | 246% | -8 pp | -3% | -61 pp to +44 pp |
| Memory after GC | 330 MB | 231 MB | -94 MB | -28% | -106 MB to -18 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 26.6 | 43.8 | +16.9 | +64% | +2.7 to +27.1 |
| Latency per file, p50 | 15640 ms | 3111 ms | -13169 ms | -84% | -14455 ms to -7852 ms |
| Latency per file, p95 | 20733 ms | 18311 ms | -2534 ms | -12% | -8835 ms to +514 ms |
| Typing (median of 5) | 16 ms | 23 ms | +9 ms | +56% | 0 ms to +11 ms |
| Moves in the window | 0 | 7 | +7 | – | 0 to +12 |
| Queue when the generator stops | 1061 | 489 | -569 | -54% | -888 to -277 |
| Drain after the generator stops | 44387 ms | 39565 ms | -4812 ms | -11% | -16958 ms to +14010 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 2 | 950 | +948 | +47400% | +310 to +2090 |
| Main-thread CPU | 6% | 18% | +11 pp | +176% | +9 pp to +15 pp |
| CPU, all threads | 122% | 246% | +124 pp | +102% | +71 pp to +175 pp |
| Memory after GC | 167 MB | 231 MB | +77 MB | +46% | +61 MB to +170 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 26.4 | 26.6 | +0.1 | +0% | 0.0 to +0.2 |
| Latency per file, p50 | 15582 ms | 15640 ms | -37 ms | 0% | -251 ms to +770 ms |
| Latency per file, p95 | 20330 ms | 20733 ms | +407 ms | +2% | +56 ms to +543 ms |
| Typing (median of 5) | 16 ms | 16 ms | -1 ms | -6% | -2 ms to 0 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1114 | 1061 | -49 | -4% | -65 to +11 |
| Drain after the generator stops | 45646 ms | 44387 ms | -1259 ms | -3% | -1759 ms to +12 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 2 | 2 | 0 | 0% | -1 to +1 |
| Main-thread CPU | 6% | 6% | 0 pp | 0% | 0 pp to +0 pp |
| CPU, all threads | 121% | 122% | +1 pp | +1% | -1 pp to +2 pp |
| Memory after GC | 183 MB | 167 MB | -16 MB | -9% | -58 MB to +3 MB |

## firefox, Normal

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 2 | -7 | -78% | -7 to -7 |
| Files done per second | 50.2 | 43.8 | -6.4 | -13% | -6.8 to -6.2 |
| Latency per file, p50 | 24 ms | 5645 ms | +5620 ms | +23417% | +5389 ms to +6315 ms |
| Latency per file, p95 | 51 ms | 11542 ms | +11491 ms | +22531% | +11136 ms to +11971 ms |
| Typing (median of 5) | 56 ms | 30 ms | -26 ms | -46% | -31 ms to -11 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 2 | 376 | +374 | +18700% | +347 to +379 |
| Drain after the generator stops | 263 ms | 10183 ms | +9922 ms | +3773% | +9648 ms to +9959 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 33 | +33 | – | +26 to +39 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 44.0 | 43.8 | -0.5 | -1% | -1.0 to +0.8 |
| Latency per file, p50 | 3421 ms | 5645 ms | +2282 ms | +67% | +2105 ms to +2790 ms |
| Latency per file, p95 | 8894 ms | 11542 ms | +2557 ms | +29% | +1867 ms to +3127 ms |
| Typing (median of 5) | 33 ms | 30 ms | -2 ms | -6% | -5 ms to +4 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 298 | 376 | +80 | +27% | +42 to +87 |
| Drain after the generator stops | 7916 ms | 10183 ms | +2267 ms | +29% | +1524 ms to +2302 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 33 | +33 | – | +26 to +39 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 44.3 | 44.0 | -0.5 | -1% | -1.1 to +0.4 |
| Latency per file, p50 | 3439 ms | 3421 ms | +23 ms | +1% | -179 ms to +536 ms |
| Latency per file, p95 | 8938 ms | 8894 ms | -44 ms | 0% | -452 ms to +632 ms |
| Typing (median of 5) | 33 ms | 33 ms | -2 ms | -6% | -4 ms to +2 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 292 | 298 | +10 | +3% | -14 to +13 |
| Drain after the generator stops | 7905 ms | 7916 ms | +11 ms | +0% | -249 ms to +235 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |

## firefox, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 9 | 0 | 0% | -2 to 0 |
| Files done per second | 50.2 | 43.4 | -6.8 | -14% | -13.2 to -2.2 |
| Latency per file, p50 | 46 ms | 1073 ms | +1028 ms | +2235% | +308 ms to +4189 ms |
| Latency per file, p95 | 602 ms | 16170 ms | +15546 ms | +2582% | +12662 ms to +20524 ms |
| Typing (median of 5) | 80 ms | 140 ms | +48 ms | +60% | +1 ms to +85 ms |
| Moves in the window | 0 | 10 | +10 | – | +9 to +14 |
| Queue when the generator stops | 10 | 362 | +351 | +3510% | +277 to +573 |
| Drain after the generator stops | 518 ms | 21566 ms | +21024 ms | +4059% | +19266 ms to +34475 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +368 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +2 |
| Files done twice | 0 | 802 | +802 | – | +584 to +3113 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 9 | +7 | +350% | +5 to +7 |
| Files done per second | 19.6 | 43.4 | +22.1 | +113% | +17.7 to +28.5 |
| Latency per file, p50 | 19353 ms | 1073 ms | -17829 ms | -92% | -19045 ms to -15118 ms |
| Latency per file, p95 | 27531 ms | 16170 ms | -10458 ms | -38% | -14570 ms to -5770 ms |
| Typing (median of 5) | 29 ms | 140 ms | +107 ms | +369% | +69 ms to +133 ms |
| Moves in the window | 0 | 10 | +10 | – | +9 to +14 |
| Queue when the generator stops | 1247 | 362 | -860 | -69% | -972 to -642 |
| Drain after the generator stops | 65586 ms | 21566 ms | -44321 ms | -68% | -45817 ms to -30630 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +368 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +2 |
| Files done twice | 8 | 802 | +793 | +9913% | +576 to +3105 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 19.8 | 19.6 | +0.5 | +3% | -0.4 to +1.5 |
| Latency per file, p50 | 19399 ms | 19353 ms | -41 ms | 0% | -497 ms to +417 ms |
| Latency per file, p95 | 27393 ms | 27531 ms | +120 ms | +0% | -978 ms to +470 ms |
| Typing (median of 5) | 28 ms | 29 ms | +1 ms | +4% | -2 ms to +7 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1254 | 1247 | -14 | -1% | -24 to +3 |
| Drain after the generator stops | 64931 ms | 65586 ms | +28 ms | +0% | -263 ms to +730 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 8 | 8 | 0 | 0% | -1 to +1 |

