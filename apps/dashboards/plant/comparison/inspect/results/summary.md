# Plant dashboard, head-to-head

Run settings:

```json
{
  "started": "2026-11-18T16:13:03.977Z",
  "args": {
    "pair": [
      "isoloop:matched=isoloop:matched+inspect"
    ],
    "rates": "5",
    "rounds": "5",
    "hold": "0",
    "engines": "chromium,firefox",
    "out": "comparison/inspect/results",
    "extra": [],
    "warm": "6",
    "window": "10",
    "summary-only": false
  },
  "configs": [
    "isoloop:matched",
    "isoloop:matched+inspect"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, 5 kHz

### isoloop:matched (A) vs isoloop:matched+inspect (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 10 | 10 | 0 | 0% | 0 to 0 |
| Late frames (of ~60/s × window) | 0 | 0 | 0 | – | 0 to 0 |
| Typing (median of 5) | 43 ms | 44 ms | +1 ms | +2% | -10 ms to +24 ms |
| Main-thread CPU | 25% | 25% | +0 pp | +1% | 0 pp to +0 pp |
| CPU, all threads | 112% | 112% | -3 pp | -3% | -13 pp to +7 pp |
| Memory, first reading | 344 MB | 349 MB | +4 MB | +1% | +2 MB to +7 MB |
| Memory, first reading, after GC | 274 MB | 273 MB | -1 MB | 0% | -3 MB to +10 MB |
| First data | 583 ms | 552 ms | -22 ms | -4% | -75 ms to +27 ms |
| All 72 widgets with data | 1508 ms | 1537 ms | +5 ms | +0% | -25 ms to +952 ms |
| Recovery after a 3 s block | 2902 ms | 2920 ms | +55 ms | +2% | -84 ms to +88 ms |
| Data gap, T3 | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Data gap, other machines | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Ring buffer, as JSON (Isoloop only) | 17.7 KB | 17.7 KB | 0.0 KB | 0% | -0.1 KB to +0.2 KB |

## firefox, 5 kHz

### isoloop:matched (A) vs isoloop:matched+inspect (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 10 | 10 | 0 | 0% | 0 to 0 |
| Late frames (of ~60/s × window) | 1 | 2 | +1 | +100% | -1 to +2 |
| Typing (median of 5) | 85 ms | 105 ms | +16 ms | +19% | -33 ms to +33 ms |
| First data | 1108 ms | 1097 ms | -58 ms | -5% | -192 ms to +31 ms |
| All 72 widgets with data | 1935 ms | 1871 ms | -82 ms | -4% | -922 ms to +44 ms |
| Recovery after a 3 s block | 3692 ms | 3564 ms | -110 ms | -3% | -297 ms to -4 ms |
| Data gap, T3 | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Data gap, other machines | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Ring buffer, as JSON (Isoloop only) | 15.4 KB | 15.4 KB | 0.0 KB | 0% | -0.1 KB to 0.0 KB |

