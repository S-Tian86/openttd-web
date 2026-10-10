import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { INVALID_TILE } from '../map/geometry';
import {
  getHouseType,
  getHouseBuildingStage,
  isHouseCompleted,
  makeHouseTile,
} from '../map/house-map';
import { getTileType, TileType, tileXY } from '../map/map';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import { houseSpec } from './house-specs';
import {
  buildTownHouse,
  canBuildHouseHere,
  checkTownBuild2x2House,
  tileLoopTown,
  tryBuildTownHouse,
} from './houses';
import { newTown, TownFlag, type Town } from './town';

const NOOP = (): void => undefined;

const advanced = (draws: number): Randomizer => {
  const r = createRandomizer(12345);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

const townGame = (): { game: GameState; town: Town } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
  game.towns.push(town);
  game.random = createRandomizer(12345);
  return { game, town };
};

describe('BuildTownHouse at world generation (port of town_cmd.cpp)', () => {
  it('completes the house and adds its population when Chance16(1,7) fails', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32);
    buildTownHouse(game, town, t, houseSpec(0x06), 0xab, true);
    expect([
      getHouseType(game.map, t),
      isHouseCompleted(game.map, t),
      game.map.m1[t],
      town.population,
      town.numHouses,
    ]).toEqual([0x06, true, 0xab, 30, 1]);
  });

  it('leaves the house unfinished when Chance16(1,7) passes', () => {
    const { game, town } = townGame();
    game.random = advanced(4); // construction_random 4215375298 (stage 2, counter 0), then 2178421593 passes 1/7
    const t = tileXY(game.map, 40, 32);
    buildTownHouse(game, town, t, houseSpec(0x06), 0, true);
    expect([
      isHouseCompleted(game.map, t),
      getHouseBuildingStage(game.map, t),
      game.map.m5[t],
      town.population,
    ]).toEqual([false, 2, 16, 0]);
  });

  it('writes the four stadium tiles with consecutive types', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 20, 20);
    buildTownHouse(game, town, t, houseSpec(0x14), 0, true);
    const tiles = [
      [20, 20],
      [20, 21],
      [21, 20],
      [21, 21],
    ] as const;
    expect(tiles.map(([x, y]) => getHouseType(game.map, tileXY(game.map, x, y)))).toEqual([
      0x14, 0x15, 0x16, 0x17,
    ]);
    expect(town.numHouses).toBe(1);
  });
});

describe('TileLoop_Town construction (port of town_cmd.cpp:AdvanceHouseConstruction)', () => {
  it('completes a house begun at stage 0 on its 24th visit and adds its population', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32);
    makeHouseTile(game.map, t, 0, 0, 0, 0x06, 0);
    town.numHouses = 1;
    for (let i = 0; i < 23; i++) tileLoopTown(game, t, NOOP);
    expect([isHouseCompleted(game.map, t), town.population]).toEqual([false, 0]);
    tileLoopTown(game, t, NOOP);
    expect([isHouseCompleted(game.map, t), town.population, game.map.m5[t]]).toEqual([true, 30, 0]);
  });
});

describe('TryBuildTownHouse (port of town_cmd.cpp)', () => {
  it('builds the first pick of the weighted draw: the church on an edge tile for seed 12345', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32); // d² = 64: Edge
    expect(tryBuildTownHouse(game, town, t, true)).toBe(true);
    expect([getHouseType(game.map, t), (town.flags & TownFlag.HasChurch) !== 0]).toEqual([
      0x03,
      true,
    ]);
  });

  it('skips a second church and keeps drawing (swap-removed list): cottages', () => {
    const { game, town } = townGame();
    town.flags |= TownFlag.HasChurch;
    const t = tileXY(game.map, 40, 32);
    expect(tryBuildTownHouse(game, town, t, true)).toBe(true);
    expect(getHouseType(game.map, t)).toBe(0x19);
  });

  it('needs flat land that a town may clear (ruling R11)', () => {
    const { game } = townGame();
    const { map } = game;
    map.height[tileXY(map, 11, 10)] = 0; // tile (10,10) sloped
    makeRoadNormal(map, tileXY(map, 12, 12), RoadBits.NE, 0);
    makeRoadNormal(map, tileXY(map, 13, 12), RoadBits.X, 0);
    const tiles = [
      tileXY(map, 20, 20),
      tileXY(map, 10, 10),
      tileXY(map, 12, 12),
      tileXY(map, 13, 12),
    ];
    expect(tiles.map((t) => canBuildHouseHere(map, t))).toEqual([true, false, true, false]);
  });

  it('places a 2×2 house on the first free block, clockwise (CheckTownBuild2x2House)', () => {
    const { game } = townGame();
    const { map } = game;
    const t = tileXY(map, 20, 20);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(t);
    makeHouseTile(map, tileXY(map, 21, 20), 0, 0, 3, 0x06, 0);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(tileXY(map, 19, 19));
    for (const [x, y] of [
      [19, 19],
      [19, 21],
    ] as const)
      makeHouseTile(map, tileXY(map, x, y), 0, 0, 3, 0x06, 0);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(INVALID_TILE);
    expect(getTileType(map, t)).toBe(TileType.Clear);
  });
});
