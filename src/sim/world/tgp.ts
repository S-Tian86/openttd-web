import { nextRandom, randomRange, type Randomizer } from '../core/random';
import { ClearGround, makeClear } from '../map/clear';
import { isInnerTile, makeVoid, tileXY, type MapState } from '../map/map';
import { WORLD } from './settings';

const HEIGHT_DECIMAL_BITS = 4;
const AMPLITUDE_DECIMAL_BITS = 10;
const MAX_TGP_FREQUENCIES = 10;
const WATER_PERCENT_FACTOR = 1024;
/** Port of tgp.cpp:_water_percent (by difficulty.quantity_sea_lakes). */
const WATER_PERCENT = [70, 170, 270, 420] as const;
/** Port of tgp.cpp:TGPGetMaxHeight max_height[terrain_type][min(LogX, LogY) - 6]. */
const MAX_HEIGHT = [
  [3, 3, 3, 3, 4, 5, 7],
  [5, 7, 8, 9, 14, 19, 31],
  [8, 9, 10, 15, 23, 37, 61],
  [10, 11, 17, 19, 49, 63, 73],
  [12, 19, 25, 31, 67, 75, 87],
] as const;
/** Port of tgp.cpp:GetAmplitude amplitudes[smoothness] (×1024). */
const AMPLITUDES = [
  [16000, 5600, 1968, 688, 240, 16, 16],
  [24000, 12800, 6400, 2700, 1024, 128, 16],
  [32000, 19200, 12800, 8000, 3200, 256, 64],
  [48000, 24000, 19200, 16000, 8000, 512, 320],
] as const;
const EXTRAPOLATION_FACTORS = [3.3, 2.8, 2.3, 1.8] as const;
/** Port of tgp.cpp:HeightMapCoastLines margin. */
const COAST_MARGIN = 4;
/** Port of tgp.cpp:HeightMapSmoothCoastInDirection limits. */
const MAX_COAST_DIST_FROM_EDGE = 35;
const MAX_COAST_SMOOTH_DEPTH = 35;

/** Truncates to int16_t, as a C++ assignment to `Height` does. */
const toInt16 = (v: number): number => (v << 16) >> 16;

/** Port of tgp.cpp:I2H. */
export const i2h = (i: number): number => i << HEIGHT_DECIMAL_BITS;
/** Port of tgp.cpp:H2I. */
export const h2i = (h: number): number => h >> HEIGHT_DECIMAL_BITS;
/** Port of tgp.cpp:A2H. */
export const a2h = (a: number): number => a >> (AMPLITUDE_DECIMAL_BITS - HEIGHT_DECIMAL_BITS);

/** Port of genworld.h:BorderFlag (bit per map edge). */
export const BorderFlag = { NorthEast: 1, SouthEast: 2, SouthWest: 4, NorthWest: 8 } as const;

/** Port of tgp.cpp:TGPGetMaxHeight (no custom terrain type in Stage 1). */
export function tgpMaxHeight(logX: number, logY: number): number {
  const fromTable = MAX_HEIGHT[WORLD.terrainType][Math.min(logX, logY) - 6]!;
  return i2h(Math.min(fromTable, WORLD.mapHeightLimit));
}

/** Port of tgp.cpp:GetAmplitude. */
export function getAmplitude(frequency: number, logX: number, logY: number): number {
  const table = AMPLITUDES[WORLD.smoothness];
  let index = frequency - MAX_TGP_FREQUENCIES + table.length;
  let amplitude: number = table[Math.max(0, index)]!;
  if (index >= 0) return amplitude;
  const factor = EXTRAPOLATION_FACTORS[WORLD.smoothness];
  let heightRange = i2h(16);
  do {
    amplitude = Math.trunc(factor * amplitude);
    heightRange <<= 1;
    index++;
  } while (index < 0);
  const k = Math.trunc((tgpMaxHeight(logX, logY) - heightRange) / heightRange);
  return Math.min(Math.max(k, 0), 1) * amplitude;
}

/** Port of tgp.cpp:HeightMap: (sizeX + 1) × (sizeY + 1) vertex heights in 1/16 level. */
export interface HeightMap {
  h: Int16Array;
  sizeX: number;
  sizeY: number;
  dimX: number;
}

/** Port of tgp.cpp:AllocHeightMap. */
export function createHeightMap(sizeX: number, sizeY: number): HeightMap {
  return { h: new Int16Array((sizeX + 1) * (sizeY + 1)), sizeX, sizeY, dimX: sizeX + 1 };
}

const at = (hm: HeightMap, x: number, y: number): number => x + y * hm.dimX;

