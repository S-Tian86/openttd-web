import {
  getTileType,
  OWNER_WATER,
  resetTileKeepingHeight,
  setTileType,
  TileType,
  type MapState,
} from './map';
import { Dir, isValidTile, tileOffsByDir } from './geometry';

/** Port of water_map.h:WaterClass (m1 bits 6..5). */
export const WaterClass = { Sea: 0, Canal: 1, River: 2, Invalid: 3 } as const;
export type WaterClass = (typeof WaterClass)[keyof typeof WaterClass];
/** Port of water_map.h:WaterTileType (m5 bits 7..4). */
export const WaterTileType = { Clear: 0, Coast: 1, Lock: 2, Depot: 3 } as const;
export type WaterTileType = (typeof WaterTileType)[keyof typeof WaterTileType];

export const getWaterClass = (map: MapState, t: number): WaterClass =>
  ((map.m1[t]! >>> 5) & 3) as WaterClass;
export function setWaterClass(map: MapState, t: number, wc: WaterClass): void {
  map.m1[t] = (map.m1[t]! & ~0x60) | (wc << 5);
}
export const getWaterTileType = (map: MapState, t: number): WaterTileType =>
  ((map.m5[t]! >>> 4) & 0xf) as WaterTileType;

/** Port of water_map.h:MakeWater / MakeShore (owner water, class sea, not a docking tile). */
function makeWaterTile(map: MapState, t: number, type: WaterTileType): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Water);
  map.m1[t] = OWNER_WATER | (WaterClass.Sea << 5);
  map.m5[t] = type << 4;
}
/** Port of water_map.h:MakeSea. */
export const makeSea = (map: MapState, t: number): void =>
  makeWaterTile(map, t, WaterTileType.Clear);
/** Port of water_map.h:MakeShore. */
export const makeShore = (map: MapState, t: number): void =>
  makeWaterTile(map, t, WaterTileType.Coast);

/** Port of water_map.h:IsWaterTile (open water: sea, canal, river). */
export const isWaterTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Water && getWaterTileType(map, t) === WaterTileType.Clear;
/** Port of water_map.h:IsCoastTile. */
export const isCoastTile = (map: MapState, t: number): boolean =>
  (getTileType(map, t) === TileType.Water && getWaterTileType(map, t) === WaterTileType.Coast) ||
  (getTileType(map, t) === TileType.Trees && getWaterClass(map, t) !== WaterClass.Invalid);

/** Port of water_map.h:HasTileWaterClass. */
export function hasTileWaterClass(map: MapState, t: number): boolean {
  const type = getTileType(map, t);
  return (
    type === TileType.Water ||
    type === TileType.Station ||
    type === TileType.Industry ||
    type === TileType.Object ||
    type === TileType.Trees
  );
}
export const isTileOnWater = (map: MapState, t: number): boolean =>
  getWaterClass(map, t) !== WaterClass.Invalid;
/** Port of water_map.h:HasTileWaterGround (coast tiles do not count). */
export const hasTileWaterGround = (map: MapState, t: number): boolean =>
  hasTileWaterClass(map, t) && isTileOnWater(map, t) && !isCoastTile(map, t);

/** m3 bit 0. Port of water_map.h:IsNonFloodingWaterTile. */
export const isNonFloodingWaterTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Water && (map.m3[t]! & 1) === 1;
export function setNonFloodingWaterTile(map: MapState, t: number, on: boolean): void {
  map.m3[t] = on ? map.m3[t]! | 1 : map.m3[t]! & ~1;
}

/** Port of water_cmd.cpp:ClearNeighbourNonFloodingStates. */
export function clearNeighbourNonFloodingStates(map: MapState, t: number): void {
  for (let dir = Dir.N; dir <= Dir.NW; dir++) {
    const dest = t + tileOffsByDir(map, dir as Dir);
    if (isValidTile(map, dest) && getTileType(map, dest) === TileType.Water)
      setNonFloodingWaterTile(map, dest, false);
  }
}
