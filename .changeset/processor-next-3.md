---
'processor': patch
'plant': patch
---

On `@isoloop/*@0.1.0-next.3`. A consumer-group member that crashes partway through a batched delivery keeps the records it settled, so they aren't sent to the next member again (ADR 0016, point 17). Before, a corrupt file that crashed its processor after the files before it in the batch were settled came back until the kernel gave up on every processor of its kind.