/** Port of tgp.cpp:IsValidXY (the last vertex row/column is not valid). */
const isValidXY = (hm: HeightMap, x: number, y: number): boolean =>
  x >= 0 && x < hm.sizeX && y >= 0 && y < hm.sizeY;

/** Port of tgp.cpp:RandomHeight. */
export const randomHeight = (r: Randomizer, amplitude: number): number =>
  toInt16(a2h(randomRange(r, 2 * amplitude + 1) - amplitude));

/** Port of tgp.cpp:HeightMapGenerate. */
export function heightMapGenerate(hm: HeightMap, r: Randomizer, logX: number, logY: number): void {
  const start = Math.max(MAX_TGP_FREQUENCIES - Math.min(logX, logY), 0);
  let first = true;
  for (let frequency = start; frequency < MAX_TGP_FREQUENCIES; frequency++) {
    const amplitude = getAmplitude(frequency, logX, logY);
    if (amplitude === 0) continue;
    const step = 1 << (MAX_TGP_FREQUENCIES - frequency - 1);
    if (first) {
      for (let y = 0; y <= hm.sizeY; y += step)
        for (let x = 0; x <= hm.sizeX; x += step) hm.h[at(hm, x, y)] = randomHeight(r, amplitude);
      first = false;
      continue;
    }
    for (let y = 0; y <= hm.sizeY; y += 2 * step)
      for (let x = 0; x <= hm.sizeX - 2 * step; x += 2 * step)
        hm.h[at(hm, x + step, y)] = Math.trunc(
          (hm.h[at(hm, x, y)]! + hm.h[at(hm, x + 2 * step, y)]!) / 2,
        );
    for (let y = 0; y <= hm.sizeY - 2 * step; y += 2 * step)
      for (let x = 0; x <= hm.sizeX; x += step)
        hm.h[at(hm, x, y + step)] = Math.trunc(
          (hm.h[at(hm, x, y)]! + hm.h[at(hm, x, y + 2 * step)]!) / 2,
        );
    for (let y = 0; y <= hm.sizeY; y += step) {
      for (let x = 0; x <= hm.sizeX; x += step) {
        const i = at(hm, x, y);
        hm.h[i] = hm.h[i]! + randomHeight(r, amplitude); // Int16Array store wraps like int16_t +=
      }
    }
  }
}

/**
 * Port of tgp.cpp:HeightMapAdjustWaterLevel (with HeightMapGetMinMaxAvg and
 * HeightMapMakeHistogram; the average is unused).
 */
export function heightMapAdjustWaterLevel(
  hm: HeightMap,
  waterPercent: number,
  hMaxNew: number,
): void {
  let hMin = hm.h[0]!;
  let hMax = hMin;
  for (const h of hm.h) {
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  const hist = new Int32Array(hMax - hMin + 1);
  for (const h of hm.h) hist[h - hMin]!++;

  const desired = Math.trunc((waterPercent * hm.sizeX * hm.sizeY) / WATER_PERCENT_FACTOR);
  let level = hMin;
  let waterTiles = 0;
  for (; level < hMax; level++) {
    waterTiles += hist[level - hMin]!;
    if (waterTiles >= desired) break;
  }

  for (let i = 0; i < hm.h.length; i++) {
    let h = toInt16(Math.trunc((hMaxNew * (hm.h[i]! - level)) / (hMax - level)) + i2h(1));
    if (h < 0) h = i2h(0);
    if (h >= hMaxNew) h = hMaxNew - 1;
    hm.h[i] = h;
  }
}

/**
 * Port of tgp.cpp:int_noise. OpenTTD's `long` is 64-bit on Linux and 32-bit on Windows;
 * the port uses 32-bit two's complement on every platform (ruling R3).
 */
export function intNoise(x: number, y: number, prime: number, seed: number): number {
  let n = (x + Math.imul(y, prime) + seed) | 0;
  n = ((n << 13) ^ n) | 0;
  const v = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) | 0;
  return 1.0 - (v & 0x7fffffff) / 1073741824.0;
}

/** Port of tgp.cpp:linear_interpolate. */
const linearInterpolate = (a: number, b: number, x: number): number => a + x * (b - a);

/** Port of tgp.cpp:interpolated_noise. */
function interpolatedNoise(x: number, y: number, prime: number, seed: number): number {
  const integerX = Math.trunc(x);
  const integerY = Math.trunc(y);
  const fractionalX = x - integerX;
  const fractionalY = y - integerY;
  const v1 = intNoise(integerX, integerY, prime, seed);
  const v2 = intNoise(integerX + 1, integerY, prime, seed);
  const v3 = intNoise(integerX, integerY + 1, prime, seed);
  const v4 = intNoise(integerX + 1, integerY + 1, prime, seed);
  const i1 = linearInterpolate(v1, v2, fractionalX);
  const i2 = linearInterpolate(v3, v4, fractionalX);
  return linearInterpolate(i1, i2, fractionalY);
}

