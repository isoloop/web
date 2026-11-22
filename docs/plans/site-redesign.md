# Plan: the site review before 0.1, from the prototype to main

**Status:** proposed (2026-11-21). The decisions are the 2026-11-21 amendments to [ADR 0002](../adr/0002-site-build.md), [ADR 0003](../adr/0003-design-system.md), [ADR 0005](../adr/0005-page-navigation-and-status-marks.md) and [ADR 0006](../adr/0006-docs.md) (web#234). The work was done on a local prototype, branch `proto/site-nav-reading` (31 commits, kept as the reference); this plan splits it into PRs that each land on `main` alone, with green CI.

**Done when:** every task below has merged, the tags at the end are deployed, and `isoloop.dev` serves what the ADRs say.

**Out:**
- **The prototype's tooling:** the settings switcher (already gone from the branch) and the dev-only `apps/site/build/proto-examples.ts`, which served the built examples on the site's dev server. Neither lands; task 4 says how the hub's frames are run in dev and in tests instead.
- **The docs' opening above the grid:** tried and rolled back on the branch (ADR 0003, amended 2026-11-21), so it has no task.

## Tasks

In order: each builds on the ones before it. "Review" says who merges: **self** means the fork merges on green (code and tooling, `AGENTS.md`); **maintainer** means it goes to the maintainer first, for copy or app code.

| # | Task | From the prototype | Changesets | Site impact | Checks | Review |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **ui: tokens and the grid.** `--ui-page` 96rem; the graphite neutrals and `#171b26`; `--ui-prose` with its contrast pairs; `--ui-gutter` 16rem, `--ui-gutter-gap`, `--ui-label`; the version pill and `.ui-pill` centred optically | `e211ac0` (tokens part), `dc86b98`, `41bf051` (pill), `50ac22a` (`.ui-pill`) | site, basic, processor, plant, markets: patch (`ui` is ignored; the apps take the new background) | done in this PR | ui unit (contrast), site unit, every app's E2E (shared tokens) | self |
| 2 | **The rail and the pager.** `RailLayout` and `Pager` on Features, How it works and Examples; the shared scroll-spy (`spy.ts`) for the rail and "On this page"; chevrons; `panel-h`; How it works without "Where to go next" and the policy box, its note as a footnote, "Each step below covers one part" | `77402ea`, `2315182`, `1adfe7e`, `efc34b9`, `f41ffe2`, `c5e0813`, the How it works copy from `dc86b98` | site: minor | done in this PR | site unit, site E2E (docs, smoke, axe) | maintainer (copy removed and changed on How it works) |
| 3 | **Two widths and calm reading.** The measures, figures at the full column (a diagram with its reading panel), `--ui-prose` in running text, leading, 18px body, quieter links and chips, the larger rails | `eed6b28`, `0661a46`, the reading part of `e211ac0`, `974bacf`, `8e04c1d` (the opening's mark and spacing) | site: patch | done in this PR | site unit, site E2E, screenshots at 1600 and 390 in both themes | self |
| 4 | **The examples hub with live examples.** One panel per example page; basic and both processor pages in frames with `?embed=1&start=manual` under the site's Start; the apps' idle view and manual start (`shared/manual-start.ts`, the processor models' `attach`, basic's idle panes and `layout.ts`); embedded apps edge to edge; "Open full page"; intros in `example.json` (`shared/intro.ts`) | `27740f1`, `3de0426`, `d072141` (not `d48cd93`, the reverted redirect), `229fcc1`, `bf41868`, `5982856` (one click) | site: minor; basic: minor; processor: minor | done in this PR | site unit, site E2E (the hub, 0 workers before Start, reset on leaving), basic and processor E2E | maintainer (app code in basic and processor; the merged intros) |
| 5 | **Processor: Measuring and Restarts.** The measuring step as Measuring / measured (`measuring.ts`, until isoloop/isoloop#346); the Restarts control (none, 1, 3, 10), the gave-up state and Restart; the corrected descriptions and "What to try" | `5c93bbd`, `d5d4909`, `5982856` (copy and the dropped "no limit") | processor: minor | update needed (the hub's text comes from `example.json`, so it lands with the app) | processor unit and E2E | maintainer (app code and copy) |
| 6 | **The Devtools switch.** `shared/devtools-switch.ts` and `.ui-devtools-switch`; on the bar of plant's and markets' Isoloop builds and interactive pages (with the panel loaded lazily there, its chunk `opt-in-*`); `?devtools=1` and the switch on the processor pages; the hub's switch over the processor frames | `e0e843d` | plant, markets, processor: minor; site: patch | done in this PR | plant, markets, processor E2E; site E2E; the bench must not change (no flag in its URLs) | maintainer (app code in three apps) |
| 7 | **Docs search and the files for agents.** `/docs/search.json`, the matcher and its conformance suite, the search box; the `llms.txt` line on `/docs/` and "View as Markdown" | `0ac0259`, `2a1d9cd`, the docs part of `ea993ae` | site: minor | done in this PR | site unit (the matcher), site E2E (search, keyboard, axe), linkcheck | self (the copy was approved on the prototype) |
| 8 | **The landing page.** One style for the "go further" links; the guard line unwrapped; the six copy items (the API freeze, Getting started, the limits link, the restart limit, the examples link, the table at plant-v0.3.1); the strip's description on its own line | the landing parts of `41bf051` and `ea993ae`, `74b7ca7` | site: patch | done in this PR | site unit, site E2E, linkcheck | maintainer (copy) |
| 9 | **Fix: the Playground quarantine E2E.** Under a full parallel run, the heavy task can move to another pool before its second block; the test should wait for its placement, not assume `balancer-1` | (new) | none (`no-changeset`, a test) | none | processor E2E, repeated | self |

Notes on the tasks:
- **Task 4 in dev and in tests:** the hub's frames need the apps' builds next to the site. The site's E2E already runs on the assembled site (`scripts/assemble-site.sh`); in dev, the README says to run the assembled site with `serve`, or the apps' own dev servers for app work. No middleware lands.
- **Tasks 4 to 6 touch the apps' public URLs only through new, optional parameters** (`start=manual`, `devtools=1`, `restarts=`). Without them the apps behave as at their last tags, so the measured comparisons stay valid.
- **The docs landmark note** from the prototype (the opening outside `<main>`) is moot, since the docs opening was rolled back.

## The end

The maintainer pushes the tags, one per push, each on its own commit (`AGENTS.md`, "Releases"), after the version PR:
- `site-v0.7.0`
- `processor-v0.4.0`
- `basic-v0.2.0`
- `plant-v0.4.0`
- `markets-v0.9.0`

The exact versions are whatever the changesets above add up to.
