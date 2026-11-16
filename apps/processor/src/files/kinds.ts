// The File processor's work (M3h decision 29): four kinds of synthetic file,
// each made from a seed and processed with real CPU work that grows with its
// size. Each kind's work is a generator that yields every few hundred
// microseconds, so a processor can run it in short slices and keep its loop
// turning; a heavy file is ten times the work, still in slices. Pure: no DOM,
// no bus, so it's tested in Node.

export const KINDS = ['csv', 'image', 'archive', 'hash'] as const;
export type Kind = (typeof KINDS)[number];

export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k === v);

export const KIND_LABELS: Record<Kind, string> = {
  csv: 'CSV',
  image: 'Image',
  archive: 'Archive',
  hash: 'Hash',
};

/** A file to process, as the generator publishes it. */
export type Job = {
  /** `<run>-<n>`, unique within a run. */
  id: string;
  kind: Kind;
  /** 1–4: the work scales with it. */
  size: number;
  /** Makes the file's content. */
  seed: number;
  /** Blocks the processor's loop for 2 s, in one piece. */
  poison?: true | undefined;
  /** Ten times the work. */
  heavy?: true | undefined;
  /** Throws partway through. */
  corrupt?: true | undefined;
  /** `performance.timeOrigin + performance.now()` when it was made, in ms. */
  at: number;
};

/** What a kind's work returns: a short digest of what it computed. */
export type Output = string;

/** A small, fast, seeded PRNG (mulberry32): the same seed, the same file. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Thrown by a corrupt file, partway through. */
export class CorruptFile extends Error {
  constructor(id: string) {
    super(`${id}: corrupt file`);
    this.name = 'CorruptFile';
  }
}

/** The work for `job`, yielding between pieces; its return value is the digest. */
export function work(job: Pick<Job, 'id' | 'kind' | 'size' | 'seed' | 'heavy' | 'corrupt'>) {
  const units = job.size * (job.heavy ? 10 : 1);
  const steps = { csv, image, archive, hash }[job.kind](units, job.seed);
  return job.corrupt ? corrupt(steps, job.id) : steps;
}

function* corrupt(steps: Generator<void, Output>, id: string): Generator<void, Output> {
  let n = 0;
  for (let r = steps.next(); !r.done; r = steps.next()) {
    if (++n === 3) throw new CorruptFile(id);
    yield;
  }
  throw new CorruptFile(id);
}

// ---- CSV: make the text, then parse it and aggregate per column ----

const CSV_ROWS = 5_000;

function* csv(units: number, seed: number): Generator<void, Output> {
  const rnd = random(seed);
  const rows = CSV_ROWS * units;
  const lines: string[] = ['id,region,qty,price,discount'];
  for (let i = 0; i < rows; i++) {
    lines.push(
      `${i},r${Math.floor(rnd() * 8)},${Math.floor(rnd() * 100)},${(rnd() * 500).toFixed(2)},${(rnd() * 0.3).toFixed(3)}`,
    );
    if (i % 200 === 199) yield;
  }
  const text = lines.join('\n');
  yield;
  const sums = new Map<string, { qty: number; revenue: number; n: number }>();
  let at = text.indexOf('\n') + 1;
  let n = 0;
  while (at > 0 && at < text.length) {
    const end = text.indexOf('\n', at);
    const line = text.slice(at, end === -1 ? text.length : end);
    const [, region = '', qty = '0', price = '0', discount = '0'] = line.split(',');
    const s = sums.get(region) ?? { qty: 0, revenue: 0, n: 0 };
    const q = Number.parseInt(qty, 10);
    s.qty += q;
    s.revenue += q * Number.parseFloat(price) * (1 - Number.parseFloat(discount));
    s.n++;
    sums.set(region, s);
    at = end === -1 ? -1 : end + 1;
    if (++n % 200 === 0) yield;
  }
  const total = [...sums.values()].reduce((t, s) => t + s.revenue, 0);
  return `${sums.size} regions, ${n} rows, ${total.toFixed(0)}`;
}

// ---- Image: make RGBA pixels, then a 2× box-filter downscale and a blur pass ----

const IMAGE_WIDTH = 256;
const IMAGE_ROWS = 280;

