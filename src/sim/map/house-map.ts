import { resetTileKeepingHeight, setTileType, TileType, type MapState } from './map';

/** Port of town_map.h:TOWN_HOUSE_COMPLETED. */
export const TOWN_HOUSE_COMPLETED = 3;

/** Port of town_map.h:MakeHouseTile (15.3 layout; protection, triggers, animation unused). */
export function makeHouseTile(
  map: MapState,
  t: number,
  townIndex: number,
  counter: number,
  stage: number,
  type: number,
  randomBits: number,
): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.House);
  map.m1[t] = randomBits & 0xff;
  map.m2[t] = townIndex;
  map.m3[t] = stage === TOWN_HOUSE_COMPLETED ? 0x80 : 0;
  map.m5[t] = stage === TOWN_HOUSE_COMPLETED ? 0 : (stage << 3) | counter;
  map.m8[t] = type & 0xfff;
}

/** Port of town_map.h:GetHouseType (GetCleanHouseType, no NewGRF). */
export const getHouseType = (map: MapState, t: number): number => map.m8[t]! & 0xfff;

/** Port of town_map.h:IsHouseCompleted. */
export const isHouseCompleted = (map: MapState, t: number): boolean => (map.m3[t]! & 0x80) !== 0;

/** Port of town_map.h:GetHouseBuildingStage. */
export const getHouseBuildingStage = (map: MapState, t: number): number =>
  isHouseCompleted(map, t) ? TOWN_HOUSE_COMPLETED : (map.m5[t]! >>> 3) & 3;

/** Port of town_map.h:GetHouseConstructionTick. */
export const getHouseConstructionTick = (map: MapState, t: number): number =>
  isHouseCompleted(map, t) ? 0 : map.m5[t]! & 7;

/** Port of town_map.h:IncHouseConstructionTick. */
export function incHouseConstructionTick(map: MapState, t: number): void {
  const m5 = map.m5[t]!;
  map.m5[t] = (m5 & 0xe0) | ((m5 + 1) & 0x1f);
  if (((map.m5[t]! >>> 3) & 3) === TOWN_HOUSE_COMPLETED) map.m3[t] = map.m3[t]! | 0x80;
}

/** Port of town_map.h:ResetHouseAge. */
export function resetHouseAge(map: MapState, t: number): void {
  map.m5[t] = 0;
}
