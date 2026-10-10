import { getClearDensity, getClearGround, ClearGround } from '../sim/map/clear';
import { getTileType, TileType, type MapState } from '../sim/map/map';
import type { SpriteId } from './theme';

export function groundSprite(map: MapState, t: number): SpriteId {
  switch (getTileType(map, t)) {
    case TileType.Void:
      return 'terrain.void';
    case TileType.Clear:
      if (getClearGround(map, t) === ClearGround.Grass) {
        return `terrain.grass.${getClearDensity(map, t)}` as SpriteId;
      }
      return 'terrain.unknown';
    default:
      return 'terrain.unknown';
  }
}
