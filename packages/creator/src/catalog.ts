// The topics a dashboard offers to the widgets users create (M3e decision 18).
// Each dashboard writes its own catalog by hand; a test there checks it against
// the dashboard's zod schemas and retention.
import type { WidgetSpec } from './spec/types';

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
  /**
   * Each record carries many samples in one array, as raw signals do (a
   * vibration chunk). The widget keeps the records as they come, and the
   * aggregate reads the samples straight from the arrays, never one object
   * per sample. The samples are offered as the number field `value` (listed
   * in `fields`); an aggregate over it takes every sample, and `count` counts
   * samples. Such a topic needs an aggregate (no table of raw records), a
   * time window, and no filter on the sample field itself; filters on the
   * record's other fields still apply, per record.
   */
  readonly samples?: CatalogSamples;
};

export type CatalogSamples = {
  /** The record property holding the samples: an array or typed array of numbers. */
  readonly field: string;
  /** The number field the samples are offered as; it must be in `fields`. */
  readonly value: string;
};

/**
 * A ready widget the drawer offers to fill its form with, e.g. "Try a heavy
 * widget". Its spec takes the form's id and placement.
 */
export type CatalogPreset = {
  readonly id: string;
  /** The button's text. */
  readonly label: string;
  readonly spec: Omit<WidgetSpec, 'id' | 'placement'>;
};

export type Catalog = {
  readonly topics: readonly CatalogTopic[];
  /** Ready widgets for the drawer's preset buttons; each must pass validateSpec (a test in each dashboard). */
  readonly presets?: readonly CatalogPreset[];
};

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

/**
 * The samples a record carries, when the topic has them: the array at
 * `samples.field`, or an empty one when it isn't an array of numbers.
 */
export function samplesOf(topic: CatalogTopic, rec: Rec): ArrayLike<number> {
  const s = topic.samples;
  if (!s) return EMPTY;
  const v = rec.value[s.field];
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a typed array other than DataView holds numbers (BigInt arrays aren't offered by catalogs)
    return v as unknown as ArrayLike<number>;
  }
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : EMPTY;
}

const EMPTY: ArrayLike<number> = new Float64Array(0);

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
