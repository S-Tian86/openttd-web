import { chance16I, nextRandom, randomRange } from '../core/random';
import type { GameState } from '../game';
import { DiagDir, INVALID_TILE, reverseDiagDir, tileOffsByDiagDir } from '../map/geometry';
import {
  incHouseConstructionTick,
  getHouseConstructionTick,
  getHouseType,
  isHouseCompleted,
  makeHouseTile,
  resetHouseAge,
  TOWN_HOUSE_COMPLETED,
} from '../map/house-map';
import { canAutoClear, doClearSquare } from '../map/landscape';
import { getTownIndex } from '../map/road-map';
import { getTileMaxZ, isTileFlat } from '../map/slope';
import type { MapState } from '../map/map';
import { HOUSE_PROBABILITY, houseCandidates, houseSpec, type HouseSpec } from './house-specs';
import { getTownRadiusGroup, TownFlag, updateTownRadius, type Town } from './town';

/**
 * Port of town_cmd.cpp:CanBuildHouseHere (flat only, ruling R11; RoadTypesAllowHouseHere is
 * always true with one road type; no bridges yet).
 */
export const canBuildHouseHere = (map: MapState, t: number): boolean =>
  isTileFlat(map, t) && canAutoClear(map, t, true);

/** Port of town_cmd.cpp:CheckBuildHouseSameZ. */
function checkBuildHouseSameZ(map: MapState, t: number, z: number): boolean {
  return canBuildHouseHere(map, t) && getTileMaxZ(map, t) === z;
}

/** Port of town_cmd.cpp:CheckFree2x2Area (t is the northern tile of the block). */
export function checkFree2x2Area(map: MapState, t: number, maxZ: number): boolean {
  if (!checkBuildHouseSameZ(map, t, maxZ)) return false;
  let tile = t;
  for (const d of [DiagDir.SE, DiagDir.SW, DiagDir.NW]) {
    tile += tileOffsByDiagDir(map, d);
    if (!checkBuildHouseSameZ(map, tile, maxZ)) return false;
  }
  return true;
}

/**
 * Port of town_cmd.cpp:CheckTownBuild2x2House: tries t and its three neighbours clockwise
 * (TL_ORIGINAL allows every position). Returns the northern tile or INVALID_TILE.
 */
export function checkTownBuild2x2House(map: MapState, t: number, maxZ: number): number {
  let tile = t;
  for (let d: number = DiagDir.SE; ; d++) {
    if (checkFree2x2Area(map, tile, maxZ)) return tile;
    if (d === 4) break; // DIAGDIR_END
    tile += tileOffsByDiagDir(map, reverseDiagDir((d & 3) as DiagDir)); // clockwise
  }
  return INVALID_TILE;
}

/** Port of town_cmd.cpp:CheckTownBuild2House (second = SE for the 1x2 hotel). */
function checkTownBuild2House(map: MapState, t: number, maxZ: number): number {
  const second = DiagDir.SE;
  const t2 = t + tileOffsByDiagDir(map, second);
  if (checkBuildHouseSameZ(map, t2, maxZ)) return t;
  const t3 = t + tileOffsByDiagDir(map, reverseDiagDir(second));
  if (checkBuildHouseSameZ(map, t3, maxZ)) return t3;
  return INVALID_TILE;
}

