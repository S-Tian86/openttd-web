import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { tileXY } from '../map/map';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import {
  closestTownFromTile,
  getTownRadiusGroup,
  HouseZone,
  newTown,
  updateTownRadius,
} from './town';

describe('town zones (port of town_cmd.cpp:UpdateTownRadius, GetTownRadiusGroup)', () => {
  it.each([
    [0, [4, 0, 0, 0, 0]],
    [20, [64, 0, 4, 0, 0]],
    [91, [121, 81, 0, 49, 36]],
    [92, [125, 84, 0, 50, 38]],
    [200, [335, 210, 0, 120, 80]],
  ])('a town with %i houses has squared radii %j', (houses, radii) => {
    const town = newTown(0, 0, 0, false);
    town.numHouses = houses;
    updateTownRadius(town);
    expect(town.squaredZoneRadius).toEqual(radii);
  });

  it('picks the highest zone whose radius covers the tile', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(map, 32, 32), 0, false);
    town.numHouses = 91;
    updateTownRadius(town);
    const zoneAt = [
      [5, 2],
      [6, 0],
      [7, 0],
      [9, 0],
      [11, 0],
    ] as const;
    expect(
      zoneAt.map(([dx, dy]) => getTownRadiusGroup(map, town, tileXY(map, 32 + dx, 32 + dy))),
    ).toEqual([
      HouseZone.Centre,
      HouseZone.InnerSuburb,
      HouseZone.Outskirt,
      HouseZone.Edge,
      HouseZone.Edge,
    ]);
  });
});

describe('ClosestTownFromTile (port of town_cmd.cpp)', () => {
  it('uses Manhattan distance, the lowest index on ties, the threshold, and the owner of town roads', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    game.towns.push(
      newTown(0, tileXY(map, 10, 10), 0, false),
      newTown(1, tileXY(map, 20, 10), 0, false),
    );
    expect(closestTownFromTile(game, tileXY(map, 15, 10), Infinity)?.index).toBe(0);
    expect(closestTownFromTile(game, tileXY(map, 16, 10), Infinity)?.index).toBe(1);
    expect(closestTownFromTile(game, tileXY(map, 15, 10), 5)).toBeUndefined();
    const road = tileXY(map, 19, 10);
    makeRoadNormal(map, road, RoadBits.X, 0);
    expect(closestTownFromTile(game, road, 1)?.index).toBe(0);
  });
});
