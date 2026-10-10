import { DoFlag } from './command/cost';
import type { GameState } from './game';
import { IndustryType } from './industry/industry-specs';
import { landscapeClear } from './map/clear-tile';
import { ClearGround, getClearDensity, getClearGround } from './map/clear';
import { getIndustryIndex } from './map/industry-map';
import { getDepotIndex, getRailType, isRailDepotTile, RAILTYPE_RAIL } from './map/rail-map';
import {
  COMPANY_FIRST,
  getTileOwner,
  getTileType,
  OWNER_TOWN,
  tileX,
  tileY,
  TileType,
} from './map/map';
import { getRoadOwner, getTownIndex, isLevelCrossingTile } from './map/road-map';
import { getTileZ } from './map/slope';
import { getStationIndex } from './map/station-map';
import { getWaterTileType, WaterTileType } from './map/water';
import type { StationNameKind } from './station/station-name';
import { convertDateToYMD } from './time/date';
import { townName } from './town/town-names';

/** Read-only views of the world for the UI (ruling R8): the UI never touches the map arrays. */

export type TileKind =
  | 'void'
  | 'bare'
  | 'grass'
  | 'rough'
  | 'rocks'
  | 'trees'
  | 'sea'
  | 'coast'
  | 'road'
  | 'rail'
  | 'depot'
  | 'station'
  | 'crossing'
  | 'house'
  | 'industry'
  | 'other';

export interface TileInfo {
  tile: number;
  x: number;
  y: number;
  z: number;
  kind: TileKind;
  owner: 'none' | 'water' | 'town' | 'company';
  townIndex: number | null;
  industryIndex: number | null;
  stationIndex: number | null;
  depotIndex: number | null;
  /** The company's test run of the bulldozer (negative: a refund); null is OpenTTD's "N/A". */
  costToClear: number | null;
  /** A crossing's road owner (m7); its rail owner is `owner`. */
  roadOwner: 'none' | 'town' | 'company' | null;
  railType: 'rail' | null;
  /** td.rail_speed in km-ish/h; null when the tile has no limit. */
  railSpeed: number | null;
  buildDate: { year: number; month: number; day: number } | null;
}

export interface StationInfo {
  index: number;
  townName: string;
  nameKind: StationNameKind;
}

export interface DepotInfo {
  index: number;
  townName: string;
  townCn: number;
}

export interface TownInfo {
  index: number;
  name: string;
  isCity: boolean;
  population: number;
  houses: number;
  x: number;
  y: number;
}

export interface IndustryInfo {
  index: number;
  type: 'coalMine' | 'powerStation';
  townName: string;
  x: number;
  y: number;
}

function clearKind(state: GameState, t: number): TileKind {
  switch (getClearGround(state.map, t)) {
    case ClearGround.Grass:
      // GetTileDesc_Clear: grass at density 0 is described as bare land (snow is not modelled yet).
      return getClearDensity(state.map, t) === 0 ? 'bare' : 'grass';
    case ClearGround.Rough:
      return 'rough';
    case ClearGround.Rocks:
      return 'rocks';
    default:
      return 'other';
  }
}

function kindOf(state: GameState, t: number): TileKind {
  const { map } = state;
  switch (getTileType(map, t)) {
    case TileType.Void:
      return 'void';
    case TileType.Clear:
      return clearKind(state, t);
    case TileType.Water:
      return getWaterTileType(map, t) === WaterTileType.Coast ? 'coast' : 'sea';
    case TileType.Trees:
      return 'trees';
    case TileType.Railway:
      return isRailDepotTile(map, t) ? 'depot' : 'rail';
    case TileType.Station:
      return 'station';
    case TileType.Road:
      return isLevelCrossingTile(map, t) ? 'crossing' : 'road';
    case TileType.House:
      return 'house';
    case TileType.Industry:
      return 'industry';
    default:
      return 'other';
  }
}

/** rail_cmd.cpp:GetTileDesc_Track: a depot's speed limit without the original acceleration. */
const DEPOT_RAIL_SPEED = 61;

