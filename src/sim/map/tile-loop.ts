import { getTileType, type MapState, type TileType } from './map';

/** Galois LFSR feedbacks indexed by logX + logY - 12. Port of landscape.cpp:RunTileLoop. */
export const TILE_LOOP_FEEDBACKS = [
  0xd8f, 0x1296, 0x2496, 0x4357, 0x8679, 0x1030e, 0x206cd, 0x403fe, 0x807b8, 0x1004b2, 0x2006a8,
  0x4004b2, 0x800b87,
] as const;

export type TileLoopProcs = Partial<Record<TileType, (t: number) => void>>;

/**
 * Visits size/256 tiles per tick in pseudo-random order, and tile 0 when the (already
 * incremented) tick counter is a multiple of 256. Port of landscape.cpp:RunTileLoop.
 */
export function runTileLoop(map: MapState, tickCounter: number, procs: TileLoopProcs): void {
  const feedback = TILE_LOOP_FEEDBACKS[map.logX + map.logY - 12]!;
  let count = 1 << (map.logX + map.logY - 8);
  let tile = map.tileLoopTile;
  if (tickCounter % 256 === 0) {
    procs[getTileType(map, 0)]?.(0);
    count--;
  }
  while (count-- > 0) {
    procs[getTileType(map, tile)]?.(tile);
    tile = ((tile >>> 1) ^ (-(tile & 1) & feedback)) >>> 0;
  }
  map.tileLoopTile = tile;
}
