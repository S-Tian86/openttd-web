import { ClearGround, makeClear } from './clear';
import { getTileType, TileType, type MapState } from './map';
import { clearNeighbourNonFloodingStates, isCoastTile } from './water';

/** Port of landscape.cpp:DoClearSquare. */
export function doClearSquare(map: MapState, t: number, generatingWorld: boolean): void {
  makeClear(map, t, ClearGround.Grass, generatingWorld ? 3 : 0);
  clearNeighbourNonFloodingStates(map, t);
}

/**
 * Whether CMD_LANDSCAPE_CLEAR with DoCommandFlag::Auto succeeds for a non-company caller (a town,
 * world generation, water). Port of the ClearTile_* procs for the Stage 1 tile types.
 */
export function canAutoClear(map: MapState, t: number, noWater: boolean): boolean {
  switch (getTileType(map, t)) {
    case TileType.Clear:
    case TileType.Trees:
      return true;
    case TileType.Water:
      return isCoastTile(map, t) || !noWater; // ClearTile_Water: NoWater refuses open water only
    default:
      return false; // void; houses must be demolished; industries cannot be cleared with Auto
  }
}
