import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { ClearGround, getClearDensity, getClearGround } from './clear';
import {
  convertGroundTilesIntoWaterTiles,
  FLOOD_FROM_DIRS,
  FloodingBehaviour,
  getFloodingBehaviour,
  tileLoopVoid,
  tileLoopWater,
} from './flood';
import { Dir } from './geometry';
import { canAutoClear, doClearSquare } from './landscape';
import {
  getTileType,
  OWNER_NONE,
  OWNER_WATER,
  setTileType,
  TileType,
  tileXY,
  type MapState,
} from './map';
import { getTreeGround, makeTree, TreeGround, TreeGrowth } from './tree-map';
import {
  getWaterTileType,
  isCoastTile,
  isNonFloodingWaterTile,
  isWaterTile,
  makeSea,
  makeShore,
  WaterTileType,
} from './water';

const NOOP = (): void => undefined;

/** Flat 64×64 world with a 5×5 block of height-0 vertices at (20..24, 20..24). */
const lakeMap = (): MapState => {
  const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  for (let y = 20; y <= 24; y++) for (let x = 20; x <= 24; x++) map.height[tileXY(map, x, y)] = 0;
  return map;
};

const count = (map: MapState, test: (t: number) => boolean): number => {
  let n = 0;
  for (let t = 0; t < map.size; t++) if (test(t)) n++;
  return n;
};

describe('water tiles (port of water_map.h)', () => {
  it('makes sea and shore tiles owned by water', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const sea = tileXY(map, 5, 5);
    const shore = tileXY(map, 6, 5);
    makeSea(map, sea);
    makeShore(map, shore);
    expect([map.m1[sea], map.m5[sea], map.m1[shore], map.m5[shore]]).toEqual([
      OWNER_WATER,
      0x00,
      OWNER_WATER,
      0x10,
    ]);
    expect([isWaterTile(map, sea), isCoastTile(map, shore), getWaterTileType(map, shore)]).toEqual([
      true,
      true,
      WaterTileType.Coast,
    ]);
  });
});

describe('ConvertGroundTilesIntoWaterTiles (port of water_cmd.cpp)', () => {
  it('keeps the flood-from table of water_cmd.cpp, in Directions bit order', () => {
    expect(FLOOD_FROM_DIRS).toEqual([
      [Dir.NE, Dir.SE, Dir.SW, Dir.NW],
      [Dir.NE, Dir.SE],
      [Dir.NE, Dir.NW],
      [Dir.NE],
      [Dir.SW, Dir.NW],
      [],
      [Dir.NW],
      [Dir.N, Dir.NE, Dir.NW],
      [Dir.SE, Dir.SW],
      [Dir.SE],
      [],
      [Dir.NE, Dir.E, Dir.SE],
      [Dir.SW],
      [Dir.SE, Dir.S, Dir.SW],
      [Dir.SW, Dir.W, Dir.NW],
    ]);
  });

  it('turns all-zero tiles into sea and the sloped ring around them into shore', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    expect(count(map, (t) => isWaterTile(map, t))).toBe(16);
    expect(count(map, (t) => isCoastTile(map, t))).toBe(20);
    expect(isWaterTile(map, tileXY(map, 20, 20)) && isWaterTile(map, tileXY(map, 23, 23))).toBe(
      true,
    );
    expect(isCoastTile(map, tileXY(map, 19, 19)) && isCoastTile(map, tileXY(map, 24, 21))).toBe(
      true,
    );
    expect(getTileType(map, tileXY(map, 18, 18))).toBe(TileType.Clear);
  });

  it('leaves a tile with two opposite corners raised as land', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    map.height[tileXY(map, 31, 30)] = 0; // W corner of (30,30)
    map.height[tileXY(map, 30, 31)] = 0; // E corner of (30,30): slope N|S = 10
    convertGroundTilesIntoWaterTiles(map);
    expect(getTileType(map, tileXY(map, 30, 30))).toBe(TileType.Clear);
  });
});

