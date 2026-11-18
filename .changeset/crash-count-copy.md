---
'site': patch
'basic': patch
---

The failed-state text in the live demos now says an isolate "crashed more than 3 times within a minute", which matches the kernel: three restarts within a minute are allowed, and the next crash marks the isolate failed. It said "3 times" before. The basic README is corrected to match.
