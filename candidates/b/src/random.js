// Seeded RNG (mulberry32) so the city, the traffic and every screenshot scene are
// reproducible from one seed. Nothing in the game uses Math.random for gameplay.

export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, min, max) { return min + rng() * (max - min); }
export function randInt(rng, min, max) { return Math.floor(rand(rng, min, max + 1)); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function chance(rng, p) { return rng() < p; }
