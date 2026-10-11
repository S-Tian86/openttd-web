import { chance16I, nextRandom, randomRange, type Randomizer } from '../core/random';
import type { GameState } from '../game';
import {
  DiagDir,
  diagDirLeft,
  diagDirRight,
  distanceFromEdge,
  isValidTile,
  reverseDiagDir,
  tileDiffXY,
  tileOffsByDiagDir,
} from '../map/geometry';
import { canAutoClear } from '../map/landscape';
import { getTileType, OWNER_TOWN, TileType, type MapState } from '../map/map';
import {
  diagDirToRoadBits,
  getRoadOwner,
  getTownIndex,
  getTownRoadBits,
  isNormalRoadTile,
  RoadBits,
} from '../map/road-map';
import { isTileFlat } from '../map/slope';
import { hasTileWaterGround } from '../map/water';
import { tryBuildTownHouse } from './houses';
import { buildTownRoad, canTownBuildRoad, cleanUpRoadBits } from './town-roads';
import type { Town } from './town';

/** Port of town_cmd.cpp:TownGrowthResult. */
export const GrowthResult = { Succeed: 0, SearchStopped: 1, Continue: 2 } as const;
export type GrowthResult = (typeof GrowthResult)[keyof typeof GrowthResult];

/** _town_coord_mod. Port of town_cmd.cpp:GrowTown. */
export const TOWN_COORD_MOD: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 0],
  [0, 2],
  [2, 0],
  [0, -2],
  [-1, -1],
  [-2, 2],
  [2, 2],
  [2, -2],
  [0, 0],
];

const DIAGDIR_END = 4;

/** Port of town_cmd.cpp:RandomDiagDir. */
const randomDiagDir = (random: Randomizer): DiagDir => randomRange(random, 4) as DiagDir;

/** Port of town_cmd.cpp:GenRandomRoadBits. */
export function genRandomRoadBits(random: Randomizer): number {
  const r = nextRandom(random);
  const a = r & 3;
  let b = (r >>> 8) & 3;
  if (a === b) b ^= 2;
  return (RoadBits.NW << a) + (RoadBits.NW << b);
}

/** Port of town_cmd.cpp:CanFollowRoad (TownExpandMode::Roads; no stations or tunnels yet). */
export function canFollowRoad(map: MapState, t: number, dir: DiagDir): boolean {
  const target = t + tileOffsByDiagDir(map, dir);
  if (!isValidTile(map, target)) return false;
  if (hasTileWaterGround(map, target)) return false;
  switch (getTileType(map, target)) {
    case TileType.Road:
      return getTownRoadBits(map, target) !== RoadBits.None;
    case TileType.House:
    case TileType.Industry:
    case TileType.Object:
      return false;
    default:
      return true; // void and water were checked above
  }
}

/** Port of town_cmd.cpp:IsNeighbourRoadTile. */
export function isNeighbourRoadTile(
  map: MapState,
  t: number,
  dir: DiagDir,
  distMulti: number,
): boolean {
  if (!isValidTile(map, t)) return false;
  const right = tileOffsByDiagDir(map, diagDirRight(dir));
  const left = tileOffsByDiagDir(map, diagDirLeft(dir));
  const back = tileOffsByDiagDir(map, reverseDiagDir(dir));
  for (let pos = 4; pos < (distMulti + 1) * 4; pos++) {
    let cur = ((pos & 1) !== 0 ? right : left) * (pos >> 2);
    if ((pos & 2) !== 0) cur += back;
    const bit = diagDirToRoadBits((pos & 2) !== 0 ? dir : reverseDiagDir(dir));
    if (isValidTile(map, t + cur) && (getTownRoadBits(map, t + cur) & bit) !== 0) return true;
  }
  return false;
}

/**
 * Port of town_cmd.cpp:IsRoadAllowedHere (TL_ORIGINAL, no bridges). A sloped tile refuses the
 * road (ruling R11), so the slope branch and its Chance16 draws are not ported.
 */
