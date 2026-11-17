# site

## 0.2.0

### Minor Changes

- 5a4e521: `/changelog/` lists what changed, release by release: the library's packages, which share one version, and the site and each example, each with its own. It's built from the changelogs Changesets writes, the library's at the pinned commit. The footer and `/features/` link to it.
  
  The nine features on `/features/` and the landing page's strip now come from one entry per feature in `apps/site/content/features/`, each with proof links to the code or tests behind it. The build fails when a proof no longer exists at the library pin.

### Patch Changes

- 072c5dd: The examples page's description names the processor too.

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes the sections above them. Each release is tagged `site-v<version>` and deployed to isoloop.dev from that tag.

## 0.1.3

Tagged 2026-11-16 (M3g).

- The landing page's "Apps built from many teams' parts" carries a measured sentence from markets' federated comparison, linked to its write-up ([web#120](https://github.com/isoloop/web/pull/120)).

## 0.1.2

Tagged 2026-11-16.

- The expressive mark beside the intro of the landing page, Features, How it works and Examples, switching with the theme and left out on phones ([web#104](https://github.com/isoloop/web/pull/104)).
- The runtime topology and placement diagrams on How it works draw again: the library pin moves to a commit that keeps stylesheet links out of the SVG ([web#104](https://github.com/isoloop/web/pull/104)).

## 0.1.1

Tagged 2026-11-15, after the release candidate 0.1.1-rc.1 the same day.

- The live demos show basic's crash-loop guard: the crash count in the Crash button, a red "failed" mark, a "Restart A" button, and one line under the controls stating the rule ([web#94](https://github.com/isoloop/web/pull/94)).
- The recording draws reactions: a read of another isolate's record is a hollow tick with a thin line back to its publisher, and the bus track shows the app's own records, with a rejected publish in red ([web#97](https://github.com/isoloop/web/pull/97)).
- The examples page shows the markets dashboard's figures again, from its M3f comparison ([web#102](https://github.com/isoloop/web/pull/102)).

## 0.1.0

Tagged 2026-11-14, the launch of `isoloop.dev`.

- The landing page, How it works, and the examples hub, with the site's copy ([web#84](https://github.com/isoloop/web/pull/84), [web#85](https://github.com/isoloop/web/pull/85)).
- The approved design: a live recording of basic's real activity on the landing page, and `/features/` with nine sections, three of them live demos ([web#91](https://github.com/isoloop/web/pull/91), [web#92](https://github.com/isoloop/web/pull/92)).
- The design system in `packages/ui`, and the brand's marks drawn from geometry ([web#82](https://github.com/isoloop/web/pull/82), [web#90](https://github.com/isoloop/web/pull/90)).
- Every app served under `/examples/` ([web#81](https://github.com/isoloop/web/pull/81)).
