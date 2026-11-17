# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-17T11:39:16.393Z",
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
    "out": "comparison/v0.2.0/calm-results",
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
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.0 | 47.5 | -2.5 | -5% | -18.4 to +30.8 |
| Latency per file, p50 | 20 ms | 45 ms | +24 ms | +120% | +9 ms to +13033 ms |
| Latency per file, p95 | 35 ms | 54892 ms | +54857 ms | +156734% | +28284 ms to +63931 ms |
| Typing (median of 5) | 19 ms | 19 ms | 0 ms | 0% | -1 ms to +3 ms |
| Moves in the window | 0 | 1 | +1 | – | +1 to +2 |
| Workers after the faults (faults, then calm) | 9 | 4 | -5 | -56% | -5 to -5 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 24 | +24 | – | +20 to +31 |
| Moves for a rising backlog | 0 | 7 | +7 | – | +3 to +7 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 197 ms | – | – | – |
| Spikes only noted | 0 | 1 | +1 | – | +1 to +2 |
| Behind events | 0 | 5 | +5 | – | +1 to +5 |
| Queue when the generator stops | 1 | 1068 | +1068 | +106800% | +202 to +1564 |
| Drain after the generator stops | 6 ms | 33918 ms | +33786 ms | +563100% | +8112 ms to +59460 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +1067 |
| Processors the kernel gave up on | 0 | 1 | +1 | – | 0 to +2 |
| Files done twice | 0 | 1945 | +1945 | – | +1429 to +2558 |
| Main-thread CPU | 22% | 20% | -2 pp | -8% | -4 pp to +2 pp |
| CPU, all threads | 136% | 186% | +51 pp | +38% | -9 pp to +157 pp |
| Memory after GC | 239 MB | 231 MB | -8 MB | -3% | -50 MB to +29 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 26.0 | 47.5 | +21.5 | +83% | +5.2 to +54.9 |
| Latency per file, p50 | 54791 ms | 45 ms | -54753 ms | -100% | -54762 ms to -41341 ms |
| Latency per file, p95 | 64193 ms | 54892 ms | -9532 ms | -15% | -35465 ms to -227 ms |
| Typing (median of 5) | 17 ms | 19 ms | +2 ms | +12% | -1 ms to +5 ms |
| Moves in the window | 0 | 1 | +1 | – | +1 to +2 |
| Workers after the faults (faults, then calm) | 2 | 4 | +2 | +100% | +2 to +2 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 24 | +24 | – | +20 to +31 |
| Moves for a rising backlog | 0 | 7 | +7 | – | +3 to +7 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 197 ms | – | – | – |
| Spikes only noted | 0 | 1 | +1 | – | +1 to +2 |
| Behind events | 0 | 5 | +5 | – | +1 to +5 |
| Queue when the generator stops | 3057 | 1068 | -1989 | -65% | -2893 to -1490 |
| Drain after the generator stops | 65756 ms | 33918 ms | -32370 ms | -49% | -58639 ms to -6101 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +1067 |
| Processors the kernel gave up on | 0 | 1 | +1 | – | 0 to +2 |
| Files done twice | 304 | 1945 | +1641 | +540% | +1125 to +2253 |
| Main-thread CPU | 7% | 20% | +13 pp | +202% | +11 pp to +17 pp |
| CPU, all threads | 119% | 186% | +67 pp | +57% | +8 pp to +174 pp |
| Memory after GC | 178 MB | 231 MB | +54 MB | +30% | +12 MB to +76 MB |

## firefox, Faults, then calm

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.1 | 50.8 | +0.7 | +1% | -12.0 to +10.0 |
| Latency per file, p50 | 24 ms | 79 ms | +55 ms | +229% | +23 ms to +13766 ms |
| Latency per file, p95 | 49 ms | 39397 ms | +39348 ms | +80302% | +33505 ms to +67273 ms |
| Typing (median of 5) | 54 ms | 51 ms | -4 ms | -7% | -10 ms to +2 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers after the faults (faults, then calm) | 9 | 4 | -5 | -56% | -5 to -5 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 18 | +18 | – | +16 to +30 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1067 ms | – | – | – |
| Spikes only noted | 0 | 3 | +3 | – | +2 to +4 |
| Behind events | 0 | 10 | +10 | – | +1 to +12 |
| Queue when the generator stops | 1 | 670 | +669 | +66900% | +381 to +1714 |
| Drain after the generator stops | 265 ms | 32205 ms | +32184 ms | +12145% | +18389 ms to +59688 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 1251 | +1251 | – | +899 to +1689 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 3/3 ran, B 3/3 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 17.2 | 50.8 | +32.3 | +188% | +21.4 to +42.8 |
| Latency per file, p50 | 66363 ms | 79 ms | -66234 ms | -100% | -66316 ms to -53319 ms |
| Latency per file, p95 | 78118 ms | 39397 ms | -37671 ms | -48% | -44563 ms to -11199 ms |
| Typing (median of 5) | 31 ms | 51 ms | +20 ms | +65% | +12 ms to +23 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers after the faults (faults, then calm) | 2 | 4 | +2 | +100% | +2 to +2 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 18 | +18 | – | +16 to +30 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1067 ms | – | – | – |
| Spikes only noted | 0 | 3 | +3 | – | +2 to +4 |
| Behind events | 0 | 10 | +10 | – | +1 to +12 |
| Queue when the generator stops | 3721 | 670 | -3011 | -81% | -3339 to -2008 |
| Drain after the generator stops | 118581 ms | 32205 ms | -85147 ms | -72% | -99927 ms to -58643 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 447 | 1251 | +810 | +181% | +452 to +1240 |

