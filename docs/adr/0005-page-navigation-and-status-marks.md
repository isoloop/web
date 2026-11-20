# ADR 0005: Page navigation and status marks

- **Status:** Proposed
- **Date:** 2026-11-19
- **Amended:** 2026-11-20, by [ADR 0006](0006-docs.md) (decision 1a: "Docs" joins the header's nav after Examples; Proposed); 2026-11-20 (decision 4: in navigation lists the experimental mark is a compact round "!"; see [the amendment](#amended-the-compact-mark-in-navigation-lists-2026-11-20)); 2026-11-20 (decision 1a: Docs right after Home, and the library version as a pill before GitHub; see [the amendment](#amended-docs-first-and-the-version-pill-2026-11-20))
- **Answers:** how a reader moves through a long page on the site, and how a feature that isn't stable yet is marked. Grilled 2026-11-19 (Q1–Q12), after a local prototype the maintainer reviewed. Amends [ADR 0002](0002-site-build.md) (the features page, the step tabs) and [ADR 0003](0003-design-system.md) (a status colour, the pill, the header's GitHub link).

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

### 1a. The header: pages, then what isn't a page (amends ADR 0003, decision 7)

The header's nav lists only the site's pages: Home, Features, How it works, Examples. GitHub isn't one of them, so it moves to the far end, beside the theme switch:
- GitHub's mark and "GitHub"; the mark alone below 760px.
- Its accessible name is "Isoloop on GitHub".
- The mark is Octicons' `mark-github` (MIT), inline as an SVG path.

The dashboards' bar is unchanged.

#### Amended: Docs first, and the version pill (2026-11-20)

The maintainer's review before the docs go live:
- **The nav:** Home, Docs, Features, How it works, Examples. Docs is where people who already know Isoloop go most, so it comes right after Home. This replaces ADR 0006's place for it, after Examples.
- **The version:** the `@isoloop/*` version the site is built from (`library.lock`) is a pill at the far end, before GitHub, linking to the changelog. It replaces the row under each docs page's title, which also linked the guide's source on GitHub and its Markdown copy. The Markdown copies stay, for `llms.txt`.

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
- **The list of all 12 features at the top of the page is gone.** The tabs and the sticky notes (decision 3) cover the same ground. The landing page keeps its strip.

### 3. The page opens with sticky notes

_Amended 2026-11-19: the notes replace the blueprint this decision first chose; the blueprint is kept under the alternatives for later._

In place of the lede and the changelog link, `/features/` opens with a board of sticky notes (`src/pages/feature-notes.tsx`):

- **One column per tab,** in the tabs' order, titled with the tab's name in its colour. The title opens that tab.
- **One note per feature,** tinted in its tab's colour and slightly tilted, with the Experimental pill where it applies. A note opens its feature.
- **Six columns on wide screens, three at about 1000 px, two on a phone.** At 1400 px the title, the notes, the tabs and the start of the first feature fit on the first screen.
- **Where a feature's note goes is its `tab` field,** so a new feature can't be left off. A test checks that every feature has exactly one note.
- **The pill sits on the page's background inside a note.** On the note's tint alone, `--ui-experimental` falls short of AA.
- **The lede goes, principle line included.** "Code that shares data shouldn't share an event loop" isn't moved anywhere else: the maintainer's call is that a slogan narrows the page to a sales pitch. The changelog stays one click away in the footer.

### 4. Experimental is a pill, from data

- **A feature entry carries `experimental: true`.** It's set today on `balancer`, `agents` and `devtools`. Their strip lines drop the "Experimental:" prefix. The sentence in their text that says so, and why, stays.
- **The pill shows wherever a feature's name does:**
  - the landing strip
  - the sticky notes
  - the section heading on `/features/`
  - "What it shows" on each `/examples/` tab

  One component, `src/pages/pill.tsx`, renders all of them from that field.
- **Only on feature names.** No pill goes on a tab, since a tab holds stable features too, and none on an example as a whole.
- **The pill is `.ui-pill` in `packages/ui`:**
  - an outlined capsule
  - small capitals at 0.72rem, smaller inside the tag chips
  - the text and the outline both in `--ui-experimental`

#### Amended: the compact mark in navigation lists (2026-11-20)

In navigation lists, the docs sidebar and later the API reference's symbol lists, the experimental mark is a compact round "!" (`ExperimentalMark` in `packages/ui`, an inline SVG in `--ui-experimental`) with a visually hidden "Experimental" label and a tooltip, so it never relies on colour alone. The full pill stays on the page heading (an experimental guide's h1) and on the `/docs/` index. The mark is a graphic, so `--ui-experimental` against the page and the surface is held to 3:1 by the contrast test, on top of the pill's 4.5:1.

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
- `/features/` opens on every feature at a glance, by group, and its first feature. Each group of features is a tab away, not a long scroll.
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
- **A blueprint of the system** (shipped first in web#188, then replaced by the notes):
  - The system drawn on a grid with dashed boxes in the part colours, each feature in the part it runs in: the main thread (safety, tools for agents), the bus worker (bus, retention and replay, durable history), an isolate (containment, restart and catch-up, your framework), the pool (placement, automatic placement), devtools' own isolate, and the cost as a dimension line along the bottom.
  - Each placement was checked against the feature's proofs: safety's DOM registry is the host's `createRegistry`; tools for agents are the host's `buildTools`; framework adapters are `defineIsolate`, inside the isolate.
  - The maintainer liked it and may bring it back. Its code, and the `blueprint` field that placed each feature, are in web#188 (`9d6989b`).
- **"Experimental" in prose only:** that was the status quo, and it's easy to miss when skimming names.

## Not in this ADR

Running each app's E2E only when its own runtime inputs change is a CI rule, not a site decision. It's a separate PR. Today `example.json`, the screenshots, `packages/ui` CSS and a lockfile change made for `apps/samples` all start every app's E2E: 15 jobs on each of web#165, #171 and #180.
