# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-19T17:38:43.801Z",
  "args": {
    "pair": [
      "isoloop:own=isoloop:balancer",
      "isoloop:one=isoloop:balancer",
      "isoloop:one-off=isoloop:one"
    ],
    "mixes": "faults",
    "rounds": "5",
    "hold": "0",
    "warm": "20",
    "window": "20",
    "engines": "chromium,firefox",
    "out": "comparison/v0.3.0/faults-next6",
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

## chromium, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.0 | 52.5 | +2.5 | +5% | -3.4 to +8.8 |
| Latency per file, p50 | 28 ms | 5767 ms | +5738 ms | +20493% | +1247 ms to +6491 ms |
| Latency per file, p95 | 378 ms | 12731 ms | +12341 ms | +3265% | +11960 ms to +18628 ms |
| Typing (median of 5) | 48 ms | 30 ms | -22 ms | -46% | -29 ms to -15 ms |
| Moves in the window | 0 | 3 | +3 | – | +2 to +4 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 13 | +13 | – | +12 to +19 |
| Moves for a rising backlog | 0 | 1 | +1 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 216 ms | – | – | – |
| Spikes only noted | 0 | 1 | +1 | – | +1 to +2 |
| Behind events | 0 | 7 | +7 | – | +5 to +8 |
| Queue when the generator stops | 12 | 167 | +156 | +1300% | +105 to +346 |
| Drain after the generator stops | 1017 ms | 7611 ms | +6585 ms | +647% | +4312 ms to +9638 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 20 | +20 | – | +11 to +23 |
| Main-thread CPU | 23% | 20% | -4 pp | -18% | -6 pp to -1 pp |
| CPU, all threads | 255% | 260% | +6 pp | +2% | -22 pp to +29 pp |
| Memory after GC | 257 MB | 270 MB | +9 MB | +4% | -19 MB to +42 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 26.5 | 52.5 | +26.2 | +99% | +20.1 to +32.3 |
| Latency per file, p50 | 16172 ms | 5767 ms | -10378 ms | -64% | -14896 ms to -8869 ms |
| Latency per file, p95 | 20517 ms | 12731 ms | -7786 ms | -38% | -8075 ms to -1708 ms |
| Typing (median of 5) | 15 ms | 30 ms | +15 ms | +100% | +6 ms to +18 ms |
| Moves in the window | 0 | 3 | +3 | – | +2 to +4 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 13 | +13 | – | +12 to +19 |
| Moves for a rising backlog | 0 | 1 | +1 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 216 ms | – | – | – |
| Spikes only noted | 0 | 1 | +1 | – | +1 to +2 |
| Behind events | 0 | 7 | +7 | – | +5 to +8 |
| Queue when the generator stops | 1080 | 167 | -914 | -85% | -951 to -765 |
| Drain after the generator stops | 44647 ms | 7611 ms | -37335 ms | -84% | -39509 ms to -34222 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 20 | +20 | – | +11 to +23 |
| Main-thread CPU | 7% | 20% | +14 pp | +214% | +12 pp to +15 pp |
| CPU, all threads | 122% | 260% | +138 pp | +113% | +112 pp to +161 pp |
| Memory after GC | 152 MB | 270 MB | +105 MB | +69% | +8 MB to +148 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 26.3 | 26.5 | +0.3 | +1% | -0.5 to +0.6 |
| Latency per file, p50 | 16049 ms | 16172 ms | -429 ms | -3% | -559 ms to +702 ms |
| Latency per file, p95 | 20393 ms | 20517 ms | +395 ms | +2% | -180 ms to +464 ms |
| Typing (median of 5) | 15 ms | 15 ms | 0 ms | 0% | -1 ms to +3 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1072 | 1080 | +8 | +1% | -42 to +55 |
| Drain after the generator stops | 44894 ms | 44647 ms | -14 ms | 0% | -1293 ms to +1318 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |
| Main-thread CPU | 7% | 7% | -0 pp | -2% | -0 pp to +0 pp |
| CPU, all threads | 123% | 122% | -0 pp | 0% | -2 pp to +0 pp |
| Memory after GC | 168 MB | 152 MB | -4 MB | -2% | -53 MB to +79 MB |

## firefox, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.3 | 47.9 | -2.3 | -5% | -13.0 to -0.1 |
| Latency per file, p50 | 47 ms | 1186 ms | +1140 ms | +2426% | +810 ms to +6399 ms |
| Latency per file, p95 | 622 ms | 15227 ms | +14592 ms | +2346% | +10582 ms to +19346 ms |
| Typing (median of 5) | 82 ms | 53 ms | -29 ms | -35% | -51 ms to -7 ms |
| Moves in the window | 0 | 4 | +4 | – | 0 to +10 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 14 | +14 | – | +13 to +25 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 220 ms | – | – | – |
| Spikes only noted | 0 | 3 | +3 | – | +2 to +4 |
| Behind events | 0 | 8 | +8 | – | +5 to +10 |
| Queue when the generator stops | 5 | 415 | +409 | +8180% | +197 to +503 |
| Drain after the generator stops | 1831 ms | 13244 ms | +11175 ms | +610% | +8392 ms to +17358 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 28 | +28 | – | +23 to +124 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 20.8 | 47.9 | +27.1 | +130% | +16.1 to +29.4 |
| Latency per file, p50 | 19318 ms | 1186 ms | -18150 ms | -94% | -18299 ms to -12555 ms |
| Latency per file, p95 | 24509 ms | 15227 ms | -9452 ms | -39% | -13258 ms to -4732 ms |
| Typing (median of 5) | 34 ms | 53 ms | +19 ms | +56% | +9 ms to +27 ms |
| Moves in the window | 0 | 4 | +4 | – | 0 to +10 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 14 | +14 | – | +13 to +25 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 220 ms | – | – | – |
| Spikes only noted | 0 | 3 | +3 | – | +2 to +4 |
| Behind events | 0 | 8 | +8 | – | +5 to +10 |
| Queue when the generator stops | 1223 | 415 | -811 | -66% | -1019 to -718 |
| Drain after the generator stops | 65376 ms | 13244 ms | -52363 ms | -80% | -54450 ms to -46227 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 28 | +28 | – | +23 to +124 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 20.9 | 20.8 | -0.2 | -1% | -0.7 to +0.5 |
| Latency per file, p50 | 19437 ms | 19318 ms | -145 ms | -1% | -327 ms to +227 ms |
| Latency per file, p95 | 24458 ms | 24509 ms | +242 ms | +1% | -421 ms to +648 ms |
| Typing (median of 5) | 30 ms | 34 ms | +2 ms | +7% | -3 ms to +13 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1218 | 1223 | +6 | +0% | -16 to +10 |
| Drain after the generator stops | 64882 ms | 65376 ms | +574 ms | +1% | -555 ms to +770 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |

