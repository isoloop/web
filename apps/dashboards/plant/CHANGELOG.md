# plant

## 0.4.3

### Patch Changes

- 013c3ec: The figures come from plant-bench on `@isoloop/*@0.1.0` (24 November 2026): the landing charts, `/benchmarks/` and plant's desktop measurements.

## 0.4.2

### Patch Changes

- 865419c: On `@isoloop/*@0.1.0`, the first release. The apps' own code doesn't change.

## 0.4.1

### Patch Changes

- 031038f: Copy corrections: the crash limit is stated as the next crash after 3 restarts in a minute, the landing page's supervisor sentence and How it works' bus-crash sentence name who acts, devices are described by class and specs, and the plant's measurement note on the examples page and the markets' About panel no longer cite decision records.
- 01eeb52: Markets' red text is lighter, so it meets the AA contrast ratio, and plant's anomaly ranking names its columns for screen readers.
- 1dc544c: On `@isoloop/*@0.1.0-next.12`. The update itself needed no change to the app's code.
- 80f1f69: Each example page has a title of its own. The one build of each that search engines index also has a description, a canonical URL and link-preview tags. Comparison builds, interactive modes and standalone diagrams say `noindex`. The browser notice stays out of search snippets.

## 0.4.0

### Minor Changes

- 94bffdb: A Devtools switch on every page that runs Isoloop: the dashboards' Isoloop builds and their interactive pages have it on their bar, and the processor pages in their controls. It reloads the page with `?devtools=1` added or removed, which opens the devtools panel once the kernel exists (on the processor, from `@isoloop/devtools`, never before Start). On the examples hub, the same switch sits over the processor frames: it reloads the frame idle with the flag, carries it to "Open full page", and makes the frame taller for the panel.

### Patch Changes

- d277f32: On `@isoloop/*@0.1.0-next.11`, which moves the library's source into areas and declares its scripts in `sideEffects`. Nothing in the apps changes.
- b87db68: The dark theme's background is a neutral `#171b26`, with its surface, rules and borders to match, in place of the navy; the version pill and the Experimental pill sit centred on their text. On the site, the page is 96rem wide and its left column is shared by every page.

## 0.3.1

### Patch Changes

- 8372ee3: On `@isoloop/*@0.1.0-next.10`, with the API's TSDoc complete. Nothing in the apps changes.
- 718f2c0: On `@isoloop/*@0.1.0-next.6`. A pool's worker stays open until the host ends it after its last member, so an isolate that starts in a pool while the others are leaving it starts normally.
- b5885ab: On `@isoloop/*@0.1.0-next.9`, the release that freezes the API. In the markets and plant dashboards the devtools button shows the kernel's health as a ring, and the panel has an Events tab with the kernel's history and a Messages tab (formerly Log) for the records the app publishes.
- a856eff: A `PLANT_AGENT_COST=1` build adds a bench-only requestable topic and an isolate that answers it, and `pnpm compare:agent-cost` measures one `kernel.request` from the main thread on an idle page and at 5 kHz, on Chromium and Firefox. Without the flag nothing changes: the deployed and measured builds are byte for byte the same.
- b5885ab: The site and the plant dashboard use the kernel's snake_case event `bus:durability_degraded` (`@isoloop/*` 0.1.0-next.9).

## 0.3.0

### Minor Changes

- `?devtools=1` on the Isoloop build adds the devtools panel (`@isoloop/devtools`, experimental) in the bottom-right corner: each isolate's state, lag, busy time and controls, the bus's topics and subscriptions, and a live record log, drawn by an isolate of its own that keeps working through a bus restart. Open it with its button or Alt+Shift+D. Without the flag the page runs no panel and loads none of its code, and the measured runs never set it; each build's JavaScript figure leaves the panel out.
- da9e138: The Isoloop build takes `?inspect=1`, which keeps a reader on the kernel's inspection feed for the whole run, and the comparison gains `isoloop:matched+inspect` and a ring-buffer figure, so the feed's cost can be measured (M4b task 6). `PLANT_COI=1` runs the preview server cross-origin isolated and the Chromium comparison in full Chromium, so the feed also measures memory per isolate. The *Comparison (plant)* workflow has a report-only `inspect` job. The main-thread memory sampler no longer leaves an uncaught error where the browser refuses the measurement. Built on `@isoloop/*` with `kernel.inspect()` (ADR 0020).

### Patch Changes

- f2e4767: On the interactive pages, an automatic widget that crashes past the kernel's restart limit is labelled "stopped: crashed too often" in its header. The balancer leaves it where it is and doesn't move or restart it.
- On `@isoloop/*@0.1.0-next.4`. When a member sharing a pool falls behind and the worker cap leaves it nowhere to go, the balancer folds a second quarantine pool of offenders into the first, so the member gets that worker. On the interactive boards a widget moved this way shows "moved to Quarantine: making room for a widget falling behind", and in the File processor the move log says "making room".
- On `@isoloop/*@0.1.0-next.5`. The balancer counts a pool toward `maxWorkers` from the moment a move claims it, so two moves in one decision can't open a pool past the cap. A second quarantine pool folds into the first like with like: offenders join offenders, and the other half of a bisect joins its first half.
- 373d33b: The examples page's Plant tab gains the inspection feed's cost: `matched` at 5 kHz with a reader on `kernel.inspect()` against without, on cross-origin isolated and headless Chromium, with Firefox in words. Memory before garbage collection is 4 MB higher with the feed open on headless Chromium (+2 to +7), in every round, the one gap on one side of zero; total CPU on isolated Chromium leans about +1 point, within its spread (−7 to +1); the other gaps cross zero. The ring buffer is about 18 KB on Chromium and 15 KB on Firefox.
- On `@isoloop/*@0.1.0-next.2`, with three balancer fixes from M3j:
  
  - A never-measured isolate's first way out of the quarantine, where it starts, no longer counts toward its move budget.
  - A quiet pool of several isolates packs back into another, one isolate a minute.
  - A backlog has to rise over two 10 s windows in a row before anything moves.
