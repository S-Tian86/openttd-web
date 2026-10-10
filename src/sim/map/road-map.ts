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

export const getRoadOwner = (map: MapState, t: number): number => map.m1[t]! & 0x1f;

/** m2 holds the town index of road and house tiles. */
export const getTownIndex = (map: MapState, t: number): number => map.m2[t]!;

export const getRoadside = (map: MapState, t: number): Roadside =>
  ((map.m6[t]! >>> 3) & 7) as Roadside;

export function setRoadside(map: MapState, t: number, rs: Roadside): void {
  map.m6[t] = (map.m6[t]! & ~0x38) | (rs << 3);
}

/** Port of road_map.h:GetTownRoadBits (crossings arrive in block 1.3). */
export const getTownRoadBits = (map: MapState, t: number): number =>
  isNormalRoadTile(map, t) ? getRoadBits(map, t) : RoadBits.None;
