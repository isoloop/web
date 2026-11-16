# Plant, interactive mode, head-to-head

Run settings:

```json
{
  "started": "2026-11-16T23:09:07.242Z",
  "args": {
    "pair": [
      "native=isoloop"
    ],
    "rates": "5",
    "rounds": "5",
    "hold": "0",
    "engines": "chromium,firefox",
    "out": "comparison/interactive/final",
    "extra": [],
    "warm": "6",
    "window": "10",
    "summary-only": false
  },
  "configs": [
    "native",
    "isoloop"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, 5 kHz

### native (A) vs isoloop (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Idle: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Idle: longest draw gap | 101 ms | 108 ms | +7 ms | +7% | +5 ms to +18 ms |
| Idle: main-thread frames over 25 ms | 0 | 0 | 0 | – | 0 to 0 |
| Idle: main-thread CPU | 23% | 3% | -20 pp | -86% | -20 pp to -19 pp |
| Drawer typing (median of 10) | 7 ms | 43 ms | +36 ms | +520% | +34 ms to +38 ms |
| Drawer typing (p95 of 10) | 10 ms | 48 ms | +39 ms | +405% | +28 ms to +40 ms |
| Drawer clicks (median of 10) | 12 ms | 47 ms | +36 ms | +309% | +35 ms to +36 ms |
| Drawer clicks (p95 of 10) | 13 ms | 49 ms | +36 ms | +285% | +35 ms to +40 ms |
| Typical preview: first draw | 447 ms | 363 ms | -6 ms | -1% | -115 ms to +105 ms |
| Typical preview: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Typical preview: draw gap p95 | 101 ms | 102 ms | +1 ms | +1% | -15 ms to +3 ms |
| Typical preview: longest draw gap | 117 ms | 105 ms | -3 ms | -3% | -15 ms to +6 ms |
| Typical preview: main-thread frames over 25 ms | 0 | 0 | 0 | – | 0 to 0 |
| Typical preview: main-thread CPU | 24% | 4% | -20 pp | -81% | -21 pp to -19 pp |
| Typical preview: CPU, all threads | 31% | 44% | +12 pp | +39% | +12 pp to +14 pp |
| Typical preview: drawer typing (median) | 10 ms | 43 ms | +33 ms | +328% | +31 ms to +35 ms |
| Typical preview: drawer typing (p95) | 17 ms | 51 ms | +34 ms | +198% | +32 ms to +36 ms |
| Typical preview: keystrokes sent (of 20) | 20 | 20 | 0 | 0% | 0 to 0 |
| Typical preview: keystrokes not echoed in 30 s | 0 | 0 | 0 | – | 0 to 0 |
| Heavy preview: first draw | 5385 ms | 4327 ms | -1055 ms | -20% | -1410 ms to -651 ms |
| Heavy preview: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Heavy preview: draw gap p95 | 130 ms | 102 ms | -27 ms | -21% | -47 ms to -19 ms |
| Heavy preview: longest draw gap | 180 ms | 106 ms | -67 ms | -37% | -137 ms to -51 ms |
| Heavy preview: main-thread frames over 25 ms | 25 | 0 | -25 | -100% | -37 to -23 |
| Heavy preview: main-thread CPU | 93% | 3% | -90 pp | -97% | -94 pp to -88 pp |
| Heavy preview: CPU, all threads | 100% | 127% | +27 pp | +27% | +22 pp to +29 pp |
| Heavy preview: drawer typing (median) | 9 ms | 44 ms | +35 ms | +393% | +35 ms to +36 ms |
| Heavy preview: drawer typing (p95) | 17 ms | 51 ms | +33 ms | +195% | +24 ms to +38 ms |
| Heavy preview: keystrokes sent (of 20) | 20 | 20 | 0 | 0% | 0 to 0 |
| Heavy preview: keystrokes not echoed in 30 s | 0 | 0 | 0 | – | 0 to 0 |

## firefox, 5 kHz

### native (A) vs isoloop (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Idle: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Idle: longest draw gap | 118 ms | 118 ms | 0 ms | 0% | -1 ms to +1 ms |
| Idle: main-thread frames over 25 ms | 0 | 0 | 0 | – | 0 to 0 |
| Drawer typing (median of 10) | 5 ms | 33 ms | +27 ms | +540% | +19 ms to +30 ms |
| Drawer typing (p95 of 10) | 9 ms | 49 ms | +37 ms | +411% | +28 ms to +57 ms |
| Drawer clicks (median of 10) | 4 ms | 28 ms | +25 ms | +625% | +24 ms to +28 ms |
| Drawer clicks (p95 of 10) | 8 ms | 35 ms | +25 ms | +313% | +16 ms to +35 ms |
| Typical preview: first draw | 638 ms | 503 ms | -76 ms | -12% | -171 ms to -62 ms |
| Typical preview: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Typical preview: draw gap p95 | 110 ms | 102 ms | -8 ms | -7% | -12 ms to 0 ms |
| Typical preview: longest draw gap | 117 ms | 120 ms | +3 ms | +3% | +1 ms to +4 ms |
| Typical preview: main-thread frames over 25 ms | 0 | 0 | 0 | – | 0 to 0 |
| Typical preview: drawer typing (median) | 3 ms | 29 ms | +26 ms | +867% | +25 ms to +28 ms |
| Typical preview: drawer typing (p95) | 6 ms | 46 ms | +39 ms | +650% | +34 ms to +44 ms |
| Typical preview: keystrokes sent (of 20) | 20 | 20 | 0 | 0% | 0 to 0 |
| Typical preview: keystrokes not echoed in 30 s | 0 | 0 | 0 | – | 0 to 0 |
| Heavy preview: first draw | 3589 ms | 2879 ms | -618 ms | -17% | -754 ms to -481 ms |
| Heavy preview: starters’ draw gaps over 250 ms | 0 | 0 | 0 | – | 0 to 0 |
| Heavy preview: draw gap p95 | 168 ms | 104 ms | -64 ms | -38% | -66 ms to -61 ms |
| Heavy preview: longest draw gap | 205 ms | 121 ms | -85 ms | -41% | -117 ms to -65 ms |
| Heavy preview: main-thread frames over 25 ms | 138 | 0 | -138 | -100% | -143 to -136 |
| Heavy preview: drawer typing (median) | 27 ms | 29 ms | +1 ms | +4% | -4 ms to +11 ms |
| Heavy preview: drawer typing (p95) | 63 ms | 43 ms | -17 ms | -27% | -29 ms to +4 ms |
| Heavy preview: keystrokes sent (of 20) | 20 | 20 | 0 | 0% | 0 to 0 |
| Heavy preview: keystrokes not echoed in 30 s | 0 | 0 | 0 | – | 0 to 0 |

