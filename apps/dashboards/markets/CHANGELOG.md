# markets

## 0.9.0

### Minor Changes

- 94bffdb: A Devtools switch on every page that runs Isoloop: the dashboards' Isoloop builds and their interactive pages have it on their bar, and the processor pages in their controls. It reloads the page with `?devtools=1` added or removed, which opens the devtools panel once the kernel exists (on the processor, from `@isoloop/devtools`, never before Start). On the examples hub, the same switch sits over the processor frames: it reloads the frame idle with the flag, carries it to "Open full page", and makes the frame taller for the panel.

### Patch Changes

- d277f32: On `@isoloop/*@0.1.0-next.11`, which moves the library's source into areas and declares its scripts in `sideEffects`. Nothing in the apps changes.
- b87db68: The dark theme's background is a neutral `#171b26`, with its surface, rules and borders to match, in place of the navy; the version pill and the Experimental pill sit centred on their text. On the site, the page is 96rem wide and its left column is shared by every page.

## 0.8.1

### Patch Changes

- 8372ee3: On `@isoloop/*@0.1.0-next.10`, with the API's TSDoc complete. Nothing in the apps changes.
- 718f2c0: On `@isoloop/*@0.1.0-next.6`. A pool's worker stays open until the host ends it after its last member, so an isolate that starts in a pool while the others are leaving it starts normally.
- b5885ab: On `@isoloop/*@0.1.0-next.9`, the release that freezes the API. In the markets and plant dashboards the devtools button shows the kernel's health as a ring, and the panel has an Events tab with the kernel's history and a Messages tab (formerly Log) for the records the app publishes.

## 0.8.0

### Minor Changes

- 10b61c9: `?devtools=1` on the Isoloop build adds the devtools panel (`@isoloop/devtools`, experimental) in the bottom-right corner: each isolate's state, lag, busy time and controls, the bus's topics and subscriptions, and a live record log, drawn by an isolate of its own that keeps working through a bus restart. Open it with its button or Alt+Shift+D. Without the flag the page runs no panel and loads none of its code, and the measured runs never set it; each build's JavaScript figure leaves the panel out.
- 10b61c9: In a browser with WebMCP (behind a flag in Chromium and Firefox), the Isoloop build lists its two agent tools, `markets.quote.v1` and `markets.alerts.create.v1`, to the browser's agent through `@isoloop/webmcp`. Without WebMCP the page loads none of its code.

### Patch Changes

- a7c0654: On `@isoloop/*@0.1.0-next.4`. When a member sharing a pool falls behind and the worker cap leaves it nowhere to go, the balancer folds a second quarantine pool of offenders into the first, so the member gets that worker. On the interactive boards a widget moved this way shows "moved to Quarantine: making room for a widget falling behind", and in the File processor the move log says "making room".
- c4503e5: On `@isoloop/*@0.1.0-next.5`. The balancer counts a pool toward `maxWorkers` from the moment a move claims it, so two moves in one decision can't open a pool past the cap. A second quarantine pool folds into the first like with like: offenders join offenders, and the other half of a bisect joins its first half.

## 0.7.0

### Minor Changes

- d0c7a19: Tools for agents (M4a): `markets.quote.v1`, a read-only quote for one symbol answered by the aggregator, and `markets.alerts.create.v1`, which adds an alert rule through the alerts isolate, once per request id. In development the page pairs with `isoloop mcp` when `VITE_ISOLOOP_MCP_TOKEN` is set, so a coding agent can call them and read the page's isolates and events. Production builds don't contain the dev MCP.

### Patch Changes

- On the interactive pages, an automatic widget that crashes past the kernel's restart limit is labelled "stopped: crashed too often" in its header. The balancer leaves it where it is and doesn't move or restart it.
- On `@isoloop/*@0.1.0-next.2`, with three balancer fixes from M3j:
  
  - A never-measured isolate's first way out of the quarantine, where it starts, no longer counts toward its move budget.
  - A quiet pool of several isolates packs back into another, one isolate a minute.
  - A backlog has to rise over two 10 s windows in a row before anything moves.
- On `@isoloop/*@0.1.0-next.3`. A consumer-group member that crashes partway through a batched delivery keeps the records it settled, so they aren't sent to the next member again (ADR 0016, point 17). Before, a corrupt file that crashed its processor after the files before it in the batch were settled came back until the kernel gave up on every processor of its kind.

## 0.6.1

### Patch Changes

