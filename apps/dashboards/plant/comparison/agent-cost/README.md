# The agent-call cost (M4a task 13)

One `kernel.request` from the main thread, the call every agent transport makes, answered by a ping isolate with no handler work ([the comparison README](../README.md#the-agent-call-cost)). Two pages: `?agent=idle` (the kernel, the bus and the ping isolate only) and the Isoloop build at 5 kHz in `matched`. 5 rounds, the pages interleaved, one at a time; per page and mode, 1,500 calls (3 bursts of 500), and 3 bursts of 1,000 calls issued back to back for the issue time.

- **Machine:** the dedicated bench machine (AMD Ryzen 7 5825U), bench mode on (cores fixed at 2.0 GHz), the container pinned to `--cpuset-cpus=2,4,6,8`, image `mcr.microsoft.com/playwright:v1.65.0-noble` (Playwright 1.65.0: Chromium headless shell 158, Firefox 159), 2026-11-19.
- **Library:** `@isoloop/*@0.1.0-next.5`, this repo's pin.
- **Plant:** isoloop/web#187 at `337dc8f`, built with `PLANT_AGENT_COST=1`.

[`results/summary.md`](results/summary.md) has every figure; each run's JSON (every round trip) is beside it. Each cell below is the median of the 5 per-round figures, with the lowest and highest round in brackets.

| One call in flight | Chromium, idle | Chromium, 5 kHz | Firefox, idle | Firefox, 5 kHz |
| --- | --- | --- | --- | --- |
| Round trip, mean (ms) | 0.15 (0.15 to 0.15) | 0.24 (0.24 to 0.27) | 0.60 (0.60 to 0.61) | 1.48 (1.36 to 1.58) |
| Round trip, p95 (ms) | 0.3 (0.3 to 0.3) | 0.4 (0.4 to 0.4) | 1 (1 to 1) | 6 (5 to 7) |
| Main thread per call (ms) | 0.035 (0.034 to 0.035) | 0.059 (0.050 to 0.084) | – | – |
| Issuing one call (ms) | 0.011 (0.010 to 0.012) | 0.023 (0.020 to 0.025) | 0.027 (0.027 to 0.028) | 0.035 (0.034 to 0.044) |

With 8 calls in flight: 12,853 calls/s (12,799 to 13,078) on idle Chromium and 9,512 (8,855 to 10,737) at 5 kHz; 2,852 (2,799 to 2,868) on idle Firefox and 1,119 (962 to 1,224) at 5 kHz, where the p95 round trip was 14 ms (13 to 17).

- **Timer resolution:** Chromium's `performance.now()` is 0.1 ms here (not cross-origin isolated) and Firefox's 1 ms, so per-call medians and p95s are in those steps; the mean comes from each burst's wall time over its calls.
- **Main thread per call** is Chromium only: CDP `TaskDuration` over the bursts, less the page's own rate measured in 2 s quiet windows beside them. At 5 kHz that rate is most of the total, so the figure's spread is wider there.
- **Not measured:** the transports' own hop (the dev MCP's WebSocket, WebMCP's browser side) and the agent's latency. No native baseline: native has no bus.
- **Retention:** the ping topic keeps 2,000 records. With `last-n` 100, as markets' tools have, the first run's burst of 1,000 calls lost the calls past the 100th before the isolate read them, and they timed out: a request topic's retention bounds how many calls can wait.

The write-up is `docs/investigations/agent-call-cost.md` in isoloop/isoloop.