function* image(units: number, seed: number): Generator<void, Output> {
  const rnd = random(seed);
  const w = IMAGE_WIDTH;
  const h = IMAGE_ROWS * units;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i++) px[i] = (rnd() * 256) | 0;
  yield;
  const ow = w >> 1;
  const oh = h >> 1;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      for (let c = 0; c < 4; c++) {
        const a = ((2 * y * w + 2 * x) << 2) + c;
        const b = a + (w << 2);
        out[((y * ow + x) << 2) + c] =
          ((px[a] ?? 0) + (px[a + 4] ?? 0) + (px[b] ?? 0) + (px[b + 4] ?? 0)) >> 2;
      }
    }
    if (y % 8 === 7) yield;
  }
  // A 3×3 blur over the result, three times.
  let src = out;
  for (let pass = 0; pass < 3; pass++) {
    const dst = new Uint8ClampedArray(src.length);
    for (let y = 1; y < oh - 1; y++) {
      for (let x = 1; x < ow - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) s += src[(((y + dy) * ow + x + dx) << 2) + c] ?? 0;
          dst[((y * ow + x) << 2) + c] = s / 9;
        }
      }
      if (y % 8 === 7) yield;
    }
    src = dst;
  }
  let sum = 0;
  for (let i = 0; i < src.length; i += 4) sum += src[i] ?? 0;
  return `${ow}×${oh}, mean ${(sum / (ow * oh)).toFixed(1)}`;
}

// ---- Archive: make compressible bytes, then an LZ77 pass over them ----

const ARCHIVE_BYTES = 120_000;

function* archive(units: number, seed: number): Generator<void, Output> {
  const rnd = random(seed);
  const n = ARCHIVE_BYTES * units;
  const data = new Uint8Array(n);
  // Words from a small vocabulary, so there's something to find.
  const words = Array.from({ length: 40 }, () =>
    Array.from({ length: 3 + Math.floor(rnd() * 6) }, () => 97 + Math.floor(rnd() * 26)),
  );
  for (let i = 0; i < n;) {
    const word = words[Math.floor(rnd() * words.length)] ?? [];
    for (const b of word) if (i < n) data[i++] = b;
    if (i < n) data[i++] = 32;
  }
  yield;
  const WINDOW = 4_096;
  const table = new Int32Array(1 << 14).fill(-1);
  let out = 0;
  let i = 0;
  let sinceYield = 0;
  while (i < n) {
    let best = 0;
    if (i + 2 < n) {
      const h = (((data[i] ?? 0) << 6) ^ ((data[i + 1] ?? 0) << 3) ^ (data[i + 2] ?? 0)) & 0x3fff;
      const cand = table[h] ?? -1;
      table[h] = i;
      if (cand >= 0 && i - cand <= WINDOW) {
        while (best < 258 && i + best < n && data[cand + best] === data[i + best]) best++;
      }
      // A slower, wider search in the window, as a real compressor's lazy match does.
      for (let back = 1; back <= 64 && i - back * 61 >= 0; back++) {
        const c = i - back * 61;
        let len = 0;
        while (len < 32 && i + len < n && data[c + len] === data[i + len]) len++;
        if (len > best) best = len;
      }
    }
    if (best >= 3) {
      out += 3;
      i += best;
    } else {
      out += 1;
      i += 1;
    }
    if (++sinceYield === 3_000) {
      sinceYield = 0;
      yield;
    }
  }
  return `${n} → ${out} bytes`;
}

// ---- Hash: SHA-256 in JavaScript over the file's bytes ----

const HASH_BYTES = 120_000;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 of `bytes`, as hex, yielding every 64 blocks. */
export function* sha256(bytes: Uint8Array): Generator<void, string> {
  const len = bytes.length;
  const blocks = Math.ceil((len + 9) / 64);
  const msg = new Uint8Array(blocks * 64);
  msg.set(bytes);
  msg[len] = 0x80;
  const bits = len * 8;
  const view = new DataView(msg.buffer);
  view.setUint32(msg.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(msg.length - 4, bits >>> 0);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  for (let b = 0; b < blocks; b++) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(b * 64 + t * 4);
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15] ?? 0;
      const w2 = W[t - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[t] = ((W[t - 16] ?? 0) + s0 + (W[t - 7] ?? 0) + s1) >>> 0;
    }
    let [a = 0, bb = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + (K[t] ?? 0) + (W[t] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = ((H[0] ?? 0) + a) >>> 0;
    H[1] = ((H[1] ?? 0) + bb) >>> 0;
    H[2] = ((H[2] ?? 0) + c) >>> 0;
    H[3] = ((H[3] ?? 0) + d) >>> 0;
    H[4] = ((H[4] ?? 0) + e) >>> 0;
    H[5] = ((H[5] ?? 0) + f) >>> 0;
    H[6] = ((H[6] ?? 0) + g) >>> 0;
    H[7] = ((H[7] ?? 0) + h) >>> 0;
    if (b % 64 === 63) yield;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

function* hash(units: number, seed: number): Generator<void, Output> {
  const rnd = random(seed);
  const bytes = new Uint8Array(HASH_BYTES * units);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (rnd() * 256) | 0;
  yield;
  const hex = yield* sha256(bytes);
  return hex.slice(0, 16);
}

/** Runs `job`'s work to the end at once: for tests and calibration. */
export function runAll(job: Parameters<typeof work>[0]): Output {
  const steps = work(job);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}
