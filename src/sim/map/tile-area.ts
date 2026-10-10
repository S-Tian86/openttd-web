import { INVALID_TILE } from './geometry';
import { tileX, tileXY, tileY, type MapState } from './map';

/** Port of tilearea.cpp:OrthogonalTileArea + OrthogonalTileIterator: X fastest, any corner order. */
export function orthogonalTiles(map: MapState, corner1: number, corner2: number): number[] {
  const x0 = Math.min(tileX(map, corner1), tileX(map, corner2));
  const x1 = Math.max(tileX(map, corner1), tileX(map, corner2));
  const y0 = Math.min(tileY(map, corner1), tileY(map, corner2));
  const y1 = Math.max(tileY(map, corner1), tileY(map, corner2));
  const tiles: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push(tileXY(map, x, y));
  return tiles;
}

/**
 * Port of tilearea.cpp:DiagonalTileArea + DiagonalTileIterator::operator++ (start = corner1,
 * end = corner2). Tiles outside the map are skipped.
 */
export function diagonalTiles(map: MapState, corner1: number, corner2: number): number[] {
  const bx = tileX(map, corner1);
  const by = tileY(map, corner1);
  let aMax = tileY(map, corner2) + tileX(map, corner2) - by - bx;
  let bMax = tileY(map, corner2) - tileX(map, corner2) - by + bx;
  aMax += aMax > 0 ? 1 : -1; // one-past-the-end
  bMax += bMax > 0 ? 1 : -1;
  const tiles = [corner1];
  let aCur = 0;
  let bCur = 0;
  for (;;) {
    let tile = INVALID_TILE;
    do {
      if (aMax === 1 || aMax === -1) {
        aCur = 0; // every second column is empty
        bCur = bMax > 0 ? Math.min(bCur + 2, bMax) : Math.max(bCur - 2, bMax);
      } else {
        aCur += aMax > 0 ? 2 : -2;
        if (aMax > 0 ? aCur >= aMax : aCur <= aMax) {
          aCur = Math.abs(aCur) % 2 !== 0 ? 0 : aMax > 0 ? 1 : -1;
          bCur += bMax > 0 ? 1 : -1;
        }
      }
      const x = bx + Math.trunc((aCur - bCur) / 2);
      const y = by + Math.trunc((bCur + aCur) / 2);
      tile = x < 0 || y < 0 || x >= map.sizeX || y >= map.sizeY ? INVALID_TILE : tileXY(map, x, y);
    } while (tile === INVALID_TILE && bMax !== bCur);
    if (bMax === bCur) return tiles;
    tiles.push(tile);
  }
}

/** Port of tilearea.cpp:TileIterator::Create. */
export const tileIterator = (
  map: MapState,
  corner1: number,
  corner2: number,
  diagonal: boolean,
): number[] =>
  diagonal ? diagonalTiles(map, corner1, corner2) : orthogonalTiles(map, corner1, corner2);
