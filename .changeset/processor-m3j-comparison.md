---
'processor': patch
---

The File processor's comparison records more for M3j: the workers every second, each processor's reported busy time in the trace, and the processors the kernel gave up on, with their kinds and when. Its "faults, then calm" mix now runs 5 minutes of calm (60 s in M3i), and its summary gains the fewest workers in the calm and the kinds left with every processor given up on.
