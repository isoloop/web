# Markets dashboard, head-to-head

Run settings:

```json
{
  "started": "2026-11-16T13:37:38.413Z",
  "args": {
    "pair": [
      "native-mixed=mixed:matched"
    ],
    "extra": [
      "mixed:teams",
      "mixed:own"
    ],
    "sizes": "normal,heavy",
    "rounds": "5",
    "hold": "0",
    "engines": "chromium,firefox",
    "out": "comparison/federated/results",
    "warm": "6",
    "window": "10",
    "summary-only": false
  },
  "configs": [
    "native-mixed",
    "mixed:matched",
    "mixed:teams",
    "mixed:own"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, Normal

### native-mixed (A) vs mixed:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 0 | 0 | 0 | – | -1 to 0 |
| Typing (median of 5) | 20 ms | 40 ms | +17 ms | +85% | +9 ms to +24 ms |
| Main-thread CPU | 87% | 21% | -66 pp | -76% | -66 pp to -64 pp |
| CPU, all threads | 103% | 108% | +5 pp | +5% | +2 pp to +6 pp |
| Memory, first reading | 279 MB | 338 MB | +63 MB | +23% | +45 MB to +66 MB |
| Memory, first reading, after GC | 190 MB | 225 MB | +34 MB | +18% | +28 MB to +39 MB |
| First data | 302 ms | 453 ms | +148 ms | +49% | +116 ms to +166 ms |
| All widgets with data | 4291 ms | 4361 ms | +68 ms | +2% | +28 ms to +209 ms |
| JS loaded, gzipped | 151 KB | 212 KB | +61 KB | +40% | +61 KB to +61 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 0% | 0% | 0 pp | – | 0 pp to 0 pp |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 3215 ms | 3486 ms | +308 ms | +10% | -301 ms to +382 ms |
| Alerts panel crashed: the other widgets’ updates kept | 97% | 95% | -1 pp | -1% | -3 pp to -1 pp |
| Alerts panel crashed: back after | – | 1332 ms | – | – | – |

### Measured alongside

| Figure | mixed:teams | mixed:own |
| --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 8 | 22 |
| Late frames (of ~60/s × window) | 0 | 0 |
| Typing (median of 5) | 39 ms | 41 ms |
| Main-thread CPU | 22% | 20% |
| CPU, all threads | 109% | 115% |
| Memory, first reading | 351 MB | 427 MB |
| Memory, first reading, after GC | 227 MB | 306 MB |
| First data | 423 ms | 823 ms |
| All widgets with data | 4367 ms | 4364 ms |
| JS loaded, gzipped | 212 KB | 212 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 98% | 99% |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 1015 ms | 1004 ms |
| Alerts panel crashed: the other widgets’ updates kept | 95% | 96% |
| Alerts panel crashed: back after | 1311 ms | 1358 ms |

## chromium, Heavy

### native-mixed (A) vs mixed:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 207 | 0 | -207 | -100% | -209 to -204 |
| Typing (median of 5) | 149 ms | 43 ms | -106 ms | -71% | -133 ms to 0 ms |
| Main-thread CPU | 100% | 23% | -76 pp | -77% | -76 pp to -76 pp |
| CPU, all threads | 115% | 144% | +29 pp | +25% | +28 pp to +31 pp |
| Memory, first reading | 377 MB | 449 MB | +73 MB | +19% | +47 MB to +108 MB |
| Memory, first reading, after GC | 251 MB | 298 MB | +49 MB | +20% | +41 MB to +54 MB |
| First data | 315 ms | 581 ms | +267 ms | +85% | +169 ms to +368 ms |
| All widgets with data | 4331 ms | 4469 ms | +77 ms | +2% | +61 ms to +183 ms |
| JS loaded, gzipped | 151 KB | 212 KB | +61 KB | +40% | +61 KB to +61 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 0% | 0% | 0 pp | – | 0 pp to 0 pp |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 3996 ms | 3901 ms | -83 ms | -2% | -263 ms to +464 ms |
| Alerts panel crashed: the other widgets’ updates kept | 100% | 100% | +1 pp | +1% | -5 pp to +6 pp |
| Alerts panel crashed: back after | – | 1407 ms | – | – | – |

### Measured alongside

| Figure | mixed:teams | mixed:own |
| --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 8 | 30 |
| Late frames (of ~60/s × window) | 0 | 0 |
| Typing (median of 5) | 37 ms | 34 ms |
| Main-thread CPU | 23% | 30% |
| CPU, all threads | 145% | 181% |
| Memory, first reading | 440 MB | 653 MB |
| Memory, first reading, after GC | 304 MB | 435 MB |
| First data | 531 ms | 1021 ms |
| All widgets with data | 4375 ms | 4477 ms |
| JS loaded, gzipped | 212 KB | 212 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 94% | 97% |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 1045 ms | 1019 ms |
| Alerts panel crashed: the other widgets’ updates kept | 100% | 101% |
| Alerts panel crashed: back after | 1303 ms | 1391 ms |

## firefox, Normal

### native-mixed (A) vs mixed:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 13 | 0 | -13 | -100% | -14 to -8 |
| Typing (median of 5) | 107 ms | 82 ms | -17 ms | -16% | -38 ms to +24 ms |
| First data | 410 ms | 788 ms | +366 ms | +89% | +87 ms to +387 ms |
| All widgets with data | 4411 ms | 4634 ms | +188 ms | +4% | -74 ms to +251 ms |
| JS loaded, gzipped | 151 KB | 212 KB | +61 KB | +40% | +61 KB to +61 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 0% | 0% | 0 pp | – | 0 pp to 0 pp |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 3356 ms | 3810 ms | +372 ms | +11% | +326 ms to +575 ms |
| Alerts panel crashed: the other widgets’ updates kept | 98% | 88% | -15 pp | -15% | -97 pp to -8 pp |
| Alerts panel crashed: back after | – | 1444 ms | – | – | – |

### Measured alongside

| Figure | mixed:teams | mixed:own |
| --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 8 | 22 |
| Late frames (of ~60/s × window) | 0 | 4 |
| Typing (median of 5) | 50 ms | 63 ms |
| First data | 788 ms | 1259 ms |
| All widgets with data | 4650 ms | 5007 ms |
| JS loaded, gzipped | 212 KB | 212 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 91% | 92% |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 1042 ms | 1026 ms |
| Alerts panel crashed: the other widgets’ updates kept | 93% | 92% |
| Alerts panel crashed: back after | 1359 ms | 1513 ms |

## firefox, Heavy

### native-mixed (A) vs mixed:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 232 | 0 | -232 | -100% | -234 to -230 |
| Typing (median of 5) | 132 ms | 132 ms | -21 ms | -16% | -40 ms to +29 ms |
| First data | 387 ms | 705 ms | +336 ms | +87% | +268 ms to +496 ms |
| All widgets with data | 4469 ms | 4729 ms | +254 ms | +6% | +192 ms to +315 ms |
| JS loaded, gzipped | 151 KB | 212 KB | +61 KB | +40% | +61 KB to +61 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 0% | 0% | 0 pp | – | 0 pp to 0 pp |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 3661 ms | 3680 ms | +57 ms | +2% | -298 ms to +1867 ms |
| Alerts panel crashed: the other widgets’ updates kept | 98% | 94% | -2 pp | -2% | -7 pp to +98 pp |
| Alerts panel crashed: back after | – | 1548 ms | – | – | – |

### Measured alongside

| Figure | mixed:teams | mixed:own |
| --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 8 | 30 |
| Late frames (of ~60/s × window) | 0 | 81 |
| Typing (median of 5) | 53 ms | 135 ms |
| First data | 970 ms | 1741 ms |
| All widgets with data | 4758 ms | 5553 ms |
| JS loaded, gzipped | 212 KB | 212 KB |
| Alerts panel blocked 3 s: the other widgets’ updates kept | 97% | 95% |
| Alerts panel blocked 3 s: the other widgets’ longest silence | 1105 ms | 1101 ms |
| Alerts panel crashed: the other widgets’ updates kept | 96% | 94% |
| Alerts panel crashed: back after | 1361 ms | 1824 ms |

