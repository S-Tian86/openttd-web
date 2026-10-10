import type { GameState } from '../game';
import { DiagDir, isValidTile, tileOffsByDiagDir } from '../map/geometry';
import { doClearSquare } from '../map/landscape';
import { getTileType, TileType, type MapState } from '../map/map';
import {
  diagDirToRoadBits,
  getRoadBits,
  getRoadside,
  isNormalRoadTile,
  makeRoadNormal,
  RoadBits,
  Roadside,
  setRoadBits,
  setRoadside,
} from '../map/road-map';
import { isTileFlat } from '../map/slope';
import { isCoastTile } from '../map/water';
import { closestTownFromTile, getTownRadiusGroup, HouseZone, type Town } from './town';

const DIRS = [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const;

/** Port of road.cpp:CleanUpRoadBits for the Stage 1 tile types. */
export function cleanUpRoadBits(map: MapState, t: number, bits: number): number {
  if (!isValidTile(map, t)) return RoadBits.None;
  let result = bits;
  for (const d of DIRS) {
    const bit = diagDirToRoadBits(d);
    if ((result & bit) === 0) continue;
    const n = t + tileOffsByDiagDir(map, d);
    let connective = false;
    if (isValidTile(map, n)) {
      switch (getTileType(map, n)) {
        case TileType.Clear:
        case TileType.Trees:
          connective = true;
          break;
        case TileType.Road:
          connective = isNormalRoadTile(map, n);
          break;
        case TileType.Water:
          connective = isCoastTile(map, n);
          break;
        default:
          break;
      }
    }
    if (!connective) result &= ~bit;
  }
  return result;
}

/** The CMD_BUILD_ROAD(Auto, NoWater) test for a town (flat land only, ruling R11). */
export function canTownBuildRoad(map: MapState, t: number, bits: number): boolean {
  if (!isValidTile(map, t) || !isTileFlat(map, t)) return false;
  switch (getTileType(map, t)) {
    case TileType.Clear:
    case TileType.Trees:
      return true;
    case TileType.Road:
      return isNormalRoadTile(map, t) && (getRoadBits(map, t) & bits) !== bits;
    default:
      return false;
  }
}

/** Port of road_cmd.cpp:CmdBuildRoad (Execute) for OWNER_TOWN. */
export function buildTownRoad(state: GameState, town: Town, t: number, bits: number): boolean {
  const { map } = state;
  if (!canTownBuildRoad(map, t, bits)) return false;
  if (getTileType(map, t) === TileType.Road) {
    setRoadBits(map, t, getRoadBits(map, t) | bits);
  } else {
    doClearSquare(map, t, true);
    makeRoadNormal(map, t, bits, town.index);
  }
  state.dirtyTiles.add(t);
  return true;
}

/** Port of road_cmd.cpp:_town_road_types (temperate): [target, pre-step] by HouseZone. */
export const TOWN_ROAD_TYPES: readonly (readonly [Roadside, Roadside])[] = [
  [Roadside.Grass, Roadside.Grass],
  [Roadside.Paved, Roadside.Paved],
  [Roadside.Paved, Roadside.Paved],
  [Roadside.Trees, Roadside.Trees],
  [Roadside.StreetLights, Roadside.Paved],
];

/** Port of road_cmd.cpp:TileLoop_Road (temperate, no road works). */
export function tileLoopRoad(state: GameState, t: number, markDirty: (t: number) => void): void {
  const { map } = state;
  const town = closestTownFromTile(state, t, Infinity);
  const grp = town === undefined ? HouseZone.Edge : getTownRadiusGroup(map, town, t);
  const [target, pre] = TOWN_ROAD_TYPES[grp]!;
  const cur = getRoadside(map, t);
  if (cur === target) return;
  setRoadside(map, t, cur === pre ? target : cur === Roadside.Barren ? pre : Roadside.Barren);
  markDirty(t);
}
