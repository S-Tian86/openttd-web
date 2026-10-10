import type { GameState } from './game';
import { IndustryType } from './industry/industry-specs';
import { ClearGround, getClearGround } from './map/clear';
import { getIndustryIndex } from './map/industry-map';
import { getTileType, OWNER_TOWN, tileX, tileY, TileType } from './map/map';
import { getRoadOwner, getTownIndex } from './map/road-map';
import { getTileZ } from './map/slope';
import { getWaterTileType, WaterTileType } from './map/water';
import { townName } from './town/town-names';

/** Read-only views of the world for the UI (ruling R8): the UI never touches the map arrays. */

export type TileKind =
  | 'void'
  | 'grass'
  | 'rough'
  | 'rocks'
  | 'trees'
  | 'sea'
  | 'coast'
  | 'road'
  | 'house'
  | 'industry'
  | 'other';

export interface TileInfo {
  tile: number;
  x: number;
  y: number;
  z: number;
  kind: TileKind;
  owner: 'none' | 'water' | 'town';
  townIndex: number | null;
  industryIndex: number | null;
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
      return 'grass';
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
    case TileType.Road:
      return 'road';
    case TileType.House:
      return 'house';
    case TileType.Industry:
      return 'industry';
    default:
      return 'other';
  }
}

export function describeTile(state: GameState, t: number): TileInfo {
  const { map } = state;
  const kind = kindOf(state, t);
  const townOwned = kind === 'house' || (kind === 'road' && getRoadOwner(map, t) === OWNER_TOWN);
  let owner: TileInfo['owner'] = 'none';
  if (kind === 'sea' || kind === 'coast') owner = 'water';
  else if (townOwned) owner = 'town';
  return {
    tile: t,
    x: tileX(map, t),
    y: tileY(map, t),
    z: getTileZ(map, t),
    kind,
    owner,
    townIndex: townOwned ? getTownIndex(map, t) : null,
    industryIndex: kind === 'industry' ? getIndustryIndex(map, t) : null,
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
