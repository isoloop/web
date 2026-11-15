# Markets dashboard, head-to-head

Run settings:

```json
{
  "started": "2026-11-15T15:05:32.339Z",
  "args": {
    "pair": [
      "native=isoloop:one",
      "native-workers=isoloop:matched"
    ],
    "extra": [
      "isoloop:own"
    ],
    "sizes": "normal,heavy",
    "rounds": "5",
    "hold": "0",
    "engines": "chromium,firefox",
    "out": "comparison/final/results",
    "warm": "6",
    "window": "10",
    "summary-only": false
  },
  "configs": [
    "native",
    "isoloop:one",
    "native-workers",
    "isoloop:matched",
    "isoloop:own"
  ],
  "cpus": "2,4,6,8"
}
```

Each pair ran interleaved (A, B, A, B…), one page at a time. **Gap** is B minus A within each round; the table gives its median over the rounds, as a share of A’s median, and its spread (lowest to highest round). Medians of A and B are over the rounds too. Stopped runs are left out and counted.

## chromium, Normal

### native (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 0 | 1 | +1 | – | +1 to +1 |
| Late frames (of ~60/s × window) | 0 | 0 | 0 | – | 0 to 0 |
| Typing (median of 5) | 32 ms | 38 ms | +4 ms | +13% | +2 ms to +18 ms |
| Main-thread CPU | 83% | 22% | -61 pp | -74% | -62 pp to -60 pp |
| CPU, all threads | 95% | 107% | +13 pp | +13% | +9 pp to +13 pp |
| Memory, first reading | 183 MB | 253 MB | +70 MB | +38% | +67 MB to +75 MB |
| Memory, first reading, after GC | 166 MB | 203 MB | +34 MB | +20% | +32 MB to +41 MB |
| First data | 166 ms | 358 ms | +184 ms | +111% | +156 ms to +195 ms |
| All widgets with data | 4178 ms | 4416 ms | +241 ms | +6% | +230 ms to +252 ms |
| Recovery after a 3 s block of the price chart | 3075 ms | 3162 ms | +75 ms | +2% | +39 ms to +94 ms |

### native-workers (A) vs isoloop:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 0 | 0 | 0 | – | -1 to 0 |
| Typing (median of 5) | 35 ms | 41 ms | +7 ms | +20% | 0 ms to +25 ms |
| Main-thread CPU | 86% | 21% | -65 pp | -75% | -66 pp to -65 pp |
| CPU, all threads | 103% | 108% | +4 pp | +4% | +3 pp to +6 pp |
| Memory, first reading | 217 MB | 273 MB | +56 MB | +26% | +54 MB to +61 MB |
| Memory, first reading, after GC | 188 MB | 222 MB | +33 MB | +18% | +30 MB to +34 MB |
| First data | 249 ms | 383 ms | +125 ms | +50% | +93 ms to +174 ms |
| All widgets with data | 4275 ms | 4339 ms | +64 ms | +1% | +53 ms to +75 ms |
| Recovery after a 3 s block of the price chart | 3143 ms | 3090 ms | -62 ms | -2% | -87 ms to -53 ms |

### Measured alongside

| Figure | isoloop:own |
| --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 22 |
| Late frames (of ~60/s × window) | 0 |
| Typing (median of 5) | 42 ms |
| Main-thread CPU | 21% |
| CPU, all threads | 113% |
| Memory, first reading | 371 MB |
| Memory, first reading, after GC | 309 MB |
| First data | 799 ms |
| All widgets with data | 4395 ms |
| Recovery after a 3 s block of the price chart | 3044 ms |

## chromium, Heavy

### native (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 0 | 1 | +1 | – | +1 to +1 |
| Late frames (of ~60/s × window) | 172 | 0 | -172 | -100% | -174 to -170 |
| Typing (median of 5) | 52 ms | 41 ms | -12 ms | -23% | -56 ms to +19 ms |
| Main-thread CPU | 100% | 22% | -78 pp | -78% | -78 pp to -77 pp |
| CPU, all threads | 111% | 122% | +12 pp | +11% | +10 pp to +13 pp |
| Memory, first reading | 259 MB | 355 MB | +93 MB | +36% | +88 MB to +107 MB |
| Memory, first reading, after GC | 220 MB | 271 MB | +51 MB | +23% | +44 MB to +56 MB |
| First data | 174 ms | 350 ms | +175 ms | +101% | +152 ms to +207 ms |
| All widgets with data | 4228 ms | 4434 ms | +210 ms | +5% | +206 ms to +247 ms |
| Recovery after a 3 s block of the price chart | 3166 ms | 3312 ms | +127 ms | +4% | +117 ms to +201 ms |