function roadOwnerOf(map: GameState['map'], t: number): 'none' | 'town' | 'company' {
  const owner = getRoadOwner(map, t);
  if (owner === OWNER_TOWN) return 'town';
  return owner === COMPANY_FIRST ? 'company' : 'none';
}

/** td.build_date of a depot or station tile (rail_cmd.cpp, station_cmd.cpp). */
function buildDateOf(state: GameState, kind: TileKind, t: number): TileInfo['buildDate'] {
  const { map } = state;
  const built =
    kind === 'depot'
      ? state.depots[getDepotIndex(map, t)]
      : kind === 'station'
        ? state.stations[getStationIndex(map, t)]
        : null;
  return built === null || built === undefined ? null : convertDateToYMD(built.buildDate);
}

export function describeTile(state: GameState, t: number): TileInfo {
  const { map } = state;
  const kind = kindOf(state, t);
  const townOwned = kind === 'house' || (kind === 'road' && getRoadOwner(map, t) === OWNER_TOWN);
  const hasRail = kind === 'rail' || kind === 'depot' || kind === 'station' || kind === 'crossing';
  let owner: TileInfo['owner'] = 'none';
  if (kind === 'sea' || kind === 'coast') owner = 'water';
  else if (townOwned) owner = 'town';
  // A crossing's tile owner is its rail's; the road owner lives in m7 (GetTileDesc_Road).
  else if (hasRail && getTileOwner(map, t) === COMPANY_FIRST) owner = 'company';
  // LandInfoWindow: the cost of a test run of the bulldozer; it never mutates the state.
  const clear = kind === 'void' ? null : landscapeClear(state, t, DoFlag.None, COMPANY_FIRST);
  return {
    tile: t,
    x: tileX(map, t),
    y: tileY(map, t),
    z: getTileZ(map, t),
    kind,
    owner,
    townIndex: townOwned || kind === 'crossing' ? getTownIndex(map, t) : null,
    industryIndex: kind === 'industry' ? getIndustryIndex(map, t) : null,
    stationIndex: kind === 'station' ? getStationIndex(map, t) : null,
    depotIndex: kind === 'depot' ? getDepotIndex(map, t) : null,
    costToClear: clear !== null && clear.ok ? clear.cost : null,
    roadOwner: kind === 'crossing' ? roadOwnerOf(map, t) : null,
    railType: hasRail && getRailType(map, t) === RAILTYPE_RAIL ? 'rail' : null,
    // GetTileDesc_Track: the default rail has no limit; depots get 61 under the realistic
    // acceleration model (the default).
    railSpeed: kind === 'depot' ? DEPOT_RAIL_SPEED : null,
    buildDate: buildDateOf(state, kind, t),
  };
}

export function townInfo(state: GameState, index: number): TownInfo | null {
  const town = state.towns[index];
  if (town === undefined) return null;
  return {
    index,
    name: townName(town.nameParts),
    isCity: town.isCity,
    population: town.population,
    houses: town.numHouses,
    x: tileX(state.map, town.xy),
    y: tileY(state.map, town.xy),
  };
}

export function industryInfo(state: GameState, index: number): IndustryInfo | null {
  const industry = state.industries[index];
  if (industry === undefined) return null;
  const town = state.towns[industry.townIndex];
  return {
    index,
    type: industry.type === IndustryType.CoalMine ? 'coalMine' : 'powerStation',
    townName: town === undefined ? '' : townName(town.nameParts),
    x: tileX(state.map, industry.tile),
    y: tileY(state.map, industry.tile),
  };
}

export function stationInfo(state: GameState, index: number): StationInfo | null {
  const station = state.stations[index];
  const town =
    station === undefined || station === null ? undefined : state.towns[station.townIndex];
  if (station === undefined || station === null || town === undefined) return null;
  return { index, townName: townName(town.nameParts), nameKind: station.nameKind };
}

export function depotInfo(state: GameState, index: number): DepotInfo | null {
  const depot = state.depots[index];
  const town = depot === undefined || depot === null ? undefined : state.towns[depot.townIndex];
  if (depot === undefined || depot === null || town === undefined) return null;
  return { index, townName: townName(town.nameParts), townCn: depot.townCn };
}
