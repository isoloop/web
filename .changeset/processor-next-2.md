---
'processor': patch
'markets': patch
'plant': patch
---

On `@isoloop/*@0.1.0-next.2`, with three balancer fixes from M3j:

- A never-measured isolate's first way out of the quarantine, where it starts, no longer counts toward its move budget.
- A quiet pool of several isolates packs back into another, one isolate a minute.
- A backlog has to rise over two 10 s windows in a row before anything moves.