### native-workers (A) vs isoloop:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 205 | 0 | -205 | -100% | -210 to -202 |
| Typing (median of 5) | 156 ms | 41 ms | -115 ms | -74% | -130 ms to -77 ms |
| Main-thread CPU | 100% | 23% | -77 pp | -77% | -77 pp to -77 pp |
| CPU, all threads | 114% | 143% | +29 pp | +25% | +27 pp to +29 pp |
| Memory, first reading | 311 MB | 381 MB | +70 MB | +23% | +58 MB to +72 MB |
| Memory, first reading, after GC | 246 MB | 301 MB | +52 MB | +21% | +51 MB to +55 MB |
| First data | 362 ms | 527 ms | +212 ms | +59% | +78 ms to +253 ms |
| All widgets with data | 4335 ms | 4443 ms | +52 ms | +1% | +28 ms to +112 ms |
| Recovery after a 3 s block of the price chart | 3256 ms | 3143 ms | -112 ms | -3% | -151 ms to -94 ms |

### Measured alongside

| Figure | isoloop:own |
| --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 30 |
| Late frames (of ~60/s × window) | 0 |
| Typing (median of 5) | 41 ms |
| Main-thread CPU | 35% |
| CPU, all threads | 185% |
| Memory, first reading | 558 MB |
| Memory, first reading, after GC | 433 MB |
| First data | 963 ms |
| All widgets with data | 4450 ms |
| Recovery after a 3 s block of the price chart | 3059 ms |

## firefox, Normal

### native (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 0 | 1 | +1 | – | +1 to +1 |
| Late frames (of ~60/s × window) | 5 | 0 | -5 | -100% | -11 to -3 |
| Typing (median of 5) | 120 ms | 79 ms | -44 ms | -37% | -50 ms to +11 ms |
| First data | 236 ms | 645 ms | +376 ms | +159% | +234 ms to +452 ms |
| All widgets with data | 4235 ms | 4535 ms | +300 ms | +7% | +102 ms to +379 ms |
| Recovery after a 3 s block of the price chart | 3111 ms | 3143 ms | +76 ms | +2% | -26 ms to +1024 ms |

### native-workers (A) vs isoloop:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 10 | 1 | -10 | -100% | -14 to -8 |
| Typing (median of 5) | 103 ms | 82 ms | -16 ms | -16% | -50 ms to 0 ms |
| First data | 386 ms | 767 ms | +384 ms | +99% | +353 ms to +413 ms |
| All widgets with data | 4464 ms | 4611 ms | +127 ms | +3% | +69 ms to +293 ms |
| Recovery after a 3 s block of the price chart | 3179 ms | 3107 ms | -75 ms | -2% | -105 ms to -2 ms |

### Measured alongside

| Figure | isoloop:own |
| --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 22 |
| Late frames (of ~60/s × window) | 5 |
| Typing (median of 5) | 67 ms |
| First data | 1226 ms |
| All widgets with data | 5007 ms |
| Recovery after a 3 s block of the price chart | 3104 ms |

## firefox, Heavy

### native (A) vs isoloop:one (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 0 | 1 | +1 | – | +1 to +1 |
| Late frames (of ~60/s × window) | 206 | 0 | -206 | -100% | -228 to -203 |
| Typing (median of 5) | 176 ms | 81 ms | -98 ms | -56% | -100 ms to -74 ms |
| First data | 237 ms | 700 ms | +408 ms | +172% | +320 ms to +543 ms |
| All widgets with data | 4257 ms | 4668 ms | +426 ms | +10% | +381 ms to +491 ms |
| Recovery after a 3 s block of the price chart | 3245 ms | 4434 ms | +1189 ms | +37% | -149 ms to +2037 ms |

### native-workers (A) vs isoloop:matched (B)

Rounds: A 5/5 ran, B 5/5 ran.

| Figure | A | B | Gap (B − A) | Gap % | Gap spread |
| --- | --- | --- | --- | --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 6 | 7 | +1 | +17% | +1 to +1 |
| Late frames (of ~60/s × window) | 231 | 1 | -229 | -99% | -231 to -227 |
| Typing (median of 5) | 150 ms | 129 ms | -25 ms | -17% | -68 ms to +15 ms |
| First data | 386 ms | 915 ms | +506 ms | +131% | +492 ms to +533 ms |
| All widgets with data | 4455 ms | 4706 ms | +253 ms | +6% | +207 ms to +287 ms |
| Recovery after a 3 s block of the price chart | 3266 ms | 3148 ms | -123 ms | -4% | -217 ms to +1206 ms |

### Measured alongside

| Figure | isoloop:own |
| --- | --- |
| Workers (Isoloop also runs the bus worker, not counted) | 30 |
| Late frames (of ~60/s × window) | 106 |
| Typing (median of 5) | 127 ms |
| First data | 1725 ms |
| All widgets with data | 4913 ms |
| Recovery after a 3 s block of the price chart | 3248 ms |

