# basic

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes each release's section from the next one on. Each release is tagged `basic-v<version>` and deployed to isoloop.dev from that tag. A deploy builds every app at its commit, so a change can go live with another app's tag first; each change is listed under the first `basic-v*` tag that includes it.

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
