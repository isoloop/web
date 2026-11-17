# site

## 0.2.0

### Minor Changes

- 5a4e521: `/changelog/` lists what changed, release by release: the library's packages, which share one version, and the site and each example, each with its own. It's built from the changelogs Changesets writes, the library's at the pinned commit. The footer and `/features/` link to it.
  
  The nine features on `/features/` and the landing page's strip now come from one entry per feature in `apps/site/content/features/`, each with proof links to the code or tests behind it. The build fails when a proof no longer exists at the library pin.

### Patch Changes

- 072c5dd: The examples page's description names the processor too.

## Earlier releases

Each release is tagged `site-v<version>` and deployed to isoloop.dev from that tag. Releases up to `site-v0.1.3` are listed by their [tags](https://github.com/isoloop/web/tags); their history as of that release is added in a later entry ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8).
