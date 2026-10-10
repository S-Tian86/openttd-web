import { CMD_ERROR, DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import type { GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { doClearSquare } from '../map/landscape';
import { COMPANY_FIRST, getTileOwner, OWNER_TOWN } from '../map/map';
import { getRailType, makeRailNormal } from '../map/rail-map';
import {
  getCrossingRailBits,
  getCrossingRailTrack,
  getCrossingRoadBits,
  getRoadBits,
  getRoadOwner,
  getTownIndex,
  isLevelCrossingTile,
  isNormalRoadTile,
  LEVELCROSSING_TRACKBIT_FACTOR,
  setRoadBits,
} from '../map/road-map';
import { cmdRemoveSingleRail } from '../track/rail-cmd';

const popcount4 = (n: number): number => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);

/**
 * Port of road_cmd.cpp:CheckAllowRemoveRoad. The sea and towns always may. A company may remove
 * its own roads and, with the town rating at RATING_INITIAL and extra_dynamite on, a town's too
 * (R15); the player's bulldozer is stopped earlier, in clearTileRoad (R33).
 */
export function checkAllowRemoveRoad(
  _state: GameState,
  _t: number,
  remove: number,
  owner: number,
  actor: number,
): CommandCost {
  if (remove === 0 || actor !== COMPANY_FIRST) return succeed();
  if (owner !== OWNER_TOWN) return succeed(); // OWNER_NONE, or the company's own road
  return succeed(); // a town's road: the rating gate passes and the rating is not changed
}

/** Port of road_cmd.cpp:RemoveRoad (normal road and level crossing branches). Returns the cost of the pieces removed. */
export function removeRoad(
  state: GameState,
  t: number,
  flags: number,
  pieces: number,
  actor: number,
): CommandCost {
  const { map } = state;
  if (isLevelCrossingTile(map, t)) {
    if ((pieces & ~getCrossingRoadBits(map, t) & 0x0f) !== 0) return CMD_ERROR;
    const allowed = checkAllowRemoveRoad(state, t, pieces, getRoadOwner(map, t), actor);
    if (!allowed.ok) return allowed;
    if ((flags & DoFlag.Execute) !== 0) {
      // The rail stays, owned as before; only the difference to the crossing's count goes.
      makeRailNormal(
        map,
        t,
        getTileOwner(map, t),
        getCrossingRailBits(map, t),
        getRailType(map, t),
      );
      state.company.infrastructure.rail -= LEVELCROSSING_TRACKBIT_FACTOR - 1;
      state.dirtyTiles.add(t);
    }
    return succeed(2 * state.prices.clearRoad);
  }
  const present = getRoadBits(map, t);
  const removed = pieces & present;
  if (removed === 0) return CMD_ERROR;
  const allowed = checkAllowRemoveRoad(state, t, removed, getRoadOwner(map, t), actor);
  if (!allowed.ok) return allowed;
  if ((flags & DoFlag.Execute) !== 0) {
    const left = present ^ removed;
    if (left === 0) doClearSquare(map, t, false);
    else setRoadBits(map, t, left);
    state.dirtyTiles.add(t);
  }
  return succeed(popcount4(removed) * state.prices.clearRoad);
}

/** Port of road_cmd.cpp:ClearTile_Road (normal roads and level crossings). */
export function clearTileRoad(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  const { map } = state;
  const auto = (flags & DoFlag.Auto) !== 0;
  if (isLevelCrossingTile(map, t)) {
    if (auto) return fail('error.mustRemoveRoadFirst');
    // R33 (D2): the player's bulldozer takes only the rail back; the road stays the town's.
    if (actor === COMPANY_FIRST) {
      return cmdRemoveSingleRail(state, flags, t, getCrossingRailTrack(map, t), actor);
    }
    const ret = removeRoad(state, t, flags, getCrossingRoadBits(map, t), actor);
    if (ret.ok && (flags & DoFlag.Execute) !== 0) landscapeClear(state, t, flags, actor);
    return ret;
  }
  if (!isNormalRoadTile(map, t)) return CMD_ERROR;
  // R33 (D2): the player's bulldozer never removes a town's road.
  if (actor === COMPANY_FIRST && !auto && getRoadOwner(map, t) === OWNER_TOWN) {
    return fail('error.localAuthorityRefuses', { town: getTownIndex(map, t) });
  }
  const bits = getRoadBits(map, t);
  if (popcount4(bits) === 1 || !auto) return removeRoad(state, t, flags, bits, actor);
  return fail('error.mustRemoveRoadFirst');
}
