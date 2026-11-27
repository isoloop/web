---
'processor': patch
'markets': patch
'plant': patch
'basic': patch
---

On `@isoloop/*@0.2.0-next.0`, the first 0.2 preview.

- Every `publish` call takes the value first and the key in an options object: `publish(topic, value, { key })`.
- On the markets and plant interactive boards, a widget the balancer has in the quarantine only to measure it shows "measuring" in its header, and its move out reads "measured, placed". "Quarantine" is now only for widgets that blocked or crashed.
