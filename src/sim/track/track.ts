import type { DiagDir } from '../map/geometry';

/** Port of track_type.h:Track. */
export const Track = { X: 0, Y: 1, Upper: 2, Lower: 3, Left: 4, Right: 5 } as const;
export type Track = (typeof Track)[keyof typeof Track];

/** Port of track_type.h:TrackBits (the combinations the port uses). */
export const TrackBits = {
  None: 0,
  X: 1,
  Y: 2,
  Upper: 4,
  Lower: 8,
  Left: 16,
  Right: 32,
  Cross: 3,
  Horz: 12,
  Vert: 48,
  All: 63,
} as const;

/** Port of direction_type.h:Axis. */
export const Axis = { X: 0, Y: 1 } as const;
export type Axis = (typeof Axis)[keyof typeof Axis];

/** Port of track_func.h:TrackToTrackBits. */
export const trackToTrackBits = (t: Track): number => 1 << t;

/** Number of set bits (OpenTTD's CountBits). */
export function countBits(bits: number): number {
  let n = 0;
  for (let b = bits; b !== 0; b >>>= 1) n += b & 1;
  return n;
}

/** Port of track_func.h:TracksOverlap. */
export const tracksOverlap = (bits: number): boolean =>
  countBits(bits) >= 2 && bits !== TrackBits.Horz && bits !== TrackBits.Vert;

/** Port of track_func.h:IsDiagonalTrack. */
export const isDiagonalTrack = (t: Track): boolean => t === Track.X || t === Track.Y;

/** Port of track_func.h:DiagDirToDiagTrack (NE, SW -> X; SE, NW -> Y). */
export const diagDirToDiagTrack = (d: DiagDir): Track => (d & 1) as Track;

/** Port of track_func.h:AxisToTrack. */
export const axisToTrack = (a: Axis): Track => a as Track;

/** Port of table/track_data.h:_exitdir_reaches_tracks, by DiagDir. */
export const DIAGDIR_REACHES_TRACKS: readonly number[] = [0x19, 0x16, 0x25, 0x2a];

/** TRACK_BIT_3WAY_NE/SE/SW/NW: the track bits that touch each edge, by DiagDir. */
export const TRACK_BITS_AT_EDGE: readonly number[] = [0x25, 0x2a, 0x19, 0x16];

/** Port of table/track_data.h:_trackdelta: the tile step after a piece, by Trackdir (0..15). */
export const TRACKDELTA: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, 1],
  [0, 0],
  [0, 0],
  [1, 0],
  [0, -1],
  [0, -1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 0],
  [0, 0],
];
