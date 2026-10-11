import { OWNER_NONE, resetTileKeepingHeight, setTileType, TileType, type MapState } from './map';
import { setWaterClass, WaterClass } from './water';

/** Port of tree_map.h:TreeGround. */
export const TreeGround = { Grass: 0, Rough: 1, SnowDesert: 2, Shore: 3, RoughSnow: 4 } as const;
export type TreeGround = (typeof TreeGround)[keyof typeof TreeGround];
/** Port of tree_map.h:TreeGrowthStage. */
export const TreeGrowth = {
  Growing1: 0,
  Growing2: 1,
  Growing3: 2,
  Grown: 3,
  Dying1: 4,
  Dying2: 5,
  Dead: 6,
} as const;
export type TreeGrowth = (typeof TreeGrowth)[keyof typeof TreeGrowth];

/** Port of table/tree_land.h:TREE_COUNT_TEMPERATE (sprite groups of the temperate climate). */
export const TREE_COUNT_TEMPERATE = 12;

export const getTreeType = (map: MapState, t: number): number => map.m3[t]!;
export const getTreeGround = (map: MapState, t: number): TreeGround =>
  ((map.m2[t]! >>> 6) & 7) as TreeGround;
export const getTreeDensity = (map: MapState, t: number): number => (map.m2[t]! >>> 4) & 3;
/** Number of trees on the tile, 1..4. */
export const getTreeCount = (map: MapState, t: number): number => (map.m5[t]! >>> 6) + 1;
export const getTreeGrowth = (map: MapState, t: number): TreeGrowth =>
  (map.m5[t]! & 7) as TreeGrowth;

/** Port of tree_map.h:SetTreeGroundDensity (a shore ground puts the tile in the sea water class). */
export function setTreeGroundDensity(
  map: MapState,
  t: number,
  ground: TreeGround,
  density: number,
): void {
  map.m2[t] = (map.m2[t]! & ~0x1f0) | (ground << 6) | (density << 4);
  setWaterClass(map, t, ground === TreeGround.Shore ? WaterClass.Sea : WaterClass.Invalid);
}

/** Port of tree_map.h:AddTreeCount. */
export function addTreeCount(map: MapState, t: number, c: number): void {
  map.m5[t] = map.m5[t]! + (c << 6);
}

/** Port of tree_map.h:SetTreeGrowth. */
export function setTreeGrowth(map: MapState, t: number, g: TreeGrowth): void {
  map.m5[t] = (map.m5[t]! & ~7) | g;
}

/** Port of tree_map.h:AddTreeGrowth. */
export function addTreeGrowth(map: MapState, t: number, a: number): void {
  map.m5[t] = map.m5[t]! + a;
}

/** Port of tree_map.h:MakeTree (`count` is the number of trees minus one). */
export function makeTree(
  map: MapState,
  t: number,
  type: number,
  count: number,
  growth: TreeGrowth,
  ground: TreeGround,
  density: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Trees);
  map.m1[t] = OWNER_NONE;
  map.m3[t] = type;
  map.m5[t] = (count << 6) | growth;
  setTreeGroundDensity(map, t, ground, density);
}
