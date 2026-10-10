import { CMD_ERROR, DoFlag, addCost, fail, succeed, type CommandCost } from '../command/cost';
import type { GameState } from '../game';
import { doClearSquare } from '../map/landscape';
import { OWNER_WATER, tileX, tileXY, tileY, type MapState } from '../map/map';
import { getStationIndex, isRailStationTile } from '../map/station-map';
import { orthogonalTiles } from '../map/tile-area';
import {
  isInUse,
  StationFacility,
  tileBelongsToRailStation,
  type Station,
  type TileArea,
} from './station';

/** Port of timer_game_tick.h:Ticks::STATION_RATING_TICKS. */
const STATION_RATING_TICKS = 185;
/** Port of timer_game_tick.h:Ticks::STATION_ACCEPTANCE_TICKS. */
const STATION_ACCEPTANCE_TICKS = 250;

/**
 * Port of station_cmd.cpp:MakeStationAreaSmaller for rail: shrink each side that holds no tile of
 * the station, restarting after every shrink; an empty area is OpenTTD's cleared TileArea (null).
 */
function makeStationAreaSmaller(map: MapState, st: Station, area: TileArea): TileArea | null {
  let x = tileX(map, area.tile);
  let y = tileY(map, area.tile);
  let w = area.w;
  let h = area.h;
  const has = (tx: number, ty: number): boolean =>
    tileBelongsToRailStation(map, st, tileXY(map, tx, ty));
  const rangeHas = (fixedX: number | null, fixedY: number | null, len: number): boolean => {
    for (let i = 0; i < len; i++) {
      if (has(fixedX ?? x + i, fixedY ?? y + i)) return true;
    }
    return false;
  };
  while (w !== 0 && h !== 0) {
    if (!rangeHas(x, null, h)) {
      x++; // the left side is unused
      w--;
    } else if (!rangeHas(x + w - 1, null, h)) {
      w--; // the right side is unused
    } else if (!rangeHas(null, y, w)) {
      y++; // the upper side is unused
      h--;
    } else if (!rangeHas(null, y + h - 1, w)) {
      h--; // the lower side is unused
    } else {
      return { tile: tileXY(map, x, y), w, h };
    }
  }
  return null;
}

/** Port of station_cmd.cpp:UpdateStationSignCoord: keep the sign inside the station's area. */
function updateStationSignCoord(map: MapState, st: Station): void {
  const area = st.trainStation;
  if (area === null) return; // no tiles belong to this station
  const ax = tileX(map, area.tile);
  const ay = tileY(map, area.tile);
  const x = Math.min(Math.max(tileX(map, st.xy), ax), ax + area.w - 1);
  const y = Math.min(Math.max(tileY(map, st.xy), ay), ay + area.h - 1);
  st.xy = tileXY(map, x, y);
}

/**
 * Port of station_cmd.cpp:RemoveFromRailBaseStation with removal_cost = PR_CLEAR_STATION_RAIL and
 * keep_rail = false. No vehicles exist yet, and the company owns every station.
 */
function removeFromRailBaseStation(
  state: GameState,
  tiles: readonly number[],
  flags: number,
): CommandCost {
  const { map } = state;
  const affected: Station[] = [];
  let quantity = 0;
  for (const t of tiles) {
    if (!isRailStationTile(map, t)) continue;
    const st = state.stations[getStationIndex(map, t)];
    if (st === undefined || st === null) continue;
    quantity++;
    if ((flags & DoFlag.Execute) !== 0) {
      const infra = state.company.infrastructure;
      infra.rail--; // station tiles are never blocked: they carry rail
      doClearSquare(map, t, false);
      infra.station--;
      state.dirtyTiles.add(t);
      if (!affected.includes(st)) affected.push(st);
    }
  }
  if (quantity === 0) return fail('error.noStation');

  for (const st of affected) {
    // shrink the area if we deleted something at the edges
    st.trainStation =
      st.trainStation === null ? null : makeStationAreaSmaller(map, st, st.trainStation);
    updateStationSignCoord(map, st);
    // if we deleted the whole station, delete the train facility
    if (st.trainStation === null) {
      st.facilities &= ~StationFacility.Train;
      // DeleteStationIfEmpty
      if (!isInUse(st)) st.deleteCtr = 0;
    }
  }
  return succeed(quantity * state.prices.clearStationRail);
}

/** Port of station_cmd.cpp:CmdRemoveFromRailStation with keep_rail = false (R19). */
export function removeFromRailStation(
  state: GameState,
  flags: number,
  start: number,
  end: number,
  actor: number,
): CommandCost {
  void actor; // the owner check passes for the company and for the sea
  const last = end === 0 ? start : end;
  if (start < 0 || start >= state.map.size || last < 0 || last >= state.map.size) return CMD_ERROR;
  return removeFromRailBaseStation(state, orthogonalTiles(state.map, start, last), flags);
}

/** Port of station_cmd.cpp:ClearTile_Station (rail stations only so far). */
export function clearTileStation(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  if ((flags & DoFlag.Auto) !== 0) return fail('error.mustDemolishRailroad');
  // if there is flooding, remove platforms tile by tile
  if (actor === OWNER_WATER) return removeFromRailStation(state, DoFlag.Execute, t, t, actor);

  // RemoveRailStation(st, flags): the area shrinks while tiles go, so walk a copy of it
  const st = state.stations[getStationIndex(state.map, t)];
  if (st === undefined || st === null || st.trainStation === null) return CMD_ERROR;
  const { tile, w, h } = st.trainStation;
  const last = tileXY(state.map, tileX(state.map, tile) + w - 1, tileY(state.map, tile) + h - 1);
  let cost = succeed(0);
  for (const part of orthogonalTiles(state.map, tile, last)) {
    if (!tileBelongsToRailStation(state.map, st, part)) continue;
    const ret = removeFromRailBaseStation(state, [part], flags);
    if (!ret.ok) return ret;
    cost = addCost(cost, ret);
  }
  return cost;
}

/**
 * Port of station_cmd.cpp:OnTick_Station: StationHandleSmallTick and the deletion half of
 * StationHandleBigTick. Rating, acceptance and animation come with block 1.5.
 */
export function onTickStation(state: GameState): void {
  for (const st of state.stations) {
    if (st === null) continue;
    if (isInUse(st)) {
      // the rating update at 0 is block 1.5
      st.deleteCtr = st.deleteCtr + 1 >= STATION_RATING_TICKS ? 0 : st.deleteCtr + 1;
    }
    if ((state.tickCounter + st.index) % STATION_ACCEPTANCE_TICKS === 0 && !isInUse(st)) {
      if (++st.deleteCtr >= 8) state.stations[st.index] = null;
    }
  }
}