export function isRoadAllowedHere(map: MapState, t: number, dir: DiagDir): boolean {
  if (distanceFromEdge(map, t) === 0) return false;
  if (getTownRoadBits(map, t) === RoadBits.None) {
    const bits = dir === DiagDir.NW || dir === DiagDir.SE ? RoadBits.Y : RoadBits.X;
    if (!canTownBuildRoad(map, t, bits) && !canAutoClear(map, t, true)) return false;
  }
  if (!isTileFlat(map, t)) return false;
  return !isNeighbourRoadTile(map, t, dir, 1);
}

/** The corner tile a house may take inside a road turn, by the turn's RoadBits. */
function cornerHouseOffset(curRb: number): readonly [number, number] | undefined {
  switch (curRb) {
    case RoadBits.N:
      return [1, 1]; // DIR_S
    case RoadBits.S:
      return [-1, -1]; // DIR_N
    case RoadBits.E:
      return [1, -1]; // DIR_W
    case RoadBits.W:
      return [-1, 1]; // DIR_E
    default:
      return undefined;
  }
}

/**
 * Port of town_cmd.cpp:GrowTownInTile for TL_ORIGINAL with both expand modes. Stage 1 drops the
 * Chance16(1, 6) draws before LevelTownLand (rulings R1, R11) and has no tunnels or bridges
 * (GrowTownWithBridge/GrowTownWithTunnel always fail on flat land without rivers or rails).
 * `targetDir` is 0..3 or 4 (DIAGDIR_END).
 */
export function growTownInTile(
  state: GameState,
  town: Town,
  t: number,
  curRb: number,
  targetDir: number,
): GrowthResult {
  const { map, random } = state;
  let rcmd: number = RoadBits.None;

  if (curRb === RoadBits.None) {
    // Tile has no road: this is the last iteration either way.
    let dir = targetDir as DiagDir;
    if (!isRoadAllowedHere(map, t, dir)) return GrowthResult.SearchStopped;
    const source = reverseDiagDir(dir);
    if (chance16I(1, 4, nextRandom(random))) {
      do dir = randomDiagDir(random);
      while (dir === source);
    }
    if (!isRoadAllowedHere(map, t + tileOffsByDiagDir(map, dir), dir)) {
      // The road may not continue: only a straight road with a house on either side is built.
      if (dir !== reverseDiagDir(source)) return GrowthResult.SearchStopped;
      const right = t + tileOffsByDiagDir(map, diagDirRight(dir));
      const left = t + tileOffsByDiagDir(map, diagDirLeft(dir));
      if (getTileType(map, right) !== TileType.House && getTileType(map, left) !== TileType.House)
        return GrowthResult.SearchStopped;
    }
    rcmd = diagDirToRoadBits(dir) | diagDirToRoadBits(source);
  } else if (
    targetDir < DIAGDIR_END &&
    (curRb & diagDirToRoadBits(reverseDiagDir(targetDir as DiagDir))) === 0
  ) {
    // Continue a partial road (TownCanGrowRoad is always true with one road type).
    rcmd = diagDirToRoadBits(reverseDiagDir(targetDir as DiagDir));
  } else {
    let allowHouse = true;
    // Possibly extend the road in a random direction; a house goes beside it or in a corner.
    let dir: number = randomDiagDir(random);
    const targetRb = diagDirToRoadBits(dir as DiagDir);
    let houseTile: number;
    if ((curRb & targetRb) !== 0) {
      // A turn has one bit in common with ROAD_X: that marks the corner-house case.
      if ((curRb & RoadBits.X) !== targetRb) return GrowthResult.Continue;
      const corner = cornerHouseOffset(curRb);
      if (corner === undefined) return GrowthResult.Continue; // not a turn
      houseTile = t + tileDiffXY(map, corner[0], corner[1]);
      dir = DIAGDIR_END;
    } else {
      houseTile = t + tileOffsByDiagDir(map, dir as DiagDir);
    }
    if (!isValidTile(map, houseTile)) return GrowthResult.Continue; // C++ asks for water first
    if (hasTileWaterGround(map, houseTile)) return GrowthResult.Continue; // don't walk into water

    if (dir !== DIAGDIR_END) {
      // Allow a house at the edge: 60% chance, or always when no road is allowed.
      rcmd = targetRb;
      allowHouse =
        !isRoadAllowedHere(map, houseTile, dir as DiagDir) || chance16I(6, 10, nextRandom(random));
    }
    if (allowHouse) {
      // Build a house, but not where there already is one.
      if (
        getTileType(map, houseTile) !== TileType.House &&
        tryBuildTownHouse(state, town, houseTile, true)
      )
        return GrowthResult.Succeed;
      return GrowthResult.Continue;
    }
  }

  if (hasTileWaterGround(map, t)) return GrowthResult.SearchStopped;
  rcmd = cleanUpRoadBits(map, t, rcmd); // make the roads look nicer
  if (rcmd === RoadBits.None) return GrowthResult.SearchStopped;
  return buildTownRoad(state, town, t, rcmd) ? GrowthResult.Succeed : GrowthResult.SearchStopped;
}

