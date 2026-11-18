// A small seeded random source (mulberry32): one seed always produces the
// same sequence, so the same seed always builds the same city, the same
// traffic and the same mission layout. A ?seed=N run is reproducible.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// One item from a list, uniformly.
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

// A float in [min, max).
export function range(random, min, max) {
  return min + random() * (max - min);
}

// An integer in [min, max], both ends included.
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
