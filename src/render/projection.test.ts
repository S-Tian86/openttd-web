import { describe, expect, it } from 'vitest';
import {
  CHUNK_TILES,
  TILE_PX,
  chunkCellToTile,
  chunkOfTile,
  tileToChunkCell,
  tileToWorld,
  visibleChunks,
  worldToTile,
} from './projection';

describe('top-down projection', () => {
  // OpenTTD's +x runs south-west and +y south-east; rotating the iso view by 45° puts
  // +x down and +y right, keeping (0,0) — the north corner — at the top-left.
  it('maps tile y to columns and tile x to rows', () => {
    expect(tileToWorld(3, 5)).toEqual({ px: 320, py: 192 });
    expect(worldToTile(320 + 10, 192 + 63)).toEqual({ x: 3, y: 5 });
  });

  it('groups tiles in 32×32 chunks', () => {
    expect(chunkOfTile(40, 70)).toEqual({ col: 2, row: 1 });
  });

  it('lists the visible chunks with one chunk of margin on every side', () => {
    const middle = visibleChunks({ x: 4096, y: 4096, width: 2048, height: 2048 }, 256, 256);
    expect(middle).toHaveLength(9);
    expect(middle).toContainEqual({ col: 1, row: 1 });
    expect(middle).toContainEqual({ col: 3, row: 3 });
  });

  it('clamps the margin to the map', () => {
    const corner = visibleChunks({ x: 0, y: 0, width: 2048, height: 2048 }, 256, 256);
    expect(corner).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ]);
  });

  it('maps chunk cells to tiles and back', () => {
    expect(chunkCellToTile(2, 1, 5, 7)).toEqual({ x: 39, y: 69 });
    expect(tileToChunkCell(39, 69)).toEqual({ col: 2, row: 1, cx: 5, cy: 7 });
    for (const [x, y] of [
      [0, 0],
      [63, 255],
      [33, 100],
      [31, 32],
      [17, 200],
    ] as const) {
      const { col, row, cx, cy } = tileToChunkCell(x, y);
      expect(chunkCellToTile(col, row, cx, cy)).toEqual({ x, y });
    }
  });

  it('places a chunk cell at the tile world position', () => {
    for (const [x, y] of [
      [3, 5],
      [40, 70],
      [63, 255],
    ] as const) {
      const { col, row, cx, cy } = tileToChunkCell(x, y);
      const px = (col * CHUNK_TILES + cx) * TILE_PX;
      const py = (row * CHUNK_TILES + cy) * TILE_PX;
      expect({ px, py }).toEqual(tileToWorld(x, y));
    }
  });
});
