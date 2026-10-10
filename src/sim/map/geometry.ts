import { getTileType, TileType, tileX, tileXY, tileY, type MapState } from './map';

/** Port of direction_type.h:DiagDirection. */
export const DiagDir = { NE: 0, SE: 1, SW: 2, NW: 3 } as const;
export type DiagDir = (typeof DiagDir)[keyof typeof DiagDir];

/** Port of direction_type.h:Direction. */
export const Dir = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

/** (dx, dy) per DiagDirection. Port of map.cpp:_tileoffs_by_diagdir. */
export const DIAGDIR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];
/** (dx, dy) per Direction. Port of map.cpp:_tileoffs_by_dir. */
export const DIR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
];

/** OpenTTD's INVALID_TILE (0xFFFFFFFF). */
export const INVALID_TILE = -1;

export const reverseDiagDir = (d: DiagDir): DiagDir => (d ^ 2) as DiagDir;
/** Port of direction_func.h:ChangeDiagDir(d, DIAGDIRDIFF_90RIGHT). */
export const diagDirRight = (d: DiagDir): DiagDir => ((d + 1) & 3) as DiagDir;
/** Port of direction_func.h:ChangeDiagDir(d, DIAGDIRDIFF_90LEFT). */
export const diagDirLeft = (d: DiagDir): DiagDir => ((d + 3) & 3) as DiagDir;
export const reverseDir = (d: Dir): Dir => (d ^ 4) as Dir;

/** Port of map_func.h:TileDiffXY. */
export const tileDiffXY = (map: MapState, dx: number, dy: number): number => dy * map.sizeX + dx;

export function tileOffsByDiagDir(map: MapState, d: DiagDir): number {
  const [dx, dy] = DIAGDIR_OFFSETS[d]!;
  return tileDiffXY(map, dx, dy);
}

export function tileOffsByDir(map: MapState, d: Dir): number {
  const [dx, dy] = DIR_OFFSETS[d]!;
  return tileDiffXY(map, dx, dy);
}

/** Port of map_func.h:TileAddXY (no wrap check, like the C++ release build). */
export const tileAddXY = (map: MapState, t: number, dx: number, dy: number): number =>
  t + tileDiffXY(map, dx, dy);

/** Port of map.cpp:TileAddWrap with freeform edges (row 0 and column 0 are refused). */
export function tileAddWrap(map: MapState, t: number, dx: number, dy: number): number {
  const x = tileX(map, t) + dx;
  const y = tileY(map, t) + dy;
  // C++ uses uint: a negative x or y wraps to a huge value and fails the MaxX/MaxY test.
  if (x <= 0 || y <= 0) return INVALID_TILE;
  if (x >= map.sizeX - 1 || y >= map.sizeY - 1) return INVALID_TILE;
  return tileXY(map, x, y);
}

/** Port of map_func.h:AddTileIndexDiffCWrap. */
export function addTileIndexDiffCWrap(map: MapState, t: number, dx: number, dy: number): number {
  const x = tileX(map, t) + dx;
  const y = tileY(map, t) + dy;
  if (x < 0 || y < 0 || x >= map.sizeX || y >= map.sizeY) return INVALID_TILE;
  return tileXY(map, x, y);
}

/** Port of map_func.h:IsValidTile. */
export const isValidTile = (map: MapState, t: number): boolean =>
  t >= 0 && t < map.size && getTileType(map, t) !== TileType.Void;

const absDx = (map: MapState, a: number, b: number): number =>
  Math.abs(tileX(map, a) - tileX(map, b));
const absDy = (map: MapState, a: number, b: number): number =>
  Math.abs(tileY(map, a) - tileY(map, b));

/** Port of map.cpp:DistanceManhattan. */
export const distanceManhattan = (map: MapState, a: number, b: number): number =>
  absDx(map, a, b) + absDy(map, a, b);
/** Port of map.cpp:DistanceSquare. */
export const distanceSquare = (map: MapState, a: number, b: number): number =>
  absDx(map, a, b) ** 2 + absDy(map, a, b) ** 2;
/** Port of map.cpp:DistanceMax. */
export const distanceMax = (map: MapState, a: number, b: number): number =>
  Math.max(absDx(map, a, b), absDy(map, a, b));

/** Port of map.cpp:DistanceFromEdge. */
export function distanceFromEdge(map: MapState, t: number): number {
  const x = tileX(map, t);
  const y = tileY(map, t);
  return Math.min(x, y, map.sizeX - 1 - x, map.sizeY - 1 - y);
}

/** n defined for 256×256, scaled by area and rounded up. Port of map_func.h:Map::ScaleBySize. */
export const scaleBySize = (map: MapState, n: number): number =>
  Math.floor((n * 2 ** (map.logX + map.logY - 12) + 15) / 16);

/** n defined for 256×256, scaled by half the circumference. Port of map_func.h:Map::ScaleBySize1D. */
export const scaleBySize1D = (map: MapState, n: number): number =>
  Math.floor((n * 2 ** map.logX + n * 2 ** map.logY + 511) / 512);

/** Port of map_func.h:Map::ScaleByLandProportion (64-bit product, truncating). */
export const scaleByLandProportion = (
  n: number,
  initialLandCount: number,
  mapSize: number,
): number => Math.floor((n * initialLandCount) / mapSize);

/** Port of map_func.h:RandomTileSeed (`r` is a uint32 draw). */
export const randomTile = (map: MapState, r: number): number => r & (map.size - 1);

/**
 * Tiles of a square spiral, skipping tiles outside the map. Port of
 * tilearea.cpp:SpiralTileIterator (the `center, diameter` constructor).
 */
export function spiralTiles(map: MapState, centre: number, diameter: number): number[] {
  const tiles: number[] = [];
  const maxRadius = Math.floor(diameter / 2);
  const extent = diameter % 2 === 1 ? 1 : 0;
  let x = tileX(map, centre);
  let y = tileY(map, centre);
  const inside = (): boolean => x >= 0 && y >= 0 && x < map.sizeX && y < map.sizeY;
  if (diameter % 2 === 1) {
    if (inside()) tiles.push(tileXY(map, x, y));
    x += 1; // DIR_W offset (1, -1): west corner of the first ring
    y -= 1;
  } else {
    x += 1; // west corner of the centre 2×2 block
  }
  let radius = 0;
  let dir = 0;
  let position = extent + 1;
  while (radius < maxRadius) {
    if (inside()) tiles.push(tileXY(map, x, y));
    const [ox, oy] = DIAGDIR_OFFSETS[dir]!;
    x += ox;
    y += oy;
    if (--position > 0) continue;
    if (++dir === 4) {
      x += 1;
      y -= 1;
      radius++;
      dir = 0;
    }
    position = extent + radius * 2 + 1;
  }
  return tiles;
}
