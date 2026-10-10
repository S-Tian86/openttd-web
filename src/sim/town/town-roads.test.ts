import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { ClearGround, getClearDensity, getClearGround } from '../map/clear';
import { canAutoClear, doClearSquare } from '../map/landscape';
import { getTileType, setTileType, TileType, tileXY } from '../map/map';
import {
  getRoadBits,
  getRoadside,
  getTownIndex,
  makeRoadNormal,
  RoadBits,
  Roadside,
  setRoadside,
} from '../map/road-map';
import { makeSea, makeShore } from '../map/water';
import { newTown, updateTownRadius } from './town';
import { buildTownRoad, canTownBuildRoad, cleanUpRoadBits, tileLoopRoad } from './town-roads';

const NOOP = (): void => undefined;

describe('CleanUpRoadBits (port of road.cpp)', () => {
  it('drops pieces that point at houses, open water and the map edge', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 10, 10);
    setTileType(map, tileXY(map, 10, 11), TileType.House); // SE
    makeSea(map, tileXY(map, 11, 10)); // SW
    makeShore(map, tileXY(map, 10, 9)); // NW: coast is connective
    expect(cleanUpRoadBits(map, t, RoadBits.All)).toBe(RoadBits.NE | RoadBits.NW);
    expect(cleanUpRoadBits(map, tileXY(map, 1, 10), RoadBits.X)).toBe(RoadBits.SW);
    expect(cleanUpRoadBits(map, tileXY(map, 0, 10), RoadBits.X)).toBe(RoadBits.None);
  });
});

describe('town road building (port of road_cmd.cpp:CmdBuildRoad for OWNER_TOWN)', () => {
  it('builds on flat clear land and adds pieces to its own road', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 30, 30), 0, false);
    game.towns.push(town);
    const t = tileXY(game.map, 30, 30);
    expect(canTownBuildRoad(game.map, t, RoadBits.NE)).toBe(true);
    expect(buildTownRoad(game, town, t, RoadBits.NE)).toBe(true);
    expect(canTownBuildRoad(game.map, t, RoadBits.NE)).toBe(false); // already built
    expect(buildTownRoad(game, town, t, RoadBits.SW)).toBe(true);
    expect([getRoadBits(game.map, t), getTownIndex(game.map, t)]).toEqual([RoadBits.X, 0]);
  });

  it('refuses sea, houses and sloped land (ruling R11)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeSea(map, tileXY(map, 5, 5));
    setTileType(map, tileXY(map, 6, 5), TileType.House);
    map.height[tileXY(map, 8, 5)] = 0; // tile (7,5) gets a raised-corner slope
    expect([
      canTownBuildRoad(map, tileXY(map, 5, 5), RoadBits.X),
      canTownBuildRoad(map, tileXY(map, 6, 5), RoadBits.X),
      canTownBuildRoad(map, tileXY(map, 7, 5), RoadBits.X),
    ]).toEqual([false, false, false]);
  });

  it('lets towns clear a one-piece road stub but not a longer road', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const stub = tileXY(map, 9, 9);
    makeRoadNormal(map, stub, RoadBits.NE, 0);
    makeRoadNormal(map, tileXY(map, 9, 10), RoadBits.X, 0);
    expect([canAutoClear(map, stub, true), canAutoClear(map, tileXY(map, 9, 10), true)]).toEqual([
      true,
      false,
    ]);
    doClearSquare(map, stub, true);
    expect([getTileType(map, stub), getClearGround(map, stub), getClearDensity(map, stub)]).toEqual(
      [TileType.Clear, ClearGround.Grass, 3],
    );
  });
});

describe('TileLoop_Road roadside (port of road_cmd.cpp)', () => {
  it('steps the roadside towards the zone target', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
    town.numHouses = 91;
    updateTownRadius(town);
    game.towns.push(town);
    const centre = tileXY(game.map, 32, 32);
    const edge = tileXY(game.map, 42, 32); // d² = 100: Edge
    const outskirt = tileXY(game.map, 39, 32); // d² = 49: Outskirt
    for (const t of [centre, edge, outskirt]) makeRoadNormal(game.map, t, RoadBits.X, 0);
    setRoadside(game.map, outskirt, Roadside.Grass);
    for (const t of [centre, edge, outskirt]) tileLoopRoad(game, t, NOOP);
    expect([
      getRoadside(game.map, centre),
      getRoadside(game.map, edge),
      getRoadside(game.map, outskirt),
    ]).toEqual([Roadside.Paved, Roadside.Grass, Roadside.Barren]);
    for (const t of [centre, edge, outskirt]) tileLoopRoad(game, t, NOOP);
    expect([
      getRoadside(game.map, centre),
      getRoadside(game.map, edge),
      getRoadside(game.map, outskirt),
    ]).toEqual([Roadside.StreetLights, Roadside.Grass, Roadside.Paved]);
  });
});
