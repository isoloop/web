---
'processor': patch
---

On `@isoloop/*@0.1.0-next.5`. The balancer counts a pool toward `maxWorkers` from the moment a move claims it, so two moves in one decision can't open a pool past the cap. A second quarantine pool folds into the first like with like: offenders join offenders, and the other half of a bisect joins its first half.
