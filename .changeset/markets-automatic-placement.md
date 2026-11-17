---
"markets": minor
---

The interactive page places new widgets automatically (web#129): a new widget's placement is **Automatic** by default, and the page's balancer ([`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), experimental) puts it in a pool from its measured load and moves it out if it blocks that pool or the pool falls behind. The widget's header says where it runs ("Auto 1", "Quarantine"), a moved widget shows a badge and "Moving…" until it draws again, and the toolbar's placement log lists every move. The starter widgets stay in their pools, and a pool can still be picked by hand. `?chaos` adds a test-only "Burn" widget for making one block on purpose.

On `@isoloop/*@0.1.0-next.0`, with M3i's balancer: a first long task is only noted and a second within 60 s quarantines, quiet widgets are packed back together to free a worker, and backlog and pack moves have their own badge (web#136, web#151). Heavy widget work runs in 10 ms slices, so a widget replaying a long history isn't stopped as hung (web#126).
