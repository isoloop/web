---
"markets": patch
---

The chart isolates fetch their canvas context once and set its transform again after each resize, so they don't crash on a resize in Firefox 159 and later, which refuses a second `getContext()` on a transferred `OffscreenCanvas` (web#124).
