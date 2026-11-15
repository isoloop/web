// A worker's side of the native + workers build: the page's relayed records
// and the job's own publishes go to the job's subscribers, and the job's
// publishes also go to the page. Nothing is retained here: the page relays a
// job's `earliest` streams from its own store after the start message, so
// every record reaches a subscriber that is already listening.
import type { Rec, Source, StreamName, Streams } from '../core/streams';
import type { FromWorker, Start, ToWorker } from './protocol';

type AnyRec = Rec<Streams[StreamName]>;

/** Runs `run` on the page's start message, against the records the page relays. */
export function serve(run: (src: Source, start: Start) => void): void {
  const subs = new Map<StreamName, Set<(r: AnyRec) => void>>();
  const deliver = (stream: StreamName, r: AnyRec): void => {
    for (const fn of subs.get(stream) ?? []) fn(r);
  };
  const source: Source = {
    subscribe: <S extends StreamName>(s: S, fn: (r: Rec<Streams[S]>) => void) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- records delivered for `s` are `Streams[S]`
      const cb = fn as (r: AnyRec) => void;
      const set = subs.get(s) ?? new Set();
      set.add(cb);
      subs.set(s, set);
      return () => {
        set.delete(cb);
      };
    },
    publish: (stream, value, key) => {
      deliver(stream, key === undefined ? { value } : { key, value });
      const m: FromWorker =
        key === undefined
          ? { type: 'record', stream, value }
          : { type: 'record', stream, key, value };
      postMessage(m);
    },
  };
  addEventListener('message', (e: MessageEvent<ToWorker>) => {
    const m = e.data;
    if (m.type === 'start') {
      run(source, m);
      return;
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the page relays `stream`'s records
    const value = m.value as Streams[StreamName];
    deliver(m.stream, m.key === undefined ? { value } : { key: m.key, value });
  });
}
