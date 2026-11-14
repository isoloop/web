# Plan: the website, to `site-v0.1.0`

**Status:** done (2026-11-14, `basic-v0.1.0` and `site-v0.1.0`). The decisions are in [ADR 0001](../adr/0001-what-this-repo-is.md) (this repo), [ADR 0002](../adr/0002-site-build.md) (the site build) and [ADR 0003](../adr/0003-design-system.md) (the design system). This plan only says what's left, in what order, and who does it.

**Done when:** `site-v0.1.0` is deployed and `isoloop.dev` serves the approved design: the landing page, `/features/`, `/how-it-works/` and the examples hub.

**Out:**
- **Markets figures:** they come back with [M3f](https://github.com/isoloop/isoloop/blob/main/docs/plans/README.md), markets parity, which is due before M4.
- **The M4 docs.**

## Done: the first pass

| What | Where |
| --- | --- |
| ADRs 0001–0003 | #77, #78, #79 |
| Domain verified, repo renamed, HTTPS enforced, first deploy | maintainer and session, 2026-11-14 |
| Apps under `/examples/`, placeholder at `/` | #81 |
| `packages/ui` foundation | #82 |
| `apps/basic` | #83 |
| The site: pages, hub, diagrams, site CI | #84, #86 |
| The core diagrams with a drift test | isoloop#184 |
| four-loops out of the library repo; `/isoloop/` redirect | isoloop#185 |

## Done: the approved design and launch

| Task | Where |
| --- | --- |
| ADR amendments: 0002 (pages, landing order, live demos on basic's real data) and 0003 (Archivo, palette, gutter layout, sticky header, switch, logo) | #87, #88, #89 |
| Fact check: a restarted subscription starts where its `from` says | #87, isoloop#186 |
| The brand: two marks, drawn from geometry, social cards | #89, #90 |
| basic's demo protocol (`isoloop-demo@1`) | #91 |
| The approved design, `/features/`, the copy, the logo wired in | #92 |
| Launch: `basic-v0.1.0`, `site-v0.1.0` | release runs, 2026-11-14 |

## Follow-ups

- **Lockup spacing:** the gap between the mark and "isoloop" is about one mark wide; `docs/brand.md` says half.
- **`--ui-rule`:** the build added a token for decorative rules, because `--ui-border` at `#d5dae2` is 1.31:1 and decision 8 asks 3:1 for borders. ADR 0003's amendment should mention it.
- **Markets figures** come back with M3f (markets parity), before M4.
- **Two deploy tags on one commit:** Pages names a deployment after its commit, so the second deploy of the same commit doesn't replace the first. `basic-v0.1.0` and `site-v0.1.0` both pointed at `2f03806`, and the site only went live after a later commit was deployed by hand. Tag a new commit for each deploy, or deploy `main` afterwards.

