# creator

The widget creator behind the dashboards' interactive pages ([M3e](https://github.com/isoloop/isoloop/blob/main/docs/plans/m3e-live-widget-creator.md)). Private, with no version: apps use it from the workspace. This is the core: the spec format, its validator, the catalog type, the operators and the pipeline. The views, the drawer and the widget isolate come next.

| Export | What it is |
| --- | --- |
| `creator` | `validateSpec(spec, catalog)`, `pipeline(spec, topic)`, `outputKind(operators)`, the `isoloop-spec@1` types (`WidgetSpec`, `Operator`, `Where`…), the catalog types with `topicOf`, `fieldOf` and `toRec`, and everything in `creator/outputs` |
| `creator/outputs` | What a pipeline hands its view: the `rows`, `scalar`, `series` and `grid` shapes, their limits, and `VIEW_INPUTS`, the outputs each view draws |

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
