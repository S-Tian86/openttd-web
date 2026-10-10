import {
  addTileIndexDiffCWrap,
  Dir,
  DIR_OFFSETS,
  isValidTile,
  reverseDir,
  tileOffsByDir,
} from './geometry';
import { DoFlag } from '../command/cost';
import type { GameState } from '../game';
import { landscapeClear } from './clear-tile';
import { doClearSquare } from './landscape';
import { getTileType, OWNER_WATER, TileType, type MapState } from './map';
import { getTileSlopeZ, isSlopeWithOneCornerRaised, Slope } from './slope';
import { getTreeGround, setTreeGroundDensity, TreeGround } from './tree-map';
import {
  getWaterClass,
  isCoastTile,
  isNonFloodingWaterTile,
  makeSea,
  makeShore,
  setNonFloodingWaterTile,
  WaterClass,
} from './water';
import { ClearGround, makeClear } from './clear';

/** Port of water_cmd.cpp:_flood_from_dirs (index = slope, directions in `Directions` bit order). */
export const FLOOD_FROM_DIRS: readonly (readonly Dir[])[] = [
  [Dir.NE, Dir.SE, Dir.SW, Dir.NW], // SLOPE_FLAT
  [Dir.NE, Dir.SE], // SLOPE_W
  [Dir.NE, Dir.NW], // SLOPE_S
  [Dir.NE], // SLOPE_SW
  [Dir.SW, Dir.NW], // SLOPE_E
  [], // SLOPE_EW
  [Dir.NW], // SLOPE_SE
  [Dir.N, Dir.NE, Dir.NW], // SLOPE_WSE
  [Dir.SE, Dir.SW], // SLOPE_N
  [Dir.SE], // SLOPE_NW
  [], // SLOPE_NS
  [Dir.NE, Dir.E, Dir.SE], // SLOPE_NWS
  [Dir.SW], // SLOPE_NE
  [Dir.SE, Dir.S, Dir.SW], // SLOPE_ENW
  [Dir.SW, Dir.W, Dir.NW], // SLOPE_SEN
];

/** Port of water_cmd.cpp:FloodingBehaviour. */
export const FloodingBehaviour = { None: 0, Active: 1, Passive: 2, DryUp: 3 } as const;
export type FloodingBehaviour = (typeof FloodingBehaviour)[keyof typeof FloodingBehaviour];

const SLOPE_MASK = 15; // ~SLOPE_STEEP

/** Port of water_cmd.cpp:GetFloodingBehaviour (tile types that exist in Stage 1). */
export function getFloodingBehaviour(map: MapState, t: number): FloodingBehaviour {
  switch (getTileType(map, t)) {
    case TileType.Water:
      if (isCoastTile(map, t)) {
        const { slope } = getTileSlopeZ(map, t);
        return isSlopeWithOneCornerRaised(slope)
          ? FloodingBehaviour.Active
          : FloodingBehaviour.DryUp;
      }
      return getWaterClass(map, t) === WaterClass.Sea
        ? FloodingBehaviour.Active
        : FloodingBehaviour.None;
    case TileType.Industry:
      return getWaterClass(map, t) === WaterClass.Sea
        ? FloodingBehaviour.Active
        : FloodingBehaviour.None;
    case TileType.Trees:
      return getTreeGround(map, t) === TreeGround.Shore
        ? FloodingBehaviour.DryUp
        : FloodingBehaviour.None;
    case TileType.Void:
      return FloodingBehaviour.Active;
    default:
      return FloodingBehaviour.None;
  }
}

/**
 * Port of water_cmd.cpp:DoFloodTile. A flat target of any type is cleared by the sea and becomes
 * sea; a sloped one keeps the Stage 1 behaviour (clear and tree tiles only).
 */
