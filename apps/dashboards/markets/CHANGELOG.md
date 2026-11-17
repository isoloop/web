# markets

## 0.6.0

### Minor Changes

- 921467c: The interactive page places new widgets automatically (web#129): a new widget's placement is **Automatic** by default, and the page's balancer ([`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), experimental) puts it in a pool from its measured load and moves it out if it blocks that pool or the pool falls behind. The widget's header says where it runs ("Auto 1", "Quarantine"), a moved widget shows a badge and "Moving…" until it draws again, and the toolbar's placement log lists every move. The starter widgets stay in their pools, and a pool can still be picked by hand. `?chaos` adds a test-only "Burn" widget for making one block on purpose.
  
  On `@isoloop/*@0.1.0-next.0`, with M3i's balancer: a first long task is only noted and a second within 60 s quarantines, the balancer can pack a quiet widget back into another pool to free a worker, and backlog and pack moves have their own badge (web#136, web#151). Heavy widget work runs in 10 ms slices, so a widget replaying a long history isn't stopped as hung (web#126).

### Patch Changes

- 921467c: The chart isolates fetch their canvas context once and set its transform again after each resize, so they don't crash on a resize in Firefox 159 and later, which refuses a second `getContext()` on a transferred `OffscreenCanvas` (web#124).
- 921467c: The examples page's description of the markets dashboard mentions its interactive page, where widgets are added from a drawer and placed automatically.

## Earlier releases

Each release is tagged `markets-v<version>` and deployed to isoloop.dev from that tag. Releases up to `markets-v0.5.0` are listed by their [tags](https://github.com/isoloop/web/tags); their history as of that release is added in a later entry ([ADR 0004](../../../docs/adr/0004-publishing-and-governance.md), step 8).
