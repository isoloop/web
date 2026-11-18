# Plant dashboard, head-to-head

Run settings:

```json
{
  "started": "2026-11-18T16:08:23.874Z",
  "args": {
    "pair": [
      "isoloop:matched=isoloop:matched+inspect"
    ],
    "rates": "5",
    "rounds": "5",
    "hold": "0",
    "engines": "chromium",
    "out": "comparison/inspect/coi-results",
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
| Typing (median of 5) | 26 ms | 34 ms | +8 ms | +31% | -9 ms to +25 ms |
| Main-thread CPU | 24% | 24% | -0 pp | -1% | -2 pp to +1 pp |
| CPU, all threads | 111% | 111% | +1 pp | +1% | -7 pp to +1 pp |
| Memory, first reading | 398 MB | 401 MB | +3 MB | +1% | -3 MB to +7 MB |
| Memory, first reading, after GC | 327 MB | 326 MB | +1 MB | +0% | -9 MB to +4 MB |
| First data | 755 ms | 702 ms | -46 ms | -6% | -126 ms to +21 ms |
| All 72 widgets with data | 1652 ms | 1645 ms | -11 ms | -1% | -1050 ms to +938 ms |
| Recovery after a 3 s block | 2914 ms | 2957 ms | +75 ms | +3% | -63 ms to +130 ms |
| Data gap, T3 | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Data gap, other machines | 0.0 s | 0.0 s | 0.0 s | – | 0.0 s to 0.0 s |
| Ring buffer, as JSON (Isoloop only) | 18.0 KB | 18.0 KB | 0.0 KB | 0% | 0.0 KB to 0.0 KB |

