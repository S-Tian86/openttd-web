import { addCost, CMD_ERROR, DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import { lowestFreeSlot } from '../core/pool';
import type { GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { DiagDir, isValidTile, tileOffsByDiagDir } from '../map/geometry';
import { doClearSquare } from '../map/landscape';
import { COMPANY_FIRST, getTileOwner, getTileType, OWNER_WATER, TileType } from '../map/map';
import {
  getDepotIndex,
  getRailDepotDirection,
  getRailTileType,
  getRailType,
  getTrackBits,
  isRailDepotTile,
  makeRailDepot,
  RAILTYPE_RAIL,
  RailTileType,
  setRailDepotExitDirection,
} from '../map/rail-map';
import { isTileFlat } from '../map/slope';
import { closestTownFromTile } from '../town/town';
import { railBuildCost } from './rail-cmd';
import { DIAGDIR_REACHES_TRACKS, Track } from './track';

/** Port of depot_base.h:Depot (train depots only). */
export interface Depot {
  index: number;
  xy: number;
  townIndex: number;
  townCn: number;
  buildDate: number;
}

/** Port of town.h:MakeDefaultName for depots. Stage 1 always has a town (R12). */
function makeDefaultName(state: GameState, depot: Depot): void {
  depot.townIndex = closestTownFromTile(state, depot.xy, Infinity)!.index;
  const used = new Set(
    state.depots
      .filter((d) => d !== null && d !== depot && d.townIndex === depot.townIndex)
      .map((d) => d!.townCn),
  );
  let cn = 0;
  while (used.has(cn)) cn++;
  depot.townCn = cn;
}

/** Port of rail_cmd.cpp:CmdBuildTrainDepot (RAILTYPE_RAIL; build or rotate). */
export function cmdBuildTrainDepot(
  state: GameState,
  flags: number,
  t: number,
  dir: DiagDir,
): CommandCost {
  const { map } = state;
  if (!isValidTile(map, t) || dir < 0 || dir > 3) return CMD_ERROR;
  if (!isTileFlat(map, t)) return fail('error.flatLandRequired'); // R26: no foundations
  let cost = succeed(0);
  const rotate = isRailDepotTile(map, t) && getRailType(map, t) === RAILTYPE_RAIL;
  if (rotate) {
    // CheckTileOwnership: OpenTTD says "owned by", unreachable in single player
    if (getTileOwner(map, t) !== COMPANY_FIRST) return CMD_ERROR;
    if (dir === getRailDepotDirection(map, t)) return succeed(0);
  } else {
    cost = addCost(cost, landscapeClear(state, t, flags, COMPANY_FIRST));
    if (!cost.ok) return cost;
  }
  if ((flags & DoFlag.Execute) !== 0) {
    if (rotate) {
      setRailDepotExitDirection(map, t, dir);
    } else {
      const index = lowestFreeSlot(state.depots);
      const depot: Depot = {
        index,
        xy: t,
        townIndex: 0,
        townCn: 0,
        buildDate: state.calendar.date,
      };
      makeRailDepot(map, t, COMPANY_FIRST, index, dir, RAILTYPE_RAIL);
      makeDefaultName(state, depot); // town = ClosestTownFromTile(xy, UINT_MAX); lowest unused town_cn
      state.depots[index] = depot;
      state.company.infrastructure.rail++;
    }
    state.dirtyTiles.add(t);
  }
  return addCost(cost, succeed(state.prices.buildDepotTrain + railBuildCost(state.prices)));
}

/** Port of rail_cmd.cpp:RemoveTrainDepot. `actor` is _current_company. */
export function removeTrainDepot(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  const { map } = state;
  if (actor !== OWNER_WATER && getTileOwner(map, t) !== actor) return CMD_ERROR; // CheckTileOwnership
  // EnsureNoVehicleOnGround: no vehicles until block 1.4
  if ((flags & DoFlag.Execute) !== 0) {
    state.company.infrastructure.rail--;
    state.depots[getDepotIndex(map, t)] = null;
    doClearSquare(map, t, false);
    state.dirtyTiles.add(t);
  }
  return succeed(state.prices.clearDepotTrain);
}

/** Port of rail_gui.cpp:_place_depot_extra_track. */
const EXTRA_TRACK: readonly Track[] = [
  Track.Left,
  Track.Upper,
  Track.Upper,
  Track.Right,
  Track.X,
  Track.Y,
  Track.X,
  Track.Y,
  Track.Lower,
  Track.Left,
  Track.Right,
  Track.Lower,
];

/** Port of rail_gui.cpp:_place_depot_extra_dir. */
const EXTRA_DIR: readonly DiagDir[] = [
  DiagDir.SE,
  DiagDir.SW,
  DiagDir.SE,
  DiagDir.SW,
  DiagDir.SW,
  DiagDir.NW,
  DiagDir.NE,
  DiagDir.SE,
  DiagDir.NW,
  DiagDir.NE,
  DiagDir.NW,
  DiagDir.NE,
];

/**
 * One PlaceExtraDepotRail call of rail_gui.cpp:CcRailDepot, read from the current state: the
 * rail piece to post (step 0, 1 or 2) in front of the depot's exit, or null when the callback
 * would post nothing.
 */
export function depotExtraRail(
  state: GameState,
  depotTile: number,
  dir: DiagDir,
  step: 0 | 1 | 2,
): { tile: number; track: Track } | null {
  const { map } = state;
  const step0 = tileOffsByDiagDir(map, dir);
  const tile = depotTile + step0;
  if (!isValidTile(map, tile) || getTileType(map, tile) !== TileType.Railway) return null;
  if (step === 1) {
    // don't place the rail straight out of the depot if there is another depot across from it
    const across = tile + step0;
    if (isValidTile(map, across) && isRailDepotTile(map, across)) return null;
  }
  const i = dir + 4 * step;
  if (getRailTileType(map, tile) !== RailTileType.Normal) return null; // depot or signals
  if ((getTrackBits(map, tile) & DIAGDIR_REACHES_TRACKS[EXTRA_DIR[i]!]!) === 0) return null;
  return { tile, track: EXTRA_TRACK[i]! };
}
