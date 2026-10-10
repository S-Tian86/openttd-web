import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { getTileType, TileType, tileXY } from './map';
import {
  getTreeCount,
  getTreeDensity,
  getTreeGround,
  getTreeGrowth,
  getTreeType,
  makeTree,
  TreeGround,
  TreeGrowth,
} from './tree-map';
import { getWaterClass, WaterClass } from './water';

describe('tree tiles (port of tree_map.h)', () => {
  it('makes a tree tile with the MakeTree bit layout', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 5, 2, TreeGrowth.Grown, TreeGround.Rough, 3);
    expect(getTileType(map, t)).toBe(TileType.Trees);
    expect([map.m1[t], map.m2[t], map.m3[t], map.m4[t], map.m5[t]]).toEqual([0x70, 112, 5, 0, 131]);
    expect([
      getTreeType(map, t),
      getTreeCount(map, t),
      getTreeGrowth(map, t),
      getTreeGround(map, t),
      getTreeDensity(map, t),
    ]).toEqual([5, 3, TreeGrowth.Grown, TreeGround.Rough, 3]);
  });

  it('puts trees on a shore in the sea water class', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 0, 0, TreeGrowth.Growing1, TreeGround.Shore, 3);
    expect([map.m1[t], getWaterClass(map, t)]).toEqual([0x10, WaterClass.Sea]);
  });
});
