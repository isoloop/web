# ui

The design system shared by the site and the examples ([ADR 0003](../../docs/adr/0003-design-system.md)). Private, with no version: every app uses it from the workspace.

| Export | What it is |
| --- | --- |
| `ui/components` | `Head`, `Header`, `Bar`, `Footer`, `Card`, `Table`, `Callout`, `Frame`, `Button`, `ThemeToggle`, `PairedBars`, `ChartLegend`: Preact, rendered to static HTML at build time only |
| `ui/render` | `render(node): string`, the only file that imports `preact-render-to-string`; `render.test.tsx` is its conformance suite |
| `ui/tokens.css` | the `--ui-*` tokens: primitives, and the semantic layer per theme |
| `ui/shell.css` | the `ui-` classes, in `@layer ui` |
| `ui/theme.js` | the theme script ([ADR 0002](../../docs/adr/0002-site-build.md), decision 8), plus `?embed=1` → `<html data-embed>` |
| `ui/vite` | `ui({ header, bar, footer })`: injects the CSS, `theme.js` and the rendered partials into an app's pages |

`src/base.css` holds the element rules (`body`, links, focus). Only pages with the full header get it, so the dashboards' bar adds no global styles.

## Using it

```ts
// vite.config.ts
import { ui } from 'ui/vite';
export default defineConfig({ plugins: [ui({ header: { current: 'examples' }, footer: true })] });
```

An app that imports `ui/vite` runs Vite with `--configLoader runner` (in its `dev`, `build` and `preview` scripts). Vite's default config loader hands a linked workspace package to Node, and Node can't load the components' `.tsx`. The runner transforms them as it loads them. Its `tsconfig.json` also needs `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`, so `tsc` can follow the import.

Put `<!-- ui:header -->`, `<!-- ui:bar -->` or `<!-- ui:footer -->` in a page to choose where a partial goes. Otherwise the header and bar go first in `<body>` and the footer last. An app with several sections names the page's section in the marker, `<!-- ui:header:how-it-works -->`, which wins over the option's `current` (the site does this).

The dashboards take `ui({ bar: true })`. Their configs load through Vite's runner (`--configLoader runner`), which follows this package's TypeScript and Preact sources.

## Charts

`PairedBars` draws a baseline against Isoloop as paired bars, one pair per row, in static SVG: no chart library and no script on the page. It takes numbers, not formatted strings, and does the formatting itself.

```tsx
<PairedBars
  title="Main thread busy"
  unit="%" // '%' | 'ms' | 's' | 'MB'; % deltas read as points, ms of 1000 or more as seconds
  base="Native + workers"
  value="Isoloop matched"
  rows={[{ label: '5 kHz', base: 79, value: 27 }]} // label optional on a one-row chart
/>
```

- **Colours:** the baseline is `--ui-border` grey; Isoloop's bar is `--ui-accent` when better and `--ui-bad` when worse (`--ui-text-muted` for a row marked `verdict: 'same'`). The delta under each pair says it in words ("52 points lower, better"), so colour is never the only signal.
- **Better or worse** comes from the sign and `lowerIsBetter` (default true, shown as "Lower is better." under the title; `note` replaces that line, `null` drops it). A row's `verdict` overrides it, e.g. `'same'` for a change inside the run's spread.
- **One scale per chart,** from zero to `max` (default 100 for `%`, else the largest value).
- **Small charts side by side:** `compact` hides the series names visually (screen readers still read them) and `legend={false}` drops each chart's legend; put one `ChartLegend` beside them.
- **Accessibility:** names, values and deltas are text in reading order; the bars are `aria-hidden`. In forced colours the bars take system colours and the words carry the sign.

`formatValue` and `formatDelta` are exported, so a table under a chart prints the same strings.

## Checks

- `contrast.test.ts`: every declared pair of semantic colours, in both themes, against WCAG AA. A new semantic colour comes with its pairs.
- `render.test.tsx`: what any renderer behind `render()` must produce.
- `PairedBars.test.tsx`: the chart's markup for a fixture, its words and its scale. The specimens page renders the charts (`specimens/charts.tsx`), so the site's axe check covers them.
- `vite.test.ts`: the plugin's files, partials and paths.
- `pnpm --filter ui dev` serves the specimens page, and `build:specimens` builds it for the site's accessibility check.

The token values are neutral placeholders until the design pick (plan task 7b).
