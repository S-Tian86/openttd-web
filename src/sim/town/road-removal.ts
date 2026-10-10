import { CMD_ERROR, DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import type { GameState } from '../game';
import { doClearSquare } from '../map/landscape';
import { COMPANY_FIRST, OWNER_TOWN } from '../map/map';
import {
  getRoadBits,
  getRoadOwner,
  getTownIndex,
  isNormalRoadTile,
  setRoadBits,
} from '../map/road-map';

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

/** Port of road_cmd.cpp:RemoveRoad, normal road branch. Returns the cost of the pieces removed. */
export function removeRoad(
  state: GameState,
  t: number,
  flags: number,
  pieces: number,
  actor: number,
): CommandCost {
  const { map } = state;
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

/** Port of road_cmd.cpp:ClearTile_Road (normal roads; crossings arrive with level crossings). */
export function clearTileRoad(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  const { map } = state;
  if (!isNormalRoadTile(map, t)) return CMD_ERROR;
  const auto = (flags & DoFlag.Auto) !== 0;
  // R33 (D2): the player's bulldozer never removes a town's road.
  if (actor === COMPANY_FIRST && !auto && getRoadOwner(map, t) === OWNER_TOWN) {
    return fail('error.localAuthorityRefuses', { town: getTownIndex(map, t) });
  }
  const bits = getRoadBits(map, t);
  if (popcount4(bits) === 1 || !auto) return removeRoad(state, t, flags, bits, actor);
  return fail('error.mustRemoveRoadFirst');
}
