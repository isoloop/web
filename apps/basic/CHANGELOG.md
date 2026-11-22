# basic

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes each release's section from the next one on. Each release is tagged `basic-v<version>` and deployed to isoloop.dev from that tag. A deploy builds every app at its commit, so a change can go live with another app's tag first; each change is listed under the first `basic-v*` tag that includes it.

## 0.2.1

### Patch Changes

- c643dfb: Clearer copy on the site: feature descriptions say what is there today, with release history left to the changelog, the devtools' tabs and the restart options read as lists, How it works says once where its diagrams come from, and the cost, install and Basic notes are plainer.
- 1a1a9d8: The failed-state text in the live demos now says an isolate "crashed more than 3 times within a minute", which matches the kernel: three restarts within a minute are allowed, and the next crash marks the isolate failed. It said "3 times" before. The basic README is corrected to match.
- 1dc544c: On `@isoloop/*@0.1.0-next.12`. The update itself needed no change to the app's code.
- 80f1f69: Each example page has a title of its own. The one build of each that search engines index also has a description, a canonical URL and link-preview tags. Comparison builds, interactive modes and standalone diagrams say `noindex`. The browser notice stays out of search snippets.

## 0.2.0

### Minor Changes

- 9d5b051: With `?start=manual` (the site's examples hub), the page draws its idle panes and starts no kernel and no worker until it's told to start; opened alone with the parameter, it shows its own Start. Its intro comes from `example.json`, the same text the hub shows. Embedded, it fills the frame edge to edge.

### Patch Changes

- d277f32: On `@isoloop/*@0.1.0-next.11`, which moves the library's source into areas and declares its scripts in `sideEffects`. Nothing in the apps changes.
- b87db68: The dark theme's background is a neutral `#171b26`, with its surface, rules and borders to match, in place of the navy; the version pill and the Experimental pill sit centred on their text. On the site, the page is 96rem wide and its left column is shared by every page.

## 0.1.1

### Patch Changes

- 9d6989b: The site's header: GitHub moves out of the page links to sit beside the theme switch, as the mark alone on a phone.
- 8372ee3: On `@isoloop/*@0.1.0-next.10`, with the API's TSDoc complete. Nothing in the apps changes.
- 718f2c0: On `@isoloop/*@0.1.0-next.6`. A pool's worker stays open until the host ends it after its last member, so an isolate that starts in a pool while the others are leaving it starts normally.
- b5885ab: On `@isoloop/*@0.1.0-next.9`, the release that freezes the API. In the markets and plant dashboards the devtools button shows the kernel's health as a ring, and the panel has an Events tab with the kernel's history and a Messages tab (formerly Log) for the records the app publishes.
- 5d44106: The docs are reachable: "Docs" is in the header right after Home, and opens `/docs/`, which lists every section and guide with its one-line description. Each guide's page has the docs layout: the section sidebar with the current page marked and the Experimental mark on the balancer and the devtools panel, the lead, "On this page" on the right, code blocks with a Copy button, and Previous and Next. Below 1100px the contents fold under the lead, and below 760px the sidebar folds into a "Docs" block at the top. The footer links `/llms.txt`, and the docs pages are in the sitemap.

## 0.1.1-rc.2

Tagged 2026-11-15.

- Each read in basic's activity names who published the record it handled, so the site's recording can draw C's and D's reactions to A's count ([web#96](https://github.com/isoloop/web/pull/96)).
- While A is loading, restarting, crashed or failed, C and D say "no count from A", and the intro says that they wait for A's next record while their own work carries on ([web#96](https://github.com/isoloop/web/pull/96)).

## 0.1.1-rc.1

Tagged 2026-11-15.

- The crash-loop guard is shown: each Crash button counts the crashes in the last minute ("Crash · 2/3"). After the kernel's limit (3 restarts within a minute), the pane turns red, says the guard stopped it, and offers "Restart A" ([web#94](https://github.com/isoloop/web/pull/94)).
- The intro says what a restarted isolate reads: it rebuilds its state from the records its topics still hold ([web#95](https://github.com/isoloop/web/pull/95)).

## 0.1.0

Tagged 2026-11-14, with the site's launch.

- The smallest example: four isolates, A (a counter) and B (a ticker) each on its own worker, and C (primes) and D (messages) sharing the pool `shared`. Each has Block 3 s and Crash buttons, and the page has "Block the main thread" and a main-thread fps reading ([web#83](https://github.com/isoloop/web/pull/83)).
- Served at `isoloop.dev/examples/basic/`, and embedded in the site's pages; its intro is hidden when embedded ([web#83](https://github.com/isoloop/web/pull/83), [web#86](https://github.com/isoloop/web/pull/86)).
- The site's live demos draw what basic really does, through the `isoloop-demo@1` messages: its activity, its records, isolate states and crashes, and frame times ([web#91](https://github.com/isoloop/web/pull/91)).
