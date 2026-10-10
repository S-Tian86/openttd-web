import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { DiagDir, DIAGDIR_OFFSETS, DIR_OFFSETS, isValidTile } from '../map/geometry';
import { getTileType, OWNER_TOWN, setTileType, TileType, tileXY } from '../map/map';
import {
  diagDirToRoadBits,
  getRoadBits,
  getRoadOwner,
  getTownIndex,
  makeRoadNormal,
  RoadBits,
} from '../map/road-map';
import { makeSea } from '../map/water';
import {
  canFollowRoad,
  genRandomRoadBits,
  growTown,
  isNeighbourRoadTile,
  isRoadAllowedHere,
} from './growth';
import { newTown, updateTownRadius, type Town } from './town';

const townAt32 = (seed: number): { game: GameState; town: Town } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
  game.towns.push(town);
  game.random = createRandomizer(seed);
  return { game, town };
};

const houseTiles = (game: GameState): Set<number> => {
  const tiles = new Set<number>();
  for (let t = 0; t < game.map.size; t++)
    if (getTileType(game.map, t) === TileType.House) tiles.add(t);
  return tiles;
};

const touchesRoad = (game: GameState, t: number): boolean =>
  DIR_OFFSETS.some(([dx, dy]) => {
    const n = t + dy * game.map.sizeX + dx;
    return getTileType(game.map, n) === TileType.Road;
  });

describe('town road helpers (port of town_cmd.cpp)', () => {
  it('draws two road pieces like GenRandomRoadBits', () => {
    expect(genRandomRoadBits(createRandomizer(12345))).toBe(RoadBits.Y);
  });

  it('follows roads and empty land, never houses, water or the map edge', () => {
    const { game } = townAt32(1);
    const { map } = game;
    const t = tileXY(map, 10, 10);
    setTileType(map, tileXY(map, 10, 11), TileType.House); // SE
    makeSea(map, tileXY(map, 11, 10)); // SW
    makeRoadNormal(map, tileXY(map, 10, 9), RoadBits.Y, 0); // NW
    expect(
      [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW].map((d) => canFollowRoad(map, t, d)),
    ).toEqual([true, false, false, true]);
    expect(canFollowRoad(map, tileXY(map, 1, 10), DiagDir.NE)).toBe(false);
  });

  it('refuses a road beside a parallel road (IsNeighbourRoadTile, TL_ORIGINAL)', () => {
    const { game } = townAt32(1);
    const { map } = game;
    const t = tileXY(map, 20, 20);
    makeRoadNormal(map, tileXY(map, 20, 19), RoadBits.Y, 0);
    expect(isNeighbourRoadTile(map, t, DiagDir.NE, 1)).toBe(false);
    makeRoadNormal(map, tileXY(map, 20, 19), RoadBits.X, 0);
    expect(isNeighbourRoadTile(map, t, DiagDir.NE, 1)).toBe(true);
    expect(isRoadAllowedHere(map, t, DiagDir.NE)).toBe(false);
  });

  it('allows roads on flat clear land only (IsRoadAllowedHere, ruling R11)', () => {
    const { game } = townAt32(1);
    const { map } = game;
    makeSea(map, tileXY(map, 5, 5));
    map.height[tileXY(map, 8, 5)] = 0; // (7,5) sloped
    const tiles = [tileXY(map, 10, 10), tileXY(map, 0, 10), tileXY(map, 5, 5), tileXY(map, 7, 5)];
    expect(tiles.map((t) => isRoadAllowedHere(map, t, DiagDir.NE))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('GrowTown (port of town_cmd.cpp)', () => {
  it('starts a town with a random two-piece road on its centre tile', () => {
    const { game, town } = townAt32(12345);
    expect(growTown(game, town)).toBe(true);
    const t = town.xy;
    expect([
      getTileType(game.map, t),
      getRoadBits(game.map, t),
      getRoadOwner(game.map, t),
      getTownIndex(game.map, t),
    ]).toEqual([TileType.Road, RoadBits.Y, OWNER_TOWN, 0]);
  });

  it('grows roads and houses; each new house touches a road when built (ruling R13)', () => {
    const { game, town } = townAt32(42);
    town.numHouses += 20; // DoCreateTown's "pretend bigger" fudge
    updateTownRadius(town);
    for (let i = 0; i < 80; i++) {
      const before = houseTiles(game);
      growTown(game, town);
      const added = [...houseTiles(game)].filter((t) => !before.has(t));
      // no house built this step, or one of the new house tiles touches a road
      expect(added.length === 0 || added.some((t) => touchesRoad(game, t))).toBe(true);
    }
    expect(town.numHouses).toBeGreaterThan(20);
    for (let t = 0; t < game.map.size; t++) {
      if (getTileType(game.map, t) !== TileType.Road) continue;
      expect([getRoadOwner(game.map, t), getTownIndex(game.map, t)]).toEqual([OWNER_TOWN, 0]);
      for (const d of [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const) {
        if ((getRoadBits(game.map, t) & diagDirToRoadBits(d)) === 0) continue;
        const [dx, dy] = DIAGDIR_OFFSETS[d]!;
        expect(isValidTile(game.map, t + dy * game.map.sizeX + dx)).toBe(true); // no piece points off the map
      }
    }
  });
});