function doFloodTile(state: GameState, target: number, markDirty: (t: number) => void): void {
  const { map } = state;
  const type = getTileType(map, target);
  const { slope } = getTileSlopeZ(map, target);
  if (slope === Slope.Flat) {
    if (landscapeClear(state, target, DoFlag.Execute, OWNER_WATER).ok) {
      makeSea(map, target);
      markDirty(target);
    }
    return;
  }
  if (type !== TileType.Clear && type !== TileType.Trees) return;
  if (type === TileType.Trees && !isSlopeWithOneCornerRaised(slope)) {
    setTreeGroundDensity(map, target, TreeGround.Shore, 3);
  } else {
    doClearSquare(map, target, false);
    makeShore(map, target);
  }
  markDirty(target);
}

/** Port of water_cmd.cpp:DoDryUp. */
function doDryUp(map: MapState, t: number, markDirty: (t: number) => void): void {
  if (getTileType(map, t) === TileType.Trees) {
    setTreeGroundDensity(map, t, TreeGround.Grass, 3);
  } else {
    doClearSquare(map, t, false);
    makeClear(map, t, ClearGround.Grass, 3);
  }
  markDirty(t);
}

/** Port of water_cmd.cpp:TileLoop_Water. */
export function tileLoopWater(state: GameState, t: number, markDirty: (t: number) => void): void {
  const { map } = state;
  const isWater = getTileType(map, t) === TileType.Water;
  if (isWater && isNonFloodingWaterTile(map, t)) return;

  switch (getFloodingBehaviour(map, t)) {
    case FloodingBehaviour.Active: {
      let continueFlooding = false;
      for (let dir = Dir.N; dir <= Dir.NW; dir++) {
        const [dx, dy] = DIR_OFFSETS[dir]!;
        const dest = addTileIndexDiffCWrap(map, t, dx, dy);
        // Flooding does not consider void tiles, and skips water to stay fast.
        if (!isValidTile(map, dest)) continue;
        const destType = getTileType(map, dest);
        if (destType === TileType.Water) continue;
        continueFlooding = true;
        if (destType === TileType.Trees && getTreeGround(map, dest) === TreeGround.Shore) continue;
        const { slope, z } = getTileSlopeZ(map, dest);
        if (z > 0) continue;
        if (!FLOOD_FROM_DIRS[slope & SLOPE_MASK]!.includes(reverseDir(dir as Dir))) continue;
        doFloodTile(state, dest, markDirty);
      }
      if (!continueFlooding && isWater) setNonFloodingWaterTile(map, t, true);
      break;
    }
    case FloodingBehaviour.DryUp: {
      const { slope } = getTileSlopeZ(map, t);
      for (const dir of FLOOD_FROM_DIRS[slope & SLOPE_MASK]!) {
        const [dx, dy] = DIR_OFFSETS[dir]!;
        const dest = addTileIndexDiffCWrap(map, t, dx, dy);
        if (dest < 0) continue; // INVALID_TILE; void is allowed
        const behaviour = getFloodingBehaviour(map, dest);
        if (behaviour === FloodingBehaviour.Active || behaviour === FloodingBehaviour.Passive)
          return;
      }
      doDryUp(map, t, markDirty);
      break;
    }
    default:
      return;
  }
}

/** Port of void_cmd.cpp:TileLoop_Void (floods the edge tiles next to the void border). */
export const tileLoopVoid = tileLoopWater;

/** Port of water_cmd.cpp:ConvertGroundTilesIntoWaterTiles. */
export function convertGroundTilesIntoWaterTiles(map: MapState): void {
  for (let t = 0; t < map.size; t++) {
    const { slope, z } = getTileSlopeZ(map, t);
    if (getTileType(map, t) !== TileType.Clear || z !== 0) continue;
    if (slope === Slope.Flat) {
      makeSea(map, t);
    } else if (isSlopeWithOneCornerRaised(slope)) {
      makeShore(map, t);
    } else {
      for (const dir of FLOOD_FROM_DIRS[slope & SLOPE_MASK]!) {
        const dest = t + tileOffsByDir(map, dir);
        const slopeDest = getTileSlopeZ(map, dest).slope & SLOPE_MASK;
        if (
          slopeDest === Slope.Flat ||
          isSlopeWithOneCornerRaised(slopeDest) ||
          getTileType(map, dest) === TileType.Void
        ) {
          makeShore(map, t);
          break;
        }
      }
    }
  }
}
