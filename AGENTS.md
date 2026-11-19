# isoloop/web

The Isoloop website (`isoloop.dev`), the examples, and the design system, built on the published `@isoloop` packages. What this repo is: [ADR 0001](docs/adr/0001-what-this-repo-is.md). How changes get published and checked: [ADR 0004](docs/adr/0004-publishing-and-governance.md).

## Where things are

- **`apps/site`:** isoloop.dev; feature entries in `apps/site/content/features`, code samples in `apps/samples`.
- **`apps/basic`, `apps/dashboards/{plant,markets}`, `apps/processor`:** the examples. Each has its `example.json` (the examples page), its `e2e/`, and, where measured, `comparison/` with the results.
- **`packages/ui`:** the design system. **`packages/compare`:** the dashboards' comparison. **`packages/creator`:** the interactive pages' widget creator.
- **`docs/adr`**, **`docs/plans`**, **`docs/brand.md`**. The library, its guides and its milestones are in [`isoloop/isoloop`](https://github.com/isoloop/isoloop).
- **`.claude/skills/publish`:** site copy for a shipped change. **`.claude/agents/steward.md`:** the PR review CI runs.
- **A running app:** markets pairs with `isoloop mcp` in development, so an agent can read its isolates and call its tools ([its README](apps/dashboards/markets/README.md)).

## Definition of done

A change is done when all five hold:

1. **Tests** cover it, and CI is green.
2. **A changeset** describes it for the app's changelog (`pnpm changeset`). An internal-only change (tests, CI, refactors nobody sees) takes the `no-changeset` label instead.
3. **Docs** match it: the app's README, or `docs/` for repo-wide behaviour.
4. **Site impact** closes the PR description: `none`, `update needed`, or `done in web#N`. Site-worthy means a new capability or a behaviour change users see, a new example or app, new or changed measurements, copy the change makes wrong, or a newly found limitation.
5. **When Site impact is `update needed`,** run the `publish` skill in the same session, while the context is fresh.

## Copy and claims

- **Positioning:** Isoloop is a complete toolchain: containment, restart and catch-up, a bus with retention, replay and durable history, placement as a switch; framework-agnostic, with React and Preact adapters. It costs CPU, memory and start-up time, and the site says so plainly.
- **Performance is a measurement:** device, build, tag, and the numbers. Compare Isoloop with native as measured results, in both directions.
- **Every claim is checked** against the code or a test before it ships. Feature entries carry proof links.
- **The maintainer reviews copy, ADRs and these rules.** Forks merge their own code and tooling PRs on green.
- **One PR per task** from a plan's task table.

## Releases

- **Tags are pushed by the maintainer, or on the maintainer's explicit word for that release.**
- **Each deploy tag goes on its own commit.** Pages names a deployment after its commit, so a second deploy of the same commit leaves the first one live.
- **After a deploy,** check the live pages once the CDN serves them (it caches for up to 10 minutes and ignores query strings).

## Look and build

The design system, the site's build and the brand are in [ADR 0002](docs/adr/0002-site-build.md), [ADR 0003](docs/adr/0003-design-system.md) and [`docs/brand.md`](docs/brand.md). Pages run under `default-src 'self'`: scripts and styles as same-origin files, every request same-origin.