describe('TileLoop_Water (port of water_cmd.cpp)', () => {
  it('classifies flooding behaviour like GetFloodingBehaviour', () => {
    const map = lakeMap();
    map.height[tileXY(map, 40, 40)] = 0;
    map.height[tileXY(map, 40, 41)] = 0;
    map.height[tileXY(map, 41, 41)] = 0; // tile (40,40) has only its W corner raised
    convertGroundTilesIntoWaterTiles(map);
    expect(getFloodingBehaviour(map, tileXY(map, 21, 21))).toBe(FloodingBehaviour.Active); // sea
    expect(getFloodingBehaviour(map, tileXY(map, 40, 40))).toBe(FloodingBehaviour.Active); // one-corner shore
    expect(getFloodingBehaviour(map, tileXY(map, 19, 21))).toBe(FloodingBehaviour.DryUp); // two-corner shore
    expect(getFloodingBehaviour(map, tileXY(map, 0, 5))).toBe(FloodingBehaviour.Active); // void
    expect(getFloodingBehaviour(map, tileXY(map, 10, 10))).toBe(FloodingBehaviour.None); // grass
  });

  it('dries up a shore whose flood-from neighbour is no longer water', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const shore = tileXY(map, 19, 21); // slope N|E: floods only from SW, the sea tile (20,21)
    doClearSquare(map, tileXY(map, 20, 21), true);
    const dirty: number[] = [];
    tileLoopWater(map, shore, (t) => dirty.push(t));
    expect([
      getTileType(map, shore),
      getClearGround(map, shore),
      getClearDensity(map, shore),
    ]).toEqual([TileType.Clear, ClearGround.Grass, 3]);
    expect(dirty).toContain(shore);
  });

  it('floods a flat height-0 land tile next to active water', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const land = tileXY(map, 20, 21);
    doClearSquare(map, land, true);
    tileLoopWater(map, tileXY(map, 20, 22), NOOP); // the sea tile SE of it
    expect(isWaterTile(map, land)).toBe(true);
  });

  it('marks water surrounded by water as non-flooding, and a change next to it wakes it up', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const inner = tileXY(map, 21, 21);
    tileLoopWater(map, inner, NOOP);
    expect(isNonFloodingWaterTile(map, inner)).toBe(true);
    doClearSquare(map, tileXY(map, 22, 22), true);
    expect(isNonFloodingWaterTile(map, inner)).toBe(false);
  });

  it('floods from the void border (TileLoop_Void)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    for (const [x, y] of [
      [1, 5],
      [2, 5],
      [1, 6],
      [2, 6],
    ] as const)
      map.height[tileXY(map, x, y)] = 0;
    tileLoopVoid(map, tileXY(map, 0, 5), NOOP);
    expect(isWaterTile(map, tileXY(map, 1, 5))).toBe(true);
  });

  it('turns shore trees back to grass trees when they dry up', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const t = tileXY(map, 19, 21);
    makeTree(map, t, 0, 0, TreeGrowth.Grown, TreeGround.Shore, 3);
    doClearSquare(map, tileXY(map, 20, 21), true);
    tileLoopWater(map, t, NOOP);
    expect(getTreeGround(map, t)).toBe(TreeGround.Grass);
  });
});

describe('landscape clearing for towns, industries and water (port of CMD_LANDSCAPE_CLEAR)', () => {
  it('clears grass, trees and shores with Auto, never sea with NoWater, void or buildings', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const house = tileXY(map, 40, 40);
    setTileType(map, house, TileType.House);
    expect([
      canAutoClear(map, tileXY(map, 10, 10), true),
      canAutoClear(map, tileXY(map, 19, 21), true),
      canAutoClear(map, tileXY(map, 21, 21), true),
      canAutoClear(map, tileXY(map, 21, 21), false),
      canAutoClear(map, tileXY(map, 0, 5), true),
      canAutoClear(map, house, true),
    ]).toEqual([true, true, false, true, false, false]);
  });

  it('DoClearSquare leaves grass, fully grown only while generating the world', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 9, 9);
    makeSea(map, t);
    doClearSquare(map, t, false);
    expect([getClearGround(map, t), getClearDensity(map, t), map.m1[t]]).toEqual([
      ClearGround.Grass,
      0,
      OWNER_NONE,
    ]);
    doClearSquare(map, t, true);
    expect(getClearDensity(map, t)).toBe(3);
  });
});
