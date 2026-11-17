---
'site': minor
---

`/changelog/` lists what changed, release by release: the library's packages, which share one version, and the site and each example, each with its own. It's built from the changelogs Changesets writes, the library's at the pinned commit. The footer and `/features/` link to it.

The nine features on `/features/` and the landing page's strip now come from one entry per feature in `apps/site/content/features/`, each with proof links to the code or tests behind it. The build fails when a proof no longer exists at the library pin.
