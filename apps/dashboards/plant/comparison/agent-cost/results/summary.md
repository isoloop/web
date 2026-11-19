# Agent-call cost (M4a task 13)

Library: 0.1.0-next.5. 5 rounds; each cell is the median of the per-round figures, with the lowest and highest round in brackets.

| Engine | Page | In flight | Round trip, median (ms) | Round trip, p95 (ms) | Round trip, mean from wall time (ms) | Issuing one call (ms) | Main thread per call (ms) | Calls/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chromium | idle | 1 | 0.10 (0.10 to 0.10) | 0.30 (0.30 to 0.30) | 0.15 (0.15 to 0.15) | 0.011 (0.010 to 0.012) | 0.035 (0.034 to 0.035) | 6599 (6539 to 6614) |
| chromium | idle | 8 | 0.60 (0.60 to 0.60) | 0.80 (0.80 to 0.80) | 0.62 (0.61 to 0.63) | 0.011 (0.011 to 0.012) | 0.030 (0.030 to 0.030) | 12853 (12799 to 13078) |
| chromium | plant-5khz | 1 | 0.20 (0.20 to 0.20) | 0.40 (0.40 to 0.40) | 0.24 (0.24 to 0.27) | 0.023 (0.020 to 0.025) | 0.059 (0.050 to 0.084) | 4154 (3665 to 4192) |
| chromium | plant-5khz | 8 | 0.60 (0.50 to 0.60) | 2.20 (1.50 to 3.00) | 0.84 (0.75 to 0.90) | 0.018 (0.016 to 0.020) | 0.041 (0.035 to 0.043) | 9512 (8855 to 10737) |
| firefox | idle | 1 | 1.00 (1.00 to 1.00) | 1.00 (1.00 to 1.00) | 0.60 (0.60 to 0.61) | 0.027 (0.027 to 0.028) | – | 1674 (1636 to 1678) |
| firefox | idle | 8 | 3.00 (3.00 to 3.00) | 4.00 (4.00 to 4.00) | 2.81 (2.79 to 2.86) | 0.026 (0.025 to 0.028) | – | 2852 (2799 to 2868) |
| firefox | plant-5khz | 1 | 1.00 (1.00 to 1.00) | 6.00 (5.00 to 7.00) | 1.48 (1.36 to 1.58) | 0.035 (0.034 to 0.044) | – | 674 (633 to 736) |
| firefox | plant-5khz | 8 | 6.00 (5.00 to 7.00) | 14.00 (13.00 to 17.00) | 7.15 (6.53 to 8.32) | 0.034 (0.028 to 0.039) | – | 1119 (962 to 1224) |
