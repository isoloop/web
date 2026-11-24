---
"site": minor
---

`/benchmarks/` has a new section, "Plain JavaScript work": js-bench at `@isoloop/*@0.1.0` on bench machine 1, Chromium only. It shows sorts, Maps, Sets, JSON and `structuredClone` as operations per second, on the main thread, in plain Workers and in Isoloop's placements. It has a chart per workload at four copies, tables for one copy and for all five placements, how late the page's timer fires, and the balancer scenario. One open cost, `structuredClone` of 5 MB being slower in an Isoloop worker, links its issue.
