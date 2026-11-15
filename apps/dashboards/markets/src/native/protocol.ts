// The messages between the page and its workers in the native + workers build
// (M3f decision 2): plain `postMessage`, as a careful team would write it
// without Isoloop.
import type { EngineName } from '../core/engines';
import type { Exchange } from '../core/schemas';
import type { ReplayConfig } from '../core/services';
import type { StreamName } from '../core/streams';

/** Page to a worker: what to run. */
export type Start =
  | { type: 'start'; job: 'replay'; config: ReplayConfig }
  | { type: 'start'; job: 'feed'; exchange: Exchange }
  | { type: 'start'; job: 'aggregator' }
  | { type: 'start'; job: 'alerts' }
  | { type: 'start'; job: 'engine'; engine: EngineName };

/** A record, either way: the page relays one into a worker's store, a worker publishes one. */
export interface RecordMessage {
  type: 'record';
  stream: StreamName;
  key?: string;
  value: unknown;
}

export type ToWorker = Start | RecordMessage;
export type FromWorker = RecordMessage;
