import type { GameState } from '../game';
import { distanceManhattan, distanceSquare } from '../map/geometry';
import { getTileType, OWNER_TOWN, TileType, type MapState } from '../map/map';
import { getRoadOwner, getTownIndex, isNormalRoadTile } from '../map/road-map';

/** Port of house.h:HouseZone (town zones only). */
export const HouseZone = {
  Edge: 0,
  Outskirt: 1,
  OuterSuburb: 2,
  InnerSuburb: 3,
  Centre: 4,
} as const;
export type HouseZone = (typeof HouseZone)[keyof typeof HouseZone];

/** Port of town.h:TownFlag (the two Stage 1 uses: one church and one stadium per town). */
export const TownFlag = { HasChurch: 1, HasStadium: 2 } as const;

/** The Town fields Stage 1 uses. Port of town.h:Town. */
export interface Town {
  index: number;
  /** Centre tile. */
  xy: number;
  /** 32-bit seed of the generated name (Town::townnameparts). */
  nameParts: number;
  /** Town::larger_town. */
  isCity: boolean;
  numHouses: number;
  population: number;
  /** cache.squared_town_zone_radius, by HouseZone. */
  squaredZoneRadius: number[];
  /** TownFlag bits. */
  flags: number;
}

export function newTown(index: number, xy: number, nameParts: number, isCity: boolean): Town {
  const town: Town = {
    index,
    xy,
    nameParts,
    isCity,
    numHouses: 0,
    population: 0,
    squaredZoneRadius: [0, 0, 0, 0, 0],
    flags: 0,
  };
  updateTownRadius(town);
  return town;
}

/** Port of town_cmd.cpp:UpdateTownRadius _town_squared_town_zone_radius_data. */
const ZONE_RADIUS_TABLE: readonly (readonly number[])[] = [
  [4, 0, 0, 0, 0],
  [16, 0, 0, 0, 0],
  [25, 0, 0, 0, 0],
  [36, 0, 0, 0, 0],
  [49, 0, 4, 0, 0],
  [64, 0, 4, 0, 0],
  [64, 0, 9, 0, 1],
  [64, 0, 9, 0, 4],
  [64, 0, 16, 0, 4],
  [81, 0, 16, 0, 4],
  [81, 0, 16, 0, 4],
  [81, 0, 25, 0, 9],
  [81, 36, 25, 0, 9],
  [81, 36, 25, 16, 9],
  [81, 49, 0, 25, 9],
  [81, 64, 0, 25, 9],
  [81, 64, 0, 36, 9],
  [81, 64, 0, 36, 16],
  [100, 81, 0, 49, 16],
  [100, 81, 0, 49, 25],
  [121, 81, 0, 49, 25],
  [121, 81, 0, 49, 25],
  [121, 81, 0, 49, 36],
];

export function updateTownRadius(town: Town): void {
  if (town.numHouses < ZONE_RADIUS_TABLE.length * 4) {
    town.squaredZoneRadius = [...ZONE_RADIUS_TABLE[Math.floor(town.numHouses / 4)]!];
    return;
  }
  const mass = Math.floor(town.numHouses / 8);
  town.squaredZoneRadius = [mass * 15 - 40, mass * 9 - 15, 0, mass * 5 - 5, mass * 3 + 5];
}

/** Port of town_cmd.cpp:GetTownRadiusGroup (fund_buildings_months is always 0 in Stage 1). */
export function getTownRadiusGroup(map: MapState, town: Town, t: number): HouseZone {
  const d = distanceSquare(map, t, town.xy);
  let zone: number = HouseZone.Edge;
  for (let i = HouseZone.Edge; i <= HouseZone.Centre; i++)
    if (d < town.squaredZoneRadius[i]!) zone = i;
  return zone as HouseZone;
}

/** Port of town_cmd.cpp:ClosestTownFromTile / CalcClosestTownFromTile (ties: lowest index). */
export function closestTownFromTile(
  state: GameState,
  t: number,
  threshold: number,
): Town | undefined {
  const { map } = state;
  const type = getTileType(map, t);
  if (
    type === TileType.House ||
    (type === TileType.Road && isNormalRoadTile(map, t) && getRoadOwner(map, t) === OWNER_TOWN)
  ) {
    return state.towns[getTownIndex(map, t)];
  }
  let best: Town | undefined;
  let bestDistance = Infinity;
  for (const town of state.towns) {
    const d = distanceManhattan(map, t, town.xy);
    if (d < bestDistance) {
      best = town;
      bestDistance = d;
    }
  }
  return best !== undefined && bestDistance < threshold ? best : undefined;
}
