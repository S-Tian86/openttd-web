import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { distanceFromEdge, distanceManhattan, INVALID_TILE } from '../map/geometry';
import { getHouseType, isHouseCompleted } from '../map/house-map';
import { getTileType, isInnerTile, TileType, tileXY } from '../map/map';
import { ClearGround, makeClear } from '../map/clear';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import { makeSea } from '../map/water';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { WorldGenerationError } from '../world/errors';
import { createGame, countLandTiles } from '../world/generate';
import { houseSpec } from './house-specs';
import { buildTownHouse } from './houses';
import { townName } from './town-names';
import {
  defaultTownCount,
  deleteTown,
  doCreateTown,
  generateTowns,
  findNearestGoodCoastalTownSpot,
  getClosestWaterDistance,
  townCanBePlacedHere,
} from './town-gen';
import { newTown } from './town';

const SEA_TILES = [
  [30, 30],
  [31, 30],
  [33, 30],
  [34, 30],
  [30, 31],
  [31, 31],
  [33, 31],
  [34, 31],
  [30, 33],
  [31, 33],
  [33, 33],
  [34, 33],
  [30, 34],
] as const;

const emptyGame = (): GameState => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.random = createRandomizer(12345);
  return game;
};

const seaGame = (): GameState => {
  const game = emptyGame();
  for (let t = 0; t < game.map.size; t++) if (isInnerTile(game.map, t)) makeSea(game.map, t);
  game.initialLandCount = countLandTiles(game.map);
  return game;
};

const runTowns = (game: GameState): void => {
  const gen = generateTowns(game);
  while (gen.next().done !== true) {
    // progress only
  }
};

const generationErrorKey = (game: GameState): string | null => {
  try {
    runTowns(game);
    return null;
  } catch (error) {
    return error instanceof WorldGenerationError ? error.key : 'not a WorldGenerationError';
  }
};

describe('town placement (port of town_cmd.cpp)', () => {
  it('scales the default town count by map size (GetDefaultTownsForMapSize)', () => {
    const counts = [
      [8, 8, 2],
      [6, 6, 2],
      [10, 10, 2],
      [8, 8, 0],
      [8, 8, 3],
    ] as const;
    expect(
      counts.map(([x, y, level]) =>
        defaultTownCount(createEmptyGame({ mapLogX: x, mapLogY: y }).map, level),
      ),
    ).toEqual([23, 2, 368, 5, 46]);
  });

  it('needs 12 tiles from the edge, 20 tiles from other towns and a flat dry site (TownCanBePlacedHere)', () => {
    const game = emptyGame();
    const { map } = game;
    expect([
      townCanBePlacedHere(game, tileXY(map, 32, 32)),
      townCanBePlacedHere(game, tileXY(map, 11, 32)),
      townCanBePlacedHere(game, tileXY(map, 12, 32)),
    ]).toEqual([true, false, true]);
    game.towns.push(newTown(0, tileXY(map, 32, 32), 0, false));
    expect([
      townCanBePlacedHere(game, tileXY(map, 40, 43)),
      townCanBePlacedHere(game, tileXY(map, 40, 44)),
    ]).toEqual([false, true]);
  });

  it('needs 12 of the 25 tiles around the centre to be dry and level', () => {
    const game = emptyGame();
    const { map } = game;
    for (const [x, y] of SEA_TILES) makeSea(map, tileXY(map, x, y));
    expect(townCanBePlacedHere(game, tileXY(map, 32, 32))).toBe(true); // 12 qualify
    makeSea(map, tileXY(map, 31, 34));
    expect(townCanBePlacedHere(game, tileXY(map, 32, 32))).toBe(false); // 11 qualify
  });
});

