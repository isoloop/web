// The board on a native page (M3e task 5): no kernel, the widgets and the
// form on the main thread over the NativeBus. The two source topics are fed
// here, as the dashboards' native builds feed theirs, and keep two minutes.
import { createRoot } from 'react-dom/client';
import {
  CreatorBoard,
  nativeRuntime,
  type BoardController,
  type NativeSources,
} from '../../src/board';
import { CATALOG, OTHER, SOURCE, STARTERS } from './catalog';

type Rec = { key: string; value: { ts: number; temp: number } };
type Fn = (r: { readonly key?: string | undefined; readonly value: unknown }) => void;

const held = new Map<string, Rec[]>([
  [SOURCE.name, []],
  [OTHER.name, []],
]);
const subscribers = new Map<string, Set<Fn>>();

let n = 0;
setInterval(() => {
  n++;
  const ts = Date.now();
  for (const name of [SOURCE.name, OTHER.name]) {
    const recs = held.get(name) ?? [];
    for (const key of ['m1', 'm2']) {
      const r: Rec = { key, value: { ts, temp: key === 'm1' ? n % 50 : 100 } };
      recs.push(r);
      for (const fn of subscribers.get(name) ?? []) fn(r);
    }
    while (recs.length > 0 && (recs[0]?.value.ts ?? ts) < ts - SOURCE.history) recs.shift();
  }
}, 50);

const sources: NativeSources = (topic, fn) => {
  const subs = subscribers.get(topic) ?? new Set<Fn>();
  subscribers.set(topic, subs);
  for (const r of held.get(topic) ?? []) fn(r);
  subs.add(fn);
  return () => subs.delete(fn);
};

const runtime = nativeRuntime({ storageKey: 'harness', sources });
let board: BoardController | undefined;
Object.assign(window, { board: { controller: () => board } });
const el = document.createElement('div');
document.body.append(el);
createRoot(el).render(
  <CreatorBoard
    runtime={runtime}
    catalog={CATALOG}
    starters={STARTERS}
    onController={(c) => {
      board = c;
    }}
  />,
);
document.body.dataset['ready'] = 'true';
