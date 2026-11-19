---
'processor': patch
---

The File processor's comparison is measured again on the M3j balancer, on `@isoloop/*@0.1.0-next.6` (web `718f2c0`, a 4-core bench server at 2.0 GHz): no file lost and no processor given up on in 26 balancer runs, with the normal, faults and faults-then-calm mixes, on Chromium and Firefox: [`comparison/v0.3.0/`](https://github.com/isoloop/web/tree/main/apps/processor/comparison/v0.3.0).
