import type { Axis } from '../track/track';
import { getTileType, resetTileKeepingHeight, setTileType, TileType, type MapState } from './map';
import { WaterClass } from './water';

/** Port of station_type.h:StationType (the types that exist so far). */
export const StationType = { Rail: 0 } as const;
export type StationType = (typeof StationType)[keyof typeof StationType];

/**
 * Port of station_map.h:MakeRailStation (MakeStation + SetRailType; the reservation bit is cleared
 * with m6). Land stations get WaterClass::Invalid; the docking bit is off.
 */
export function makeRailStation(
  map: MapState,
  t: number,
  owner: number,
  stationIndex: number,
  axis: Axis,
  section: number,
  railType: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Station);
  map.m1[t] = (owner & 0x1f) | (WaterClass.Invalid << 5);
  map.m2[t] = stationIndex;
  map.m3[t] = 0;
  map.m4[t] = 0;
  map.m5[t] = section + axis;
  map.m6[t] = StationType.Rail << 3;
  map.m7[t] = 0;
  map.m8[t] = railType;
}

/** Port of station_map.h:IsRailStationTile: the tile type first, as other types reuse m6. */
export const isRailStationTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Station && ((map.m6[t]! >>> 3) & 0xf) === StationType.Rail;

/** Port of station_map.h:GetStationIndex. */
export const getStationIndex = (map: MapState, t: number): number => map.m2[t]!;

/** Port of station_map.h:GetStationGfx. */
export const getStationGfx = (map: MapState, t: number): number => map.m5[t]!;

/** Port of station_map.h:GetRailStationAxis. */
export const getRailStationAxis = (map: MapState, t: number): Axis => (map.m5[t]! & 1) as Axis;

/** Port of station_map.h:GetStationTileRandomBits (m3 bits 7..4). */
export const getStationTileRandomBits = (map: MapState, t: number): number => map.m3[t]! >>> 4;

/** Port of station_map.h:SetStationTileRandomBits. */
export function setStationTileRandomBits(map: MapState, t: number, bits: number): void {
  map.m3[t] = (map.m3[t]! & 0x0f) | ((bits & 0xf) << 4);
}
