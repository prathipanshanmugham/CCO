// Deterministic hashing / PRNG helpers.

/** 32-bit FNV-1a hash of a string → unsigned int. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG → function returning floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small helper bag around a PRNG. */
export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    seed: seed >>> 0,
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}
