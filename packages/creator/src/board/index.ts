// The interactive board (M3e task 5): the host's controller, the React board
// a page mounts, and the two runtimes. No Isoloop runtime code: the drawer's
// isolate entry is `creator/drawer-isolate`, the widget's `creator/widget-isolate`.
export { CreatorBoard, type CreatorBoardProps } from './Board';
export {
  BoardController,
  POOLS_EVERY_MS,
  SYNC_KEY,
  WIDGET_CAP,
  type BoardOptions,
  type BoardState,
  type BoardWidget,
  type DrawerState,
} from './controller';
export { DRAWER_GRANTS, DRAWER_ID, isoloopRuntime, type IsoloopRuntimeOptions } from './isoloop';
export { NativeBus, type NativeBusOptions, type NativeSources } from './native-bus';
export { nativeRuntime } from './native';
export { nextPool, poolLabel, poolStatus, sortPools } from './pools';
export type { BoardRuntime, HostBus, Mounted } from './runtime';
export {
  UI_KEY,
  doneOf,
  openOf,
  poolsOf,
  type DoneMessage,
  type DoneWhat,
  type OpenCommand,
  type PoolStatus,
  type UiRecord,
} from './ui';
