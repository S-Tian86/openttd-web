import { resetTileKeepingHeight, setTileType, TileType, type MapState } from './map';
import { WaterClass } from './water';

/** Port of industry_map.h:INDUSTRY_COMPLETED. */
export const INDUSTRY_COMPLETED = 3;

/** Port of industry_map.h:MakeIndustry (land: water class Invalid; protection/triggers unused). */
export function makeIndustry(
  map: MapState,
  t: number,
  index: number,
  gfx: number,
  randomBits: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Industry);
  map.m1[t] = WaterClass.Invalid << 5;
  map.m2[t] = index;
  map.m3[t] = randomBits & 0xff;
  map.m4[t] = 0;
  map.m5[t] = gfx & 0xff;
  map.m6[t] = ((gfx >> 8) & 1) << 2;
  map.m7[t] = 0;
  map.m8[t] = 0;
}

/** Port of industry_map.h:GetIndustryIndex. */
export const getIndustryIndex = (map: MapState, t: number): number => map.m2[t]!;

/** Port of industry_map.h:GetCleanIndustryGfx (no NewGRF translation). */
export const getIndustryGfx = (map: MapState, t: number): number =>
  map.m5[t]! | (((map.m6[t]! >>> 2) & 1) << 8);

/** Port of industry_map.h:IsIndustryCompleted. */
export const isIndustryCompleted = (map: MapState, t: number): boolean => (map.m1[t]! & 0x80) !== 0;

/** Port of industry_map.h:SetIndustryCompleted. */
export function setIndustryCompleted(map: MapState, t: number): void {
  map.m1[t] = map.m1[t]! | 0x80;
}

/** Port of industry_map.h:GetIndustryConstructionStage. */
export const getIndustryConstructionStage = (map: MapState, t: number): number =>
  isIndustryCompleted(map, t) ? INDUSTRY_COMPLETED : map.m1[t]! & 3;

/** Port of industry_map.h:SetIndustryConstructionStage. */
export function setIndustryConstructionStage(map: MapState, t: number, stage: number): void {
  map.m1[t] = (map.m1[t]! & ~3) | (stage & 3);
}

/** Port of industry_map.h:GetIndustryConstructionCounter. */
export const getIndustryConstructionCounter = (map: MapState, t: number): number =>
  (map.m1[t]! >>> 2) & 3;

/** Port of industry_map.h:SetIndustryConstructionCounter. */
export function setIndustryConstructionCounter(map: MapState, t: number, counter: number): void {
  map.m1[t] = (map.m1[t]! & ~0x0c) | ((counter & 3) << 2);
}