- cb2f44e: The WebKit typing checks at Heavy are reported, not expected to fail. With the widgets' work in 10 ms slices (web#126), they passed in the markets-v0.6.0 release run (medians 104–240 ms against 400 ms on the CI runner, run 44118384318), and because they were marked expected to fail, the passes counted as failures and stopped that release from deploying.

## 0.6.0

### Minor Changes

- 921467c: The interactive page places new widgets automatically (web#129): a new widget's placement is **Automatic** by default, and the page's balancer ([`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), experimental) puts it in a pool from its measured load and moves it out if it blocks that pool or the pool falls behind. The widget's header says where it runs ("Auto 1", "Quarantine"), a moved widget shows a badge and "Moving…" until it draws again, and the toolbar's placement log lists every move. The starter widgets stay in their pools, and a pool can still be picked by hand. `?chaos` adds a test-only "Burn" widget for making one block on purpose.
  
  On `@isoloop/*@0.1.0-next.0`, with M3i's balancer: a first long task is only noted and a second within 60 s quarantines, the balancer can pack a quiet widget back into another pool to free a worker, and backlog and pack moves have their own badge (web#136, web#151). Heavy widget work runs in 10 ms slices, so a widget replaying a long history isn't stopped as hung (web#126).

### Patch Changes

- 921467c: The chart isolates fetch their canvas context once and set its transform again after each resize, so they don't crash on a resize in Firefox 159 and later, which refuses a second `getContext()` on a transferred `OffscreenCanvas` (web#124).
- 921467c: The examples page's description of the markets dashboard mentions its interactive page, where widgets are added from a drawer and placed automatically.

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes the sections above them. Each release is tagged `markets-v<version>` and deployed to isoloop.dev from that tag. A deploy builds every app at its commit, so a change can go live with another app's tag first; each change is listed under the first `markets-v*` tag that includes it.

## 0.5.0

Tagged 2026-11-16 (M3g).

- The federated comparison, written up: native + workers with a Preact part loaded apart (`native-mixed`) against `/mixed` in `matched`, with `teams` and `own` alongside, when the Preact team's alerts panel blocks or crashes. Results in [`comparison/federated/`](https://github.com/isoloop/web/tree/markets-v0.5.0/apps/dashboards/markets/comparison/federated), and a "Parts from two teams" section in the README ([web#120](https://github.com/isoloop/web/pull/120)).
- The examples page's summary names the React and Preact builds and the pool per team ([web#120](https://github.com/isoloop/web/pull/120)).

## 0.4.0

Tagged 2026-11-16 (M3e, and M3g's builds).

- An interactive page at `/dashboards/markets/interactive/`, on Isoloop and native: editable starter widgets, and a drawer that adds widgets from markets' topics (trades, prices, aggregates and stats), each widget its own isolate, placed by hand. The page has a Native | Isoloop switch and the Size dial, and keeps each offered topic for the same time window on both builds ([web#110](https://github.com/isoloop/web/pull/110), [web#113](https://github.com/isoloop/web/pull/113), [web#116](https://github.com/isoloop/web/pull/116), [web#118](https://github.com/isoloop/web/pull/118), [web#122](https://github.com/isoloop/web/pull/122)).
- A sixth build, `native-mixed`: native + workers with the filters and the alerts panel as Preact parts built apart and loaded at run time through a manifest, each behind its own error boundary. It's the native counterpart of `/mixed` ([web#111](https://github.com/isoloop/web/pull/111)).
- `?placement=teams` on `/mixed`: the data on its own workers and one pool per team, `react` and `preact`, so a blocked widget stalls only its own team's widgets ([web#114](https://github.com/isoloop/web/pull/114)).
- Each widget report carries when that run of the widget started, so a crashed widget counts as back only once a restarted run reports ([web#115](https://github.com/isoloop/web/pull/115), [web#117](https://github.com/isoloop/web/pull/117)).

## 0.3.1

Tagged 2026-11-16.

- A box under the header names the build and placement and explains the mode, the library and the placement, including what a blocked widget takes down. On native builds the placement row stays, dimmed, as "Not used" ([web#108](https://github.com/isoloop/web/pull/108)).
- The header's controls are labelled segmented controls (Native | Isoloop, Build, Size, Placement) that keep the same place and width on every build and placement. On React + Preact, Native is disabled, since that build has no native counterpart ([web#108](https://github.com/isoloop/web/pull/108)).

## 0.3.0

Tagged 2026-11-15 (M3f).

- A native + workers build (`/native-workers`): each headless job in a plain worker of its own, on the same code as the Isoloop isolates, with the widgets on the main thread ([web#99](https://github.com/isoloop/web/pull/99)).
- `?placement=own|matched|one` on every Isoloop build, with a placement switch in the header, a worker count in the metrics panel, and widget headers that name their pool. `own` stays the default; the toggle pairs `matched` with native + workers ([web#99](https://github.com/isoloop/web/pull/99)).
- The head-to-head comparison on the runner shared with the plant, recorded on the bench server and written up in [`comparison/final/`](https://github.com/isoloop/web/tree/markets-v0.3.0/apps/dashboards/markets/comparison/final). The examples page shows its result line again ([web#98](https://github.com/isoloop/web/pull/98), [web#100](https://github.com/isoloop/web/pull/100), [web#101](https://github.com/isoloop/web/pull/101), [web#102](https://github.com/isoloop/web/pull/102)).
- On WebKit, `matched` at Heavy is expected to time out in the load test, as the other Isoloop builds at Heavy are: worker canvases are presented on the main thread there ([web#103](https://github.com/isoloop/web/pull/103)).
- The first markets release at `isoloop.dev/examples/dashboards/markets/` ([web#41](https://github.com/isoloop/web/pull/41), [web#81](https://github.com/isoloop/web/pull/81)). The page says when the browser isn't supported, instead of staying blank ([web#70](https://github.com/isoloop/web/pull/70)).

## 0.2.0

Tagged 2026-11-08 (M3c), after the release candidates 0.2.0-rc.1 (2026-11-07), rc.2 and rc.3 (2026-11-08).

- Dashboard sizes, Lite, Normal and Heavy, from one widget registry; Heavy adds widgets on three new engines (rolling stats, correlations and depth) and twenty correlated symbols in the replay ([web#21](https://github.com/isoloop/web/pull/21), [web#22](https://github.com/isoloop/web/pull/22), [web#23](https://github.com/isoloop/web/pull/23), [web#24](https://github.com/isoloop/web/pull/24), [web#25](https://github.com/isoloop/web/pull/25), [web#26](https://github.com/isoloop/web/pull/26), [web#27](https://github.com/isoloop/web/pull/27), [web#28](https://github.com/isoloop/web/pull/28)).
- Responsiveness shown on the page, time per category and the core count in About, and a header on each widget with where it runs and its updates/s ([web#29](https://github.com/isoloop/web/pull/29), [web#30](https://github.com/isoloop/web/pull/30), [web#31](https://github.com/isoloop/web/pull/31)).
- A comparison matrix, each size on each build, and an input-budget test for Isoloop at each size, with native's median and the ratio reported ([web#33](https://github.com/isoloop/web/pull/33), [web#34](https://github.com/isoloop/web/pull/34)).
- Fixes: each canvas draws at most once per frame; updates/s counts what reached the screen, the same way in every build; the filters bar no longer moves while the page fills ([web#35](https://github.com/isoloop/web/pull/35), [web#39](https://github.com/isoloop/web/pull/39), [web#40](https://github.com/isoloop/web/pull/40)).

## 0.1.0

Tagged 2026-11-07 (M3b), the first public deploy.

- A backend-less markets dashboard: Coinbase, Kraken, Bitstamp and OKX feeds as isolates, or a seeded replay played at N×, with an aggregator and alerts isolates, three canvas charts, a virtualized trades table, an alerts panel with a rule editor, and stress controls on every widget ([web#2](https://github.com/isoloop/web/pull/2) to [web#10](https://github.com/isoloop/web/pull/10)).
- Five builds of one source: Isoloop and native in React (`/isoloop`, `/native`) and in Preact (`/isoloop-preact`, `/native-preact`), and `/mixed`, React with the filters and the alerts panel as Preact isolates. A toggle lands on the other build with the same filters and replay position ([web#11](https://github.com/isoloop/web/pull/11), [web#12](https://github.com/isoloop/web/pull/12), [web#13](https://github.com/isoloop/web/pull/13)).
- A metrics panel in every build with Isoloop's costs beside what it gives: main-thread fps, long tasks, input latency, and on Isoloop the worst worker loop lag, bus throughput, memory, time to first trade and JS gzipped ([web#14](https://github.com/isoloop/web/pull/14)).
- "About this demo": the pipeline with live isolate states ([web#16](https://github.com/isoloop/web/pull/16)).
- A recorded comparison of native against Isoloop, run on demand, with its results from CI ([web#15](https://github.com/isoloop/web/pull/15), [web#17](https://github.com/isoloop/web/pull/17)).
