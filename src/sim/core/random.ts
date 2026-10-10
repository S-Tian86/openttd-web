/** Generator state. Port of core/random_func.hpp:Randomizer (two uint32 words). */
export interface Randomizer {
  state0: number;
  state1: number;
}

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Port of core/random_func.cpp:Randomizer::SetSeed. */
export function createRandomizer(seed: number): Randomizer {
  const s = seed >>> 0;
  return { state0: s, state1: s };
}

/** Port of core/random_func.cpp:Randomizer::Next. Returns a uint32. */
export function nextRandom(r: Randomizer): number {
  const s = r.state0;
  const t = r.state1;
  r.state0 = (s + rotr((t ^ 0x1234567f) >>> 0, 7) + 1) >>> 0;
  r.state1 = (rotr(s, 3) - 1) >>> 0;
  return r.state1;
}

/**
 * (value * limit) >> 32 without losing precision: the 64-bit product is split in 16-bit
 * halves. Port of core/random_func.hpp:ScaleToLimit.
 */
export function scaleToLimit(value: number, limit: number): number {
  const high = value >>> 16;
  const low = value & 0xffff;
  return Math.floor((high * limit + Math.floor((low * limit) / 65536)) / 65536);
}

/** Random number in [0, limit). Port of core/random_func.hpp:RandomRange. */
export function randomRange(r: Randomizer, limit: number): number {
  return scaleToLimit(nextRandom(r), limit);
}

/** True with probability a/b, using the low 16 bits of r. Port of core/random_func.hpp:Chance16I. */
export function chance16I(a: number, b: number, r: number): boolean {
  return Math.floor(((r & 0xffff) * b + Math.floor(b / 2)) / 65536) < a;
}
