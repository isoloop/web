/** mulberry32: a small seeded PRNG, so every placement builds the same inputs. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random lowercase word of `len` letters. */
export function word(next: () => number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(97 + Math.floor(next() * 26));
  return s;
}