/** Port of tgp.cpp:perlin_coast_noise_2D. */
export function perlinCoastNoise2D(
  x: number,
  y: number,
  p: number,
  prime: number,
  seed: number,
): number {
  let total = 0.0;
  for (let i = 0; i < 6; i++) {
    const frequency = 1 << i;
    const amplitude = Math.pow(p, i);
    total +=
      interpolatedNoise((x * frequency) / 64.0, (y * frequency) / 64.0, prime, seed) * amplitude;
  }
  return total;
}

/** Widens a coast depth like tgp.cpp:HeightMapCoastLines (`S + margin` mirror and the small-map rule). */
function coastDepth(noise: number, smallestLog: number): number {
  const s = Math.trunc((smallestLog * smallestLog) / 64);
  let depth = Math.max(s + noise, s + COAST_MARGIN - noise);
  if (smallestLog < 8 && depth > 5) depth /= 1.5;
  return depth;
}

/**
 * Port of tgp.cpp:HeightMapCoastLines. `smallestLog` is min(map_x, map_y), the log2 sizes;
 * `seed` is game_creation.generation_seed.
 */
export function heightMapCoastLines(
  hm: HeightMap,
  borders: number,
  smallestLog: number,
  seed: number,
): void {
  const { sizeX, sizeY } = hm;
  const n = (x: number, y: number, p: number, prime: number): number =>
    perlinCoastNoise2D(x, y, p, prime, seed);

  for (let y = 0; y <= sizeY; y++) {
    if ((borders & BorderFlag.NorthEast) !== 0) {
      const raw = Math.abs((n(sizeY - y, y, 0.9, 53) + 0.25) * 5 + (n(y, y, 0.35, 179) + 1) * 12);
      const maxX = coastDepth(raw, smallestLog);
      for (let x = 0; x < maxX; x++) hm.h[at(hm, x, y)] = 0;
    }
    if ((borders & BorderFlag.SouthWest) !== 0) {
      const raw = Math.abs((n(sizeY - y, y, 0.85, 101) + 0.3) * 6 + (n(y, y, 0.45, 67) + 0.75) * 8);
      const maxX = coastDepth(raw, smallestLog);
      for (let x = sizeX; x > sizeX - 1 - maxX; x--) hm.h[at(hm, x, y)] = 0;
    }
  }

  const half = Math.trunc(sizeY / 2);
  const third = Math.trunc(sizeY / 3);
  for (let x = 0; x <= sizeX; x++) {
    if ((borders & BorderFlag.NorthWest) !== 0) {
      const raw = Math.abs((n(x, half, 0.9, 167) + 0.4) * 5 + (n(x, third, 0.4, 211) + 0.7) * 9);
      const maxY = coastDepth(raw, smallestLog);
      for (let y = 0; y < maxY; y++) hm.h[at(hm, x, y)] = 0;
    }
    if ((borders & BorderFlag.SouthEast) !== 0) {
      const raw = Math.abs(
        (n(x, third, 0.85, 71) + 0.25) * 6 + (n(x, third, 0.35, 193) + 0.75) * 12,
      );
      const maxY = coastDepth(raw, smallestLog);
      for (let y = sizeY; y > sizeY - 1 - maxY; y--) hm.h[at(hm, x, y)] = 0;
    }
  }
}

/** Port of tgp.cpp:HeightMapSmoothCoastInDirection. */
export function heightMapSmoothCoastInDirection(
  hm: HeightMap,
  orgX: number,
  orgY: number,
  dirX: number,
  dirY: number,
): void {
  let x = orgX;
  let y = orgY;
  // Search for the coast (first non-water vertex, or one beside it).
  for (
    let ed = 0;
    isValidXY(hm, x, y) && ed < MAX_COAST_DIST_FROM_EDGE;
    x += dirX, y += dirY, ed++
  ) {
    if (hm.h[at(hm, x, y)]! >= i2h(1)) break;
    if (isValidXY(hm, x + dirY, y + dirX) && hm.h[at(hm, x + dirY, y + dirX)]! > 0) break;
    if (isValidXY(hm, x - dirY, y - dirX) && hm.h[at(hm, x - dirY, y - dirX)]! > 0) break;
  }

  // Soften the coast slope: std::min<uint>(h, h_prev + (4 + depth)).
  let hPrev = i2h(1);
  for (
    let depth = 0;
    isValidXY(hm, x, y) && depth <= MAX_COAST_SMOOTH_DEPTH;
    depth++, x += dirX, y += dirY
  ) {
    const i = at(hm, x, y);
    const h = toInt16(Math.min(hm.h[i]! >>> 0, (hPrev + 4 + depth) >>> 0));
    hm.h[i] = h;
    hPrev = h;
  }
}

