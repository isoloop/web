import { rng, word } from '../rng.ts';
import type { Workload } from './types.ts';

const mapGetSet: Workload<{ map: Map<number, number> }> = {
  id: 'map-get-set',
  tier: 'cheap',
  title: 'Map: 100 gets + 10 sets on 1k keys',
  setup(seed) {
    const next = rng(seed);
    const map = new Map<number, number>();
    for (let k = 0; k < 1000; k++) map.set(k, Math.floor(next() * 1e6));
    return { map };
  },
  op({ map }, i) {
    let s = 0;
    for (let j = 0; j < 100; j++) s += map.get((i * 7 + j * 13) % 1000) ?? 0;
    for (let j = 0; j < 10; j++) map.set((i + j * 101) % 1000, (s + j) % 1e6);
    return s;
  },
};

const setOps: Workload<{ set: Set<number> }> = {
  id: 'set-add-has-delete',
  tier: 'cheap',
  title: 'Set: 50 adds, 50 has, 50 deletes on 1k values',
  setup(seed) {
    const next = rng(seed);
    const set = new Set<number>();
    while (set.size < 1000) set.add(Math.floor(next() * 1e6));
    return { set };
  },
  op({ set }, i) {
    let hits = 0;
    const base = 2e6 + (i % 1000) * 50;
    for (let j = 0; j < 50; j++) set.add(base + j);
    for (let j = 0; j < 50; j++) if (set.has(base + j * 2)) hits++;
    for (let j = 0; j < 50; j++) set.delete(base + j);
    return hits + set.size;
  },
};

const arrayPushPop: Workload<{ arr: number[] }> = {
  id: 'array-push-pop-indexof',
  tier: 'cheap',
  title: 'Array: 50 push, 50 pop, 5 indexOf on 1k numbers',
  setup(seed) {
    const next = rng(seed);
    return { arr: Array.from({ length: 1000 }, () => Math.floor(next() * 1e6)) };
  },
  op({ arr }, i) {
    for (let j = 0; j < 50; j++) arr.push(i + j);
    let s = 0;
    for (let j = 0; j < 50; j++) s += arr.pop() ?? 0;
    for (let j = 0; j < 5; j++) s += arr.indexOf(arr[(i * 31 + j * 197) % 1000] ?? -1);
    return s;
  },
};

const objectRw: Workload<{ obj: Record<string, number>; keys: string[] }> = {
  id: 'object-read-write',
  tier: 'cheap',
  title: 'Object: read 50 keys, write 10, Object.keys, on a 50-key object',
  setup(seed) {
    const next = rng(seed);
    const keys = Array.from({ length: 50 }, (_, k) => `${word(next, 6)}${k}`);
    const obj: Record<string, number> = {};
    for (const k of keys) obj[k] = Math.floor(next() * 1000);
    return { obj, keys };
  },
  op({ obj, keys }, i) {
    let s = 0;
    for (const k of keys) s += obj[k] ?? 0;
    for (let j = 0; j < 10; j++) obj[keys[(i + j * 5) % 50]!] = (s + j) % 1000;
    return s + Object.keys(obj).length;
  },
};

const smallFilterMap: Workload<{ arr: number[] }> = {
  id: 'small-filter-map',
  tier: 'cheap',
  title: 'filter + map + reduce on 100 numbers',
  setup(seed) {
    const next = rng(seed);
    return { arr: Array.from({ length: 100 }, () => Math.floor(next() * 1000)) };
  },
  op({ arr }, i) {
    return arr
      .filter((x) => (x + i) % 2 === 0)
      .map((x) => x * 2)
      .reduce((a, b) => a + b, 0);
  },
};

export const cheap: Workload[] = [mapGetSet, setOps, arrayPushPop, objectRw, smallFilterMap];
