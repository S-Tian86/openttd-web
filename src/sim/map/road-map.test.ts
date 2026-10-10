import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { Axis, TrackBits } from '../track/track';
import { DiagDir } from './geometry';
import { OWNER_TOWN, TileType, getTileType, tileXY } from './map';
import {
  complementRoadBits,
  diagDirToRoadBits,
  getCrossingRailBits,
  getCrossingRoadBits,
  getRoadBits,
  getRoadOwner,
  getRoadside,
  getTownIndex,
  getTownRoadBits,
  isStraightRoad,
  makeRoadCrossing,
  makeRoadNormal,
  mirrorRoadBits,
  RoadBits,
  Roadside,
} from './road-map';

describe('road bits (port of road_type.h, road_func.h)', () => {
  it('maps directions to road pieces and back', () => {
    const dirs = [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const;
    expect(dirs.map(diagDirToRoadBits)).toEqual([
      RoadBits.NE,
      RoadBits.SE,
      RoadBits.SW,
      RoadBits.NW,
    ]);
    expect([
      mirrorRoadBits(RoadBits.NW),
      mirrorRoadBits(RoadBits.SW),
      complementRoadBits(RoadBits.X),
    ]).toEqual([RoadBits.SE, RoadBits.NE, RoadBits.Y]);
    expect([isStraightRoad(RoadBits.X), isStraightRoad(RoadBits.N)]).toEqual([true, false]);
  });
});

describe('town road tiles (port of road_map.h:MakeRoadNormal)', () => {
  it('writes the fields roads.md §3.3 lists for a town road', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 10, 10);
    makeRoadNormal(map, t, RoadBits.X, 3);
    expect(getTileType(map, t)).toBe(TileType.Road);
    expect([
      map.m1[t],
      map.m2[t],
      map.m3[t],
      map.m4[t]! & 0x3f,
      map.m5[t],
      map.m6[t]! & 0xfc,
      map.m7[t],
      map.m8[t],
    ]).toEqual([0x0f, 3, 0xf0, 0, 10, 0, 0, 0xfc0]);
    expect([
      getRoadOwner(map, t),
      getTownIndex(map, t),
      getRoadBits(map, t),
      getRoadside(map, t),
    ]).toEqual([OWNER_TOWN, 3, RoadBits.X, Roadside.Barren]);
    expect([getTownRoadBits(map, t), getTownRoadBits(map, tileXY(map, 11, 10))]).toEqual([
      RoadBits.X,
      RoadBits.None,
    ]);
  });

  it('stores a crossing like MakeRoadCrossing (roads.md §3.3)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 10, 10);
    makeRoadCrossing(map, t, OWNER_TOWN, 0, Axis.Y, 0, 3);
    expect([
      map.m1[t],
      map.m2[t],
      map.m3[t],
      map.m4[t],
      map.m5[t],
      map.m6[t],
      map.m7[t],
      map.m8[t],
    ]).toEqual([0, 3, 0xf0, 0, 0x41, 0, 0x0f, 0xfc0]);
    expect([
      getCrossingRoadBits(map, t),
      getCrossingRailBits(map, t),
      getRoadOwner(map, t),
    ]).toEqual([RoadBits.Y, TrackBits.X, OWNER_TOWN]);
  });
});
