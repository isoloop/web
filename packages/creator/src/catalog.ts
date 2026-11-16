// The topics a dashboard offers to the widgets users create (M3e decision 18).
// Each dashboard writes its own catalog by hand; a test there checks it against
// the dashboard's zod schemas and retention.

/** What a field holds. `time` is ms since the epoch, compared as a number. */
export type FieldType = 'number' | 'string' | 'time';

export type CatalogField = {
  /** The record's top-level property. */
  readonly name: string;
  readonly type: FieldType;
  /** Shown in forms and legends, e.g. "Bearing temperature". Defaults to `name`. */
  readonly label?: string;
  /** e.g. "°C", "kW". */
  readonly unit?: string;
};

export type CatalogTopic = {
  /** The bus topic, e.g. `plant.scalars.v1`. */
  readonly name: string;
  /** Shown in the drawer's source picker. */
  readonly title: string;
  /**
   * What the record key means, for a keyed topic. A widget may pick one key
   * (`source.key`), and may filter or group by the key as the field `$key`.
   * `values`, when given, are the only keys a spec may name.
   */
  readonly key?: { readonly label: string; readonly values?: readonly string[] };
  /** The fields a widget may filter, aggregate or group by. */
  readonly fields: readonly CatalogField[];
  /** How far back the topic keeps records, in ms: the longest window a spec may ask for. */
  readonly history: number;
  /** The field holding the record's time. Without one, the time it arrived is used. */
  readonly time?: string;
};

export type Catalog = { readonly topics: readonly CatalogTopic[] };

/** The record key as a field: filter or group by the key with `"field": "$key"`. */
export const KEY_FIELD = '$key';

export function topicOf(catalog: Catalog, name: string): CatalogTopic | undefined {
  return catalog.topics.find((t) => t.name === name);
}

/** A field of a topic, `$key` included (as a string field) when the topic is keyed. */
export function fieldOf(topic: CatalogTopic, name: string): CatalogField | undefined {
  if (name === KEY_FIELD) {
    return topic.key ? { name: KEY_FIELD, type: 'string', label: topic.key.label } : undefined;
  }
  return topic.fields.find((f) => f.name === name);
}

/** A record as the pipeline takes it: its key, its time and its value. */
export type Rec = {
  readonly key?: string | undefined;
  /** ms since the epoch. */
  readonly t: number;
  readonly value: Readonly<Record<string, unknown>>;
};

/**
 * A bus record as a pipeline record: the time from the topic's `time` field
 * when it holds a number, otherwise `receivedAt`.
 */
export function toRec(
  topic: CatalogTopic,
  record: { readonly key?: string | undefined; readonly value: Readonly<Record<string, unknown>> },
  receivedAt: number,
): Rec {
  const t = topic.time === undefined ? undefined : record.value[topic.time];
  return { key: record.key, t: typeof t === 'number' ? t : receivedAt, value: record.value };
}
