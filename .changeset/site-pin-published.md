---
'site': patch
---

The site builds from `isoloop/isoloop` at `0.1.0-next.7`'s version commit, so `/changelog/` includes `0.1.0-next.7`. The build now fetches the library's guides as well as its diagrams, and CI checks that the pin is a published version: every package on npm, with npm's provenance naming the pin as the commit it was built from (ADR 0006).
