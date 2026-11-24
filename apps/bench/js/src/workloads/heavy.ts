import { rng, word } from '../rng.ts';
import type { Workload } from './types.ts';

const sortNumbers1m: Workload<{ arr: number[] }> = {
  id: 'sort-numbers-1m',
  tier: 'heavy',
  title: 'Sort a copy of 1M numbers (plain array)',
  setup(seed) {
    const next = rng(seed);
    return { arr: Array.from({ length: 1_000_000 }, () => next() * 1e9) };
  },
  op({ arr }) {
    const c = arr.slice().sort((a, b) => a - b);
    return c[0]! + c[c.length >> 1]!;
  },
};

const sortTyped1m: Workload<{ arr: Float64Array }> = {
  id: 'sort-typed-1m',
  tier: 'heavy',
  title: 'Sort a copy of 1M Float64Array numbers',
  setup(seed) {
    const next = rng(seed);
    const arr = new Float64Array(1_000_000);
    for (let k = 0; k < arr.length; k++) arr[k] = next() * 1e9;
    return { arr };
  },
  op({ arr }) {
    const c = arr.slice().sort();
    return c[0]! + c[c.length >> 1]!;
  },
};

interface Pair {
  group: number;
  name: string;
  v: number;
}

const sortObjects200k: Workload<{ rows: Pair[] }> = {
  id: 'sort-objects-200k',
  tier: 'heavy',
  title: 'Sort a copy of 200k objects on two keys',
  setup(seed) {
    const next = rng(seed);
    return {
      rows: Array.from({ length: 200_000 }, () => ({
        group: Math.floor(next() * 100),
        name: word(next, 6),
        v: next(),
      })),
    };
  },
  op({ rows }) {
    const c = rows
      .slice()
      .sort((x, y) => x.group - y.group || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    return c[0]!.group + c[c.length - 1]!.v;
  },
};

const map1m: Workload<{ seed: number }> = {
  id: 'map-insert-iterate-1m',
  tier: 'heavy',
  title: 'Insert 1M entries into a new Map, then iterate it',
  setup: (seed) => ({ seed }),
  op({ seed }, i) {
    const m = new Map<number, number>();
    const off = (seed + i) % 97;
    for (let k = 0; k < 1_000_000; k++) m.set(k * 3 + off, k);
    let s = 0;
    for (const v of m.values()) s += v & 0xff;
    return s + m.size;
  },
};

const clone5mb: Workload<{ doc: unknown }> = {
  id: 'structured-clone-5mb',
  tier: 'heavy',
  title: 'structuredClone of a nested ~5 MB object',
  setup(seed) {
    const next = rng(seed);
    const users = Array.from({ length: 20_000 }, (_, k) => ({
      id: k,
      name: word(next, 10),
      email: `${word(next, 8)}@${word(next, 6)}.test`,
      score: next() * 100,
      tags: [word(next, 4), word(next, 5), word(next, 6)],
      address: { street: word(next, 12), city: word(next, 8), zip: Math.floor(next() * 99999) },
      history: Array.from({ length: 5 }, () => ({ at: Math.floor(next() * 1e12), v: next() })),
    }));
    return { doc: { users, meta: { seed } } };
  },
  op({ doc }) {
    const c = structuredClone(doc) as { users: { score: number }[] };
    return c.users.length + c.users[c.users.length - 1]!.score;
  },
};

const N = 300;
const matmul: Workload<{ a: Float64Array; b: Float64Array; c: Float64Array }> = {
  id: 'matmul-300',
  tier: 'heavy',
  title: '300×300 matrix multiply (Float64Array)',
  setup(seed) {
    const next = rng(seed);
    const a = new Float64Array(N * N);
    const b = new Float64Array(N * N);
    for (let k = 0; k < N * N; k++) {
      a[k] = next();
      b[k] = next();
    }
    return { a, b, c: new Float64Array(N * N) };
  },
  op({ a, b, c }) {
    for (let r = 0; r < N; r++) {
      for (let col = 0; col < N; col++) {
        let s = 0;
        for (let k = 0; k < N; k++) s += a[r * N + k]! * b[k * N + col]!;
        c[r * N + col] = s;
      }
    }
    return c[0]! + c[N * N - 1]!;
  },
};

export const heavy: Workload[] = [
  sortNumbers1m,
  sortTyped1m,
  sortObjects200k,
  map1m,
  clone5mb,
  matmul,
];
