import { nextRandom } from '../core/random';
import type { GameState } from '../game';
import {
  distanceFromEdge,
  distanceManhattan,
  INVALID_TILE,
  randomTile,
  scaleByLandProportion,
  scaleBySize,
  spiralTiles,
} from '../map/geometry';
import { getClearGround, ClearGround } from '../map/clear';
import { doClearSquare } from '../map/landscape';
import { getTileType, OWNER_TOWN, TileType, tileXY, tileX, tileY, type MapState } from '../map/map';
import { getRoadOwner, getTownIndex, isNormalRoadTile } from '../map/road-map';
import { getTileMaxZ, getTileZ, isTileFlat } from '../map/slope';
import { getTreeGround, TreeGround } from '../map/tree-map';
import { hasTileWaterGround } from '../map/water';
import { WorldGenerationError } from '../world/errors';
import { WORLD } from '../world/settings';
import { growTown } from './growth';
import { newTown, updateTownRadius, type Town } from './town';
import { generateTownName } from './town-names';

/** Widened from the literal so the city rules read like the C++ (a setting, not a constant). */
const largerTowns: number = WORLD.largerTowns;

/** Port of town_cmd.cpp:GetDefaultTownsForMapSize (difficulty.number_towns 0..3). */
export const defaultTownCount = (map: MapState, level: number): number =>
  scaleBySize(map, [5, 11, 23, 46][level]!);

/** Port of town_cmd.cpp:TownCanBePlacedHere (check_surrounding = true). */
export function townCanBePlacedHere(state: GameState, t: number): boolean {
  const { map } = state;
  if (distanceFromEdge(map, t) < 12) return false;
  // IsCloseToTown: the kd-tree metric is Manhattan.
  for (const town of state.towns) if (distanceManhattan(map, t, town.xy) < 20) return false;
  const type = getTileType(map, t);
  if ((type !== TileType.Clear && type !== TileType.Trees) || !isTileFlat(map, t)) return false;
  const h = getTileZ(map, t);
  let counter = 0;
  for (const tile of spiralTiles(map, t, 5)) {
    if (counter === 12) break; // VALID_TILE_GOAL
    const tileType = getTileType(map, tile);
    if (tileType === TileType.Clear) {
      if (getClearGround(map, tile) === ClearGround.Rough) continue;
    } else if (tileType === TileType.Trees) {
      if (getTreeGround(map, tile) === TreeGround.Rough) continue;
    } else {
      continue;
    }
    if (getTileMaxZ(map, tile) <= h + 1 && getTileZ(map, tile) >= h - 1) counter++;
  }
  return counter >= 12;
}

/**
 * Port of map.cpp:GetClosestWaterDistance (water = true): 0 on water ground, else the Manhattan
 * distance to the nearest water ground, 0x7f when there is none.
 */
export function getClosestWaterDistance(map: MapState, t: number): number {
  if (hasTileWaterGround(map, t)) return 0;
  const maxDist = 0x7f;
  const maxX = map.sizeX - 1;
  const maxY = map.sizeY - 1;
  const ddx = [-1, 1, 1, -1];
  const ddy = [1, 1, -1, -1];
  let x = tileX(map, t);
  let y = tileY(map, t);
  for (let dist = 1; dist < maxDist; dist++) {
    y--;
    for (let dir = 0; dir < 4; dir++) {
      for (let a = 0; a < dist; a++) {
        // Void tiles are not checked: the interval is [1, max) (freeform edges).
        if (x >= 1 && x < maxX && y >= 1 && y < maxY) {
          if (hasTileWaterGround(map, tileXY(map, x, y))) return dist;
        }
        x += ddx[dir]!;
        y += ddy[dir]!;
      }
    }
  }
  return maxDist;
}

