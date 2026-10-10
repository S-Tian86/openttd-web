import { ClearGround, getClearDensity, getClearGround } from '../sim/map/clear';
import { getRailGroundType, RailGroundType } from '../sim/map/rail-map';
import { getCrossingRoadAxis, getRoadBits, isLevelCrossingTile } from '../sim/map/road-map';
import { getTileSlope } from '../sim/map/slope';
import { getRailStationAxis, isRailStationTile } from '../sim/map/station-map';
import { getTileType, TileType, type MapState } from '../sim/map/map';
import { getTreeDensity, getTreeGround, TreeGround } from '../sim/map/tree-map';
import { getWaterTileType, WaterTileType } from '../sim/map/water';
import { Axis } from '../sim/track/track';
import { GROUND_SPRITE_IDS, type SpriteId } from './theme';

const GROUND_ID_SET: ReadonlySet<string> = new Set(GROUND_SPRITE_IDS);

function coastSprite(map: MapState, t: number): SpriteId {
  const id = `water.coast.${getTileSlope(map, t)}`;
  return GROUND_ID_SET.has(id) ? (id as SpriteId) : 'terrain.unknown';
}

/** The ground sprite under whatever stands on tile `t`. */
export function groundSprite(map: MapState, t: number): SpriteId {
  switch (getTileType(map, t)) {
    case TileType.Void:
      return 'terrain.void';
    case TileType.Clear:
      switch (getClearGround(map, t)) {
        case ClearGround.Grass:
          return `terrain.grass.${getClearDensity(map, t)}` as SpriteId;
        case ClearGround.Rough:
          return 'terrain.rough';
        case ClearGround.Rocks:
          return 'terrain.rocks';
        default:
          return 'terrain.unknown';
      }
    case TileType.Water:
      return getWaterTileType(map, t) === WaterTileType.Coast ? coastSprite(map, t) : 'water.sea';
    case TileType.Trees:
      switch (getTreeGround(map, t)) {
        case TreeGround.Grass:
          return `terrain.grass.${getTreeDensity(map, t)}` as SpriteId;
        case TreeGround.Rough:
          return 'terrain.rough';
        case TreeGround.Shore:
          return coastSprite(map, t);
        default:
          return 'terrain.unknown';
      }
    case TileType.Railway:
      // Fences are not drawn (R32): every grass ground is plain grass.
      return getRailGroundType(map, t) === RailGroundType.Barren
        ? 'terrain.grass.0'
        : 'terrain.grass.3';
    case TileType.Station:
      if (!isRailStationTile(map, t)) return 'terrain.unknown';
      return getRailStationAxis(map, t) === Axis.X ? 'station.platform.x' : 'station.platform.y';
    case TileType.Road: {
      if (isLevelCrossingTile(map, t)) {
        return getCrossingRoadAxis(map, t) === Axis.X ? 'crossing.x' : 'crossing.y';
      }
      const bits = getRoadBits(map, t);
      return bits >= 1 && bits <= 15 ? (`road.${bits}` as SpriteId) : 'terrain.unknown';
    }
    case TileType.House:
      return 'ground.house';
    case TileType.Industry:
      return 'ground.industry';
    default:
      return 'terrain.unknown';
  }
}
