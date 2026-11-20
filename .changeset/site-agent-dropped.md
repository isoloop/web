---
'site': patch
---

`/features/`: **Tools for agents** says what a burst of calls past a tool topic's retention does: on a topic that keeps 100 records, 1,000 calls at once get 100 answers, and since `0.1.0-next.7` the 900 that retention removed before any isolate got them fail at once with `dropped` (isoloop#303). It replaces the sentence that said the cause wasn't confirmed. The library pin moves to isoloop/isoloop `3c354e8`, which has the change.