/** Port of town_cmd.cpp:FindNearestGoodCoastalTownSpot (layout TL_ORIGINAL: no grid alignment). */
export function findNearestGoodCoastalTownSpot(state: GameState, t: number): number {
  const { map } = state;
  for (const coast of spiralTiles(map, t, 40)) {
    if (getTileType(map, coast) !== TileType.Clear) continue;
    let furthest = INVALID_TILE;
    let maxDist = 0;
    for (const test of spiralTiles(map, coast, 10)) {
      if (getTileType(map, test) !== TileType.Clear || !isTileFlat(map, test)) continue;
      if (!townCanBePlacedHere(state, test)) continue;
      const dist = getClosestWaterDistance(map, test);
      if (dist > maxDist) {
        furthest = test;
        maxDist = dist;
      }
    }
    return furthest; // only the first clear tile found is searched
  }
  return INVALID_TILE;
}

/** Port of town_cmd.cpp:DoCreateTown (TSZ_RANDOM, not manual). */
export function doCreateTown(state: GameState, town: Town): void {
  let x = (nextRandom(state.random) & 0xf) + 8;
  if (town.isCity) x *= WORLD.initialCitySize;
  town.numHouses += x; // pretend the town is bigger while it grows
  updateTownRadius(town);
  for (let i = x * 4; i > 0; i--) growTown(state, town);
  town.numHouses -= x;
  updateTownRadius(town);
  // UpdateTownGrowthRate (growth, R4) and UpdateTownMaxPass (passenger statistics) wait for block 1.5.
}

/**
 * Port of town_cmd.cpp:CmdDeleteTown (generation case): clears the town's houses and town-owned
 * roads. The town must be the last one created, so its pool index is reused like OpenTTD's lowest
 * free index.
 */
export function deleteTown(state: GameState, town: Town): void {
  const { map } = state;
  for (let t = 0; t < map.size; t++) {
    const type = getTileType(map, t);
    const owned =
      (type === TileType.House && getTownIndex(map, t) === town.index) ||
      (type === TileType.Road &&
        isNormalRoadTile(map, t) &&
        getRoadOwner(map, t) === OWNER_TOWN &&
        getTownIndex(map, t) === town.index);
    if (owned) doClearSquare(map, t, true);
  }
  state.towns.pop();
}

/** Port of town_cmd.cpp:CreateRandomTown (AlignTileToGrid is a no-op for TL_ORIGINAL). */
export function createRandomTown(
  state: GameState,
  attempts: number,
  nameParts: number,
  isCity: boolean,
): Town | null {
  const { map } = state;
  for (let i = 0; i < attempts; i++) {
    let tile = randomTile(map, nextRandom(state.random));
    if (getTileType(map, tile) === TileType.Water) {
      tile = findNearestGoodCoastalTownSpot(state, tile);
      if (tile === INVALID_TILE) continue;
    } else if (!townCanBePlacedHere(state, tile)) {
      continue;
    }
    const town = newTown(state.towns.length, tile, nameParts, isCity);
    state.towns.push(town);
    doCreateTown(state, town);
    if (town.population > 0) return town;
    deleteTown(state, town);
  }
  return null;
}

/** Port of town_cmd.cpp:GenerateTowns (TL_ORIGINAL, larger_towns 4). Yields its own progress. */
export function* generateTowns(state: GameState): Generator<number, void, void> {
  const { map, random } = state;
  let total = scaleByLandProportion(
    defaultTownCount(map, state.options.townCount) + (nextRandom(random) & 7),
    state.initialLandCount,
    map.size,
  );
  total = Math.min(Math.max(total, 1), 64000);
  const used = new Set<string>();
  const cityOffset = largerTowns === 0 ? 0 : nextRandom(random) % largerTowns;
  let created = 0;
  for (let i = 0; i < total; i++) {
    const isCity = largerTowns !== 0 && (cityOffset + created) % largerTowns === 0;
    const parts = generateTownName(random, used);
    if (parts !== null && createRandomTown(state, 20, parts, isCity) !== null) created++;
    yield (i + 1) / total;
  }
  if (created > 0) return;
  const parts = generateTownName(random, null, []);
  if (parts !== null && createRandomTown(state, 10000, parts, largerTowns !== 0) !== null) return;
  throw new WorldGenerationError('error.noTownCreated');
}
