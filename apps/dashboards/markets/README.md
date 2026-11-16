# Markets dashboard

A backend-less markets dashboard. Public exchange feeds, or a seeded replay of them, are aggregated into prices, spreads, volume, depth and correlations, with alerts, all in the visitor's tab. It's built from the same widgets and data as:

- **native:** everything on the main thread.
- **native + workers:** the replay, the aggregator, alerts and the three engines in a worker each (and the four feeds, in live mode), with the widgets on the main thread.
- **native + workers, React and Preact** (`/native-mixed/`): native + workers, with the filters and the alerts panel as Preact parts built and shipped apart (`vite build --mode native-mixed-parts`) and loaded at run time with `import()` from their own `parts/parts-manifest.json`. Each part exports `mount(el, host)`, where `host` is the page's store; nothing else is shared (`src/parts/contract.ts`). The native counterpart of `/mixed`.
- **Isoloop:** in React, in Preact, or both mixed.

The Isoloop builds place their isolates with `?placement=`:

- `own`: a worker per isolate, the default.
- `matched`: native + workers' data workers, plus one pool for every widget.
- `one`: everything in one pool.

Live at **https://isoloop.dev/examples/dashboards/markets/** (`?size=lite|normal|heavy`; `?placement=own|matched|one` on the Isoloop builds).

## What was measured

On four cores at 2.0 GHz, Isoloop keeps the main thread free. At Heavy it keeps every frame, where both native builds drop about a third. It costs 4–29 points of CPU, 33–52 MB of memory and 0.1–0.5 s more to first data.

The findings, the numbers and how they were measured are in [`comparison/final/`](comparison/final/README.md), recorded for `markets-v0.3.0`. The earlier M3b and M3c recording, native on one thread against Isoloop's `own`, is kept as history in [`comparison/`](comparison/README.md).

`own` is the default because markets shows containment: a blocked chart stalls only itself. In `matched`, a blocked widget stalls every widget, while the data keeps flowing. In `one`, it stalls everything until the block ends.

## Running it

```bash
pnpm --filter ./apps/dashboards/markets dev                 # the Isoloop build
pnpm --filter ./apps/dashboards/markets dev:native          # native
pnpm --filter ./apps/dashboards/markets build               # every build into dist/
pnpm --filter ./apps/dashboards/markets e2e                 # the Playwright suite
```

The head-to-head runner is `compare:pairs`: [`comparison/final/`](comparison/final/README.md#how-it-was-measured) has the command that produced the shipped figures.
