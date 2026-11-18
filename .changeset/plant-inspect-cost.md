---
'plant': minor
---

The Isoloop build takes `?inspect=1`, which keeps a reader on the kernel's inspection feed for the whole run, and the comparison gains `isoloop:matched+inspect` and a ring-buffer figure, so the feed's cost can be measured (M4b task 6). `PLANT_COI=1` runs the preview server cross-origin isolated and the Chromium comparison in full Chromium, so the feed also measures memory per isolate. The *Comparison (plant)* workflow has a report-only `inspect` job. The main-thread memory sampler no longer leaves an uncaught error where the browser refuses the measurement. Built on `@isoloop/*` with `kernel.inspect()` (ADR 0020).
