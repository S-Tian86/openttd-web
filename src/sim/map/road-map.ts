import { axisToTrack, trackToTrackBits, type Axis, type Track } from '../track/track';
import type { DiagDir } from './geometry';
import { getTileType, OWNER_TOWN, resetTileKeepingHeight, setTileType, TileType } from './map';
import type { MapState } from './map';

/** Port of road_type.h:RoadBits. */
export const RoadBits = {
  None: 0,
  NW: 1,
  SW: 2,
  SE: 4,
  NE: 8,
  X: 10,
  Y: 5,
  N: 9,
  E: 12,
  S: 6,
  W: 3,
  All: 15,
} as const;

/** Port of road_map.h:RoadTileType. */
export const RoadTileType = { Normal: 0, Crossing: 1, Depot: 2 } as const;
export type RoadTileType = (typeof RoadTileType)[keyof typeof RoadTileType];

/** Port of road_map.h:Roadside (temperate subset). */
export const Roadside = {
  Barren: 0,
  Grass: 1,
  Paved: 2,
  StreetLights: 3,
  Trees: 5,
  GrassRoadWorks: 6,
  PavedRoadWorks: 7,
} as const;
export type Roadside = (typeof Roadside)[keyof typeof Roadside];

export const ROADTYPE_ROAD = 0;
export const INVALID_ROADTYPE = 63;

/** Port of road_func.h:DiagDirToRoadBits. */
export const diagDirToRoadBits = (d: DiagDir): number => RoadBits.NW << (3 ^ d);

/** Port of road_func.h:MirrorRoadBits. */
export const mirrorRoadBits = (r: number): number => ((r & 3) << 2) | ((r >> 2) & 3);

/** Port of road_func.h:ComplementRoadBits. */
export const complementRoadBits = (r: number): number => 15 ^ r;

/** Port of road_func.h:IsStraightRoad. */
export const isStraightRoad = (r: number): boolean => r === RoadBits.X || r === RoadBits.Y;

/** Port of road_map.h:MakeRoadNormal for a town-owned road without tram. */
export function makeRoadNormal(map: MapState, t: number, bits: number, townIndex: number): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Road);
  map.m1[t] = OWNER_TOWN;
  map.m2[t] = townIndex;
  map.m3[t] = OWNER_TOWN << 4; // tram owner
  map.m4[t] = ROADTYPE_ROAD;
  map.m5[t] = bits | (RoadTileType.Normal << 6);
  map.m8[t] = INVALID_ROADTYPE << 6;
}

export const getRoadTileType = (map: MapState, t: number): RoadTileType =>
  (map.m5[t]! >>> 6) as RoadTileType;

export const isNormalRoadTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Road && getRoadTileType(map, t) === RoadTileType.Normal;

export const getRoadBits = (map: MapState, t: number): number => map.m5[t]! & 0x0f;

export function setRoadBits(map: MapState, t: number, bits: number): void {
  map.m5[t] = (map.m5[t]! & 0xf0) | bits;
}

/** Port of road_map.h:GetRoadOwner for the road type (a crossing keeps the rail owner in m1). */
export const getRoadOwner = (map: MapState, t: number): number =>
  (isNormalRoadTile(map, t) ? map.m1[t]! : map.m7[t]!) & 0x1f;

/** m2 holds the town index of road and house tiles. */
export const getTownIndex = (map: MapState, t: number): number => map.m2[t]!;

export const getRoadside = (map: MapState, t: number): Roadside =>
  ((map.m6[t]! >>> 3) & 7) as Roadside;

export function setRoadside(map: MapState, t: number, rs: Roadside): void {
  map.m6[t] = (map.m6[t]! & ~0x38) | (rs << 3);
}

/** Port of road_map.h:LEVELCROSSING_TRACKBIT_FACTOR. */
export const LEVELCROSSING_TRACKBIT_FACTOR = 2;

/**
 * Port of road_map.h:MakeRoadCrossing for a town-owned road without tram: m1 holds the rail
 * owner, m7 the road owner.
 */
export function makeRoadCrossing(
  map: MapState,
  t: number,
  roadOwner: number,
  railOwner: number,
  roadAxis: Axis,
  railType: number,
  townIndex: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Road);
  map.m1[t] = railOwner;
  map.m2[t] = townIndex;
  map.m3[t] = OWNER_TOWN << 4; // tram owner
  map.m4[t] = ROADTYPE_ROAD;
  map.m5[t] = (RoadTileType.Crossing << 6) | roadAxis;
  map.m7[t] = roadOwner;
  map.m8[t] = (INVALID_ROADTYPE << 6) | railType;
}

/** Port of road_map.h:IsLevelCrossingTile. */
export const isLevelCrossingTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Road && getRoadTileType(map, t) === RoadTileType.Crossing;

/** Port of road_map.h:GetCrossingRoadAxis. */
export const getCrossingRoadAxis = (map: MapState, t: number): Axis => (map.m5[t]! & 1) as Axis;

/** Port of road_map.h:GetCrossingRoadBits. */
export const getCrossingRoadBits = (map: MapState, t: number): number =>
  getCrossingRoadAxis(map, t) === 0 ? RoadBits.X : RoadBits.Y;

/** Port of road_map.h:GetCrossingRailTrack: the axis the road does not use. */
export const getCrossingRailTrack = (map: MapState, t: number): Track =>
  axisToTrack((1 - getCrossingRoadAxis(map, t)) as Axis);

/** Port of road_map.h:GetCrossingRailBits. */
export const getCrossingRailBits = (map: MapState, t: number): number =>
  trackToTrackBits(getCrossingRailTrack(map, t));

/** Port of road_map.h:HasTownOwnedRoad. */
export const hasTownOwnedRoad = (map: MapState, t: number): boolean =>
  getRoadOwner(map, t) === OWNER_TOWN;

/** Port of road_map.h:GetTownRoadBits: a crossing is its straight road. */
export const getTownRoadBits = (map: MapState, t: number): number => {
  if (isLevelCrossingTile(map, t)) return getCrossingRoadBits(map, t);
  return isNormalRoadTile(map, t) ? getRoadBits(map, t) : RoadBits.None;
};
