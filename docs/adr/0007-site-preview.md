# ADR 0007: The site preview at `next.isoloop.dev`

- **Status:** Proposed
- **Date:** 2026-11-28
- **Answers:** where the site and the examples on a library preview (`x.y.z-next.N`) can be seen before the release, and how that preview is built, deployed and kept apart from the stable site. Grilled 2026-11-28, Q1–Q12, yes to all. Amends [ADR 0001](0001-what-this-repo-is.md) (decisions 4 and 5).

## Context

- **The examples must match the docs next to them.** A visitor reads the docs for the release on `isoloop.dev`, opens an example, and reads its source. If the example runs a preview with a changed API (0.2's `publish(topic, value, { key? })` against 0.1's `publish(topic, { value, key? })`), the example contradicts the page that links it. So the apps on web's `main` stay pinned to the release the live docs describe, and the 0.1 practice of putting a preview live (`site-v0.7.1` on `0.1.0-next.12`) stops.
- **Preview work still needs a place to be seen.** Moving the apps to a preview, the examples that use a new feature, and the measurements taken on them all happen before the release. Kept only as stacked draft branches, none of it can be opened in a browser by the people testing the preview, and each draft is rebased by hand as `main` moves.
- **GitHub Pages serves one site, at one custom domain, per repo.** The web repo's Pages is `isoloop.dev`.
- **The site and the examples link with root-absolute paths.** Dozens of links in `apps/site` and `packages/ui`, plus the examples' `example.json` paths, start with `/`. `Frame` and the examples' build check require it. A preview under a sub-path would have to change all of them.
- **npm's `next` dist-tag falls behind after a release.** Once `0.2.0` is `latest`, `next` still points at `0.2.0-next.N`, which is older.

## Decision

1. **The preview is for us and early testers.** The stable site gets one small "Preview" link in its header. There's no version switch.
2. **The preview is a second site at `next.isoloop.dev`.** A subdomain, so the site and the apps build exactly as they do for `isoloop.dev`, with no path in them changed.
3. **It's the whole site,** built from the preview code: landing, features, docs, API reference, examples and changelog, with a banner on every page.
4. **There's always a preview.** The release run of every minor also publishes the next minor's first preview: with `0.2.0` comes `0.3.0-next.0`, with the same code as `0.2.0` and a changeset that only bumps the minor. Both are staged and approved in one sitting. npm's `next` is then never behind `latest`, and the preview site always has a version to show.
5. **The preview's code lives on a long-lived `next` branch** in `isoloop/web`:
   - **Preview PRs target `next`,** with green CI and the steward, as on `main`. The 0.2 migration and the M8 Watchers examples are the first.
   - **`main` merges into `next`** regularly.
   - **At the release, `next` merges into `main`** as one PR, with the docs pin bump. The apps, the docs and the site then move to the release together.
6. **`next.isoloop.dev` is served by a small public repo, `isoloop/next`,** with its own Pages and that custom domain. It holds one workflow of about 10 lines, which calls web's deploy workflow. It holds no source.
7. **The preview deploy is run by hand** in `isoloop/next`, with one input: a web ref, by default the `next` branch. It runs on the maintainer's word, like the other deploys. It has no tag and no GitHub Release, and the deployment records the commit it built.
8. **One pipeline for both sites.** web's `deploy.yml` gains two inputs: `ref`, the web commit to build, and `preview`, true for `next.isoloop.dev`. A called workflow deploys to its caller's Pages, so the preview gets the same build, assembly and smoke tests, with the smoke tests pointed at `next.isoloop.dev` when `preview` is true.
9. **The banner and the link:**
   - **On every preview page,** a banner says "Preview of 0.2 (0.2.0-next.0). For the current release, see isoloop.dev →", linking to the same page on `isoloop.dev`. The version comes from the docs pin.
   - **On the stable site,** a "Preview" link in the header goes to the same page on `next.isoloop.dev`. It's always there, since there's always a preview (decision 4).
   - **Both are built** from the `preview` input and the pin, with no live check at build time.
10. **The preview stays out of search.** On `next.isoloop.dev`, `robots.txt` is `Disallow: /`, every page is `noindex`, and there's no `sitemap.xml`. The stable site's sitemap and canonical links don't change.
11. **The preview's docs pin** in `next`'s `apps/site/library.lock` is the latest published preview's commit, `681347f` for `0.2.0-next.0`. The existing pin check applies: a commit on the library's `main` or a `release/*` branch, published with provenance naming it. A new preview means a pin-bump PR on `next`, as a release means one on `main`.
12. **Who does what.** The maintainer creates `isoloop/next` (public), sets its Pages source to GitHub Actions with the custom domain `next.isoloop.dev`, and adds a DNS `CNAME` from `next` to `isoloop.github.io`, since repo settings, Pages and DNS stay with the maintainer ([ADR 0004](0004-publishing-and-governance.md), decision 6). The rest is PRs in `isoloop/web` and `isoloop/next`. The order:
    1. this ADR;
    2. the maintainer's repo and DNS setup;
    3. `deploy.yml`'s inputs, the banner, the link and the search rules, on `main`;
    4. the `next` branch, with the open preview PRs retargeted to it;
    5. the `isoloop/next` workflow;
    6. the first preview deploy.

## Consequences

**Good:**

- **Every example on `isoloop.dev` matches the docs beside it,** and every example on `next.isoloop.dev` matches the preview's docs.
- **Preview work merges with review** on `next`, instead of waiting as stacked drafts.
- **No path changes,** and one deploy workflow for both sites.
- **`npm i isoloop@next`** always installs something at least as new as `latest`.

**Costs, each with what limits it:**

- **A second repo to own.** *Limited by* it holding one workflow and no source; the build, the checks and the smoke tests stay in `isoloop/web`.
- **The preview deploy is run by hand.** *Limited by* it being one dispatch with a default ref, the same rule as every other deploy (only tags or by hand).
- **A pin-bump PR per preview** on `next`. *Limited by* it being the same mechanical PR as a release's, which the steward may merge (ADR 0004).
- **`0.3.0-next.0` is published with the same code as `0.2.0`.** *Limited by* it going out in the same sitting as the release, with notes that say so.
- **`next` drifts from `main`** between merges. *Limited by* merging `main` into it regularly, and by `next` holding only preview work.

## Alternatives considered

- **A cookie switch on `isoloop.dev`.** Pages is static, so the switch would be client-side script that reads the cookie and then swaps or redirects: a flash on every page, more script under the CSP, and a shared link that shows different pages to different people. Not taken.
- **A sub-path, `isoloop.dev/next/`, in the same Pages artifact.** One repo and one host, but the root-absolute links and the examples' paths would move to a base-aware helper, with a check against raw `/` links. Not taken; the subdomain needs no path changes.
- **An external host** (Cloudflare Pages, Netlify) on `isoloop/web`, deploying the `next` branch. No second repo and no refactor, but a new third-party service and account in the release path. Not taken.
- **The subdomain from Pages in `isoloop/web`.** Not possible: one custom domain per repo.
- **Stacked draft branches and no preview site.** No new setup, but nothing to open in a browser, and each draft rebased by hand. Not taken.
