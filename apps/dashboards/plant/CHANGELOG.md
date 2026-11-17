# plant

## Before Changesets

The sections below were written on 2026-11-17 from the git history, the release tags and their PRs ([ADR 0004](../../../docs/adr/0004-publishing-and-governance.md), step 8). Changesets writes each release's section from the next one on. Each release is tagged `plant-v<version>` and deployed to isoloop.dev from that tag. A deploy builds every app at its commit, so a change can go live with another app's tag first; each change is listed under the first `plant-v*` tag that includes it.

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
