import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { DiagDir } from './geometry';
import { getTileOwner, getTileType, TileType, tileXY } from './map';
import {
  getRailDepotDirection,
  getRailTileType,
  getTrackBits,
  isPlainRail,
  isRailDepotTile,
  makeRailDepot,
  makeRailNormal,
  RailTileType,
} from './rail-map';

describe('rail tiles (port of rail_map.h)', () => {
  it('stores plain rail and depots in OpenTTD bit layout', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const a = tileXY(map, 10, 10);
    const b = tileXY(map, 11, 10);
    makeRailNormal(map, a, 0, 0b101, 0);
    makeRailDepot(map, b, 0, 7, DiagDir.NW, 0);
    expect([
      getTileType(map, a),
      getTileOwner(map, a),
      map.m5[a],
      getTrackBits(map, a),
      isPlainRail(map, a),
    ]).toEqual([TileType.Railway, 0, 0b101, 0b101, true]);
    expect([
      map.m2[b],
      map.m5[b],
      getRailTileType(map, b),
      getRailDepotDirection(map, b),
      isRailDepotTile(map, b),
      isPlainRail(map, b),
    ]).toEqual([7, 0xc3, RailTileType.Depot, DiagDir.NW, true, false]);
  });
});
