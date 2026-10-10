import type { MapState } from '../map/map';
import { getStationIndex, isRailStationTile } from '../map/station-map';
import type { StationNameKind } from './station-name';

/** Port of station_type.h:StationFacility (the facilities that exist so far). */
export const StationFacility = { Train: 1 } as const;

/** Port of tilearea_type.h:OrthogonalTileArea. */
export interface TileArea {
  tile: number;
  w: number;
  h: number;
}

/** Port of base_station_base.h:BaseStation + station_base.h:Station (the fields Stage 1 uses). */
export interface Station {
  index: number;
  /** Sign tile: the first facility's tile (Station::AddFacility). */
  xy: number;
  townIndex: number;
  /** The generated name (string_id), relative to the town. */
  nameKind: StationNameKind;
  owner: number;
  /** Bounding box of the rail part; null is OpenTTD's INVALID_TILE area. */
  trainStation: TileArea | null;
  /** Bitset of StationFacility. */
  facilities: number;
  deleteCtr: number;
  buildDate: number;
  /** uint16, drawn when the first facility is added. */
  randomBits: number;
}

/** Port of settings: station.station_spread (default). */
export const STATION_SPREAD = 12;

/** Port of base_station_base.h:BaseStation::IsInUse. */
export const isInUse = (st: Station): boolean => (st.facilities & StationFacility.Train) !== 0;

/** Port of station_base.h:Station::TileBelongsToRailStation. */
export const tileBelongsToRailStation = (map: MapState, st: Station, t: number): boolean =>
  isRailStationTile(map, t) && getStationIndex(map, t) === st.index;