/** Port of tgp.cpp:HeightMapSmoothCoasts. */
export function heightMapSmoothCoasts(hm: HeightMap, borders: number): void {
  for (let x = 0; x < hm.sizeX; x++) {
    if ((borders & BorderFlag.NorthWest) !== 0) heightMapSmoothCoastInDirection(hm, x, 0, 0, 1);
    if ((borders & BorderFlag.SouthEast) !== 0) {
      heightMapSmoothCoastInDirection(hm, x, hm.sizeY - 1, 0, -1);
    }
  }
  for (let y = 0; y < hm.sizeY; y++) {
    if ((borders & BorderFlag.NorthEast) !== 0) heightMapSmoothCoastInDirection(hm, 0, y, 1, 0);
    if ((borders & BorderFlag.SouthWest) !== 0) {
      heightMapSmoothCoastInDirection(hm, hm.sizeX - 1, y, -1, 0);
    }
  }
}

/** Port of tgp.cpp:HeightMapSmoothSlopes. */
export function heightMapSmoothSlopes(hm: HeightMap, dhMax: number): void {
  const { sizeX, sizeY } = hm;
  for (let y = 0; y <= sizeY; y++) {
    for (let x = 0; x <= sizeX; x++) {
      const left = hm.h[at(hm, x > 0 ? x - 1 : x, y)]!;
      const up = hm.h[at(hm, x, y > 0 ? y - 1 : y)]!;
      const hMax = toInt16(Math.min(left, up) + dhMax);
      const i = at(hm, x, y);
      if (hm.h[i]! > hMax) hm.h[i] = hMax;
    }
  }
  for (let y = sizeY; y >= 0; y--) {
    for (let x = sizeX; x >= 0; x--) {
      const right = hm.h[at(hm, x < sizeX ? x + 1 : x, y)]!;
      const down = hm.h[at(hm, x, y < sizeY ? y + 1 : y)]!;
      const hMax = toInt16(Math.min(right, down) + dhMax);
      const i = at(hm, x, y);
      if (hm.h[i]! > hMax) hm.h[i] = hMax;
    }
  }
}

/**
 * TerraGenesis up to the second HeightMapSmoothSlopes, thresholded to two levels (ruling R2),
 * then InitializeLandscape's tile types. Port of tgp.cpp:GenerateTerrainPerlin with
 * HeightMapNormalize. Yields between steps (progress 0..1) so a 1024x1024 map can be sliced;
 * the yields draw no random numbers, so the result does not depend on how it is driven.
 */
export function* generateTerrainSteps(
  map: MapState,
  r: Randomizer,
  seed: number,
): Generator<number, void, void> {
  const hm = createHeightMap(map.sizeX, map.sizeY);
  heightMapGenerate(hm, r, map.logX, map.logY);
  yield 0.2;
  const hMaxNew = tgpMaxHeight(map.logX, map.logY);
  const roughness = 7 + 3 * WORLD.smoothness;
  heightMapAdjustWaterLevel(hm, WATER_PERCENT[WORLD.quantitySeaLakes], hMaxNew);
  const borders = nextRandom(r) & 0xf; // water_borders == BorderFlag::Random: GB(Random(), 0, 4)
  heightMapCoastLines(hm, borders, Math.min(map.logX, map.logY), seed);
  yield 0.4;
  heightMapSmoothSlopes(hm, roughness);
  heightMapSmoothCoasts(hm, borders);
  yield 0.5;
  heightMapSmoothSlopes(hm, roughness);
  yield 0.6;
  // HeightMapSineTransform and HeightMapCurves never move a vertex across level 1 (world-generation.md §4.3.2).
  for (let y = 0; y < map.sizeY; y++) {
    for (let x = 0; x < map.sizeX; x++) {
      const t = tileXY(map, x, y);
      if (isInnerTile(map, t)) makeClear(map, t, ClearGround.Grass, 3);
      else makeVoid(map, t);
      // Void tiles keep the height-map height, as OpenTTD does (ruling R2).
      map.height[t] = h2i(hm.h[at(hm, x, y)]!) >= 1 ? 1 : 0;
    }
    if ((y & 127) === 127) yield 0.6 + (0.4 * (y + 1)) / map.sizeY;
  }
}

/** Runs generateTerrainSteps to the end. */
export function generateTerrain(map: MapState, r: Randomizer, seed: number): void {
  for (const _ of generateTerrainSteps(map, r, seed)) {
    // Nothing to do between steps.
  }
}
