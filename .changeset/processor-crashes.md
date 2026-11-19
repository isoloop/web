---
'processor': patch
---

`window.files.crashes()` lists every processor crash in order, with its time, reason, pool and message. The comparison writes them into each run's JSON, so a processor the kernel gave up on can be traced to the crashes before it.
