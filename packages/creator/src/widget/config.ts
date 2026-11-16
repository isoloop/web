// `manifest.config` for a widget isolate, checked by hand: the isolate loads
// no Zod.
import type { CatalogTopic } from '../catalog';
import type { WidgetConfig } from './runner';

function isTopic(v: unknown): v is CatalogTopic {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof Reflect.get(v, 'name') === 'string' &&
    Array.isArray(Reflect.get(v, 'fields')) &&
    typeof Reflect.get(v, 'history') === 'number'
  );
}

/** The config, or a thrown error naming what's wrong (the isolate then fails to start). */
export function widgetConfig(v: unknown): WidgetConfig {
  if (typeof v !== 'object' || v === null) throw new Error('widget config: expected an object');
  const id: unknown = Reflect.get(v, 'id');
  const mode: unknown = Reflect.get(v, 'mode');
  const topic: unknown = Reflect.get(v, 'topic');
  if (typeof id !== 'string' || id === '') throw new Error('widget config: `id` must be a string');
  if (mode !== 'spec' && mode !== 'draft')
    throw new Error('widget config: `mode` must be "spec" or "draft"');
  if (!isTopic(topic)) throw new Error('widget config: `topic` must be a catalog topic');
  return { id, mode, topic };
}
