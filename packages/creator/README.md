# creator

The widget creator behind the dashboards' interactive pages ([M3e](https://github.com/isoloop/isoloop/blob/main/docs/plans/m3e-live-widget-creator.md)). Private, with no version: apps use it from the workspace. It holds the spec format, its validator, the catalog type, the operators, the pipeline, the five views, the widget isolate that runs them, and the board: the grid, the drawer that adds and edits widgets, and the controller behind them.

| Export | What it is |
| --- | --- |
| `creator` | `validateSpec(spec, catalog)`, `pipeline(spec, topic)`, `outputKind(operators)`, the `isoloop-spec@1` types (`WidgetSpec`, `Operator`, `Where`…), the catalog types (with sample topics and presets) with `topicOf`, `fieldOf`, `samplesOf` and `toRec`, and everything in `creator/outputs` |
| `creator/outputs` | What a pipeline hands its view: the `rows`, `scalar`, `series` and `grid` shapes, their limits, and `VIEW_INPUTS`, the outputs each view draws |
| `creator/views` | The five views (React): `View` renders any of them by type with the spec's `view.options`; `ViewEnv` gives canvas views their draw target |
| `creator/view-kinds` | Without React: `VIEW_TYPES`, `VIEW_LABELS`, `viewAccepts`, and `VIEW_OPTIONS` with `checkViewOptions`, the options each view reads |
| `creator/draw` | The canvas drawing the views use, on any 2D context: `drawChart`, `drawBars`, `drawHeatmap` |
| `creator/widget` | A widget at run time, with no Isoloop runtime code: `WidgetRunner`, `Widget` and `NativeWidget`, `applyKind`, `widgetGrants`, `spawnWidget`, the spec records (`specRecord`, `TOMBSTONE`) and topic names |
| `creator/widget-isolate` | The widget isolate's module, for `?isolate` |
| `creator/topics` | `creatorTopics()`, `specRecordSchema` and `uiRecordSchema`, for a page's contracts module (Zod) |
| `creator/board` | The board a page mounts: `CreatorBoard`, its `BoardController`, and the runtimes `isoloopRuntime` and `nativeRuntime` (with the `NativeBus`) |
| `creator/drawer` | The drawer's form (React, `Drawer`) and its form logic, for the native page and tests |
| `creator/drawer-isolate` | The drawer isolate's module, for `?isolate` |
| `creator/styles.css` | The creator's stylesheet; every rule is under a `.creator-*` class. The board adds it to the document, the isolates to their surfaces |

## A widget spec

```json
{
  "id": "w7",
  "title": "Pump 1 bearing p95",
  "source": { "topic": "plant.scalars.v1", "key": "pump-1" },
  "operators": [
    { "op": "filter", "where": { "field": "speed", "op": ">", "value": 0 } },
    { "op": "window", "ms": 60000 },
    { "op": "aggregate", "fn": "percentile", "p": 95, "field": "bearingTemp", "every": 1000 }
  ],
  "view": { "type": "line", "size": "m" },
  "placement": { "mode": "manual", "pool": "pool-1" }
}
```

