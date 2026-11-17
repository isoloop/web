# Isoloop web

The [Isoloop](https://github.com/isoloop/isoloop) website, its examples and its design system, served at **[isoloop.dev](https://isoloop.dev/)**. Everything here is built on the published `@isoloop/*` packages, installed from npm the way any app would; the library itself, its guides and its ADRs live in [`isoloop/isoloop`](https://github.com/isoloop/isoloop).

- **Decisions** about this repo are in [`docs/adr`](docs/adr): what the repo is (0001), how the site is built (0002), the design system (0003).
- **Plans** are in [`docs/plans`](docs/plans), starting with the [website plan](docs/plans/site.md).
- **Apps** are packages under `apps/`, grouped by kind (`apps/dashboards/<name>`). The live examples are at [isoloop.dev/examples](https://isoloop.dev/examples/).
- **Shared packages** are under `packages/`: [`ui`](packages/ui), the design system, and [`compare`](packages/compare), the head-to-head comparison runner the dashboards share. Both are private.

Until the site's first tag (`site-v0.1.0`), [isoloop.dev](https://isoloop.dev/) shows a placeholder that links to the examples.

| App | What it shows |
| --- | --- |
| [`apps/site`](apps/site) | isoloop.dev itself: the landing page, how it works (the library's diagrams) and the examples hub, built from each app's `example.json`. Preact at build time only; no framework code reaches the browser. |
| [`apps/basic`](apps/basic) | The smallest example: four vanilla isolates on three event loops, A and B on their own workers, C and D sharing a pool. Block or crash any of them; a pool is a unit of failure. It's embedded on the landing page. [Live](https://isoloop.dev/examples/basic/) |
| [`apps/dashboards/markets`](apps/dashboards/markets) | A backend-less markets dashboard: public exchange feeds, cross-market aggregates and alerts, all in the visitor's tab. One code base, six builds (native and Isoloop, each with React and with Preact; native + workers with React; a mixed React and Preact Isoloop build), three Isoloop placements (`own`, `matched`, `one`), in Lite, Normal and Heavy sizes, with live metrics. [Live](https://isoloop.dev/examples/dashboards/markets/) |
| [`apps/dashboards/plant`](apps/dashboards/plant) | A telemetry dashboard for a fictional plant of eight machines: 72 widgets on seeded high-rate sensor data. Three builds (native, native with a data worker per machine, Isoloop), and placements of the Isoloop build's isolates in workers and pools. [Live](https://isoloop.dev/examples/dashboards/plant/) |
| [`apps/processor`](apps/processor) | Background work as headless isolates, placed by `@isoloop/balancer`. The Playground: add tasks, set each one's CPU, block or crash it, and watch the balancer move it between worker pools. The File processor: groups of processors share a seeded stream of synthetic files through the bus's consumer groups, measured on a worker each, in one pool and with the balancer ([results](apps/processor/comparison/README.md)). [Live](https://isoloop.dev/examples/processor/) |

## Browser support

Safari 16.4 or later, or a recent Chrome, Edge or Firefox. That's Vite's default build target ("Baseline Widely Available": Chrome and Edge 111, Firefox 114, Safari 16.4), and what the Isoloop builds need: module workers, `OffscreenCanvas` drawn in workers, and adopted stylesheets on a shadow root. The native builds also call ES2023 array methods (`toSorted`, from Safari 16).

On anything older, each page says so instead of staying blank. Every app page carries a plain-HTML notice and a small classic script, `browser-check.js`, both from [`shared/browser-check.ts`](shared/browser-check.ts):
- the notice shows even when no script runs
- the script names what's missing and stops the app from starting (`shared/guard.ts`)
- the app removes the notice once it has loaded

The script is a file, not inline, so it runs under the hosting guide's `script-src 'self'` policy.

## Setup

Node 26 (`.nvmrc`) and pnpm 12 (`packageManager`), as in the main repository.

```bash
pnpm install
pnpm check            # format, lint, typecheck, unit tests
pnpm e2e              # Playwright, all three engines
pnpm --filter markets dev
pnpm --filter processor dev   # the Playground; the File processor at /files/
```

Until Isoloop 0.1, the apps use `next` prereleases of `@isoloop/*`: one version for every package, set in `pnpm-workspace.yaml` (`catalogs.isoloop`). To move to a newer one, change it there and run `pnpm install`.

## License

MIT
