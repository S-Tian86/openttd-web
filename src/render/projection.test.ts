import { describe, expect, it } from 'vitest';
import { chunkOfTile, tileToWorld, visibleChunks, worldToTile } from './projection';

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
});
