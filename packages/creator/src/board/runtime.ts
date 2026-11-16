// What the board needs from its environment (M3e decision 6): the same
// controller and components run on an Isoloop page (widgets and the drawer
// as isolates, isoloop.ts) and on the native page (the same code on the main
// thread, native.tsx).
import type { CatalogTopic } from '../catalog';
import type { WidgetSpec } from '../spec/types';
import type { WidgetMode } from '../widget/records';
import type { DrawerConfig } from '../drawer/config';
import type { PoolStatus } from './ui';

/** Topics by name from the host: every subscription from `earliest`. */
export interface HostBus {
  subscribe(
    topic: string,
    fn: (r: { readonly key?: string | undefined; readonly value: unknown }) => void,
  ): () => void;
  publish(topic: string, key: string, value: unknown): Promise<void>;
}

/** A widget, a preview or the drawer, running in a surface. */
export interface Mounted {
  stop(): Promise<void>;
}

export interface BoardRuntime {
  readonly kind: 'isoloop' | 'native';
  readonly bus: HostBus;
  /** Starts a widget (`spec`) or the drawer's preview (`draft`) in `surface`. */
  mountWidget(
    spec: WidgetSpec,
    surface: Element,
    o: { readonly mode: WidgetMode; readonly topic: CatalogTopic; readonly draftId?: string },
  ): Mounted;
  /** Starts the drawer's form in `surface`: its own worker, never pooled, on Isoloop. */
  mountDrawer(surface: Element, config: DrawerConfig): Mounted;
  /** The placement field's list, from the kernel's snapshots. Isoloop only. */
  pools?(specs: readonly WidgetSpec[]): PoolStatus[];
  /** What a widget's header says about where it runs. */
  where(spec: WidgetSpec): string;
}
