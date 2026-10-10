import { DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import type { GameState } from '../game';
import { getHouseType, isHouseCompleted } from '../map/house-map';
import { doClearSquare } from '../map/landscape';
import { tileAddXY } from '../map/geometry';
import { getTownIndex } from '../map/road-map';
import { findHouseSpec } from './house-specs';
import { TownFlag, updateTownRadius, type Town } from './town';

/** Port of town_cmd.cpp:GetHouseNorthPart (temperate has no 2x1 houses). */
export function getHouseNorthPart(id: number): { id: number; dx: number; dy: number } {
  if (id >= 3) {
    const prev = findHouseSpec(id - 1)?.size;
    if (prev === '1x2' || prev === '2x2') return { id: id - 1, dx: 0, dy: -1 };
    if (findHouseSpec(id - 2)?.size === '2x2') return { id: id - 2, dx: -1, dy: 0 };
    if (findHouseSpec(id - 3)?.size === '2x2') return { id: id - 3, dx: -1, dy: -1 };
  }
  return { id, dx: 0, dy: 0 };
}

/** Port of town_cmd.cpp:ClearTownHouse (RemoveNearbyStations arrives with stations, block 1.5). */
export function clearTownHouse(state: GameState, town: Town, t: number): void {
  const { map } = state;
  const part = getHouseNorthPart(getHouseType(map, t));
  const north = tileAddXY(map, t, part.dx, part.dy);
  const spec = findHouseSpec(part.id)!;

  if (isHouseCompleted(map, north)) town.population -= spec.population;
  town.numHouses--;
  if (spec.church) town.flags &= ~TownFlag.HasChurch;
  else if (spec.stadium) town.flags &= ~TownFlag.HasStadium;

  const tiles = [north];
  if (spec.size === '1x2' || spec.size === '2x2') tiles.push(tileAddXY(map, north, 0, 1));
  if (spec.size === '2x2') tiles.push(tileAddXY(map, north, 1, 0), tileAddXY(map, north, 1, 1));
  for (const tile of tiles) {
    doClearSquare(map, tile, false);
    state.dirtyTiles.add(tile);
  }
  updateTownRadius(town);
}

/**
 * Port of town_cmd.cpp:ClearTile_Town. The town rating always allows the removal (it starts at
 * RATING_INITIAL, above the largest remove_rating_decrease) and is not changed (R15).
 */
export function clearTileTown(
  state: GameState,
  t: number,
  flags: number,
  _actor: number,
): CommandCost {
  if ((flags & DoFlag.Auto) !== 0) return fail('error.buildingMustBeDemolished');
  const { map } = state;
  const spec = findHouseSpec(getHouseType(map, t))!;
  // HouseSpec::GetRemovalCost
  const cost = Math.floor((state.prices.clearHouse * spec.removalCost) / 256);
  if ((flags & DoFlag.Execute) !== 0) {
    clearTownHouse(state, state.towns[getTownIndex(map, t)]!, t);
  }
  return succeed(cost);
}
