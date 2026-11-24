import { rng, word } from '../rng.ts';
import type { Workload } from './types.ts';

interface Row {
  name: string;
  n: number;
  a: number;
  b: number;
  tag: string;
}

function rows(seed: number, count: number): Row[] {
  const next = rng(seed);
  const tags = ['red', 'green', 'blue', 'amber', 'violet', 'grey', 'teal', 'pink'];
  return Array.from({ length: count }, () => ({
    name: word(next, 8),
    n: Math.floor(next() * 1000),
    a: next(),
    b: Math.floor(next() * 1e4),
    tag: tags[Math.floor(next() * tags.length)]!,
  }));
}

const byNameThenN = (x: Row, y: Row): number =>
  x.name < y.name ? -1 : x.name > y.name ? 1 : x.n - y.n;

const sortNumbers: Workload<{ arr: number[] }> = {
  id: 'sort-numbers-10k',
  tier: 'regular',
  title: 'Sort a copy of 10k numbers',
  setup(seed) {
    const next = rng(seed);
    return { arr: Array.from({ length: 10_000 }, () => next() * 1e6) };
  },
  op({ arr }) {
    const c = arr.slice().sort((a, b) => a - b);
    return c[0]! + c[c.length >> 1]!;
  },
};

const sortObjects: Workload<{ rows: Row[] }> = {
  id: 'sort-objects-2k',
  tier: 'regular',
  title: 'Sort a copy of 2k objects by a string key, then a number',
  setup: (seed) => ({ rows: rows(seed, 2000) }),
  op({ rows }) {
    const c = rows.slice().sort(byNameThenN);
    return c[0]!.n + c[c.length - 1]!.n;
  },
};

const pipeline: Workload<{ rows: Row[] }> = {
  id: 'filter-map-reduce-10k',
  tier: 'regular',
  title: 'filter → map → reduce on 10k objects',
  setup: (seed) => ({ rows: rows(seed, 10_000) }),
  op({ rows }, i) {
    const cut = (i % 10) / 10;
    return rows
      .filter((r) => r.a > cut)
      .map((r) => r.b * 2)
      .reduce((s, x) => s + x, 0);
  },
};

const mapBuild: Workload<{ keys: string[] }> = {
  id: 'map-build-lookup-10k',
  tier: 'regular',
  title: 'Build a Map of 10k string keys, then look up 10k',
  setup(seed) {
    const next = rng(seed);
    return { keys: Array.from({ length: 10_000 }, (_, k) => `${word(next, 5)}-${k}`) };
  },
  op({ keys }, i) {
    const m = new Map<string, number>();
    for (let k = 0; k < keys.length; k++) m.set(keys[k]!, k);
    let s = 0;
    for (let k = 0; k < keys.length; k++) s += m.get(keys[(k + i) % keys.length]!) ?? 0;
    return s;
  },
};

const dedupeGroup: Workload<{ rows: Row[] }> = {
  id: 'set-dedupe-groupby-10k',
  tier: 'regular',
  title: 'Dedupe 10k values with a Set, then Object.groupBy 10k objects',
  setup: (seed) => ({ rows: rows(seed, 10_000) }),
  op({ rows }) {
    const unique = new Set(rows.map((r) => r.n));
    const groups = Object.groupBy(rows, (r) => r.tag);
    let s = unique.size;
    for (const g of Object.values(groups)) s += g?.length ?? 0;
    return s;
  },
};

const json: Workload<{ doc: unknown }> = {
  id: 'json-roundtrip-50kb',
  tier: 'regular',
  title: 'JSON.stringify + JSON.parse of a ~50 KB document',
  setup: (seed) => ({ doc: { items: rows(seed, 500), meta: { seed, at: 0 } } }),
  op({ doc }) {
    const text = JSON.stringify(doc);
    const back = JSON.parse(text) as { items: Row[] };
    return text.length + back.items.length;
  },
};

export const regular: Workload[] = [
  sortNumbers,
  sortObjects,
  pipeline,
  mapBuild,
  dedupeGroup,
  json,
];
