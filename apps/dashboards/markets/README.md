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
- `teams`, on `/mixed` only: the data on its own workers, plus a pool per team, one for the React widgets and one for the Preact ones. A blocked widget stalls its own team's widgets only.

**Interactive mode** is a separate page, `/interactive/` (Isoloop or native, `?size=lite|normal|heavy`), on the same replay, with six starter widgets you can edit or delete and a drawer that adds new ones from the dashboard's trades, prices, cross-market figures and rolling stats, each widget its own isolate ([M3e](https://github.com/isoloop/isoloop/blob/main/docs/plans/m3e-live-widget-creator.md)). A new widget's placement is **Automatic** by default: the page's balancer ([`@isoloop/balancer`](https://github.com/isoloop/isoloop/blob/main/docs/adr/0017-opt-in-balancer.md)) puts it in a pool from its measured load, and moves it out if it blocks that pool or the pool falls behind ([M3h](https://github.com/isoloop/isoloop/blob/main/docs/plans/m3h-auto-placement.md)). The widget's header says where it runs ("Auto 1", "Quarantine"), a moved widget shows a badge and "Moving…" until it draws again, and the toolbar's placement log lists every move. You can still pick a pool by hand, and the starter widgets stay in theirs. `?chaos` adds a test-only "Burn" to the drawer, for making a widget block on purpose.

Live at **https://isoloop.dev/examples/dashboards/markets/** (`?size=lite|normal|heavy`; `?placement=own|matched|one` on the Isoloop builds, `teams` on `/mixed`).

## What was measured

On four cores at 2.0 GHz, Isoloop keeps the main thread free. At Heavy it keeps every frame, where both native builds drop about a third. It costs 4–29 points of CPU, 33–52 MB of memory and 0.1–0.5 s more to first data.

The findings, the numbers and how they were measured are in [`comparison/final/`](comparison/final/README.md), recorded for `markets-v0.3.0`. The earlier M3b and M3c recording, native on one thread against Isoloop's `own`, is kept as history in [`comparison/`](comparison/README.md).

### Parts from two teams

The React and Preact build was measured against its native counterpart, native + workers with the Preact part loaded at run time, in [`comparison/federated/`](comparison/federated/README.md) (M3g). When the Preact team's alerts panel blocks for 3 s, the React team's widgets get none of their updates on the native build and in `matched`, and keep 91–99% of them in `teams` and `own`. When it crashes, native's error boundary keeps the rest running but the panel stays down; Isoloop has it back in 1.3–1.8 s. Isoloop loads 61 KB more JavaScript, gzipped, and costs 34–49 MB of memory and 5–29 points of CPU against native + workers.

`own` is the default because markets shows containment: a blocked chart stalls only itself. In `matched`, a blocked widget stalls every widget, while the data keeps flowing. In `one`, it stalls everything until the block ends.

## Running it

```bash
pnpm --filter ./apps/dashboards/markets dev                 # the Isoloop build
pnpm --filter ./apps/dashboards/markets dev:native          # native
pnpm --filter ./apps/dashboards/markets build               # every build into dist/
pnpm --filter ./apps/dashboards/markets e2e                 # the Playwright suite
```

## Tools for agents

The Isoloop builds expose two tools to agents ([ADR 0018](https://github.com/isoloop/isoloop/blob/main/docs/adr/0018-tools-for-agents.md)). Each is a requestable topic in [`src/isoloop/contracts.ts`](src/isoloop/contracts.ts), listed in the kernel's `agents.expose`:

| Tool | Answered by | What it does |
| --- | --- | --- |
| `markets.quote.v1` | the aggregator | Read-only. For one symbol: VWAP, cross-market spread and volume over the dashboard's window (`null` with no trades in it), and each exchange's last, bid and ask. |
| `markets.alerts.create.v1` | the alerts isolate | Consequential. Adds an alert rule, shown in the alerts panel and kept across reloads. The rule's id comes from the request's id, so a request delivered again after a crash adds nothing new. |

In development the page pairs with the `isoloop mcp` dev server, so a coding agent can call them and read the page's isolates, topics and events. Run the CLI with a fixed token, and give the page the same one:

```bash
ISOLOOP_MCP_TOKEN=some-long-token npx isoloop mcp --allow-write   # what your agent starts, e.g. `claude mcp add isoloop -- …`
VITE_ISOLOOP_MCP_TOKEN=some-long-token pnpm --filter ./apps/dashboards/markets dev
```

Without `--allow-write` the CLI lists only the quote. Without `VITE_ISOLOOP_MCP_TOKEN` the page doesn't pair. Production builds don't contain the dev MCP: `@isoloop/vite` fails a build that does. `e2e/dev-mcp.spec.ts` runs both tools through the official MCP SDK client and the real CLI, in Chromium.

In a browser with WebMCP, the Isoloop build also lists both tools to the browser's agent with [`connectWebMCP`](https://github.com/isoloop/isoloop/blob/main/docs/guide/agents.md). WebMCP is behind a flag in Chromium (`--enable-features=WebMCP`) and Firefox (`dom.modelcontext.enabled`); without it the page loads none of its code. `e2e/webmcp.spec.ts` lists the tools and asks for a quote through Playwright's WebMCP client, in both.

## Devtools

`?devtools=1` on the Isoloop builds and the interactive Isoloop page, set by the **Devtools** switch on their bar (`shared/devtools-switch.ts`), adds the [devtools panel](https://github.com/isoloop/isoloop/blob/main/docs/guide/devtools.md) in the bottom-right corner: the isolates with their controls, the bus, the kernel’s own events and a live record log (Messages), drawn by its own isolate. Its button is ringed by twelve arcs that show the kernel’s health. Open it with its button or Alt+Shift+D. Without the flag the page runs no panel and loads none of its code, and the measured runs never set it. `e2e/devtools.spec.ts` checks the panel on the built page, through a bus restart; `e2e/devtools-dev.spec.ts` checks it under the dev server.

The head-to-head runner is `compare:pairs`: [`comparison/final/`](comparison/final/README.md#how-it-was-measured) has the command that produced the shipped figures.
