# Site

isoloop.dev's own pages ([ADR 0002](../../docs/adr/0002-site-build.md)): the landing page, the features, how it works, the examples hub, the changelog, and the docs (`/docs/` and `/docs/<slug>/`, one page per library guide). The examples themselves are built on their own and put next to these pages by [`scripts/assemble-site.sh`](../../scripts/assemble-site.sh).

- **Pages are Preact components**, rendered to static HTML at build time through `ui/render` ([ADR 0003](../../docs/adr/0003-design-system.md)). No framework code reaches the browser; the only script on a page is ui's theme script, plus a page's own enhancement modules (the live demos, the tabs, the docs' Copy button).
- **Every page carries** `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`, and every request is same-origin. The meta is left out in dev, where Vite injects inline styles.

| Path | What it is |
| --- | --- |
| `index.html`, `features/index.html`, `how-it-works/index.html`, `examples/index.html`, `changelog/index.html`, `404.html` | One-line stubs (`<!-- page:home -->`) that `build/plugin.ts` turns into whole documents |
| `src/pages/` | The pages, by name (`src/pages/index.ts`) |
| `src/copy.ts` | **The page-level text,** with the source of each figure in a comment above it (ADR 0002, decision 10) |
| `content/features/` | One entry per feature on `/features/` and the landing strip: its name, line, section text, its tab (which also sets its sticky note) ([ADR 0005](../../docs/adr/0005-page-navigation-and-status-marks.md)), `experimental` for the pill, `since`, and `proof` links to the code or tests behind it ([ADR 0004](../../docs/adr/0004-publishing-and-governance.md), decision 5) |
| `build/plugin.ts` | Renders the stubs, copies the hub's screenshots and the diagrams into the build, and emits `robots.txt` and `sitemap.xml` |
| `build/crawl.ts` | `robots.txt` (every crawler allowed, the sitemap named) and `sitemap.xml`: the site's pages and every deployed example, from the lists the build renders, so none is left out |
| `build/examples.ts` | Reads and validates every app's `example.json` (a zod schema); a bad one fails the build, naming the file and the field |
| `build/features.ts` | Validates the feature entries (zod) and checks every proof: the path, and the export or test title it names, at the library pin or in this checkout; a broken one fails the build, naming the entry and the path |
| `build/changelog.ts` | Builds `/changelog/` from every published library package's `CHANGELOG.md` at the pin and every app's, newest release first |
| `build/diagrams.ts` | Rewrites the library's Archify pages to run under the site's policy |
| `build/docs/render.ts` | `renderMarkdown()`: a docs page's Markdown to HTML, with its title, description, headings and links, and the only file that imports `markdown-it` (M4c). `render.test.ts` is the conformance suite any engine put behind it has to pass. `build/docs/highlight.ts` runs fences through the site's tokenizer |
| `content/docs.json` | The docs pages' sections and order (M4c, decision 11), validated with zod. It lists exactly the guides in `docs/guide` at the pin: a guide at the pin that isn't listed, or a listed one the pin lacks, fails the build. `leadPending` marks a guide whose lead is still several sentences (M4c task 5): its description is the first sentence, and the build fails once the mark is no longer needed |
| `build/docs/pages.ts` | Reads `docs.json`, matches it against the pinned guides and renders each through `renderMarkdown()`, with `build/docs/links.ts` rewriting links: another guide → `/docs/<slug>/`; ADRs, plans, source and the rest → GitHub at the pin; a relative link to nothing fails the build, naming the guide and the link |
| `build/docs/llms.ts` | The docs for agents (M4c, decision 16): `/llms.txt` (the llmstxt.org index: each page's `.md` link and description, then an Optional section), `/docs/<slug>.md` (the guide as fetched, its links made absolute: guides → their `.md` copy, the rest → GitHub at the pin; a relative link left fails the build) and `/llms-full.txt` (every guide in nav order). `e2e/llms.spec.ts` checks them as served |
| `src/pages/doc.tsx` | A guide's page in the docs layout (M4c task 11, from the approved mock): the section sidebar, the lead and meta line, "On this page", Previous and Next; and `/docs/`, every section and guide. Below 1100px the contents fold, below 760px the sidebar folds, both as `<details>`. The guide pages have no `index.html` stubs; `docInputs` in `build/plugin.ts` names a virtual one per guide. `experimental` in `docs.json` draws the pill. `src/demos/copy.ts` turns on the code blocks' Copy buttons |
| `build/library.ts` | Fetches the library's `docs/diagrams` and `docs/guide` at the sha in `library.lock`, and reads its other files at that sha (proofs, changelogs) |
| `build/pin.ts` | Checks the pin is a published version: every package at the pin on npm, and npm's provenance naming the pin as the commit it was built from (ADR 0006) |
| `scripts/` | `serve.ts` (static server, as Pages), `linkcheck.ts`, `screenshots.ts`, `fetch-library.ts`, `check-pin.ts` |
| `e2e/` | The smoke test, and `expectAccessible` (axe) |

## Running it

```bash
pnpm --filter site dev            # the site's own pages, with the diagrams
pnpm --filter site build          # dist/
```

The whole site as deployed, with the examples:

```bash
pnpm --filter "./apps/dashboards/*" --filter ./apps/basic --filter ./apps/processor --filter ./apps/site build
pnpm --filter ui build:specimens
SITE=1 scripts/assemble-site.sh site     # from the repo root; SITE=1 includes the site's pages
pnpm --filter site linkcheck ../../site
pnpm --filter site serve                 # http://localhost:4799/
pnpm --filter site smoke                 # Chromium smoke test against site/
```

Without `SITE=1`, `assemble-site.sh` includes the site only once a `site-v*` tag is reachable from `HEAD`, so the deployed root stays the placeholder until the first site tag.

## The library's diagrams

`library.lock` pins an `isoloop/isoloop` commit. The build clones that repo without blobs into `.library/` (git-ignored), checks the pin is on its `main` (so the diagrams passed the drift test there), and takes only `docs/diagrams` and `docs/guide`. A fetched pin is reused, offline too.

The pin must be a published version (ADR 0006): the commit a `chore: version` PR made, from 0.1 on the commit a `v*` tag points at. `pnpm --filter site check-pin` checks it against npm and runs in the site CI job; the build itself doesn't, so it works offline. To show newer diagrams and guides, change the sha in `library.lock` in a PR, after that version is published.

Archify's pages need three rewrites to run under `default-src 'self'` (`build/diagrams.ts`):
- **Style attributes** (`style="--step:N"`, one `fill`) become classes, with the declarations in a generated `dg-inline-<hash>.css`.
- **`data:` URLs** in the viewer's CSS (fonts, icons) become files next to the pages.
- **The viewer's `<style>` element** for its flow keyframes becomes a constructable stylesheet.

Anything else inline fails the build, so a re-render that brings something new is caught here.

## The hub

`/examples/` shows one example per tab (the step tabs `/how-it-works/` also uses: `src/pages/steps.tsx`, `src/demos/steps.ts`). Each app has an `example.json` next to its `package.json`; the schema is in `build/examples.ts`, and unknown fields fail, so a typo can't slip through:

- `title`, `tab` (its tab's short name), `summary` (what it is), `order`.
- `shows`: feature ids from `content/features/`, shown as the landing page's features strip. An id that isn't a feature fails the build.
- `try`: what to do in it, and what to watch.
- `measurements`, one of:
  - `measured`: blocks, each with an `id`, a `heading`, `findings`, a `caption` (device, browser, rounds, date), the `tag` the figures ship with, the run's `results` link, an optional `firefox` line and `notes`, and a table as `pairs` and `groups` (rows of A, B and Δ with its verdict, copied from the run's summary as written). A block of findings alone, for runs recorded by hand in one round, has no table. Plant's `desktop` block is also the landing and features pages' costs.
  - `in-progress`: a `note` and the `previous` run's link, while a new run is underway.
  - `none`: a `note`, and optionally `see`, a link to where the figures are.
- `links`: `live`, `source`, and optionally `results` and `architecture`.
- `screenshot`: `{ light, dark? }`, WebPs next to `example.json`. With both, the page shows the one for its theme (`data-theme`), switching live; an app that looks the same in both themes (the dashboards) has only `light`.

Screenshots: after building and assembling the site (above), `pnpm --filter site screenshots` writes each app's screenshots at 1280×800 and 2× density, at a fixed state: `screenshot-light.webp` and `screenshot-dark.webp` for apps that follow the theme (Basic, Processor; without the site header, and the processor after adding tasks), and one `screenshot.webp` for the dashboards. It serves the site on port 4798, or `SCREENSHOTS_PORT`, and stops if that port is taken. Run it when an app's look changes, check the images, and commit them. It isn't in CI: the dashboards' live data makes every run's images differ.

## Accessibility

The target is WCAG 2.2 AA (ADR 0002, decision 9). The smoke test runs axe on every page and on ui's specimens, failing on serious and critical findings; the contrast of the tokens is a unit test in `packages/ui`. The rest is checked by hand **before each `site-v*` tag**:

- [ ] Tab through each page from the top: every link and button is reached in reading order, and the focus ring is visible on each, in both themes.
- [ ] The theme toggle works by keyboard (Enter and Space) and says its state (pressed means dark).
- [ ] Inside the basic iframe, Tab reaches every Block, Crash and Restart button, and leaves the frame again.
- [ ] With a screen reader (VoiceOver or NVDA), each page's headings read as an outline, each table reads its caption and both headers, and each iframe has a name.
- [ ] At 200% zoom and at 320 px wide, nothing is cut off and only the tables scroll sideways.
- [ ] With reduced motion set, nothing animates on the site's own pages.
- [ ] Windows high-contrast mode (forced colours): borders and focus rings stay visible.
