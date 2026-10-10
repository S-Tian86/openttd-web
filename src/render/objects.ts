import { getHouseBuildingStage, getHouseType, isHouseCompleted } from '../sim/map/house-map';
import { getIndustryGfx } from '../sim/map/industry-map';
import { getTileType, tileXY, TileType, type MapState } from '../sim/map/map';
import { getTreeCount, getTreeGrowth } from '../sim/map/tree-map';
import { CHUNK_TILES, TILE_PX } from './projection';
import type { SpriteId } from './theme';

export interface ObjectSprite {
  sprite: SpriteId;
  /** Offset of the sprite's bottom centre from the tile's bottom centre, in pixels. */
  dx: number;
  dy: number;
}

/** Tree positions inside a tile, by tree count - 1. */
export const TREE_OFFSETS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [
    [-12, -8],
    [12, 8],
  ],
  [
    [-14, -10],
    [14, -6],
    [0, 12],
  ],
  [
    [-14, -12],
    [14, -12],
    [-14, 12],
    [14, 12],
  ],
];

const TREE_BY_GROWTH: readonly SpriteId[] = [
  'tree.small',
  'tree.small',
  'tree.medium',
  'tree.large',
  'tree.dying',
  'tree.dying',
  'tree.dead',
];

const HOUSE_SPRITES = new Map<number, SpriteId>([
  [0x03, 'house.church'],
  [0x06, 'house.town-houses'],
  [0x09, 'house.statue'],
  [0x0a, 'house.fountain'],
  [0x0b, 'house.park'],
  [0x0c, 'house.park'],
  [0x0e, 'house.shops-offices'],
  [0x0f, 'house.shops-offices'],
  [0x10, 'house.shops-offices'],
  [0x1d, 'house.shops-offices'],
  [0x14, 'house.stadium.0'],
  [0x15, 'house.stadium.1'],
  [0x16, 'house.stadium.2'],
  [0x17, 'house.stadium.3'],
  [0x18, 'house.old-houses'],
  [0x19, 'house.cottages'],
  [0x1a, 'house.houses'],
  [0x1b, 'house.flats'],
  [0x1f, 'house.theatre'],
  [0x27, 'house.cinema'],
]);

export const houseSprite = (houseId: number): SpriteId =>
  HOUSE_SPRITES.get(houseId) ?? 'object.unknown';

/** The tall sprites standing on tile `t`, sorted by `dy` (back to front). */
export function objectSprites(map: MapState, t: number): ObjectSprite[] {
  switch (getTileType(map, t)) {
    case TileType.Trees: {
      const sprite = TREE_BY_GROWTH[getTreeGrowth(map, t)] ?? 'tree.small';
      const offsets = TREE_OFFSETS[getTreeCount(map, t) - 1] ?? TREE_OFFSETS[0]!;
      return offsets.map(([dx, dy]) => ({ sprite, dx, dy })).toSorted((a, b) => a.dy - b.dy);
    }
    case TileType.House: {
      const sprite = isHouseCompleted(map, t)
        ? houseSprite(getHouseType(map, t))
        : (`house.construction.${Math.min(getHouseBuildingStage(map, t), 2)}` as SpriteId);
      return [{ sprite, dx: 0, dy: 0 }];
    }
    case TileType.Industry:
      return [{ sprite: `industry.gfx.${getIndustryGfx(map, t)}` as SpriteId, dx: 0, dy: 0 }];
    default:
      return [];
  }
}

export interface PlacedObject {
  sprite: SpriteId;
  /** Horizontal centre, in chunk pixels. */
  px: number;
  /** Bottom edge, in chunk pixels. */
  py: number;
}

/** The objects of a chunk in draw order: top tile row first, left to right. */
export function chunkObjects(map: MapState, col: number, row: number): PlacedObject[] {
  const placed: PlacedObject[] = [];
  for (let cy = 0; cy < CHUNK_TILES; cy++) {
    for (let cx = 0; cx < CHUNK_TILES; cx++) {
      const t = tileXY(map, row * CHUNK_TILES + cy, col * CHUNK_TILES + cx);
      for (const { sprite, dx, dy } of objectSprites(map, t)) {
        placed.push({
          sprite,
          px: cx * TILE_PX + TILE_PX / 2 + dx,
          py: cy * TILE_PX + TILE_PX + dy,
        });
      }
    }
  }
  return placed;
}
