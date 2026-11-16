// What the drawer's form is told when it starts: `manifest.config` in an
// isolate, so plain data only. Checked by hand: the drawer validates specs
// with Zod, but its config is the page's own.
import type { Catalog } from '../catalog';

export type DrawerConfig = {
  /** The topics a widget may read: the dashboard's catalog. */
  readonly catalog: Catalog;
  /** The native page: the same form on the main thread, with no placement to choose. */
  readonly native: boolean;
  /** Most widgets a page holds, the preview not counted (decision 20). */
  readonly cap: number;
};

/** The config, or a thrown error naming what's wrong (the isolate then fails to start). */
export function drawerConfig(v: unknown): DrawerConfig {
  if (typeof v !== 'object' || v === null) throw new Error('drawer config: expected an object');
  const catalog: unknown = Reflect.get(v, 'catalog');
  const native: unknown = Reflect.get(v, 'native');
  const cap: unknown = Reflect.get(v, 'cap');
  if (
    typeof catalog !== 'object' ||
    catalog === null ||
    !Array.isArray(Reflect.get(catalog, 'topics'))
  ) {
    throw new Error('drawer config: `catalog` must be a catalog');
  }
  if (typeof native !== 'boolean') throw new Error('drawer config: `native` must be a boolean');
  if (typeof cap !== 'number' || !Number.isInteger(cap) || cap < 1) {
    throw new Error('drawer config: `cap` must be a positive whole number');
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checked its topics list above; the page wrote it
  return { catalog: catalog as DrawerConfig['catalog'], native, cap };
}
