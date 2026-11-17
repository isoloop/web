# Changesets

Each change to an app adds one file here (`pnpm changeset`): which apps it touches, a bump (`patch`, `minor`, `major`), and one or two sentences for the app's `CHANGELOG.md`, written for someone using the demo or the site.

The shared packages have no version of their own: log a change to `packages/ui` (the design system, ADR 0003, decision 11) under `site` and any app whose look it changes, and a change to `packages/creator` or `packages/compare` under the apps that use it. `apps/samples` is type-check-only and has no changelog.

Releasing an app is in the [README](../README.md#releases). How changesets fit into publishing: [ADR 0004](../docs/adr/0004-publishing-and-governance.md).
