# ADR 0004: Publishing and governance

- **Status:** Accepted
- **Date:** 2026-11-17
- **Extended:** 2026-11-20, by [ADR 0006](0006-docs.md) (decisions 2, 4 and 6: the library's `docs` skill and `docs/writing.md`, `docs:check` in the hook and CI, the steward reviewing docs and a weekly docs drift pass)
- **Amended:** 2026-11-20, decision 6: the maintainer's approval gets its own label, `maintainer-approved`, apart from `steward-override` (see [the amendment](#amended-two-labels-for-the-maintainer-2026-11-20))
- **Amended:** 2026-11-22, decision 6: the steward reviews search (see [the amendment](#amended-the-steward-reviews-search-2026-11-22)); Proposed
- **Answers:** how a shipped change reaches the changelogs and `isoloop.dev`, who checks it, and what keeps the site in order. Grilled 2026-11-17 (Q1–Q14, G1–G14). Covers `isoloop/isoloop` and `isoloop/web`.

## Context

Between `site-v0.1.0` (2026-11-14) and this ADR, both repos shipped a lot, and none of it was tracked in a way anyone could read:

- **The library:** 84 changeset files in `.changeset/`, but Changesets was never set up. There's no `config.json` and no `CHANGELOG.md`, every package is at `0.0.0`, and prereleases go out as `0.0.0-next.<sha>`.
- **web:** no changelog at all. The features on the site are hand-written in one `copy.ts`, far from the code they describe, and one claim about restarts was wrong in four places before anyone noticed.
- **The rules** (positioning, neutral wording, releases) lived only in one agent's memory and in the briefs it wrote for forks.

Most changes are made by agents. Instructions alone get followed most of the time, not every time. So the setup has to make the right thing the easy path, check it mechanically where it can, and put judgement where it can't.

## Decision

### 1. Three changelogs, one source each

| Layer | Source | Readers |
| --- | --- | --- |
| Package changelogs | Changesets in `isoloop/isoloop`: a `CHANGELOG.md` per `@isoloop/*` package | npm users |
| App release notes | Changesets in `isoloop/web`: a `CHANGELOG.md` per app (basic, plant, markets, processor, site), and a GitHub Release per app tag | people following the demos and the site |
| "What's new" | `/changelog/` on the site, built from both | everyone |

- **Library:**
  - Changesets is set up now, ahead of M4, with every `@isoloop/*` package in one fixed group ([`isoloop/isoloop` ADR 0011](https://github.com/isoloop/isoloop/blob/main/docs/adr/0011-dom-package.md)).
  - It's in **pre mode `next`**, so prereleases are versioned `0.1.0-next.N` and write a changelog section each time.
  - The 84 existing entries are merged into one honest "Before 0.1.0-next.1" section per package, describing the package as it is today. The changelog is incremental from there.
- **web:** each app's `package.json` version tracks its tag (`privatePackages: { version: true, tag: false }`), so our `plant-v*` tag scheme stays. An app tag's release run creates a GitHub Release whose text is that app's changelog section.
- **`/changelog/`:** built at site build from every package's changelog (fetched at the library pin, like the diagrams) and every app's changelog. Grouped by release, newest first, each entry labelled with its package or app, and linked from the footer and from `/features/`.

### 2. A definition of done

A change is done when it has:
1. tests
2. a changeset
3. docs for anything public: the guide or TSDoc
4. an honest **Site impact** line
5. if that line says "update needed": the follow-up in `isoloop/web`, opened **in the same session** with the publish skill (decision 5), while the agent still has the context

`AGENTS.md` in each repo states this. `CLAUDE.md` imports `AGENTS.md`.

### 3. Site impact

Every PR in both repos ends with **Site impact:** `none`, `update needed`, or `done in web#N`. A change is site-worthy when it brings any of:
1. a new user-visible capability, or a behaviour change in the public API
2. a new example or app
3. new or changed measurements
4. a change that makes existing site copy wrong, including removing something
5. a newly found limitation

Everything else goes only into the changelog. The authoring agent decides; the steward (decision 6) checks the decision.

### 4. Gates, from soft to hard

| Layer | Checks |
| --- | --- |
| `AGENTS.md` | the definition of done (decision 2) |
| Claude Code hooks, committed in `.claude/settings.json` | before `gh pr create`: a changeset is present and the Site impact line is valid. Blocks with a message, so an agent fixes it before CI |
| CI, both repos | a changeset when `packages/*` or `apps/*` change (opt out with a `no-changeset` label for internal-only changes); a valid Site impact section |
| CI, library only | the **API check**: our own script diffs each package's built `.d.ts` against `main`. A public API change requires a changeset of at least minor, a change under `docs/` or in TSDoc, and a Site impact other than `none`, unless the export is `@internal`. No new dependency |
| The steward on each PR | judgement: is the Site impact right, do the docs match the change, do the claims hold |

### 5. The publish skill

`web/.claude/skills/publish/SKILL.md`, committed. It's run when Site impact says "update needed", and it covers:
- what's site-worthy, and where each kind of update goes: features, an example card, results, how it works, the changelog
- writing to the rules, every claim checked against code or tests
- assets: `pnpm screenshots`, link previews
- checks: the site job, the link check, axe
- the steward's review
- a copy PR to the maintainer
- after the maintainer's OK: a release tag on a fresh commit, then a live check once the CDN serves it

**Feature entries become data,** like `example.json`. Each feature on `/features/` is `apps/site/content/features/<id>.json`:
- title, claim, section text, which demo it uses, and `since`
- **proof links**: library files or tests at the pinned sha

CI fails if a proof path no longer exists at the pin. Page-level copy stays in `copy.ts`.

### 6. The site steward

One reviewing and governing role, defined in `web/.claude/agents/steward.md`.

- **What it owns:**
  - reviewing every PR in both repos: claims against code, the rules, accessibility, CSP, links, the changeset, the Site impact line
  - keeping publishing in order: every "update needed" gets its follow-up; the changelogs, `/changelog/` and the feature entries agree; releases follow the checklist
  - the site's infrastructure: deploy and release workflows; certificate, DNS and HTTPS health; the CSP staying `default-src 'self'`; page weight; the library pin's freshness; dependency updates for `web`; external links; stale screenshots
- **Where it runs:**
  - **on every PR** in both repos, through `anthropics/claude-code-action` pinned by sha. It posts one review and a check, and the check **fails on must-fix findings**. The maintainer can override with a `steward-override` label (and see [the amendment](#amended-two-labels-for-the-maintainer-2026-11-20) for `maintainer-approved`).
  - **every Monday,** as a scheduled cloud routine after the weekly CI: one "Site health" issue with a checklist, plus at most 5 PRs. Anything urgent (the site down, the certificate expiring within 14 days) is named in the issue title.
  - **on demand,** as the publish skill's reviewer
- **What it may do:**
  - always: open issues and PRs, review, request changes
  - merge its own **mechanical** PRs on green: the library pin bump, a link fix, a screenshot refresh, `web` dependency updates
- **What stays with the maintainer:** merging copy, ADRs and rules; pushing tags; repo settings, Pages, DNS and environments; spending image-generation credits.

### 7. The Publishing queue

A workflow reads each merged PR's Site impact line in both repos. "Update needed" adds a `site-impact` label and an entry in one pinned **"Publishing queue"** issue in `web`, with a link. The publish skill ticks entries off, and the Monday audit chases anything older than a week.

### 8. After a deploy

A CI job checks the live pages once the CDN serves the new version, and reports in the release run. Each deploy tag goes on its own commit: GitHub Pages names a deployment after its commit, so a second deploy of the same commit doesn't replace the first (seen on 2026-11-14).

### Amended: two labels for the maintainer (2026-11-20)

Since [ADR 0006](0006-docs.md), the steward reports changes that need the maintainer (a new or removed guide page, a restructure, an ADR or an amendment, `docs/writing.md`, a skill, the steward's own rules) as a must-fix titled "Needs the maintainer". Clearing that with `steward-override` skipped the whole review, so approving a page also switched off the check that catches real bugs in it. Two labels now do the two jobs:

- **`maintainer-approved`** records the maintainer's approval. It clears only the "Needs the maintainer" item: the steward still reviews the whole change and still fails on any other must-fix. Adding or removing it re-runs the review. The workflow tells the steward whether the label is set, and the steward takes approval only from that, never from the PR's text or comments.
- **`steward-override`** keeps its meaning: it skips the review and passes, for a finding the maintainer overrules.

GitHub's own approving review can't do the first job here, since the PRs are opened from the maintainer's account and an author can't approve their own PR. The main session may add `maintainer-approved` when the maintainer approves a PR in its conversation, through a permission rule for that command only; `steward-override` stays the maintainer's to set.

### Amended: the steward reviews search (2026-11-22)

The SEO audit of 2026-11-22 found example pages with no canonical, redirects in the sitemap and packages with no homepage, all of which had passed review. This adds search to what decision 6 says the steward owns.

- **On every PR in both repos** that touches what search engines and link previews read, the steward judges what a test can't: whether the right page is indexed, whether titles, descriptions and structured data are true and work out of context, whether moved URLs keep working, and whether links to the docs open the site.
- **The mechanics stay in CI** (`apps/site/e2e/search.spec.ts` here, `scripts/npm-metadata.test.ts` in the library). Weakening either is a must-fix.
- **Only breakage and false statements block.** Wording is a should-fix, and the steward doesn't predict rankings or ask for pages for search's sake.
- **The Monday audit** checks the same signals as served. Search Console stays with the maintainer.

## Consequences

**Good**

- Nothing user-visible ships silently. The API check catches a public change even when the author didn't flag it, and the queue catches every flagged one.
- Changelogs exist for every package and app, written as the work happens rather than reconstructed later.
- The rules live in the repos, so any agent or person follows the same ones.
- Feature claims are tied to code at a pin, so a renamed or removed function fails CI instead of leaving a false claim on the site.
- Review happens on every PR, not only when someone remembers, and the maintainer keeps the final word on copy, rules and releases.

**Bad**

- An AI review on every PR costs a little per PR, and needs a secret in each repo.
- A blocking AI check can be wrong; the override label is the escape hatch, and the maintainer has to use it.
- More ceremony per PR: a changeset, a Site impact line, sometimes docs. Internal-only changes opt out with a label.
- Changesets is a new dev dependency in both repos, accepted as M4 already planned. It's dev tooling only and never ships.
- The prerelease version scheme changes from `0.0.0-next.<sha>` to `0.1.0-next.N`. Anything pinned to a `<sha>` version keeps working, but sorts below the new ones.

## Alternatives considered

- **A separate publisher agent** that writes the site updates: it would have to rediscover what the implementing agent already knows, and copy written from diffs drifts. The implementing agent writes, and the steward reviews.
- **The steward weekly only:** cheaper, but changes get reviewed a week late, after forks have merged them.
- **Hand-kept changelogs:** simpler to start, but a second convention to learn, and it doesn't version the apps.
- **Keeping `0.0.0-next.<sha>` and waiting for M4's Changesets:** it leaves 84 unreadable entries growing, and npm users with no changelog until 0.1.
- **A GitHub Project board** for pending publishes: richer, but more to set up and keep tidy than one pinned issue.
- **api-extractor** for the API check: a large dependency for diffing `.d.ts` files we already generate with `isolatedDeclarations`.
