import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createMap, getTileType, TileType, tileXY } from '../map/map';
import {
  a2h,
  createHeightMap,
  generateTerrain,
  getAmplitude,
  h2i,
  heightMapAdjustWaterLevel,
  heightMapGenerate,
  heightMapSmoothCoastInDirection,
  heightMapSmoothSlopes,
  i2h,
  intNoise,
  randomHeight,
  tgpMaxHeight,
} from './tgp';

const advanced = (seed: number, draws: number): Randomizer => {
  const r = createRandomizer(seed);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

const terrainHeights = (seed: number): Uint8Array => {
  const map = createMap(6, 6);
  generateTerrain(map, createRandomizer(seed), seed);
  return map.height;
};

describe('TGP fixed point and tables (port of tgp.cpp)', () => {
  it('converts heights and amplitudes with arithmetic shifts', () => {
    expect([i2h(1), i2h(8), h2i(31), h2i(-1), a2h(64), a2h(-1)]).toEqual([16, 128, 1, -1, 1, -1]);
  });

  it('picks the flat-terrain maximum height by the smaller map side', () => {
    const sizes = [
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 10],
      [10, 6],
    ] as const;
    expect(sizes.map(([x, y]) => tgpMaxHeight(x, y))).toEqual([80, 112, 128, 144, 224, 80]);
  });

  it('uses the smooth amplitudes and drops octaves the map is too low for', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9].map((f) => getAmplitude(f, 8, 8))).toEqual([
      0, 24000, 12800, 6400, 2700, 1024, 128, 16,
    ]);
    expect([0, 1, 2, 3].map((f) => getAmplitude(f, 10, 10))).toEqual([0, 0, 0, 24000]);
  });

  it('spreads random heights over ±amplitude like RandomHeight', () => {
    const r = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomHeight(r, 24000))).toEqual([
      -282, 238, 327, -165, 361,
    ]);
    const r2 = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomHeight(r2, 1024))).toEqual([-12, 10, 13, -7, 15]);
  });
});

describe('coast noise with 32-bit integers (port of tgp.cpp:int_noise, ruling R3)', () => {
  it.each([
    [0, 0, 53, 0, -0.2817909838631749],
    [5, 7, 179, 12345, -0.8151024850085378],
    [100, 3, 101, 0xdeadbeef, 0.9190056482329965],
    [-3, 250, 211, 42, -0.03440327662974596],
  ])('int_noise(%i, %i, %i) with seed %i', (x, y, prime, seed, expected) => {
    expect(intNoise(x, y, prime, seed)).toBe(expected);
  });
});

describe('height map passes (port of tgp.cpp)', () => {
  it('HeightMapSmoothSlopes caps each vertex at its neighbours plus dh', () => {
    const hm = createHeightMap(2, 2);
    hm.h.set([0, 100, 100, 100, 100, 100, 100, 100, 100]);
    heightMapSmoothSlopes(hm, 10);
    expect([...hm.h]).toEqual([0, 10, 20, 10, 20, 30, 20, 30, 40]);
  });

  it('HeightMapSmoothCoastInDirection softens the first land it meets', () => {
    const hm = createHeightMap(8, 2);
    for (let x = 3; x <= 8; x++) hm.h[x] = 80;
    heightMapSmoothCoastInDirection(hm, 0, 0, 1, 0);
    expect([...hm.h.subarray(0, 9)]).toEqual([0, 0, 0, 20, 25, 31, 38, 46, 80]);
  });

  it('HeightMapAdjustWaterLevel maps the water level to 16 and clamps', () => {
    const hm = createHeightMap(2, 2);
    hm.h.set([-20, -10, 0, 10, 20, 30, 40, 50, 60]);
    heightMapAdjustWaterLevel(hm, 512, 128);
    expect([...hm.h]).toEqual([0, 16, 34, 52, 70, 89, 107, 125, 127]);
  });

  it.each([
    [6, 6, 5718],
    [7, 6, 11304],
    [8, 8, 88399],
  ] as const)('HeightMapGenerate on 2^%i×2^%i draws Random() %i times', (logX, logY, draws) => {
    const r = createRandomizer(7);
    heightMapGenerate(createHeightMap(1 << logX, 1 << logY), r, logX, logY);
    expect(r).toEqual(advanced(7, draws));
  });
});

describe('generateTerrain (TGP up to the second SmoothSlopes, ruling R2)', () => {
  it('writes two height levels, a void border and grass inside', () => {
    const map = createMap(6, 6);
    generateTerrain(map, createRandomizer(1), 1);
    expect(map.height.every((h) => h <= 1)).toBe(true);
    for (const [x, y] of [
      [0, 5],
      [5, 0],
      [63, 5],
      [5, 63],
    ] as const) {
      expect(getTileType(map, tileXY(map, x, y))).toBe(TileType.Void);
    }
    expect(getTileType(map, tileXY(map, 5, 5))).toBe(TileType.Clear);
  });

  it('draws the water borders right after the noise (one more Random())', () => {
    const r = createRandomizer(1);
    generateTerrain(createMap(6, 6), r, 1);
    expect(r).toEqual(advanced(1, 5719));
  });

  it('is deterministic for a seed and changes with it', () => {
    expect(terrainHeights(1)).toEqual(terrainHeights(1));
    expect(terrainHeights(1)).not.toEqual(terrainHeights(2));
  });
});
