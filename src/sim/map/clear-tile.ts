import { CMD_ERROR, DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import { ExpensesType } from '../economy/company';
import type { PriceName } from '../economy/prices';
import type { GameState } from '../game';
import { clearTileTown } from '../town/house-removal';
import { clearTileRoad } from '../town/road-removal';
import { clearTileTrack } from '../track/rail-cmd';
import { ClearGround, getClearDensity, getClearGround } from './clear';
import { isValidTile } from './geometry';
import { getIndustryIndex } from './industry-map';
import { doClearSquare } from './landscape';
import { COMPANY_FIRST, getTileType, TileType } from './map';
import { getTileSlopeZ, isSlopeWithOneCornerRaised } from './slope';
import { tileIterator } from './tile-area';
import { getTreeCount } from './tree-map';
import { getWaterTileType, WaterTileType } from './water';

/** Port of clear_cmd.cpp:clear_price_table. */
const CLEAR_PRICE: Record<ClearGround, PriceName> = {
  [ClearGround.Grass]: 'clearGrass',
  [ClearGround.Rough]: 'clearRough',
  [ClearGround.Rocks]: 'clearRocks',
  [ClearGround.Fields]: 'clearFields',
  [ClearGround.Desert]: 'clearRough',
};

/** Port of clear_cmd.cpp:ClearTile_Clear. */
function clearTileClear(state: GameState, t: number, flags: number): CommandCost {
  const { map } = state;
  const ground = getClearGround(map, t);
  const bare = ground === ClearGround.Grass && getClearDensity(map, t) === 0;
  const price = bare ? 0 : state.prices[CLEAR_PRICE[ground]];
  if ((flags & DoFlag.Execute) !== 0) doClearSquare(map, t, false);
  return succeed(price);
}

/** Port of tree_cmd.cpp:ClearTile_Trees (temperate; the rating change is skipped, R15). */
function clearTileTrees(state: GameState, t: number, flags: number): CommandCost {
  const cost = getTreeCount(state.map, t) * state.prices.clearTrees;
  if ((flags & DoFlag.Execute) !== 0) doClearSquare(state.map, t, false);
  return succeed(cost);
}

/** Port of water_cmd.cpp:ClearTile_Water (sea and coast; canals, locks and depots do not exist yet). */
function clearTileWater(state: GameState, t: number, flags: number): CommandCost {
  const { map } = state;
  if (getWaterTileType(map, t) === WaterTileType.Clear) {
    if ((flags & DoFlag.NoWater) !== 0) return fail('error.cantBuildOnWater');
    if ((flags & DoFlag.Execute) !== 0) doClearSquare(map, t, false);
    return succeed(state.prices.clearWater);
  }
  const { slope } = getTileSlopeZ(map, t);
  if ((flags & DoFlag.Execute) !== 0) doClearSquare(map, t, false);
  return succeed(
    isSlopeWithOneCornerRaised(slope) ? state.prices.clearWater : state.prices.clearRough,
  );
}

/**
 * Port of industry_cmd.cpp:ClearTile_Industry. Only the sea (OWNER_WATER) may destroy industries
 * in the game; they stand at height 1, so it never reaches one: everyone else is refused.
 */
function clearTileIndustry(state: GameState, t: number, flags: number): CommandCost {
  if ((flags & DoFlag.Auto) !== 0) {
    return fail('error.objectInTheWay', { industry: getIndustryIndex(state.map, t) });
  }
  return CMD_ERROR; // INVALID_STRING_ID: no detail line
}

function clearTileProc(state: GameState, t: number, flags: number, actor: number): CommandCost {
  switch (getTileType(state.map, t)) {
    case TileType.Clear:
      return clearTileClear(state, t, flags);
    case TileType.Trees:
      return clearTileTrees(state, t, flags);
    case TileType.Water:
      return clearTileWater(state, t, flags);
    case TileType.Industry:
      return clearTileIndustry(state, t, flags);
    case TileType.House:
      return clearTileTown(state, t, flags, actor);
    case TileType.Road:
      return clearTileRoad(state, t, flags, actor);
    case TileType.Railway:
      return clearTileTrack(state, t, flags, actor);
    case TileType.Station:
      // Port of station_cmd.cpp:ClearTile_Station's Auto refusal (rail stations only so far);
      // the bulldozer comes with RemoveRailStation.
      if ((flags & DoFlag.Auto) !== 0) return fail('error.mustDemolishRailroad');
      return CMD_ERROR;
    default:
      return CMD_ERROR;
  }
}

/**
 * Port of landscape.cpp:CmdLandscapeClear. `actor` is OpenTTD's _current_company: COMPANY_FIRST,
 * or OWNER_WATER for the sea flooding a tile.
 */
export function landscapeClear(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  if (!isValidTile(state.map, t)) return CMD_ERROR; // CommandHelper::Do: outside the map or void
  // ForceClearTile's water branch needs a house/rail/station on water: unreachable in Stage 1.
  const c = (flags & DoFlag.Auto) !== 0 || actor !== COMPANY_FIRST ? null : state.company;
  if (c !== null && c.clearLimit >>> 16 < 1) return fail('error.clearingLimitReached');
  const cost = clearTileProc(state, t, flags, actor);
  if ((flags & DoFlag.Execute) !== 0 && c !== null) c.clearLimit -= 1 << 16; // even if the tile cost 0
  if ((flags & DoFlag.Execute) !== 0 && cost.ok) state.dirtyTiles.add(t);
  return cost;
}

/** Port of landscape.cpp:CmdClearArea (the estimate is the sum of the tests; exec pays per tile). */
export function clearArea(
  state: GameState,
  flags: number,
  endTile: number,
  startTile: number,
  diagonal: boolean,
  actor: number,
): CommandCost {
  if (startTile < 0 || startTile >= state.map.size) return CMD_ERROR;
  let money = state.company.money; // GetAvailableMoneyForCommand
  let cost = 0;
  let lastError: CommandCost = CMD_ERROR;
  let hadSuccess = false;
  const c = (flags & DoFlag.Auto) !== 0 || actor !== COMPANY_FIRST ? null : state.company;
  let limit = c === null ? 0x7fffffff : c.clearLimit >>> 16;
  const tileFlags = endTile !== startTile ? flags | DoFlag.ForceClearTile : flags;
  for (const t of tileIterator(state.map, endTile, startTile, diagonal)) {
    const ret = landscapeClear(state, t, tileFlags & ~DoFlag.Execute, actor);
    if (!ret.ok) {
      lastError = ret;
      if (c !== null && c.clearLimit >>> 16 < 1) break;
      continue;
    }
    hadSuccess = true;
    if ((flags & DoFlag.Execute) !== 0) {
      money -= ret.cost;
      if (ret.cost > 0 && money < 0) {
        return { ok: true, cost, expense: ExpensesType.Construction, extraCash: ret.cost };
      }
      landscapeClear(state, t, tileFlags, actor);
    } else if (ret.cost !== 0 && --limit <= 0) {
      break;
    }
    cost += ret.cost;
  }
  return hadSuccess ? succeed(cost) : lastError;
}
