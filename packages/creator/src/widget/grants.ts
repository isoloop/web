// A widget isolate's grants (M3e decision 9): it reads its source topic and
// the topic its spec comes from, and publishes nothing.
import type { Grants } from '@isoloop/protocol';
import type { WidgetSpec } from '../spec/types';
import { specTopicOf, type WidgetMode } from './records';

export function widgetGrants(spec: WidgetSpec, mode: WidgetMode): Grants {
  return { publish: [], subscribe: [spec.source.topic, specTopicOf(mode)] };
}
