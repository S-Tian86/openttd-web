import { resetTileKeepingHeight, setTileType, TileType, type MapState } from './map';
import type { DiagDir } from './geometry';

/** Port of rail_map.h:RailTileType. */
export const RailTileType = { Normal: 0, Signals: 1, Depot: 3 } as const;
export type RailTileType = (typeof RailTileType)[keyof typeof RailTileType];

/** Port of rail_map.h:RailGroundType (temperate values). */
export const RailGroundType = {
  Barren: 0,
  Grass: 1,
  FenceNW: 2,
  FenceSE: 3,
  FenceSENW: 4,
  FenceNE: 5,
  FenceSW: 6,
  FenceNESW: 7,
  FenceVert1: 8,
  FenceVert2: 9,
  FenceHoriz1: 10,
  FenceHoriz2: 11,
} as const;
export type RailGroundType = (typeof RailGroundType)[keyof typeof RailGroundType];

export const RAILTYPE_RAIL = 0;

function makeRail(
  map: MapState,
  t: number,
  owner: number,
  m2: number,
  m5: number,
  r: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Railway);
  map.m1[t] = owner;
  map.m2[t] = m2;
  map.m5[t] = m5;
  map.m8[t] = r;
}

/** Port of rail_map.h:MakeRailNormal. */
export const makeRailNormal = (
  map: MapState,
  t: number,
  owner: number,
  bits: number,
  railType: number,
): void => makeRail(map, t, owner, 0, (RailTileType.Normal << 6) | bits, railType);

/** Port of rail_map.h:MakeRailDepot. */
export const makeRailDepot = (
  map: MapState,
  t: number,
  owner: number,
  depotIndex: number,
  dir: DiagDir,
  railType: number,
): void => makeRail(map, t, owner, depotIndex, (RailTileType.Depot << 6) | dir, railType);

/** Port of rail_map.h:GetRailTileType. */
export const getRailTileType = (map: MapState, t: number): RailTileType =>
  (map.m5[t]! >> 6) as RailTileType;

/** Port of rail_map.h:IsPlainRail (normal or with signals). */
export const isPlainRail = (map: MapState, t: number): boolean =>
  getRailTileType(map, t) !== RailTileType.Depot;

/** Port of rail_map.h:IsRailDepot. */
export const isRailDepotTile = (map: MapState, t: number): boolean =>
  getRailTileType(map, t) === RailTileType.Depot;

/** Port of rail_map.h:GetTrackBits (plain rail only). */
export const getTrackBits = (map: MapState, t: number): number => map.m5[t]! & 0x3f;

/** Port of rail_map.h:SetTrackBits. */
export function setTrackBits(map: MapState, t: number, bits: number): void {
  map.m5[t] = (map.m5[t]! & 0xc0) | (bits & 0x3f);
}

/** Port of rail_map.h:GetRailType. */
export const getRailType = (map: MapState, t: number): number => map.m8[t]! & 0x3f;

/** Port of rail_map.h:GetRailGroundType. */
export const getRailGroundType = (map: MapState, t: number): RailGroundType =>
  (map.m4[t]! & 0xf) as RailGroundType;

/** Port of rail_map.h:SetRailGroundType. */
export function setRailGroundType(map: MapState, t: number, g: RailGroundType): void {
  map.m4[t] = (map.m4[t]! & 0xf0) | g;
}

/** Port of rail_map.h:GetRailDepotDirection. */
export const getRailDepotDirection = (map: MapState, t: number): DiagDir =>
  (map.m5[t]! & 3) as DiagDir;

/** Port of rail_map.h:SetRailDepotExitDirection. */
export function setRailDepotExitDirection(map: MapState, t: number, dir: DiagDir): void {
  map.m5[t] = (map.m5[t]! & 0xfc) | dir;
}

/** Port of depot_map.h:GetDepotIndex. */
export const getDepotIndex = (map: MapState, t: number): number => map.m2[t]!;
