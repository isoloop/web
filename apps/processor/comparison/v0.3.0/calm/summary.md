# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-19T18:27:33.133Z",
  "args": {
    "pair": [
      "isoloop:own=isoloop:balancer",
      "isoloop:one=isoloop:balancer"
    ],
    "mixes": "faults-calm",
    "rounds": "3",
    "hold": "0",
    "warm": "20",
    "window": "20",
    "engines": "chromium,firefox",
    "out": "comparison/v0.3.0/calm-next6",
    "extra": [],
    "summary-only": false
  },
  "configs": [
    "isoloop:own",
    "isoloop:balancer",
    "isoloop:one"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, Faults, then calm

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | -6 | -67% | -6 to -6 |
| Files done per second | 50.1 | 50.1 | 0.0 | 0% | -0.1 to 0.0 |
| Latency per file, p50 | 20 ms | 27 ms | +7 ms | +35% | +6 ms to +8 ms |
| Latency per file, p95 | 37 ms | 60 ms | +23 ms | +62% | +23 ms to +28 ms |
| Typing (median of 5) | 19 ms | 17 ms | -2 ms | -11% | -3 ms to +1 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers after the faults (faults, then calm) | 9 | 4 | -5 | -56% | -5 to -5 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Fewest workers in the calm (faults, then calm) | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 25 | +25 | – | +18 to +26 |
| Moves for a rising backlog | 0 | 5 | +5 | – | 0 to +6 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 118 ms | – | – | – |
| Spikes only noted | 0 | 2 | +2 | – | +1 to +3 |
| Behind events | 0 | 19 | +19 | – | +10 to +21 |
| Queue when the generator stops | 1 | 0 | 0 | 0% | -1 to 0 |
| Drain after the generator stops | 264 ms | 5 ms | -260 ms | -98% | -260 ms to +260 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 27 | +27 | – | +19 to +42 |
| Main-thread CPU | 22% | 19% | -2 pp | -11% | -3 pp to -2 pp |
| CPU, all threads | 139% | 132% | -7 pp | -5% | -7 pp to -4 pp |
| Memory after GC | 245 MB | 194 MB | -52 MB | -21% | -59 MB to -41 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 54.3 | 50.1 | -4.2 | -8% | -4.2 to -4.1 |
| Latency per file, p50 | 48040 ms | 27 ms | -48012 ms | -100% | -49629 ms to -44855 ms |
| Latency per file, p95 | 89398 ms | 60 ms | -89338 ms | -100% | -89666 ms to -84311 ms |
| Typing (median of 5) | 16 ms | 17 ms | +4 ms | +25% | +1 ms to +4 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers after the faults (faults, then calm) | 2 | 4 | +2 | +100% | +2 to +2 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Fewest workers in the calm (faults, then calm) | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 25 | +25 | – | +18 to +26 |
| Moves for a rising backlog | 0 | 5 | +5 | – | 0 to +6 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 118 ms | – | – | – |
| Spikes only noted | 0 | 2 | +2 | – | +1 to +3 |
| Behind events | 0 | 19 | +19 | – | +10 to +21 |
| Queue when the generator stops | 2328 | 0 | -2326 | -100% | -2342 to -2305 |
| Drain after the generator stops | 44419 ms | 5 ms | -44311 ms | -100% | -44415 ms to -43821 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 27 | +27 | – | +19 to +42 |
| Main-thread CPU | 9% | 19% | +10 pp | +113% | +10 pp to +10 pp |
| CPU, all threads | 119% | 132% | +14 pp | +12% | +13 pp to +15 pp |
| Memory after GC | 177 MB | 194 MB | +19 MB | +11% | +13 MB to +23 MB |

## firefox, Faults, then calm

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | -6 | -67% | -6 to -6 |
| Files done per second | 50.0 | 50.0 | -0.1 | 0% | -0.1 to +0.1 |
| Latency per file, p50 | 25 ms | 36 ms | +12 ms | +48% | +11 ms to +15 ms |
| Latency per file, p95 | 50 ms | 87 ms | +38 ms | +76% | +33 ms to +58 ms |
| Typing (median of 5) | 57 ms | 42 ms | -15 ms | -26% | -26 ms to -9 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers after the faults (faults, then calm) | 9 | 4 | -5 | -56% | -5 to -5 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Fewest workers in the calm (faults, then calm) | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 30 | +30 | – | +27 to +32 |
| Moves for a rising backlog | 0 | 1 | +1 | – | +1 to +4 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 174 ms | – | – | – |
| Spikes only noted | 0 | 4 | +4 | – | +3 to +6 |
| Behind events | 0 | 22 | +22 | – | +19 to +27 |
| Queue when the generator stops | 2 | 2 | 0 | 0% | -1 to +1 |
| Drain after the generator stops | 271 ms | 268 ms | -3 ms | -1% | -12 ms to +255 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 38 | +38 | – | +19 to +75 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 43.3 | 50.0 | +6.7 | +15% | +6.5 to +7.2 |
| Latency per file, p50 | 130275 ms | 36 ms | -130235 ms | -100% | -131689 ms to -128595 ms |
| Latency per file, p95 | 192620 ms | 87 ms | -192533 ms | -100% | -193707 ms to -190172 ms |
| Typing (median of 5) | 30 ms | 42 ms | +13 ms | +43% | +10 ms to +18 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers after the faults (faults, then calm) | 2 | 4 | +2 | +100% | +2 to +2 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Fewest workers in the calm (faults, then calm) | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 30 | +30 | – | +27 to +32 |
| Moves for a rising backlog | 0 | 1 | +1 | – | +1 to +4 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 174 ms | – | – | – |
| Spikes only noted | 0 | 4 | +4 | – | +3 to +6 |
| Behind events | 0 | 22 | +22 | – | +19 to +27 |
| Queue when the generator stops | 6147 | 2 | -6145 | -100% | -6181 to -6129 |
| Drain after the generator stops | – | 268 ms | – | – | – |
| Files without a result 2 min after the generator stops | 1347 | 0 | -1347 | -100% | -1374 to -1342 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 38 | +38 | – | +19 to +75 |

