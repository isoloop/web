// Spawning widget isolates from the page (M3e decisions 9, 10 and 13; M3h
// decision 19). The page and the drawer decide when (applyKind says whether
// an edit needs it); this builds the manifest. A manual widget goes to its
// creator pool, a preview to its own worker, and an `auto` widget has no
// pool: the page's balancer picks one. Types only from @isoloop/host: no
// Isoloop code reaches a native bundle through here.
import type { IsolateHandle, IsolateManifest, Kernel } from '@isoloop/host';
import type { CatalogTopic } from '../catalog';
import { placementKey, type WidgetSpec } from '../spec/types';
import { widgetGrants } from './grants';
import type { WidgetMode } from './records';
import type { WidgetConfig } from './runner';

/** The kernel pool a spec's `placement.pool` names, kept apart from the dashboard's own pools. */
export const poolId = (pool: string): string => `creator-${pool}`;

/** The spec's `placement.pool` from a kernel pool id, or `undefined` for another pool. */
export const poolOfId = (id: string): string | undefined =>
  id.startsWith('creator-') ? id.slice('creator-'.length) : undefined;

/** The isolate id: `widget-<id>` on the grid, `preview-<draft id>` in the drawer. */
export const isolateIdOf = (mode: WidgetMode, id: string): string =>
  `${mode === 'spec' ? 'widget' : 'preview'}-${id}`;

/** The widget id an isolate id carries (`widget-<id>`), or `undefined` for anything else. */
export const widgetIdOf = (isolateId: string): string | undefined =>
  isolateId.startsWith('widget-') ? isolateId.slice('widget-'.length) : undefined;

export type SpawnWidget = {
  /** The widget isolate's URL: `import src from 'creator/widget-isolate?isolate'`. */
  readonly src: string;
  readonly surface: Element;
  /** The source topic's catalog entry; its name must be `spec.source.topic`. */
  readonly topic: CatalogTopic;
  /** Default `spec`. A `draft` is the drawer's preview: on its own worker, reading `creator.draft.v1`. */
  readonly mode?: WidgetMode;
  /** For a draft: its key in `creator.draft.v1`. Default `spec.id`. */
  readonly draftId?: string;
};

/**
 * The manifest for `spec`'s widget isolate: grants for its source topic and
 * spec topic only; in its creator pool if it's placed by hand, with no pool
 * if it's `auto` (the balancer sets one) or a preview (its own worker).
 */
export function widgetManifest(spec: WidgetSpec, o: SpawnWidget): IsolateManifest {
  const mode = o.mode ?? 'spec';
  if (o.topic.name !== spec.source.topic) {
    throw new Error(`spawnWidget: topic "${o.topic.name}" isn't the spec's "${spec.source.topic}"`);
  }
  const id = mode === 'draft' ? (o.draftId ?? spec.id) : spec.id;
  const config: WidgetConfig =
    mode === 'spec'
      ? { id, mode, topic: o.topic, pool: placementKey(spec.placement) }
      : { id, mode, topic: o.topic };
  const pool =
    mode === 'spec' && spec.placement.mode === 'manual' ? poolId(spec.placement.pool) : undefined;
  return {
    id: isolateIdOf(mode, id),
    src: o.src,
    surface: o.surface,
    config,
    grants: widgetGrants(spec, mode),
    ...(pool === undefined ? {} : { pool }),
  };
}

/**
 * Spawns the widget isolate for `spec` with `kernel.spawn` (widgetManifest).
 * An `auto` widget on the grid goes through the page's balancer instead
 * (board/isoloop.ts). Stop it with `handle.stop()`.
 */
export function spawnWidget(
  kernel: Pick<Kernel, 'spawn'>,
  spec: WidgetSpec,
  o: SpawnWidget,
): IsolateHandle {
  return kernel.spawn(widgetManifest(spec, o));
}
