---
'plant': patch
---

A `PLANT_AGENT_COST=1` build adds a bench-only requestable topic and an isolate that answers it, and `pnpm compare:agent-cost` measures one `kernel.request` from the main thread on an idle page and at 5 kHz, on Chromium and Firefox (M4a task 13). Without the flag nothing changes: the deployed and measured builds are byte for byte the same.
