import type { GameState } from '../game';
import { IndustryType } from '../industry/industry-specs';
import { distanceFromEdge, distanceMax, INVALID_TILE, tileAddWrap } from '../map/geometry';
import { getIndustryIndex } from '../map/industry-map';
import { getTileType, TileType, tileX, tileY } from '../map/map';
import { getTileZ } from '../map/slope';
import { isWaterTile } from '../map/water';
import type { Station } from './station';

/** The generated station names (STR_SV_STNAME* for rail stations); 'fallback' is "Station #n". */
export type StationNameKind =
  | 'town'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'central'
  | 'transfer'
  | 'halt'
  | 'valley'
  | 'heights'
  | 'woods'
  | 'lakeside'
  | 'exchange'
  | 'mines'
  | 'annexe'
  | 'sidings'
  | 'branch'
  | 'upper'
  | 'lower'
  | 'fallback';

/** Every name kind in a fixed order (the hash stores the position). */
export const STATION_NAME_KINDS: readonly StationNameKind[] = [
  'town',
  'north',
  'south',
  'east',
  'west',
  'central',
  'transfer',
  'halt',
  'valley',
  'heights',
  'woods',
  'lakeside',
  'exchange',
  'mines',
  'annexe',
  'sidings',
  'branch',
  'upper',
  'lower',
  'fallback',
];

/** Port of station_cmd.cpp:GenerateStationName fallback_names. */
const FALLBACK_NAMES = [
  'north',
  'south',
  'east',
  'west',
  'transfer',
  'halt',
  'exchange',
  'annexe',
  'sidings',
  'branch',
  'upper',
  'lower',
] as const;

/** Port of station_cmd.cpp:CountMapSquareAround: matches in the 7×7 square around `t`. */
function countMapSquareAround(
  state: GameState,
  t: number,
  matches: (state: GameState, t: number) => boolean,
): number {
  let num = 0;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const u = tileAddWrap(state.map, t, dx, dy);
      if (u !== INVALID_TILE && matches(state, u)) num++;
    }
  }
  return num;
}

/**
 * Port of station_cmd.cpp:CMSAMine: a tile of an extractive industry producing a non-liquid,
 * non-passenger, non-mail cargo. Of the Stage 1 industries only the coal mine qualifies.
 */
const isMineTile = (state: GameState, t: number): boolean =>
  getTileType(state.map, t) === TileType.Industry &&
  state.industries[getIndustryIndex(state.map, t)]!.type === IndustryType.CoalMine;

/** Port of station_cmd.cpp:CMSAWater. */
const isWater = (state: GameState, t: number): boolean => isWaterTile(state.map, t);

/** Port of station_cmd.cpp:CMSATree. */
const isTree = (state: GameState, t: number): boolean =>
  getTileType(state.map, t) === TileType.Trees;

/** Port of station_cmd.cpp:GenerateStationName for STATIONNAMING_RAIL. */
export function generateStationName(state: GameState, st: Station, t: number): StationNameKind {
  const { map } = state;
  const town = state.towns[st.townIndex]!;
  const used = new Set<StationNameKind>();
  for (const s of state.stations) {
    if (s !== null && s !== st && s.townIndex === st.townIndex && s.nameKind !== 'fallback') {
      used.add(s.nameKind);
    }
  }
  // The industry spiral is skipped: default industries name no station (station_name = STR_UNDEFINED).
  const free = (k: StationNameKind): boolean => !used.has(k);

  if (free('mines') && countMapSquareAround(state, t, isMineTile) >= 2) return 'mines';
  if (distanceMax(map, t, town.xy) < 8) {
    if (free('town')) return 'town';
    if (free('central')) return 'central';
  }
  if (
    free('lakeside') &&
    distanceFromEdge(map, t) < 20 &&
    countMapSquareAround(state, t, isWater) >= 5
  ) {
    return 'lakeside';
  }
  // IsTileForestIndustry: no forests in Stage 1 (R6)
  if (free('woods') && countMapSquareAround(state, t, isTree) >= 8) return 'woods';

  const z = getTileZ(map, t);
  const z2 = getTileZ(map, town.xy);
  if (z < z2) {
    if (free('valley')) return 'valley';
  } else if (z > z2) {
    if (free('heights')) return 'heights';
  }

  // check direction compared to town
  if (tileX(map, t) < tileX(map, town.xy)) {
    used.add('south');
    used.add('west');
  } else {
    used.add('north');
    used.add('east');
  }
  if (tileY(map, t) < tileY(map, town.xy)) {
    used.add('south');
    used.add('east');
  } else {
    used.add('north');
    used.add('west');
  }
  for (const k of FALLBACK_NAMES) if (free(k)) return k;
  return 'fallback';
}
