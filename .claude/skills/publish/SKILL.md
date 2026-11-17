---
name: publish
description: Publish a shipped change to isoloop.dev. Use when a PR's Site impact is "update needed", when the Publishing queue has an open item, or when site copy no longer matches the code.
---

# Publish a change to isoloop.dev

The rules this follows are in [`AGENTS.md`](../../../AGENTS.md) (copy and claims, releases) and [ADR 0004](../../../docs/adr/0004-publishing-and-governance.md). The site's build is [ADR 0002](../../../docs/adr/0002-site-build.md); its look, [ADR 0003](../../../docs/adr/0003-design-system.md) and [`docs/brand.md`](../../../docs/brand.md).

## 1. Name the change

Write down, from the source PR and its code: what users can now do or see, what changed in behaviour, and which code or test proves it (file and symbol, or test name).

**Done when** each claim you intend to make has a proof you can link.

## 2. Map it to the site

Go through every place below and decide, for each, *changes* or *unaffected*:

| Kind of change | Where it goes |
| --- | --- |
| A capability or behaviour change | `/features/`: the feature's entry in `apps/site/content/features/<id>.json` (its strip line, section text, `since` and `proof`), which also feeds the landing page's strip; the demo's own labels stay in `apps/site/src/copy.ts` |
| A new example or app | its `example.json` and screenshot; the landing page's examples section |
| New or changed measurements | the results tables on the landing page and the example's results, each figure with device, build and tag |
| A change to how Isoloop works inside | `/how-it-works/` and the diagrams (redrawn in `isoloop/isoloop`, then the pin in `apps/site/library.lock` bumped) |
| A newly found limitation | "What Isoloop can't hide" |
| Anything that ships | the app's changelog (`pnpm changeset`) |

Then search the whole site's copy for text the change makes wrong: `grep` for the changed API names, option names and behaviours.

**Done when** every row has a decision and the search found no stale text left untouched.

## 3. Write it

Write to `AGENTS.md`'s copy rules: the whole package, measurements with their device, build and tag, plain sentences. Each new claim carries its proof link (in a feature entry's `proof`, or in the PR description).

**Done when** every sentence you added or changed has been checked against the code or a test, and the changeset is written.

## 4. Assets and checks

- Screenshots for a new or changed example: `pnpm --filter site screenshots`.
- Run `pnpm check`, then `pnpm --filter site build`, `pnpm --filter site linkcheck` and `pnpm --filter site smoke` (axe runs inside the smoke test).

**Done when** all of them pass.

## 5. Review by the steward

Dispatch the `steward` agent on your branch's diff, giving it the source PR's link and nothing of your reasoning. Fix every **must-fix**; answer or fix every **should-fix** in the PR description.

**Done when** the steward reports no open must-fix.

## 6. Hand over

Open the PR to the maintainer: the source PR, what changed on which page, the steward's verdict, and `Site impact: done in web#<this PR>` to paste into the source PR. Tick the item in the "Publishing queue" issue. Copy PRs wait for the maintainer; they are never self-merged.

**Done when** the PR is open, the source PR links it, and the queue item is ticked.

## 7. Release, on the maintainer's word

When the maintainer says to release: tag `site-v<next>` on the merge commit, which must be a commit no other deploy tag sits on. Watch the release run, then check the changed pages on `isoloop.dev` once the CDN serves them (up to 10 minutes), and report what you saw.

**Done when** the changed pages show the new content live.
