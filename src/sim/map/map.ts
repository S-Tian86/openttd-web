/** Port of tile_type.h:TileType. */
export const TileType = {
  Clear: 0,
  Railway: 1,
  Road: 2,
  House: 3,
  Trees: 4,
  Station: 5,
  Water: 6,
  Void: 7,
  Industry: 8,
  TunnelBridge: 9,
  Object: 10,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Port of map_type.h. */
export const MIN_MAP_SIZE_BITS = 6;
export const MAX_MAP_SIZE_BITS = 12;

/** Owner values used on tiles (port of company_type.h). COMPANY_FIRST is the player's company. */
export const COMPANY_FIRST = 0x00;
export const OWNER_TOWN = 0x0f;
export const OWNER_NONE = 0x10;
export const OWNER_WATER = 0x11;

/** Tile storage as parallel typed arrays. Port of map_func.h:Tile (TileBase + TileExtended). */
export interface MapState {
  logX: number;
  logY: number;
  sizeX: number;
  sizeY: number;
  size: number;
  type: Uint8Array;
  height: Uint8Array;
  m1: Uint8Array;
  m2: Uint16Array;
  m3: Uint8Array;
  m4: Uint8Array;
  m5: Uint8Array;
  m6: Uint8Array;
  m7: Uint8Array;
  m8: Uint16Array;
  /** LFSR state of the tile loop; never 0. Port of landscape.cpp:_cur_tileloop_tile. */
  tileLoopTile: number;
}

/** Port of map.cpp:Map::Allocate. */
export function createMap(logX: number, logY: number): MapState {
  for (const bits of [logX, logY]) {
    if (!Number.isInteger(bits) || bits < MIN_MAP_SIZE_BITS || bits > MAX_MAP_SIZE_BITS) {
      throw new RangeError(`Map size bits must be ${MIN_MAP_SIZE_BITS}..${MAX_MAP_SIZE_BITS}`);
    }
  }
  const sizeX = 1 << logX;
  const sizeY = 1 << logY;
  const size = sizeX * sizeY;
  return {
    logX,
    logY,
    sizeX,
    sizeY,
    size,
    type: new Uint8Array(size),
    height: new Uint8Array(size),
    m1: new Uint8Array(size),
    m2: new Uint16Array(size),
    m3: new Uint8Array(size),
    m4: new Uint8Array(size),
    m5: new Uint8Array(size),
    m6: new Uint8Array(size),
    m7: new Uint8Array(size),
    m8: new Uint16Array(size),
    tileLoopTile: 1,
  };
}

/** Port of map_func.h:TileXY. */
export const tileXY = (map: MapState, x: number, y: number): number => (y << map.logX) + x;
/** Port of map_func.h:TileX. */
export const tileX = (map: MapState, t: number): number => t & (map.sizeX - 1);
/** Port of map_func.h:TileY. */
export const tileY = (map: MapState, t: number): number => t >>> map.logX;

/** Port of tile_map.h:GetTileType. */
export const getTileType = (map: MapState, t: number): TileType => (map.type[t]! >>> 4) as TileType;

/** Port of tile_map.h:SetTileType (keeps the low nibble). */
export function setTileType(map: MapState, t: number, type: TileType): void {
  map.type[t] = (map.type[t]! & 0x0f) | (type << 4);
}

/** Port of tile_map.h:IsInnerTile with freeform edges (the default). */
export function isInnerTile(map: MapState, t: number): boolean {
  const x = tileX(map, t);
  const y = tileY(map, t);
  return x < map.sizeX - 1 && y < map.sizeY - 1 && x > 0 && y > 0;
}

function clearTile(map: MapState, t: number): void {
  map.type[t] = 0;
  map.height[t] = 0;
  map.m1[t] = 0;
  map.m2[t] = 0;
  map.m3[t] = 0;
  map.m4[t] = 0;
  map.m5[t] = 0;
  map.m6[t] = 0;
  map.m7[t] = 0;
  map.m8[t] = 0;
}

/** Port of void_map.h:MakeVoid. */
export function makeVoid(map: MapState, t: number): void {
  clearTile(map, t);
  setTileType(map, t, TileType.Void);
}

/** Exposed for tile makers in other modules: reset every field but height. */
export function resetTileKeepingHeight(map: MapState, t: number): void {
  const h = map.height[t]!;
  clearTile(map, t);
  map.height[t] = h;
}

/** Port of tile_map.h:GetTileOwner (m1 bits 4..0). */
export const getTileOwner = (map: MapState, t: number): number => map.m1[t]! & 0x1f;

/** Port of tile_map.h:SetTileOwner: keeps m1 bits 7..5. */
export function setTileOwner(map: MapState, t: number, owner: number): void {
  map.m1[t] = (map.m1[t]! & 0xe0) | (owner & 0x1f);
}
