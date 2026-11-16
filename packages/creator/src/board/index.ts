// The interactive board (M3e task 5): the host's controller, the React board
// a page mounts, and the two runtimes. No Isoloop runtime code: the drawer's
// isolate entry is `creator/drawer-isolate`, the widget's `creator/widget-isolate`.
export { CreatorBoard, MOVING_MAX_MS, type CreatorBoardProps } from './Board';
export {
  autoPlacer,
  balancerLabel,
  moveText,
  type AutoMove,
  type AutoPlacer,
  type BalancerLike,
  type LoadsLike,
  type MoveReason,
} from './auto';
export {
  BoardController,
  MOVE_BADGE_MS,
  MOVE_LOG,
  POOLS_EVERY_MS,
  SYNC_KEY,
  WIDGET_CAP,
  type BoardOptions,
  type BoardState,
  type BoardWidget,
  type DrawerState,
} from './controller';
export {
  DRAWER_GRANTS,
  DRAWER_ID,
  hostBus,
  isoloopRuntime,
  type IsoloopRuntimeOptions,
} from './isoloop';
export { LOADS_SYNC_KEY, placementLoads, type PlacementLoads } from './loads';
export { NativeBus, type NativeBusOptions, type NativeSources } from './native-bus';
export { nativeRuntime } from './native';
export { nextPool, poolLabel, poolStatus, sortPools } from './pools';
export type { BoardRuntime, HostBus, Mounted } from './runtime';
export {
  UI_KEY,
  doneOf,
  openOf,
  placementsOf,
  poolsOf,
  type AutoPlacement,
  type DoneMessage,
  type DoneWhat,
  type OpenCommand,
  type PoolStatus,
  type UiRecord,
} from './ui';
