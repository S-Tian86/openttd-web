import { describe, expect, it } from 'vitest';
import {
  addTileIndexDiffCWrap,
  DiagDir,
  Dir,
  distanceFromEdge,
  distanceManhattan,
  distanceMax,
  distanceSquare,
  INVALID_TILE,
  isValidTile,
  randomTile,
  reverseDiagDir,
  scaleByLandProportion,
  scaleBySize,
  scaleBySize1D,
  spiralTiles,
  tileAddWrap,
  tileOffsByDiagDir,
  tileOffsByDir,
} from './geometry';
import { createMap, makeVoid, tileX, tileXY, tileY, type MapState } from './map';

const coords = (map: MapState, tiles: number[]): [number, number][] =>
  tiles.map((t) => [tileX(map, t), tileY(map, t)]);

describe('tile offsets (port of map.cpp offset tables)', () => {
  it('follows OpenTTD directions on a 256×64 map', () => {
    const map = createMap(8, 6);
    const diag = [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const;
    expect(diag.map((d) => tileOffsByDiagDir(map, d))).toEqual([-1, 256, 1, -256]);
    const dirs = [Dir.N, Dir.E, Dir.S, Dir.W] as const;
    expect(dirs.map((d) => tileOffsByDir(map, d))).toEqual([-257, 255, 257, -255]);
    expect(reverseDiagDir(DiagDir.NE)).toBe(DiagDir.SW);
  });

  it('wraps like TileAddWrap with freeform edges', () => {
    const map = createMap(6, 6);
    expect(tileAddWrap(map, tileXY(map, 1, 1), -1, 0)).toBe(INVALID_TILE);
    expect(tileAddWrap(map, tileXY(map, 62, 5), 1, 0)).toBe(INVALID_TILE);
    expect(tileAddWrap(map, tileXY(map, 10, 10), 3, -2)).toBe(tileXY(map, 13, 8));
  });

  it('wraps like AddTileIndexDiffCWrap', () => {
    const map = createMap(6, 6);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 0, 5), -1, 0)).toBe(INVALID_TILE);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 63, 5), 1, 0)).toBe(INVALID_TILE);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 63, 5), 0, 1)).toBe(tileXY(map, 63, 6));
  });

  it('treats void and out-of-range tiles as invalid', () => {
    const map = createMap(6, 6);
    makeVoid(map, 0);
    const tiles = [0, tileXY(map, 5, 5), -1, map.size];
    expect(tiles.map((t) => isValidTile(map, t))).toEqual([false, true, false, false]);
  });
});

describe('distances (port of map.cpp)', () => {
  it('measures Manhattan, square, max and edge distance', () => {
    const map = createMap(6, 6);
    const a = tileXY(map, 10, 20);
    const b = tileXY(map, 13, 16);
    expect([
      distanceManhattan(map, a, b),
      distanceSquare(map, a, b),
      distanceMax(map, a, b),
    ]).toEqual([7, 25, 4]);
    expect(distanceFromEdge(map, tileXY(map, 10, 60))).toBe(3);
  });
});

describe('scaling by map size (port of map_func.h)', () => {
  it.each([
    [6, 6, 23, 2],
    [6, 6, 1, 1],
    [8, 8, 23, 23],
    [10, 10, 23, 368],
    [8, 6, 23, 6],
  ])('ScaleBySize on 2^%i×2^%i turns %i into %i', (logX, logY, n, expected) => {
    expect(scaleBySize(createMap(logX, logY), n)).toBe(expected);
  });

  it('scales by circumference and by the land proportion', () => {
    expect([6, 8, 10].map((log) => scaleBySize1D(createMap(log, log), 64))).toEqual([16, 64, 256]);
    expect(scaleByLandProportion(23, 3328, 4096)).toBe(18);
  });

  it('picks a random tile from the low bits (RandomTileSeed)', () => {
    const map = createMap(6, 6);
    expect([randomTile(map, 0xffffffff), randomTile(map, 536872454)]).toEqual([4095, 1542]);
  });
});

describe('SpiralTileSequence (port of tilearea.cpp:SpiralTileIterator)', () => {
  it('starts at the centre for odd diameters, then rings from the west corner', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, tileXY(map, 10, 10), 3))).toEqual([
      [10, 10],
      [11, 9],
      [10, 9],
      [9, 9],
      [9, 10],
      [9, 11],
      [10, 11],
      [11, 11],
      [11, 10],
    ]);
    expect(spiralTiles(map, tileXY(map, 10, 10), 5)).toHaveLength(25);
  });

  it('starts with the 2×2 block for even diameters', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, tileXY(map, 10, 10), 2))).toEqual([
      [11, 10],
      [10, 10],
      [10, 11],
      [11, 11],
    ]);
    expect(spiralTiles(map, tileXY(map, 10, 10), 4)).toHaveLength(16);
  });

  it('skips tiles outside the map', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, 0, 3))).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });
});
