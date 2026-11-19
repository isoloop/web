# ADR 0005: Page navigation and status marks

- **Status:** Proposed
- **Date:** 2026-11-19
- **Answers:** how a reader moves through a long page on the site, and how a feature that isn't stable yet is marked. Grilled 2026-11-19 (Q1–Q12), after a local prototype the maintainer reviewed. Amends [ADR 0002](0002-site-build.md) (the features page, the step tabs) and [ADR 0003](0003-design-system.md) (a status colour, the pill).

## Context

Three pages hold more than a screen or two:

- **`/how-it-works/`** walks through the runtime in 9 steps.
- **`/examples/`** has 4 examples.
- **`/features/`** has 12 features, each with its text and a figure, a live demo, code or a table, all on one long scroll.

The first two already use the step tabs (ADR 0002, amended 2026-11-18): a sticky row of links to each step's `#id`, one step shown at a time, everything shown without JS. `/features/` had no way through it but scrolling, and a list of all 12 features at the top pushed the first feature below the fold.

Three features are experimental: automatic placement (`@isoloop/balancer`), tools for agents and devtools. That was said only in prose. Their strip lines started with "Experimental:", and their section text said it again. A reader skimming the names couldn't tell which ones were stable.

The step tabs also had a bug. Marking the current tab called `scrollIntoView` on it, which keeps the tab row in view but also scrolls the page when the row is below the fold.

The maintainer asked for other ways through a page to be looked at before settling on tabs.

## Decision

### 1. One navigation system, the step tabs, on all three pages

The step tabs stay the one pattern for a long page: a sticky row under the header, one panel at a time, `#id` links that survive reloads and the back button, everything shown in order without JS.

- **How it works** stays as it is: its steps form a sequence, closed by Previous and Next.
- **Examples** stay as they are: 4 examples, one tab each.
- **Features** gets the same tabs, one per group of features (decision 2).

All three run one script, `src/demos/steps.ts`. It gains two things:

- **A hash that names something inside a panel**, such as `/features/#balancer`, opens that panel and scrolls to the target. So the landing page's strip and the examples' "What it shows" keep linking straight to a feature.
- **The tab row scrolls sideways only.** Marking the current tab no longer moves the page.

### 2. Features in six tabs

| Tab | Features | Colour (its part) |
| --- | --- | --- |
| Isolation (`#isolation`) | containment, restart and catch-up | isolate |
| Bus (`#messaging`) | the message bus, retention and replay, durable history | bus |
| Placement (`#pools`) | placement, automatic placement | pool |
| Tools and frameworks (`#tools`) | tools for agents, devtools, your framework | host |
| Safety (`#security`) | safety | host |
| Cost (`#costs`) | what it costs | cost |

- **The tab is data:** each feature entry carries `tab`, validated by the schema in `build/features.ts`. The schema's list of tabs sets their order. A tab added there fails the type check until `src/pages/features.tsx` gives it a colour.
- **The tab anchors differ from every feature id** (`#messaging`, not `#bus`), so a link names either a tab or a feature, never both.
- **Each panel holds its features' gutter sections** as before, with their headings sticky below the header and the tab row.
- **The list of all 12 features at the top of the page is gone.** The tabs and the blueprint (decision 3) cover the same ground. The landing page keeps its strip.

### 3. The page opens with a blueprint

In place of the lede and the changelog link, `/features/` opens with a blueprint of the system (`src/pages/feature-map.tsx`), drawn on a grid with dashed boxes in the part colours:

- **main thread, the kernel:** safety, tools for agents
- **bus, its own worker:** the message bus, retention and replay, durable history, joined to the main thread by a dashed wire
- **isolate, its own worker:** containment, restart and catch-up, your framework
- **pool, one worker and several isolates:** placement, automatic placement
- **devtools, an isolate of its own:** devtools
- **along the bottom,** as a dimension line, "CPU, memory, start-up" leading to "What it costs"

Every title links to its feature. The layout is CSS grid:

| Screen | Layout | Height |
| --- | --- | --- |
| Wide | two rows | about 270 px at 1400 px wide |
| About 1000 px | two columns | |
| Phone | one column | |

At 1400 px wide, the title, the blueprint, the tabs and the start of the first feature fit on the first screen.

- **Where a feature sits is data:** each entry carries `blueprint` (`host`, `bus`, `isolate`, `pool`, `devtools` or `cost`), validated by the schema. Each box draws the features that name it, so a new feature can't be left off. A test checks that every feature appears on the blueprint exactly once.
- **The placements were checked against each entry's proofs** at the library pin:
  - Safety's DOM registry (`createRegistry`, which sanitises every write) is in `@isoloop/host`, on the main thread. The grants it enforces are declared in `@isoloop/protocol`.
  - Tools for agents are built by the host's `buildTools`.
  - Framework adapters are `defineIsolate`, which runs inside the isolate.
  - Devtools "restarts after a crash, like any isolate" (its test).

  Restart and catch-up sits on the isolate, as its `part` already says. The kernel's supervisor drives it from the main thread, but it's the isolate that restarts and catches up.
