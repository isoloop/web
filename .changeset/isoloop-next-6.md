---
'processor': patch
'markets': patch
'plant': patch
---

On `@isoloop/*@0.1.0-next.6`. A pool's worker stays open until the host ends it after its last member, so a processor restarted into a quarantine pool while the others leave it starts normally.
