import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { tileX, tileXY, tileY } from './map';
import { diagonalTiles, orthogonalTiles } from './tile-area';

const map = createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map;
const xy = (tiles: number[]): [number, number][] =>
  tiles.map((t) => [tileX(map, t), tileY(map, t)]);

describe('tile iterators (port of tilearea.cpp)', () => {
  it('walks a rectangle X first, whatever corners it is given', () => {
    expect(xy(orthogonalTiles(map, tileXY(map, 12, 10), tileXY(map, 10, 11)))).toEqual([
      [10, 10],
      [11, 10],
      [12, 10],
      [10, 11],
      [11, 11],
      [12, 11],
    ]);
  });

  it('walks a diagonal (Ctrl) area in rotated coordinates', () => {
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 10, 12)))).toEqual([
      [10, 10],
      [11, 11],
      [10, 11],
      [9, 11],
      [10, 12],
    ]);
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 12, 12)))).toEqual([
      [10, 10],
      [11, 11],
      [12, 12],
    ]);
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 12, 10)))).toEqual([
      [10, 10],
      [11, 11],
      [11, 10],
      [11, 9],
      [12, 10],
    ]);
  });
});
