import {
  getTileType,
  OWNER_NONE,
  resetTileKeepingHeight,
  setTileType,
  TileType,
  type MapState,
} from './map';

/** Port of clear_map.h:ClearGround. */
export const ClearGround = { Grass: 0, Rough: 1, Rocks: 2, Fields: 3, Desert: 5 } as const;
export type ClearGround = (typeof ClearGround)[keyof typeof ClearGround];

/** Port of clear_map.h:MakeClear. m5 = ground << 2 | density; counter in bits 7..5. */
export function makeClear(map: MapState, t: number, ground: ClearGround, density: number): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Clear);
  map.m1[t] = OWNER_NONE;
  map.m5[t] = (ground << 2) | density;
}

/** Port of clear_map.h:SetClearGroundDensity. Resets the growth counter. */
export function setClearGroundDensity(
  map: MapState,
  t: number,
  ground: ClearGround,
  density: number,
): void {
  setTileType(map, t, TileType.Clear);
  map.m5[t] = (ground << 2) | density;
}

export const getClearGround = (map: MapState, t: number): ClearGround =>
  ((map.m5[t]! >>> 2) & 0x7) as ClearGround;
export const getClearDensity = (map: MapState, t: number): number => map.m5[t]! & 0x3;
const getClearCounter = (map: MapState, t: number): number => (map.m5[t]! >>> 5) & 0x7;
const setClearCounter = (map: MapState, t: number, c: number): void => {
  map.m5[t] = (map.m5[t]! & 0x1f) | (c << 5);
};

/** Grass growth only (temperate, Stage 1). Port of clear_cmd.cpp:TileLoop_Clear. */
export function tileLoopClear(map: MapState, t: number, markDirty: (t: number) => void): void {
  if (getTileType(map, t) !== TileType.Clear) return;
  if (getClearGround(map, t) !== ClearGround.Grass) return;
  const density = getClearDensity(map, t);
  if (density === 3) return;
  const counter = getClearCounter(map, t);
  if (counter < 7) {
    setClearCounter(map, t, counter + 1);
    return;
  }
  setClearCounter(map, t, 0);
  map.m5[t] = (map.m5[t]! & ~0x3) | (density + 1);
  markDirty(t);
}
