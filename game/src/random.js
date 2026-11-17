// Seeded RNG (mulberry32) so the city, traffic and shots are deterministic per seed.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rand(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return Math.floor(rand(rng, a, b + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function choice(rng, ...items) { return items[Math.floor(rng() * items.length)]; }
