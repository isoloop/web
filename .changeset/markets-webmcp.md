---
'markets': minor
---

In a browser with WebMCP (behind a flag in Chromium and Firefox), the Isoloop build lists its two agent tools, `markets.quote.v1` and `markets.alerts.create.v1`, to the browser's agent through `@isoloop/webmcp`. Without WebMCP the page loads none of its code.
