import { describe, expect, it } from 'vitest';
import { createMap, tileXY, type MapState } from './map';
import {
  getTileMaxZ,
  getTileSlopeZ,
  getTileZ,
  isSlopeWithOneCornerRaised,
  isTileFlat,
  Slope,
} from './slope';

const setHeight = (map: MapState, x: number, y: number, h: number): void => {
  map.height[tileXY(map, x, y)] = h;
};

describe('GetTileSlopeZ (port of tile_map.cpp)', () => {
  it('reads the N, W, E and S corners from the tile and its neighbours', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 10, 10);
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.Flat, z: 0 });
    setHeight(map, 11, 10, 1); // W corner
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.W, z: 0 });
    expect(isSlopeWithOneCornerRaised(Slope.W)).toBe(true);
    setHeight(map, 11, 11, 1); // S corner
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.W | Slope.S, z: 0 });
    expect(isSlopeWithOneCornerRaised(Slope.W | Slope.S)).toBe(false);
    setHeight(map, 10, 10, 1);
    setHeight(map, 10, 11, 1);
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.Flat, z: 1 });
    expect([isTileFlat(map, t), getTileZ(map, t), getTileMaxZ(map, t)]).toEqual([true, 1, 1]);
  });

  it('flags a corner two levels up as steep', () => {
    const map = createMap(6, 6);
    setHeight(map, 10, 10, 2);
    expect(getTileSlopeZ(map, tileXY(map, 10, 10))).toEqual({ slope: Slope.N | Slope.Steep, z: 0 });
  });

  it('clamps the corners of the last column to the map', () => {
    const map = createMap(6, 6);
    setHeight(map, 63, 10, 1);
    expect(getTileSlopeZ(map, tileXY(map, 63, 10))).toEqual({ slope: Slope.N | Slope.W, z: 0 });
    expect(getTileMaxZ(map, tileXY(map, 63, 10))).toBe(1);
  });
});
