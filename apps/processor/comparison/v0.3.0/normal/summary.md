# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-19T20:27:49.314Z",
  "args": {
    "pair": [
      "isoloop:own=isoloop:balancer",
      "isoloop:one=isoloop:balancer",
      "isoloop:one-off=isoloop:one"
    ],
    "mixes": "normal",
    "rounds": "5",
    "hold": "0",
    "warm": "20",
    "window": "20",
    "engines": "chromium,firefox",
    "out": "comparison/v0.3.0/normal-next6",
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
| Workers (bus excluded) | 9 | 3 | -6 | -67% | -6 to -6 |
| Files done per second | 50.1 | 50.1 | 0.0 | 0% | -0.1 to +0.1 |
| Latency per file, p50 | 19 ms | 33 ms | +14 ms | +74% | +11 ms to +14 ms |
| Latency per file, p95 | 39 ms | 74 ms | +36 ms | +92% | +27 ms to +37 ms |
| Typing (median of 5) | 20 ms | 18 ms | -2 ms | -10% | -6 ms to 0 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 10 | +10 | – | +10 to +11 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 186 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1 | 2 | +1 | +100% | 0 to +2 |
| Drain after the generator stops | 6 ms | 258 ms | +1 ms | +17% | 0 ms to +259 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 4 | +4 | – | 0 to +5 |
| Main-thread CPU | 20% | 17% | -4 pp | -17% | -4 pp to -3 pp |
| CPU, all threads | 138% | 130% | -8 pp | -6% | -10 pp to -8 pp |
| Memory after GC | 225 MB | 167 MB | -57 MB | -25% | -59 MB to -55 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 50.2 | 50.1 | -0.1 | 0% | -0.2 to -0.1 |
| Latency per file, p50 | 59 ms | 33 ms | -29 ms | -49% | -32 ms to -23 ms |
| Latency per file, p95 | 148 ms | 74 ms | -82 ms | -55% | -87 ms to -70 ms |
| Typing (median of 5) | 17 ms | 18 ms | +2 ms | +12% | -1 ms to +3 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 10 | +10 | – | +10 to +11 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 186 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1 | 2 | +2 | +200% | -1 to +2 |
| Drain after the generator stops | 3 ms | 258 ms | +9 ms | +300% | +1 ms to +262 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 4 | +4 | – | 0 to +5 |
| Main-thread CPU | 14% | 17% | +3 pp | +23% | +3 pp to +4 pp |
| CPU, all threads | 122% | 130% | +8 pp | +7% | +7 pp to +10 pp |
| Memory after GC | 170 MB | 167 MB | -2 MB | -1% | -9 MB to +3 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 50.2 | 50.2 | 0.0 | 0% | 0.0 to 0.0 |
| Latency per file, p50 | 57 ms | 59 ms | +2 ms | +4% | -2 ms to +8 ms |
| Latency per file, p95 | 147 ms | 148 ms | +7 ms | +5% | -11 ms to +18 ms |
| Typing (median of 5) | 16 ms | 17 ms | 0 ms | 0% | -1 ms to +2 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 3 | 1 | -1 | -33% | -3 to +1 |
| Drain after the generator stops | 258 ms | 3 ms | -1 ms | 0% | -255 ms to 0 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |
| Main-thread CPU | 14% | 14% | 0 pp | 0% | -0 pp to +0 pp |
| CPU, all threads | 122% | 122% | +0 pp | +0% | -1 pp to +1 pp |
| Memory after GC | 169 MB | 170 MB | +1 MB | +1% | -11 MB to +15 MB |

## firefox, Normal

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | -6 | -67% | -6 to -6 |
| Files done per second | 50.1 | 50.1 | -0.1 | 0% | -0.1 to 0.0 |
| Latency per file, p50 | 24 ms | 38 ms | +13 ms | +54% | +12 ms to +15 ms |
| Latency per file, p95 | 51 ms | 94 ms | +44 ms | +86% | +42 ms to +47 ms |
| Typing (median of 5) | 60 ms | 44 ms | -14 ms | -23% | -19 ms to -3 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 11 | +11 | – | +11 to +11 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 228 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1 | 2 | 0 | 0% | -2 to +2 |
| Drain after the generator stops | 260 ms | 262 ms | +1 ms | +0% | -250 ms to +265 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 9 | +9 | – | +7 to +10 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 43.9 | 50.1 | +6.2 | +14% | +5.6 to +6.5 |
| Latency per file, p50 | 3454 ms | 38 ms | -3417 ms | -99% | -3585 ms to -3281 ms |
| Latency per file, p95 | 8959 ms | 94 ms | -8865 ms | -99% | -9317 ms to -8492 ms |
| Typing (median of 5) | 33 ms | 44 ms | +9 ms | +27% | +4 ms to +18 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 11 | +11 | – | +11 to +11 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 228 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 304 | 2 | -302 | -99% | -312 to -286 |
| Drain after the generator stops | 8408 ms | 262 ms | -8146 ms | -97% | -8402 ms to -7905 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 9 | +9 | – | +7 to +10 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 43.9 | 43.9 | +0.1 | +0% | -0.6 to +0.6 |
| Latency per file, p50 | 3642 ms | 3454 ms | -245 ms | -7% | -323 ms to -2 ms |
| Latency per file, p95 | 9153 ms | 8959 ms | -89 ms | -1% | -808 ms to +258 ms |
| Typing (median of 5) | 36 ms | 33 ms | -1 ms | -3% | -7 ms to +7 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 306 | 304 | +1 | +0% | -21 to +11 |
| Drain after the generator stops | 8401 ms | 8408 ms | +246 ms | +3% | -507 ms to +504 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Kinds with every processor given up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |

