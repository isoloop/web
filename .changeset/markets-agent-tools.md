---
'markets': minor
---

Tools for agents (M4a): `markets.quote.v1`, a read-only quote for one symbol answered by the aggregator, and `markets.alerts.create.v1`, which adds an alert rule through the alerts isolate, once per request id. In development the page pairs with `isoloop mcp` when `VITE_ISOLOOP_MCP_TOKEN` is set, so a coding agent can call them and read the page's isolates and events. Production builds don't contain the dev MCP.