- **Operators run in order:** filters, then at most one window, then at most one aggregate. An aggregate needs a window before it.
- **Conditions are JSON, never code:** `{ field, op, value }` with `==`, `!=`, `<`, `<=`, `>`, `>=` or `in` (a list), and `{ and: [...] }`, `{ or: [...] }`, `{ not: {...} }`. Ordering works on number and time fields only.
- **`$key`** is the record key, as a text field: filter or group by it on a keyed topic.
- **A window** is `ms` (no longer than the topic's `history`) or `n` records.
- **An aggregate** is `count`, `sum`, `avg`, `min`, `max`, `last` or `percentile` (with `p`), over a number field (`count` takes none), optionally `every` ms and `groupBy` a text field.

## The output a view gets

| Operators | Output | Drawn by |
| --- | --- | --- |
| no aggregate | `rows`: the records, newest first | table |
| aggregate | `scalar`: the value now | stat |
| aggregate with `every` | `series`: the value at each tick | line, bar, stat |
| aggregate with `groupBy` | `grid`: a value per group, now | line, bar, heatmap, table |
| aggregate with `groupBy` and `every` | `grid`: a value per group and tick | line, bar, heatmap, table |

`validateSpec` rejects a view that doesn't draw its pipeline's output, and gives every error at once, each with a path such as `operators[1].ms`.

## Running a pipeline

```ts
import { pipeline, toRec, topicOf, validateSpec } from 'creator';

const result = validateSpec(json, catalog);
if (!result.ok) showErrors(result.errors); // [{ path, message }]
else {
  const topic = topicOf(catalog, result.spec.source.topic)!;
  const p = pipeline(result.spec, topic);
  // on each record from the topic:
  p.push(toRec(topic, record, Date.now()));
  // once per frame:
  draw(p.read(Date.now()));
}
```

A pipeline with `every` takes its ticks on `read`, so the first read after a replay fills the history at once.

### Topics that carry samples

A raw signal arrives as chunks: one record with an array of samples (plant's vibration, 50 to 250 samples per 50 ms). A catalog entry says so with `samples: { field, value }`. `field` is the record property holding the array (an array or typed array of numbers), and `value` is the number field the samples are offered as, listed in `fields`. The widget keeps the chunks as they arrive, bounded like any topic's records, and an aggregate over `value` reads every sample straight from the arrays: one `Float64Array` copy to sort for `percentile`, no object per sample. `count` counts samples. Such a topic needs an aggregate and a time window, and a filter tests a whole record, so it can't test `value`; `validateSpec` says so.

### Presets

`catalog.presets` lists ready widgets, each `{ id, label, spec }` without an id or placement. The drawer shows one button per preset (plant's "Try a heavy widget") that fills the form with its spec. A test in each dashboard checks every preset passes `validateSpec`.

## The views

| View | Draws | Options (`view.options`) |
| --- | --- | --- |
| line | a series as one line; a grid as one line per group | none |
| bar | a series as bars over time; a grid as a bar per group, its newest value | none |
| heatmap | a grid: groups down, ticks across | none |
| table | rows, newest first; a grid as a row per group with its newest value | `limit`: 1 to 200 rows (default 50) |
| stat | a scalar; a series' newest value | `gaugeMin` and `gaugeMax`, both or neither: a gauge under the number |

Nulls are gaps: a line lifts its pen, a heatmap cell is left dark, a table shows a dash. Labels and units come from the output. `size` (`s`, `m` or `l`) sets the view's height; `SIZE[size].columns` is how many grid columns it spans, for the page.

Canvas views (line, bar, heatmap) draw through `<ViewEnv useCanvas={…}>`: a hook that turns the view's `<canvas>` into a 2D context sized to the element. A widget isolate passes one that asks the host for an `OffscreenCanvas`; the native build passes `useMainThreadCanvas`.

```tsx
import { View, ViewEnv, useMainThreadCanvas } from 'creator/views';

<ViewEnv useCanvas={useMainThreadCanvas}>
  <View type={spec.view.type} size={spec.view.size} options={spec.view.options} title={spec.title} output={p.read(Date.now())} />
</ViewEnv>
```

## A widget at run time

Each widget is one visual isolate (or, on the native page, the same component on the main thread). It reads two topics, both from `earliest`:

- **its source topic**, whose raw records it keeps for as long as the topic does (the catalog's `history`, at most 100,000), so an edited pipeline starts full;
- **its spec record:** its key in `creator.specs.v1` on the grid, or in `creator.draft.v1` as the drawer's preview, which rebuilds 300 ms after the draft last changed.

A spec record is `{ spec, added? }` or the tombstone `{ deleted: true }`; `added` (when the widget was first added) keeps the grid in add order across edits. Its grants are those two topics, and it publishes nothing. A widget on the grid knows the pool it was spawned in (`config.pool`), so the older records a replay delivers first don't make it ask for a respawn. After a bus restart that lost its source topic, it starts again empty on the spec it runs.

| Change to the spec | `applyKind` | What happens |
| --- | --- | --- |
| nothing | `none` | nothing |
| operators, view, title or the source key | `reconfigure` | the running widget rebuilds its pipeline from the records it kept |
| the source topic, or the placement (not for a preview) | `respawn` | the widget keeps drawing its old spec, with `data-state="respawn"`; the page stops it and spawns a new one |
| a tombstone | | the widget draws nothing (`data-state="deleted"`); the page stops it |

```ts
// The page's contracts module:
import { creatorTopics } from 'creator/topics';
export default contracts(...dashboardTopics, ...creatorTopics());

// The page:
import { spawnWidget, specRecord, applyKind } from 'creator/widget';
import widgetSrc from 'creator/widget-isolate?isolate';

await kernel.publish(specsTopic, { key: spec.id, value: specRecord(spec) });
const handle = spawnWidget(kernel, spec, { src: widgetSrc, surface, topic: topicOf(catalog, spec.source.topic)! });
// Later, on an edit: publish the new spec, and if applyKind(old, next) is 'respawn', stop and spawn again.
```

A widget on the grid runs in the kernel pool `creator-<placement.pool>` (`poolId`); a preview gets its own worker. `NativeWidget` takes any `WidgetBus` (topics by name, from `earliest`) and a memoized `WidgetConfig`.

## The board

A page mounts `CreatorBoard` with its runtime, its catalog and its starter widgets:

```tsx
// Isoloop page: the page's contracts module includes ...creatorTopics().
import { CreatorBoard, isoloopRuntime } from 'creator/board';
import widgetSrc from 'creator/widget-isolate?isolate';
import drawerSrc from 'creator/drawer-isolate?isolate';

const runtime = isoloopRuntime({ kernel, widgetSrc, drawerSrc });
<CreatorBoard runtime={runtime} catalog={catalog} starters={STARTERS} />;

// Native page: no kernel; the page feeds its own topics.
import { nativeRuntime } from 'creator/board';
const runtime = nativeRuntime({ storageKey: 'plant', sources: (topic, fn) => subscribeFromOldest(topic, fn) });
```

- **The toolbar:** Add widget (off at 24 widgets), Reset to starter, and the count.
- **The grid:** each widget in its slot, in add order, `s` one column, `m` two, `l` three, with Edit and Delete in its header and where it runs ("Pool 1", or "main thread").
- **The drawer**, docked on the right: the host's frame with two slots, the **preview** (a widget isolate on its own worker, reading the draft) and the **form** (the drawer isolate, on its own worker, never pooled). The form starts the first time the drawer opens and stays; closing the drawer stops the preview.
- **The form** picks a topic and key, filter rows (joined by all or any, each one can be negated), a window by seconds or records, an aggregate (with `p`, `every` in seconds and a group), the views that draw the result, a size, a title (made from the choices when empty) and the pool. Every valid change is published as the draft; `validateSpec` runs in the form's worker and each error shows on its field. Add and Save are off while the spec isn't valid, and Add is off at 24 widgets.
- **Placement** (Isoloop) lists the page's pools with their widgets and lag, then "Create new"; a new widget starts in the pool of the widget added last. On the native page the field is off ("Not used").

The controller (`BoardController`) does the work behind it, for both runtimes:

- **Seeding:** it subscribes to `creator.specs.v1`, then publishes a replay probe (`$sync`, `{ sync }`); once its own probe comes back, every older record has been read. A topic that held no widget at all (a first visit) gets the starters. A page whose widgets were all deleted stays empty.
- **Widgets:** each slot the grid renders runs its widget. An edit to operators, view, title or key is applied by the widget itself; a new source topic or pool stops it, and once it has stopped, spawns it again in the same slot. A tombstone stops it.
- **Reset** tombstones every widget that isn't a starter and publishes the starters again.
- **The drawer** talks to the form over `creator.ui.v1` (memory, compacted): `open` (add, or edit an id, with the draft id), `done` (added, saved, deleted, cancelled) and, on Isoloop pages, `pools` about once a second, from the kernel's snapshots.
- **A bus restart** loses the memory topics: widgets start their source again empty, the form publishes its draft again, and the page publishes its pools on the next tick.

The native page's `NativeBus` holds the three creator topics on the main thread, compacted, with `creator.specs.v1` in localStorage (`creator:<storageKey>:specs`), so widgets survive a reload as they do in OPFS. Every other topic comes from the page's `sources`.

`pnpm e2e` runs the widget isolate and the board on a real kernel (`e2e/harness`, `?board=isoloop`) and the board's native page (`native.html`) in Chromium, Firefox and WebKit. Playwright's WebKit has no OPFS, so the reload test is skipped there on the Isoloop page.
