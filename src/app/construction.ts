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

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Port of landscape.cpp:InverseRemapCoords2 with clamp_to_map (as TranslateXYToTileCoord
 * calls it): a point past the edge moves to the nearest point at most MaxX/MaxY * 16 - 1.
 * Negative points clamp to 0 rather than OpenTTD's extra rows above the north edge.
 */
const clampToMap = (map: MapState, p: OttdPoint): OttdPoint => ({
  x: clamp(p.x, 0, (map.sizeX - 1) * TILE_UNITS - 1),
  y: clamp(p.y, 0, (map.sizeY - 1) * TILE_UNITS - 1),
});

/** viewport.cpp:TileVirtXY. */
const ottdTile = (map: MapState, p: OttdPoint): number => tileXY(map, p.x >> 4, p.y >> 4);

/**
 * Plans the command of one press/release gesture of a build tool, as OpenTTD's GUI does on
 * mouse-up. Points past the map edge are clamped into it, so a drag released beyond the
 * edge builds up to the edge.
 */
export function planBuild(
  map: MapState,
  tool: BuildTool,
  options: BuildOptions,
  pressPoint: OttdPoint,
  currentPoint: OttdPoint,
  ctrl: boolean,
): PlannedBuild {
  const press = clampToMap(map, pressPoint);
  const current = clampToMap(map, currentPoint);
  const startTile = ottdTile(map, press);
  switch (tool) {
    case 'rail': {
      // Port of rail_gui.cpp:HandleAutodirPlacement
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
      // Port of rail_gui.cpp:PlaceRail_Station (VPM_X_AND_Y_LIMITED drag)
      const end = limitedAreaEnd(
        press,
        current,
        options.remove ? REMOVE_STATION_SIZE_LIMIT : STATION_SPREAD,
      );
      const endTile = ottdTile(map, end);
      const tiles = orthogonalTiles(map, startTile, endTile);
      if (options.remove) {
        return {
          // Port of rail_gui.cpp:BuildRailToolbarWindow::OnPlaceMouseUp (l.768): (end, start)
          command: { type: 'removeFromRailStation', start: endTile, end: startTile },
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
      // Port of rail_gui.cpp:BuildRailToolbarWindow::OnPlaceObject (l.691-693). OpenTTD
      // builds on the press; we deliberately use the release tile so a finger can aim.
      const tile = ottdTile(map, current);
      return {
        command: { type: 'buildTrainDepot', tile, dir: options.depotDir },
        header: 'header.cantBuildDepot',
        rails: [],
        tiles: [tile],
      };
    }
    case 'demolish': {
      // Port of terraform_gui.cpp:GUIPlaceProcDragXY: CMD_CLEAR_AREA(end, start, Ctrl)
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