/** Port of town_cmd.cpp:GrowTownAtRoad (TL_ORIGINAL, no tunnels or bridges). */
export function growTownAtRoad(state: GameState, town: Town, start: number): boolean {
  const { map, random } = state;
  let t = start;
  let targetDir: number = DIAGDIR_END; // first call: the "else" branch of growTownInTile
  let iterations = 10 + Math.trunc((town.numHouses * 4) / 9);
  do {
    // The bits read before growTownInTile, as in C++.
    let curRb = getTownRoadBits(map, t);
    const result = growTownInTile(state, town, t, curRb, targetDir);
    if (result === GrowthResult.Succeed) return true;
    if (result === GrowthResult.SearchStopped) iterations = 0;

    // Exclude the source position and stop when no road piece is left.
    if (targetDir < DIAGDIR_END) curRb &= ~diagDirToRoadBits(reverseDiagDir(targetDir as DiagDir));
    if (curRb === RoadBits.None) return false;

    // Walk one step along a random remaining road piece.
    do {
      if (curRb === RoadBits.None) return false;
      let bits: number;
      do {
        targetDir = randomDiagDir(random);
        bits = diagDirToRoadBits(targetDir as DiagDir);
      } while ((curRb & bits) === 0);
      curRb &= ~bits;
    } while (!canFollowRoad(map, t, targetDir as DiagDir));
    t += tileOffsByDiagDir(map, targetDir as DiagDir);

    // Don't build over roads of other towns.
    if (
      isNormalRoadTile(map, t) &&
      getRoadOwner(map, t) === OWNER_TOWN &&
      getTownIndex(map, t) !== town.index
    )
      return false;
  } while (--iterations >= 0);
  return false;
}

/**
 * Port of town_cmd.cpp:GrowTown (both expand modes).
 * Precondition: the town centre is at least 12 tiles from the map edge (townCanBePlacedHere
 * guarantees it), so the walk's tile offsets never leave the map; there is no bounds check here.
 */
export function growTown(state: GameState, town: Town): boolean {
  const { map } = state;
  // Find a road that we can base the construction on.
  let t = town.xy;
  for (const [dx, dy] of TOWN_COORD_MOD) {
    if (getTownRoadBits(map, t) !== RoadBits.None) return growTownAtRoad(state, town, t);
    t += tileDiffXY(map, dx, dy);
  }
  // No road: build a random road piece on the first plain land that is not a house.
  t = town.xy;
  for (const [dx, dy] of TOWN_COORD_MOD) {
    if (
      getTileType(map, t) !== TileType.House &&
      isTileFlat(map, t) &&
      canAutoClear(map, t, true)
    ) {
      buildTownRoad(state, town, t, genRandomRoadBits(state.random));
      return true;
    }
    t += tileDiffXY(map, dx, dy);
  }
  return false;
}