describe('DoCreateTown (port of town_cmd.cpp)', () => {
  it('grows 4x times with x = (Random() & 15) + 8, then counts real houses and population', () => {
    const game = emptyGame();
    const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
    game.towns.push(town);
    doCreateTown(game, town); // first draw 536872454: x = 14
    let buildings = 0;
    let population = 0;
    for (let t = 0; t < game.map.size; t++) {
      if (getTileType(game.map, t) !== TileType.House) continue;
      const spec = houseSpec(getHouseType(game.map, t));
      if (spec.size !== 'part') buildings++;
      if (isHouseCompleted(game.map, t)) population += spec.population;
    }
    expect([town.numHouses, town.population]).toEqual([buildings, population]);
    expect(buildings).toBeGreaterThan(0);
  });

  it('deletes a town by clearing its roads and houses only (CmdDeleteTown)', () => {
    const game = emptyGame();
    const { map } = game;
    const keep = newTown(0, tileXY(map, 20, 20), 1, false);
    const gone = newTown(1, tileXY(map, 44, 44), 2, false);
    game.towns.push(keep, gone);
    makeRoadNormal(map, tileXY(map, 20, 20), RoadBits.X, 0);
    makeRoadNormal(map, tileXY(map, 44, 44), RoadBits.X, 1);
    buildTownHouse(game, gone, tileXY(map, 45, 44), houseSpec(0x06), 0, true);
    deleteTown(game, gone);
    expect([
      getTileType(map, tileXY(map, 20, 20)),
      getTileType(map, tileXY(map, 44, 44)),
      getTileType(map, tileXY(map, 45, 44)),
    ]).toEqual([TileType.Road, TileType.Clear, TileType.Clear]);
    expect(game.towns.map((t) => t.index)).toEqual([0]);
  });
});

describe('GenerateTowns (port of town_cmd.cpp)', () => {
  it('places towns by the rules on the default world', () => {
    const { map, towns } = createGame({ seed: 5 });
    expect(towns.length).toBeGreaterThan(0);
    for (const a of towns) {
      expect(distanceFromEdge(map, a.xy)).toBeGreaterThanOrEqual(12);
      expect(a.population).toBeGreaterThan(0);
      const others = towns.filter((b) => b !== a).map((b) => distanceManhattan(map, a.xy, b.xy));
      expect(Math.min(...others, 20)).toBe(20);
    }
    expect(new Set(towns.map((t) => townName(t.nameParts))).size).toBe(towns.length);
    // The city flag uses the number of towns created so far: one town in four, every fourth index.
    const first = towns.findIndex((t) => t.isCity);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
    expect(towns.every((t, i) => t.isCity === (i % 4 === first))).toBe(true);
  });

  it('fails like OpenTTD when no town fits (ruling R12)', () => {
    expect(generationErrorKey(seaGame())).toBe('error.noTownCreated');
  });
});

describe('coastal siting (port of town_cmd.cpp and water_map.cpp)', () => {
  it('measures the Manhattan distance to the nearest water ground', () => {
    const game = emptyGame();
    const { map } = game;
    makeSea(map, tileXY(map, 30, 32));
    expect(getClosestWaterDistance(map, tileXY(map, 30, 32))).toBe(0);
    expect(getClosestWaterDistance(map, tileXY(map, 33, 33))).toBe(4);
    expect(getClosestWaterDistance(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 100)).toBe(
      0x7f,
    );
  });

  it('moves a town drawn on the sea to the dry site furthest from the water', () => {
    const game = seaGame();
    const { map } = game;
    for (let y = 1; y < 63; y++)
      for (let x = 20; x < 63; x++) makeClear(map, tileXY(map, x, y), ClearGround.Grass, 3);
    const spot = findNearestGoodCoastalTownSpot(game, tileXY(map, 10, 32));
    expect(spot).not.toBe(INVALID_TILE);
    expect(townCanBePlacedHere(game, spot)).toBe(true);
    expect(getClosestWaterDistance(map, spot)).toBeGreaterThan(0);
  });

  it('finds nothing on open sea', () => {
    const game = seaGame();
    expect(findNearestGoodCoastalTownSpot(game, tileXY(game.map, 32, 32))).toBe(INVALID_TILE);
  });

  it('treats a shore tree tile as coast, not as water ground', () => {
    const game = emptyGame();
    const { map } = game;
    const t = tileXY(map, 32, 32);
    makeTree(map, t, 0, 0, TreeGrowth.Grown, TreeGround.Shore, 0);
    expect(getClosestWaterDistance(map, t)).toBe(0x7f);
  });
});
