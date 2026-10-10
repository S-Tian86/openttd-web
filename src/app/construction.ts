import { TILE_UNITS, type OttdPoint } from '../render/projection';
import type { Command } from '../sim/command/command';
import type { DiagDir } from '../sim/map/geometry';
import { tileX, tileXY, tileY, type MapState } from '../sim/map/map';
import { orthogonalTiles, tileIterator } from '../sim/map/tile-area';
import { STATION_SPREAD } from '../sim/station/station';
import { railDragPieces } from '../sim/track/rail-cmd';
import { Axis, type Track } from '../sim/track/track';
import { calcRaildirsDrawstyle, limitedAreaEnd, REMOVE_STATION_SIZE_LIMIT } from './autorail';

export type BuildTool = 'rail' | 'station' | 'depot' | 'demolish';

export interface BuildOptions {
  remove: boolean;
  stationAxis: Axis;
  depotDir: DiagDir;
}

export type BuildHeader =
  | 'header.cantBuildRail'
  | 'header.cantRemoveRail'
  | 'header.cantBuildStation'
  | 'header.cantRemoveStationPart'
  | 'header.cantBuildDepot'
  | 'header.cantClearArea';

/** The command one gesture posts, its error header, and the ghost to draw (rails or tiles). */
export interface PlannedBuild {
  command: Command;
  header: BuildHeader;
  rails: readonly { tile: number; track: Track }[];
  tiles: readonly number[];
}

const insideMap = (map: MapState, p: OttdPoint): boolean =>
  p.x >= 0 && p.y >= 0 && p.x < map.sizeX * TILE_UNITS && p.y < map.sizeY * TILE_UNITS;

/** viewport.cpp:TileVirtXY. */
const ottdTile = (map: MapState, p: OttdPoint): number => tileXY(map, p.x >> 4, p.y >> 4);

/**
 * Plans the command of one press/release gesture of a build tool, as OpenTTD's GUI does on
 * mouse-up. Null when either point is outside the map (OpenTTD ignores such a release).
 */
export function planBuild(
  map: MapState,
  tool: BuildTool,
  options: BuildOptions,
  press: OttdPoint,
  current: OttdPoint,
  ctrl: boolean,
): PlannedBuild | null {
  if (!insideMap(map, press) || !insideMap(map, current)) return null;
  const startTile = ottdTile(map, press);
  switch (tool) {
    case 'rail': {
      // rail_gui.cpp:HandleAutodirPlacement
      const s = calcRaildirsDrawstyle(press, current);
      const endTile = ottdTile(map, s.end);
      const header = options.remove ? 'header.cantRemoveRail' : 'header.cantBuildRail';
      if (!s.line) {
        // GenericPlaceRail: CMD_BUILD_SINGLE_RAIL / CMD_REMOVE_SINGLE_RAIL
        return {
          command: {
            type: options.remove ? 'removeRail' : 'buildRail',
            tile: endTile,
            track: s.track,
          },
          header,
          rails: [{ tile: endTile, track: s.track }],
          tiles: [],
        };
      }
      // DoRailroadTrack: CMD_BUILD_RAILROAD_TRACK / CMD_REMOVE_RAILROAD_TRACK(end, start)
      return {
        command: {
          type: options.remove ? 'removeRailroadTrack' : 'buildRailroadTrack',
          endTile,
          startTile,
          track: s.track,
        },
        header,
        rails: railDragPieces(map, startTile, endTile, s.track) ?? [],
        tiles: [],
      };
    }
    case 'station': {
      // rail_gui.cpp:PlaceRail_Station drags with VPM_X_AND_Y_LIMITED
      const end = limitedAreaEnd(
        press,
        current,
        options.remove ? REMOVE_STATION_SIZE_LIMIT : STATION_SPREAD,
      );
      const endTile = ottdTile(map, end);
      const tiles = orthogonalTiles(map, startTile, endTile);
      if (options.remove) {
        return {
          command: { type: 'removeFromRailStation', start: startTile, end: endTile },
          header: 'header.cantRemoveStationPart',
          rails: [],
          tiles,
        };
      }
      // HandleStationPlacement: numtracks = ta.w, platlength = ta.h, swapped for AXIS_X
      const w = Math.abs(tileX(map, endTile) - tileX(map, startTile)) + 1;
      const h = Math.abs(tileY(map, endTile) - tileY(map, startTile)) + 1;
      const [numTracks, platLength] = options.stationAxis === Axis.X ? [h, w] : [w, h];
      return {
        command: {
          type: 'buildRailStation',
          tile: tiles[0]!,
          axis: options.stationAxis,
          numTracks,
          platLength,
        },
        header: 'header.cantBuildStation',
        rails: [],
        tiles,
      };
    }
    case 'depot': {
      // rail_gui.cpp:BuildRailToolbarWindow::OnPlaceObject, on the tile under the pointer
      const tile = ottdTile(map, current);
      return {
        command: { type: 'buildTrainDepot', tile, dir: options.depotDir },
        header: 'header.cantBuildDepot',
        rails: [],
        tiles: [tile],
      };
    }
    case 'demolish': {
      // terraform_gui.cpp:GUIPlaceProcDragXY: CMD_CLEAR_AREA(end, start, Ctrl)
      const endTile = ottdTile(map, current);
      return {
        command: { type: 'clearArea', endTile, startTile, diagonal: ctrl },
        header: 'header.cantClearArea',
        rails: [],
        tiles: tileIterator(map, endTile, startTile, ctrl),
      };
    }
  }
}
