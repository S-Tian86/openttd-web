import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, hashGameState } from '../game';
import { ClearGround, getClearGround } from '../map/clear';
import { getTileType, isInnerTile, TileType, tileXY } from '../map/map';
import { getTileSlopeZ } from '../map/slope';
import { isCoastTile, isWaterTile, makeSea } from '../map/water';
import { clearTileAttempts, generateClearTile } from './clear-gen';
import { countLandTiles, createGame, generateGame, SETTLE_PASSES } from './generate';

/**
 * Golden replay hash of the 64×64 world for seed 1 (ruling R9). Pinned from the first run
 * (Step 6); every later task that changes generation re-pins it and says why in its commit.
 */
const GOLDEN_64_SEED_1 = '11e1df20';

const countClear = (seed: number, ground: ClearGround): number => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  generateClearTile(game.map, createRandomizer(seed));
  let n = 0;
  for (let t = 0; t < game.map.size; t++) {
    if (getTileType(game.map, t) === TileType.Clear && getClearGround(game.map, t) === ground) n++;
  }
  return n;
};

const progressOf = (seed: number): { fractions: number[]; hash: string } => {
  const gen = generateGame({ mapLogX: 6, mapLogY: 6, seed });
  const fractions: number[] = [];
  let step = gen.next();
  while (step.done !== true) {
    fractions.push(step.value.fraction);
    step = gen.next();
  }
  return { fractions, hash: hashGameState(step.value) };
};

describe('GenerateClearTile (port of clear_cmd.cpp)', () => {
  it('derives the rough and rocky attempts from the first two draws', () => {
    expect(
      clearTileAttempts(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 536872454, 3515126559),
    ).toEqual({ rough: 97, rocks: 10 });
    expect(clearTileAttempts(createEmptyGame().map, 536872454, 3515126559)).toEqual({
      rough: 1542,
      rocks: 159,
    });
  });

  it('roughens and rocks clear tiles but never water', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const sea = tileXY(game.map, 30, 30);
    makeSea(game.map, sea);
    generateClearTile(game.map, createRandomizer(12345));
    expect(isWaterTile(game.map, sea)).toBe(true);
    expect(countClear(12345, ClearGround.Rough)).toBeGreaterThan(0);
    expect(countClear(12345, ClearGround.Rocks)).toBeGreaterThan(0);
  });
});

describe('CountLandTiles (port of map.cpp)', () => {
  it('counts every tile but open water, adds 1/12 and caps at the map size', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    expect(countLandTiles(map)).toBe(4096);
    for (let t = 0; t < 1024; t++) makeSea(map, t);
    expect(countLandTiles(map)).toBe(3328);
  });
});

describe('generateGame (port of genworld.cpp:_GenerateWorld)', () => {
  it.each([
    [6, 6],
    [8, 6],
    [6, 8],
  ] as const)('keeps OpenTTD map invariants on 2^%i×2^%i', (mapLogX, mapLogY) => {
    const { map, tickCounter } = createGame({ mapLogX, mapLogY, seed: 3 });
    expect(tickCounter).toBe(SETTLE_PASSES);
    const bad: number[] = [];
    for (let t = 0; t < map.size; t++) {
      expect(map.height[t]).toBeLessThanOrEqual(1);
      expect(getTileType(map, t) === TileType.Void).toBe(!isInnerTile(map, t));
      const { slope, z } = getTileSlopeZ(map, t);
      if (isWaterTile(map, t) && (slope !== 0 || z !== 0)) bad.push(t);
      if (isCoastTile(map, t) && (z !== 0 || slope === 0)) bad.push(t);
    }
    expect(bad).toEqual([]);
  });

  it('reports rising progress up to 1 and returns the createGame world', () => {
    const { fractions, hash } = progressOf(3);
    expect(fractions).toEqual(fractions.toSorted((a, b) => a - b));
    expect(fractions.at(-1)).toBe(1);
    expect(hash).toBe(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 3 })));
  });

  it('is reproducible from the seed (golden replay hash)', () => {
    expect(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 1 }))).toBe(GOLDEN_64_SEED_1);
    expect(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 2 }))).not.toBe(
      GOLDEN_64_SEED_1,
    );
  });
});
