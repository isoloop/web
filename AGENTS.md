# isoloop/web

The Isoloop website (`isoloop.dev`), the examples, and the design system, built on the published `@isoloop` packages. What this repo is: [ADR 0001](docs/adr/0001-what-this-repo-is.md). How changes get published and checked: [ADR 0004](docs/adr/0004-publishing-and-governance.md).

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
- **Every release tag deploys the commit it's on, and Pages keeps the first deploy of a commit.** A second deploy of the same commit leaves the first one live. When tags share a commit, such as a release PR's merge, push `site-v*` first, so the first deploy of that commit is the complete one, then the app tags, one per push.
- **After a deploy,** check the live pages once the CDN serves them (it caches for up to 10 minutes and ignores query strings).

## Look and build

The design system, the site's build and the brand are in [ADR 0002](docs/adr/0002-site-build.md), [ADR 0003](docs/adr/0003-design-system.md) and [`docs/brand.md`](docs/brand.md). Pages run under `default-src 'self'`: scripts and styles as same-origin files, every request same-origin.

## Delegating work

When a session hands a task to a subagent:

- **A fork of the session** (same model, the whole conversation) for work that needs judgement: ADRs and other decisions, design, public API, generators and checks, changes across several packages, and anything that may contradict an ADR or a plan.
- **A fresh agent on a smaller model** (Sonnet today) for a well-specified task with checks behind it: a guide from a plan's task row, site plumbing, a mechanical fix. It sees none of the conversation, so its brief names the task, the plan row, the files to read (this file, the docs rules, the skill it needs), its worktree, and what it may merge.
- **Either way,** one PR per task, and the rest of this file applies as written.