- **The lede goes, principle line included.** "Code that shares data shouldn't share an event loop" isn't moved anywhere else: the maintainer's call is that a slogan narrows the page to a sales pitch, and the blueprint says more. The changelog stays one click away in the footer.

### 4. Experimental is a pill, from data

- **A feature entry carries `experimental: true`.** It's set today on `balancer`, `agents` and `devtools`. Their strip lines drop the "Experimental:" prefix. The sentence in their text that says so, and why, stays.
- **The pill shows wherever a feature's name does:**
  - the landing strip
  - the blueprint
  - the section heading on `/features/`
  - "What it shows" on each `/examples/` tab

  One component, `src/pages/pill.tsx`, renders all of them from that field.
- **Only on feature names.** No pill goes on a tab, since a tab holds stable features too, and none on an example as a whole.
- **The pill is `.ui-pill` in `packages/ui`:**
  - an outlined capsule
  - small capitals at 0.72rem, smaller inside the tag chips
  - the text and the outline both in `--ui-experimental`

### 5. A status colour (amends ADR 0003, decisions 3 and 8)

- **New primitives:**
  - `--ui-orange-1`: `oklch(0.56 0.15 50)`, `#b75400`
  - `--ui-orange-2`: `oklch(0.8 0.13 62)`, `#f9aa60`
- **One new semantic token:** `--ui-experimental` is orange-1 in light and orange-2 in dark, in both dark blocks.
- **Contrast, by the existing test:** `--ui-experimental` on `--ui-bg` and on `--ui-surface` must reach 4.5:1, since it colours small text.

  | Theme | On `--ui-bg` | On `--ui-surface` |
  | --- | --- | --- |
  | Light | 4.60 | 4.93 |
  | Dark | 8.83 | 8.06 |

- **It means only "not stable yet" on the site's pages.** The dashboards have their own orange (`#f0a35e`, in their fixed-dark header) for React and Preact on one page. It's close to the dark `--ui-experimental` in hue, but the two never share a page: the dashboards take only ui's bar, and the pill is drawn only by the site.

## Consequences

- One script and one look for every long page. A fix to the tabs, like this one's to the scrolling, reaches all three pages.
- `/features/` opens on a picture of the whole toolchain and its first feature. Each group of features is a tab away, not a long scroll.
- The blueprint is a second explanation of where things run, next to how it works's diagrams. It must stay true, which is why each entry's place is data and checked by a test, not drawn by hand.
- Experimental is now said once, in data, and shown the same way on every page. When a feature becomes stable, its entry drops the field and the pill goes everywhere at once.
- (Bad) Find-in-page no longer finds a feature in a hidden tab, as on the other two pages. A reader who wants every feature at once has the no-JS view, or the landing strip.
- (Bad) The 4.60:1 light contrast leaves little room. A later change to `--ui-bg` could break it, though the test would catch that.

## Alternatives considered

- **12 flat tabs on `/features/`:** on a phone the row scrolls sideways with most tabs out of view, and a tab per feature gives each one a near-empty page.
- **One long page with a sticky contents bar that follows the scroll** (prototyped as `?nav=contents`):
  - Find-in-page keeps working and nothing is hidden.
  - But the page stays as long as before, and on a phone the bar of 12 names, three with pills, is crowded.
- **One page per feature** (`/features/containment/`):
  - Each feature gets its own URL and preview image.
  - But it costs 12 more pages to build and keep up, and a click per feature.
- **5 tabs, with safety inside "Tools and frameworks"** (prototyped): it mixes tools you add with a property the kernel always enforces. Safety reads as its own subject.
- **Keeping the list of all 12 features above the tabs** (prototyped): it repeats the tabs and pushed the first feature off the first screen.
- **Sticky notes in place of the blueprint** (prototyped as `?intro=notes`, not kept in code):
  - A board of tinted, slightly tilted notes, one column per tab.
  - The maintainer liked them too, and they may come back.
  - The blueprint was chosen because it says where each feature runs as well as naming it.
- **"Experimental" in prose only:** that was the status quo, and it's easy to miss when skimming names.

## Not in this ADR

Running each app's E2E only when its own runtime inputs change is a CI rule, not a site decision. It's a separate PR. Today `example.json`, the screenshots, `packages/ui` CSS and a lockfile change made for `apps/samples` all start every app's E2E: 15 jobs on each of web#165, #171 and #180.
