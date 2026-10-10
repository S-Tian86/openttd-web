import { describe, expect, it } from 'vitest';
import { ClearGround, getClearDensity, getClearGround, makeClear, tileLoopClear } from './clear';
import {
  createMap,
  getTileType,
  isInnerTile,
  makeVoid,
  setTileType,
  TileType,
  tileX,
  tileXY,
  tileY,
} from './map';

describe('map storage (port of map_func.h, tile_map.h)', () => {
  it('allocates power-of-two sizes from 64 to 4096', () => {
    const map = createMap(8, 6);
    expect([map.sizeX, map.sizeY, map.size]).toEqual([256, 64, 16384]);
    expect(map.m2).toBeInstanceOf(Uint16Array);
    expect(() => createMap(5, 8)).toThrow('Map size bits must be 6..12');
    expect(() => createMap(8, 13)).toThrow('Map size bits must be 6..12');
  });

  it('converts between tile index and coordinates', () => {
    const map = createMap(8, 8);
    const t = tileXY(map, 10, 20);
    expect(t).toBe((20 << 8) + 10);
    expect([tileX(map, t), tileY(map, t)]).toEqual([10, 20]);
  });

  it('stores the tile type in the high nibble', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 5, 5);
    setTileType(map, t, TileType.Trees);
    expect(map.type[t]).toBe(TileType.Trees << 4);
    expect(getTileType(map, t)).toBe(TileType.Trees);
  });

  it('treats both border rows and columns as outside with freeform edges', () => {
    const map = createMap(6, 6);
    expect(isInnerTile(map, tileXY(map, 0, 5))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 5, 0))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 63, 5))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 5, 63))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 1, 1))).toBe(true);
  });

  it('makes void and clear tiles with OpenTTD bit layouts', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 2);
    expect(getTileType(map, t)).toBe(TileType.Clear);
    expect(map.m1[t]).toBe(0x10); // OWNER_NONE
    expect(map.m5[t]).toBe((ClearGround.Grass << 2) | 2);
    expect([getClearGround(map, t), getClearDensity(map, t)]).toEqual([ClearGround.Grass, 2]);
    makeVoid(map, t);
    expect(getTileType(map, t)).toBe(TileType.Void);
    expect(map.height[t]).toBe(0);
  });
});

describe('TileLoop_Clear (port of clear_cmd.cpp)', () => {
  it('grows grass one density step every 8 visits and marks the tile dirty', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 0);
    const dirty: number[] = [];
    for (let i = 0; i < 7; i++) tileLoopClear(map, t, (d) => dirty.push(d));
    expect(getClearDensity(map, t)).toBe(0);
    tileLoopClear(map, t, (d) => dirty.push(d));
    expect(getClearDensity(map, t)).toBe(1);
    expect(dirty).toEqual([t]);
  });

  it('leaves full grass alone', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 3);
    for (let i = 0; i < 20; i++) tileLoopClear(map, t, () => undefined);
    expect(getClearDensity(map, t)).toBe(3);
  });
});
