import { tileX, tileXY, tileY, type MapState } from './map';

/** Port of slope_type.h:Slope (corner bits; Steep marks a corner two levels up). */
export const Slope = { Flat: 0, W: 1, S: 2, E: 4, N: 8, Steep: 16 } as const;

/** Port of tile_map.cpp:GetTileSlopeZ (N = this tile, W = x+1, E = y+1, S = both; clamped). */
export function getTileSlopeZ(map: MapState, t: number): { slope: number; z: number } {
  const x1 = tileX(map, t);
  const y1 = tileY(map, t);
  const x2 = Math.min(x1 + 1, map.sizeX - 1);
  const y2 = Math.min(y1 + 1, map.sizeY - 1);
  const n = map.height[t]!;
  const w = map.height[tileXY(map, x2, y1)]!;
  const e = map.height[tileXY(map, x1, y2)]!;
  const s = map.height[tileXY(map, x2, y2)]!;
  const min = Math.min(n, w, e, s);
  let slope: number = Slope.Flat;
  if (n !== min) slope |= Slope.N;
  if (w !== min) slope |= Slope.W;
  if (e !== min) slope |= Slope.E;
  if (s !== min) slope |= Slope.S;
  if (Math.max(n, w, e, s) - min === 2) slope |= Slope.Steep;
  return { slope, z: min };
}

export const getTileSlope = (map: MapState, t: number): number => getTileSlopeZ(map, t).slope;
/** Port of tile_map.h:GetTileZ (lowest corner). */
export const getTileZ = (map: MapState, t: number): number => getTileSlopeZ(map, t).z;
export const isTileFlat = (map: MapState, t: number): boolean =>
  getTileSlope(map, t) === Slope.Flat;

/** Port of tile_map.cpp:GetTileMaxZ (highest corner). */
export function getTileMaxZ(map: MapState, t: number): number {
  const x1 = tileX(map, t);
  const y1 = tileY(map, t);
  const x2 = Math.min(x1 + 1, map.sizeX - 1);
  const y2 = Math.min(y1 + 1, map.sizeY - 1);
  return Math.max(
    map.height[t]!,
    map.height[tileXY(map, x2, y1)]!,
    map.height[tileXY(map, x1, y2)]!,
    map.height[tileXY(map, x2, y2)]!,
  );
}

/** Port of slope_func.h:IsSlopeWithOneCornerRaised. */
export const isSlopeWithOneCornerRaised = (slope: number): boolean =>
  slope === Slope.W || slope === Slope.S || slope === Slope.E || slope === Slope.N;
