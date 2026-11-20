# site

## 0.6.0

### Minor Changes

- 8372ee3: The docs have a Reference section: the API of every `@isoloop/*` package, one page each at `/docs/api/<package>/`, generated from the published types, plus the `isoloop` command line and a Kernel config link to `KernelConfig`. An experimental export shows the Experimental pill, and each API page is in `llms.txt` and `llms-full.txt` with a Markdown copy at `/docs/api/<package>.md`.
- 5d44106: The docs are reachable: "Docs" is in the header right after Home, and opens `/docs/`, which lists every section and guide with its one-line description. Each guide's page has the docs layout: the section sidebar with the current page marked and the Experimental mark on the balancer and the devtools panel, the lead, "On this page" on the right, code blocks with a Copy button, and Previous and Next. Below 1100px the contents fold under the lead, and below 760px the sidebar folds into a "Docs" block at the top. The footer links `/llms.txt`, and the docs pages are in the sitemap.
- 5a6c2dd: The docs have all fourteen guides of `0.1.0-next.8`, in three sections: Start (Getting started, What Isoloop can't hide), Build and Agents and tooling.
- f7d652c: The header shows the `@isoloop/*` version the site is built from as a pill before GitHub, linking to the changelog.

### Patch Changes

- 580d5be: On `@isoloop/devtools@0.1.0-next.8`. The Devtools entry on /features/ says what the panel shows now: the health ring round its button, four tabs (Isolates with its pools, Bus, Events, Messages), and the kernel's events kept for the whole page session and the last three before it.
- 4497c63: In the docs sidebar an experimental guide gets a compact round "!" mark after its name, with a tooltip and a hidden "Experimental" label, in place of the full pill. The pill stays on the guide's heading and on `/docs/`.
- b5885ab: The site says consumer groups and request and reply are experimental in 0.1, as the library marks them from 0.1.0-next.9.
- 7951c26: The site's build writes the docs for agents: `/llms.txt` in the llmstxt.org format, listing each docs page with its description; a Markdown copy of each page at `/docs/<slug>.md`, with its links made absolute; and `/llms-full.txt`, every guide in nav order.
- 37b9249: The docs sidebar's Experimental mark sits after a title's last word, so a title that wraps ends in it.
- 8dc2d1c: The site builds from `isoloop/isoloop` at `0.1.0-next.7`'s version commit, so `/changelog/` includes `0.1.0-next.7`. The build now fetches the library's guides as well as its diagrams, and CI checks that the pin is a published version: every package on npm, with npm's provenance naming the pin as the commit it was built from.
- 35c7883: The Tools for agents, Balancer and Devtools entries on /features/ no longer list an ADR among their proofs: a proof is code or a test.
- b5885ab: The site and the plant dashboard use the kernel's snake_case event `bus:durability_degraded` (`@isoloop/*` 0.1.0-next.9).

## 0.5.3

### Patch Changes

- c4bd116: `/features/`: **Tools for agents** says what a burst of calls past a tool topic's retention does: on a topic that keeps 100 records, 1,000 calls at once get 100 answers, and since `0.1.0-next.7` the 900 that retention removed before any isolate got them fail at once with `dropped` (isoloop#303). It replaces the sentence that said the cause wasn't confirmed. The library pin moves to isoloop/isoloop `3c354e8`, which has the change.

## 0.5.2

### Patch Changes

- a9330cf: isoloop.dev has a `robots.txt` and a `sitemap.xml`, listing every page and every live example, so search engines can find them all.
- 54f306c: The balancer's table on /features/ matches the library's guide: a backlog moves an isolate after it rises over two 10 s windows in a row, a second quarantine pool folds into the first to free a worker for it, a quiet pool packs back one isolate at a time, and an isolate that has used its 3 moves in 5 minutes can stay in the quarantine past its quiet window.

## 0.5.1

### Patch Changes

- 210babe: `/features/` opens with sticky notes in place of the blueprint: one column per tab, one note per feature in its tab's colour, the Experimental pill on the notes that need it. A column's title opens its tab; a note opens its feature.
- 4abda7f: The landing intro and the meta description say what Isoloop is in the shared message (docs/brand.md, Messaging): each part of your app runs on its own worker or in a shared pool, talks over a message bus, and is restarted when it fails, while the rest keeps running. The link-preview card's line says the same.

## 0.5.0

### Minor Changes

- 9d6989b: `/features/` in six tabs (Isolation, Bus, Placement, Tools and frameworks, Safety, Cost), opened by a blueprint of the system with each feature on the part it runs in. Experimental features carry an orange Experimental pill wherever their name shows: the landing strip, the blueprint, the feature headings and each example's "What it shows". The tabs on every page no longer scroll the page when they mark the current tab. In the header, GitHub moves out of the page links to sit beside the theme switch.

### Patch Changes

- a10e25d: `/features/`: **Tools for agents** says what one call costs the page, measured on the plant dashboard with `0.1.0-next.5`: the round trip in Chromium and Firefox and the main-thread time per call in Chromium, idle and at 5 kHz, and that a burst of 1,000 calls didn't complete on a topic keeping 100 records. The library pin moves to isoloop/isoloop `a07fa70`, which has the write-up.

## 0.4.0

### Minor Changes

- 3d8aa6b: `/features/` gains an eleventh feature, **Tools for agents** (experimental): a requestable topic with a `tool` description, listed in `agents.expose`, becomes a tool a coding agent calls through `npx isoloop mcp` in development, or a browser's agent through `@isoloop/webmcp` where the browser has WebMCP (Chromium 158 and Firefox 159, both behind a flag). It has a type-checked sample, links to the Agents guide and to the markets dashboard's two tools, and says what the hints don't do and what Firefox's agent doesn't see. The landing page's strip lists it too, and the install block gains `@isoloop/webmcp@next`. The library pin moves to isoloop/isoloop `c8279f6`, which has the Agents guide.
- 9551bb6: `/features/` gains a twelfth feature, **Devtools** (experimental): `connectDevtools` from `@isoloop/devtools` adds a panel in the page with the isolates and their controls, the bus, and a live record log, drawn by an isolate of its own that keeps working through a bus restart and lists itself. It says where memory per isolate is measured, that nothing gates the controls in production, and what the feed costs unread, with a type-checked sample, the devtools guide, and a link to the plant dashboard with the panel open. The landing page's strip lists it, the install block gains `@isoloop/devtools@next`, and the plant and markets tabs on `/examples/` list it with a step to try.

## 0.3.1

### Patch Changes

- 16dda70: /how-it-works/: the Rendering step shows the library's new diagram of a visual isolate's frame, with its "Reading the diagram" text. Its list of events that reach the worker now includes scroll, at most one per frame for each scrolled element; it had said scroll wasn't forwarded.

## 0.3.0

### Minor Changes

- e6d0eec: `/features/` gains a tenth feature, **Automatic placement**: `@isoloop/balancer` (experimental), what moves an isolate with the defaults, a type-checked sample, and links to the balancer guide and the processor example. It's on the landing page's strip too, and the install block lists `@isoloop/balancer@next`.
  
  Retention and replay, and Restart and catch-up, say that a consumer group that has committed resumes after its commit whatever `from` says (isoloop#224). The library pin moves to isoloop/isoloop `34aeead`, so `/changelog/` lists the library's `0.1.0-next.0` and `0.1.0-next.1`.
- 774e9c6: The landing page's recording folds out the code behind the demo: basic's setup (`main.ts`, `counter.ts`, `topics.ts`) as tabs, type-checked against the published packages. Every code block on the site is syntax-highlighted at build time, with no script in the browser. The recording's status is a labelled row of its own, C and D's row names no longer sit under their bars, and the caption above it is shorter.
- c64312b: `/examples/` shows one example per tab, as `/how-it-works/` does: what it is, a full-width screenshot, what it shows, what to try, and its measurements, findings first and then an A/B/Δ table with what it was measured on. Plant has its desktop, phone and interactive-page runs; Markets its main and two-team runs; Basic says why it isn't measured; the processor's new run is marked as in progress. The landing and features pages' costs table now reads the plant's figures from the same place.
- 3c2093b: `/how-it-works/` is a walkthrough of the runtime instead of a row of diagrams, one step at a time behind a row of step tabs: the overview, the host and its isolates, workers and pools, topics and the bus, rendering from a worker, the supervisor, restarts and catch-up, persistence and bus crashes, and grants. Each step has short type-checked code and, where it helps, the diagram drawn from the library's code, at the page's full width as the drawing alone, sized so all of it shows (Open full size has the viewer's presentation mode and controls), and described in words: its parts, then its arrows in order. The diagrams' own titles now show in their frames' names and links. The landing page's link to it now reads "How it works, part by part". Code inside prose is set as a chip on every page, so it reads apart from the words around it.
- bf05f42: The landing page says what Isoloop is: an open-source TypeScript library, framework-agnostic with React and Preact adapters, under the headline "Event-loop isolation for JavaScript apps". "What it's for" lists six patterns with an example each. "What it gives" shows behaviour only, with the opt-in `split` placement. "What it costs, and where it helps" is an A/B/Δ table from the desktop run, with both native builds, the native baseline stated, and one table per pair on narrow screens; `/features/` uses the same table. "How it works" explains the host, workers, bus and supervisor, with a link to the diagrams. The Examples section is gone, and Install says Isoloop runs in the browser. The Features strip calls the frameworks line framework-agnostic, and the link-preview cards carry the new headline.

### Patch Changes

- c8dca63: `/changelog/` lists every app's releases back to its first tag: the releases before Changesets, written afterwards from the git history, the tags and their PRs. App releases are in the order their tags were made, so releases tagged the same day appear in the order they shipped.
- d83023d: The landing page's "What it's for" says "Containing code you don't control" (widgets from other teams, AI-generated components) instead of "Running code you don't fully trust", and the features page's Safety opens with the threat model: isolates share the origin's cookies and storage, so Isoloop contains unreliable code, not hostile code; for that, a cross-origin iframe.

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
