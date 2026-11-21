---
'plant': minor
'markets': minor
'processor': minor
'site': patch
---

A Devtools switch on every page that runs Isoloop: the dashboards' Isoloop builds and their interactive pages have it on their bar, and the processor pages in their controls. It reloads the page with `?devtools=1` added or removed, which opens the devtools panel once the kernel exists (on the processor, from `@isoloop/devtools`, never before Start). On the examples hub, the same switch sits over the processor frames: it reloads the frame idle with the flag, carries it to "Open full page", and makes the frame taller for the panel.