/** Port of town_cmd.cpp:TryBuildTownHouse (TL_ORIGINAL, temperate). */
export function tryBuildTownHouse(
  state: GameState,
  town: Town,
  t: number,
  generatingWorld: boolean,
): boolean {
  const { map } = state;
  if (!canBuildHouseHere(map, t)) return false;
  const maxZ = getTileMaxZ(map, t);
  const candidates = houseCandidates(getTownRadiusGroup(map, town, t));
  let probabilityMax = candidates.length * HOUSE_PROBABILITY;
  const year = state.calendar.year;
  while (probabilityMax > 0) {
    let r = randomRange(state.random, probabilityMax);
    let i = 0;
    while (HOUSE_PROBABILITY <= r) {
      r -= HOUSE_PROBABILITY;
      i++;
    }
    const spec = candidates[i]!;
    probabilityMax -= HOUSE_PROBABILITY;
    candidates[i] = candidates.at(-1)!; // swap-remove: the order changes, as in C++
    candidates.pop();
    if (year < spec.minYear || year > spec.maxYear) continue;
    if (
      (spec.church && (town.flags & TownFlag.HasChurch) !== 0) ||
      (spec.stadium && (town.flags & TownFlag.HasStadium) !== 0)
    )
      continue;
    let north = t;
    if (spec.size === '2x2') {
      north = checkTownBuild2x2House(map, t, maxZ);
      if (north === INVALID_TILE) continue;
    } else if (spec.size === '1x2') {
      north = checkTownBuild2House(map, t, maxZ);
      if (north === INVALID_TILE) continue;
    }
    const randomBits = nextRandom(state.random) & 0xff;
    if (spec.church) town.flags |= TownFlag.HasChurch;
    if (spec.stadium) town.flags |= TownFlag.HasStadium;
    buildTownHouse(state, town, north, spec, randomBits, generatingWorld);
    return true;
  }
  return false;
}

/** Port of town_cmd.cpp:BuildTownHouse + MakeTownHouse. */
export function buildTownHouse(
  state: GameState,
  town: Town,
  t: number,
  spec: HouseSpec,
  randomBits: number,
  generatingWorld: boolean,
): void {
  const { map } = state;
  town.numHouses++;
  let counter = 0;
  let stage = 0;
  if (generatingWorld) {
    const constructionRandom = nextRandom(state.random);
    stage = TOWN_HOUSE_COMPLETED;
    if (chance16I(1, 7, nextRandom(state.random))) stage = constructionRandom & 3;
    if (stage === TOWN_HOUSE_COMPLETED) {
      town.population += spec.population;
    } else {
      counter = (constructionRandom >>> 2) & 3;
    }
  }
  // MakeTownHouse: the type grows by one per extra tile, in (0,1), (1,0), (1,1) order
  const tiles: [number, number][] = [[0, 0]];
  if (spec.size === '1x2' || spec.size === '2x2') tiles.push([0, 1]);
  if (spec.size === '2x2') tiles.push([1, 0], [1, 1]);
  let type = spec.id;
  for (const [dx, dy] of tiles) {
    const tile = t + dy * map.sizeX + dx;
    doClearSquare(map, tile, generatingWorld);
    makeHouseTile(map, tile, town.index, counter, stage, type++, randomBits);
    state.dirtyTiles.add(tile);
  }
  updateTownRadius(town);
}

/** Port of town_cmd.cpp:AdvanceSingleHouseConstruction. */
function advanceSingleHouseConstruction(
  state: GameState,
  t: number,
  markDirty: (t: number) => void,
): void {
  const { map } = state;
  incHouseConstructionTick(map, t);
  if (getHouseConstructionTick(map, t) !== 0) return;
  if (isHouseCompleted(map, t)) {
    const town = state.towns[getTownIndex(map, t)];
    if (town !== undefined) town.population += houseSpec(getHouseType(map, t)).population;
    resetHouseAge(map, t);
  }
  markDirty(t);
}

/**
 * Port of town_cmd.cpp:TileLoop_Town. Only the construction advance exists until block 1.5
 * (ruling R4): completed houses do nothing.
 */
export function tileLoopTown(state: GameState, t: number, markDirty: (t: number) => void): void {
  const { map } = state;
  if (isHouseCompleted(map, t)) return;
  const { size } = houseSpec(getHouseType(map, t));
  if (size === 'part') return;
  advanceSingleHouseConstruction(state, t, markDirty);
  if (size === '1x2' || size === '2x2')
    advanceSingleHouseConstruction(state, t + map.sizeX, markDirty);
  if (size === '2x2') {
    advanceSingleHouseConstruction(state, t + 1, markDirty);
    advanceSingleHouseConstruction(state, t + map.sizeX + 1, markDirty);
  }
}
