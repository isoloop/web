# File processor, placements compared

Run settings:

```json
{
  "started": "2026-11-17T10:12:11.801Z",
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
    "out": "comparison/v0.2.0/results",
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
| Files done per second | 50.0 | 50.2 | +0.1 | +0% | +0.1 to +0.2 |
| Latency per file, p50 | 19 ms | 33 ms | +14 ms | +74% | +12 ms to +15 ms |
| Latency per file, p95 | 39 ms | 83 ms | +44 ms | +113% | +39 ms to +54 ms |
| Typing (median of 5) | 21 ms | 19 ms | -3 ms | -14% | -7 ms to +2 ms |
| Moves in the window | 0 | 2 | +2 | – | +2 to +2 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 11 | +11 | – | +11 to +11 |
| Moves for a rising backlog | 0 | 3 | +3 | – | +3 to +3 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 251 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 0 | 3 | +2 | – | +1 to +3 |
| Drain after the generator stops | 260 ms | 259 ms | +6 ms | +2% | -3 ms to +255 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 4 | +4 | – | +4 to +5 |
| Main-thread CPU | 20% | 17% | -4 pp | -19% | -5 pp to -3 pp |
| CPU, all threads | 139% | 128% | -11 pp | -8% | -12 pp to -10 pp |
| Memory after GC | 223 MB | 166 MB | -57 MB | -26% | -66 MB to -42 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 50.2 | 50.2 | 0.0 | 0% | -0.2 to +0.1 |
| Latency per file, p50 | 60 ms | 33 ms | -26 ms | -43% | -31 ms to -23 ms |
| Latency per file, p95 | 153 ms | 83 ms | -69 ms | -45% | -83 ms to -60 ms |
| Typing (median of 5) | 17 ms | 19 ms | +2 ms | +12% | -1 ms to +4 ms |
| Moves in the window | 0 | 2 | +2 | – | +2 to +2 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 11 | +11 | – | +11 to +11 |
| Moves for a rising backlog | 0 | 3 | +3 | – | +3 to +3 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 251 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 3 | 3 | 0 | 0% | -2 to +3 |
| Drain after the generator stops | 257 ms | 259 ms | +10 ms | +4% | +1 ms to +255 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 4 | +4 | – | +4 to +5 |
| Main-thread CPU | 14% | 17% | +3 pp | +21% | +3 pp to +3 pp |
| CPU, all threads | 122% | 128% | +7 pp | +5% | +5 pp to +8 pp |
| Memory after GC | 170 MB | 166 MB | -4 MB | -2% | -8 MB to +4 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 50.1 | 50.2 | 0.0 | 0% | 0.0 to +0.1 |
| Latency per file, p50 | 57 ms | 60 ms | +1 ms | +2% | -4 ms to +4 ms |
| Latency per file, p95 | 152 ms | 153 ms | +5 ms | +3% | -5 ms to +12 ms |
| Typing (median of 5) | 16 ms | 17 ms | 0 ms | 0% | -1 ms to +3 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 3 | 3 | 0 | 0% | -2 to +1 |
| Drain after the generator stops | 258 ms | 257 ms | -1 ms | 0% | -255 ms to +1 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |
| Main-thread CPU | 14% | 14% | 0 pp | 0% | -0 pp to +0 pp |
| CPU, all threads | 121% | 122% | +1 pp | +1% | +0 pp to +1 pp |
| Memory after GC | 174 MB | 170 MB | -4 MB | -2% | -7 MB to +5 MB |

## chromium, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.1 | 46.3 | -3.7 | -7% | -19.9 to +6.9 |
| Latency per file, p50 | 28 ms | 1855 ms | +1825 ms | +6518% | +727 ms to +6265 ms |
| Latency per file, p95 | 383 ms | 17368 ms | +16994 ms | +4437% | +9272 ms to +21712 ms |
| Typing (median of 5) | 57 ms | 29 ms | -24 ms | -42% | -37 ms to -12 ms |
| Moves in the window | 0 | 3 | +3 | – | 0 to +6 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 13 | +13 | – | +13 to +19 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 204 ms | – | – | – |
| Spikes only noted | 0 | 2 | +2 | – | +1 to +7 |
| Behind events | 0 | 3 | +3 | – | +2 to +4 |
| Queue when the generator stops | 14 | 318 | +304 | +2171% | +57 to +1020 |
| Drain after the generator stops | 1032 ms | 14092 ms | +13066 ms | +1266% | +3523 ms to +57090 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +989 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +6 |
| Files done twice | 0 | 458 | +458 | – | +125 to +2076 |
| Main-thread CPU | 25% | 21% | -6 pp | -23% | -10 pp to -2 pp |
| CPU, all threads | 255% | 290% | +36 pp | +14% | -91 pp to +72 pp |
| Memory after GC | 256 MB | 269 MB | -37 MB | -14% | -85 MB to +58 MB |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 26.8 | 46.3 | +20.0 | +75% | +3.4 to +30.0 |
| Latency per file, p50 | 15722 ms | 1855 ms | -13771 ms | -88% | -15659 ms to -9943 ms |
| Latency per file, p95 | 20845 ms | 17368 ms | -3482 ms | -17% | -11189 ms to +1568 ms |
| Typing (median of 5) | 16 ms | 29 ms | +12 ms | +75% | +4 ms to +18 ms |
| Moves in the window | 0 | 3 | +3 | – | 0 to +6 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 13 | +13 | – | +13 to +19 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to +1 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 204 ms | – | – | – |
| Spikes only noted | 0 | 2 | +2 | – | +1 to +7 |
| Behind events | 0 | 3 | +3 | – | +2 to +4 |
| Queue when the generator stops | 1119 | 318 | -814 | -73% | -990 to -87 |
| Drain after the generator stops | 45879 ms | 14092 ms | -32044 ms | -70% | -40548 ms to +13723 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +989 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +6 |
| Files done twice | 2 | 458 | +456 | +22800% | +123 to +2075 |
| Main-thread CPU | 7% | 21% | +15 pp | +223% | +7 pp to +16 pp |
| CPU, all threads | 122% | 290% | +168 pp | +137% | +43 pp to +202 pp |
| Memory after GC | 176 MB | 269 MB | +118 MB | +67% | -22 MB to +126 MB |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 26.5 | 26.8 | +0.2 | +1% | -0.4 to +0.8 |
| Latency per file, p50 | 16070 ms | 15722 ms | +205 ms | +1% | -750 ms to +344 ms |
| Latency per file, p95 | 20251 ms | 20845 ms | +594 ms | +3% | -13 ms to +772 ms |
| Typing (median of 5) | 17 ms | 16 ms | -1 ms | -6% | -2 ms to +2 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1115 | 1119 | -10 | -1% | -61 to +81 |
| Drain after the generator stops | 45661 ms | 45879 ms | +21 ms | +0% | -1047 ms to +1719 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 2 | 2 | 0 | 0% | -1 to +1 |
| Main-thread CPU | 6% | 7% | +0 pp | +2% | 0 pp to +0 pp |
| CPU, all threads | 122% | 122% | -0 pp | 0% | -1 pp to +1 pp |
| Memory after GC | 188 MB | 176 MB | +6 MB | +3% | -39 MB to +32 MB |

## firefox, Normal

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 3 | -6 | -67% | -6 to -6 |
| Files done per second | 50.1 | 49.5 | -0.5 | -1% | -1.9 to +2.5 |
| Latency per file, p50 | 24 ms | 1162 ms | +1138 ms | +4742% | +632 ms to +3894 ms |
| Latency per file, p95 | 50 ms | 15515 ms | +15465 ms | +30930% | +12016 ms to +16959 ms |
| Typing (median of 5) | 55 ms | 40 ms | -17 ms | -31% | -20 ms to -3 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers at the end of the window | 9 | 3 | -6 | -67% | -6 to -6 |
| Moves in the whole run | 0 | 9 | +9 | – | +9 to +10 |
| Moves for a rising backlog | 0 | 1 | +1 | – | +1 to +2 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1129 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 6 | +6 | – | +6 to +6 |
| Queue when the generator stops | 2 | 198 | +198 | +9900% | +163 to +227 |
| Drain after the generator stops | 270 ms | 5604 ms | +5587 ms | +2069% | +4831 ms to +6628 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 54 | +54 | – | +52 to +156 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 3 | +1 | +50% | +1 to +1 |
| Files done per second | 43.8 | 49.5 | +6.3 | +14% | +3.7 to +8.8 |
| Latency per file, p50 | 3403 ms | 1162 ms | -2747 ms | -81% | -3319 ms to +762 ms |
| Latency per file, p95 | 9050 ms | 15515 ms | +6465 ms | +71% | +3134 ms to +8067 ms |
| Typing (median of 5) | 30 ms | 40 ms | +6 ms | +20% | +3 ms to +11 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to +1 |
| Workers at the end of the window | 2 | 3 | +1 | +50% | +1 to +1 |
| Moves in the whole run | 0 | 9 | +9 | – | +9 to +10 |
| Moves for a rising backlog | 0 | 1 | +1 | – | +1 to +2 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1129 ms | – | – | – |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 6 | +6 | – | +6 to +6 |
| Queue when the generator stops | 296 | 198 | -108 | -36% | -153 to -51 |
| Drain after the generator stops | 8148 ms | 5604 ms | -2544 ms | -31% | -4086 ms to -1273 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 54 | +54 | – | +52 to +156 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 44.0 | 43.8 | -0.1 | 0% | -1.4 to +0.3 |
| Latency per file, p50 | 3422 ms | 3403 ms | -19 ms | -1% | -313 ms to +949 ms |
| Latency per file, p95 | 9492 ms | 9050 ms | -57 ms | -1% | -581 ms to +573 ms |
| Typing (median of 5) | 31 ms | 30 ms | 0 ms | 0% | -2 ms to +6 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 312 | 296 | -9 | -3% | -25 to +31 |
| Drain after the generator stops | 8444 ms | 8148 ms | -10 ms | 0% | -298 ms to +1019 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 0 | 0 | 0 | – | 0 to 0 |

## firefox, With faults

### isoloop:own (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 9 | 4 | -5 | -56% | -5 to -5 |
| Files done per second | 50.3 | 33.4 | -16.8 | -33% | -24.3 to -11.9 |
| Latency per file, p50 | 45 ms | 2527 ms | +2482 ms | +5516% | +1319 ms to +9805 ms |
| Latency per file, p95 | 586 ms | 21653 ms | +21061 ms | +3594% | +20062 ms to +24837 ms |
| Typing (median of 5) | 74 ms | 65 ms | -9 ms | -12% | -22 ms to -3 ms |
| Moves in the window | 0 | 2 | +2 | – | 0 to +5 |
| Workers at the end of the window | 9 | 4 | -5 | -56% | -5 to -5 |
| Moves in the whole run | 0 | 25 | +25 | – | +16 to +28 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1042 ms | – | – | – |
| Spikes only noted | 0 | 4 | +4 | – | +2 to +4 |
| Behind events | 0 | 2 | +2 | – | +1 to +4 |
| Queue when the generator stops | 4 | 788 | +782 | +19550% | +759 to +1002 |
| Drain after the generator stops | 1804 ms | 56538 ms | +54741 ms | +3034% | +35522 ms to +117601 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +262 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +2 |
| Files done twice | 0 | 1485 | +1485 | – | +952 to +2254 |

### isoloop:one (A) vs isoloop:balancer (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 4 | +2 | +100% | +2 to +2 |
| Files done per second | 19.7 | 33.4 | +14.3 | +73% | +5.7 to +17.7 |
| Latency per file, p50 | 19887 ms | 2527 ms | -17136 ms | -86% | -18541 ms to -9535 ms |
| Latency per file, p95 | 27699 ms | 21653 ms | -6197 ms | -22% | -6590 ms to -2283 ms |
| Typing (median of 5) | 32 ms | 65 ms | +32 ms | +100% | +16 ms to +37 ms |
| Moves in the window | 0 | 2 | +2 | – | 0 to +5 |
| Workers at the end of the window | 2 | 4 | +2 | +100% | +2 to +2 |
| Moves in the whole run | 0 | 25 | +25 | – | +16 to +28 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Move cost, median (stop to first beat) | – | 1042 ms | – | – | – |
| Spikes only noted | 0 | 4 | +4 | – | +2 to +4 |
| Behind events | 0 | 2 | +2 | – | +1 to +4 |
| Queue when the generator stops | 1254 | 788 | -477 | -38% | -513 to -230 |
| Drain after the generator stops | 66171 ms | 56538 ms | -9584 ms | -14% | -29544 ms to +53239 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to +262 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to +2 |
| Files done twice | 9 | 1485 | +1477 | +16411% | +943 to +2245 |

### isoloop:one-off (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (bus excluded) | 2 | 2 | 0 | 0% | 0 to 0 |
| Files done per second | 19.6 | 19.7 | +0.2 | +1% | -1.4 to +1.9 |
| Latency per file, p50 | 19680 ms | 19887 ms | -17 ms | 0% | -557 ms to +1176 ms |
| Latency per file, p95 | 27478 ms | 27699 ms | -27 ms | 0% | -679 ms to +339 ms |
| Typing (median of 5) | 34 ms | 32 ms | -2 ms | -6% | -3 ms to +5 ms |
| Moves in the window | 0 | 0 | 0 | – | 0 to 0 |
| Workers at the end of the window | 2 | 2 | 0 | 0% | 0 to 0 |
| Moves in the whole run | 0 | 0 | 0 | – | 0 to 0 |
| Moves for a rising backlog | 0 | 0 | 0 | – | 0 to 0 |
| Packs back | 0 | 0 | 0 | – | 0 to 0 |
| Spikes only noted | 0 | 0 | 0 | – | 0 to 0 |
| Behind events | 0 | 0 | 0 | – | 0 to 0 |
| Queue when the generator stops | 1251 | 1254 | -2 | 0% | -48 to +30 |
| Drain after the generator stops | 65879 ms | 66171 ms | +993 ms | +2% | -1491 ms to +1055 ms |
| Files without a result 2 min after the generator stops | 0 | 0 | 0 | – | 0 to 0 |
| Processors the kernel gave up on | 0 | 0 | 0 | – | 0 to 0 |
| Files done twice | 9 | 9 | 0 | 0% | -1 to +1 |

