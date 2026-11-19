---
'plant': minor
'markets': minor
---

`?devtools=1` on the Isoloop build adds the devtools panel (`@isoloop/devtools`, experimental) in the bottom-right corner: each isolate's state, lag, busy time and controls, the bus's topics and subscriptions, and a live record log, drawn by an isolate of its own that keeps working through a bus restart. Open it with its button or Alt+Shift+D. Without the flag the page runs no panel and loads none of its code, and the measured runs never set it; each build's JavaScript figure leaves the panel out.