- On `@isoloop/*@0.1.0-next.3`. A consumer-group member that crashes partway through a batched delivery keeps the records it settled, so they aren't sent to the next member again (ADR 0016, point 17). Before, a corrupt file that crashed its processor after the files before it in the batch were settled came back until the kernel gave up on every processor of its kind.

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes the sections above them. Each release is tagged `plant-v<version>` and deployed to isoloop.dev from that tag. A deploy builds every app at its commit, so a change can go live with another app's tag first; each change is listed under the first `plant-v*` tag that includes it.

## 0.2.0

Tagged 2026-11-17 (M3e).

- An interactive page at `/dashboards/plant/interactive/`, on Isoloop and native: six editable starter widgets, and a drawer that adds widgets from plant's topics (each machine's scalars, health and spectrum, plus fleet, alarms and events), each widget its own isolate. The page has a Native | Isoloop switch and the Rate dial, and writes nothing to the main page's history ([web#110](https://github.com/isoloop/web/pull/110), [web#113](https://github.com/isoloop/web/pull/113), [web#116](https://github.com/isoloop/web/pull/116), [web#118](https://github.com/isoloop/web/pull/118), [web#119](https://github.com/isoloop/web/pull/119)).
- A widget is placed by hand in a pool, or automatically by the page's balancer ([`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md), experimental) ([web#127](https://github.com/isoloop/web/pull/127)).
- A widget's work runs in 10 ms slices, so a heavy widget isn't stopped as hung ([web#126](https://github.com/isoloop/web/pull/126)). The chart isolates fetch their canvas context once, so a resize doesn't crash them in Firefox 159 and later ([web#124](https://github.com/isoloop/web/pull/124)).
- The interactive page measured against native in both directions, the dashboard under the drawer and the drawer under a heavy preview over every raw vibration sample, recorded on the bench server and written up in [`comparison/interactive/final/`](https://github.com/isoloop/web/tree/plant-v0.2.0/apps/dashboards/plant/comparison/interactive/final) ([web#121](https://github.com/isoloop/web/pull/121), [web#123](https://github.com/isoloop/web/pull/123), [web#134](https://github.com/isoloop/web/pull/134), [web#135](https://github.com/isoloop/web/pull/135)).

## 0.1.1

Tagged 2026-11-16.

- A box under the header names the build and placement and explains the mode, the library and the placement, including what a blocked widget takes down ([web#108](https://github.com/isoloop/web/pull/108)).
- The header's controls are labelled segmented controls (Native | Isoloop, Build, Rate, Placement) that keep the same place and width on every build and placement, and the Architecture link is readable on the dark bar ([web#108](https://github.com/isoloop/web/pull/108)).
- The first plant release at `isoloop.dev/examples/dashboards/plant/` ([web#81](https://github.com/isoloop/web/pull/81)). The head-to-head runner moved to `packages/compare`, shared with markets ([web#98](https://github.com/isoloop/web/pull/98)).

## 0.1.0

Tagged 2026-11-14 (M3d), after the release candidates 0.1.0-rc.1 to rc.5 (2026-11-09 to 2026-11-13).

- A telemetry dashboard for a fictional plant: 8 machines and 72 widgets on seeded sensor data, with vibration sampled at 1, 2 or 5 kHz, spectra, health, fleet widgets, alarms and events ([web#42](https://github.com/isoloop/web/pull/42) to [web#47](https://github.com/isoloop/web/pull/47)).
- Three builds of the same widgets and data: native, native + workers (a data worker per machine) and Isoloop, with a Rate switch ([web#42](https://github.com/isoloop/web/pull/42), [web#49](https://github.com/isoloop/web/pull/49)).
- Six placements on the Isoloop build (`matched`, the default, `split`, `machine`, `shared-engines`, `own` and `one`), block and crash per pool, and alarms and events kept across a reload in persistent topics ([web#48](https://github.com/isoloop/web/pull/48), [web#55](https://github.com/isoloop/web/pull/55), [web#69](https://github.com/isoloop/web/pull/69)).
- A responsiveness strip and metrics panels, with timings sampled once a second per thread ([web#50](https://github.com/isoloop/web/pull/50), [web#59](https://github.com/isoloop/web/pull/59), [web#61](https://github.com/isoloop/web/pull/61)).
- The head-to-head comparison in one command, runnable in Playwright's Docker image, with the M3d write-up from the final run on the bench server, and runs on a Galaxy Z Fold6 in Chrome 157, an iKKO MindOne in Firefox Focus 156 and an iPhone X in Safari 16.6 ([web#56](https://github.com/isoloop/web/pull/56), [web#67](https://github.com/isoloop/web/pull/67), [web#68](https://github.com/isoloop/web/pull/68), [web#72](https://github.com/isoloop/web/pull/72), [web#74](https://github.com/isoloop/web/pull/74)).
- Architecture diagrams of every build, published with the plant, and a notice when the browser isn't supported, instead of a blank page ([web#70](https://github.com/isoloop/web/pull/70), [web#71](https://github.com/isoloop/web/pull/71)).
