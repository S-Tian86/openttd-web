import { TILE_UNITS, type OttdPoint } from '../render/projection';
import { Track } from '../sim/track/track';

const U = Track.Upper;
const D = Track.Lower;
const L = Track.Left;
const R = Track.Right;
const X = Track.X;
const Y = Track.Y;

const EDGE_ROW: readonly Track[] = [U, U, U, U, U, U, X, X, X, X, R, R, R, R, R, R];
const FAR_ROW: readonly Track[] = [L, L, L, L, L, L, X, X, X, X, D, D, D, D, D, D];

/**
 * Port of table/autorail.h:_autorail_piece: the piece under each sub-tile point, indexed
 * [x & 15][y & 15] (HT_DIR_HU = Upper, HT_DIR_HL = Lower, HT_DIR_VL = Left, HT_DIR_VR = Right).
 */
export const AUTORAIL_PIECE: readonly (readonly Track[])[] = [
  EDGE_ROW,
  EDGE_ROW,
  EDGE_ROW,
  EDGE_ROW,
  EDGE_ROW,
  EDGE_ROW,
  [Y, Y, Y, Y, Y, Y, X, X, X, Y, Y, Y, Y, Y, Y, Y],
  [Y, Y, Y, Y, Y, Y, Y, X, Y, Y, Y, Y, Y, Y, Y, Y],
  [Y, Y, Y, Y, Y, Y, Y, Y, X, Y, Y, Y, Y, Y, Y, Y],
  [Y, Y, Y, Y, Y, Y, Y, X, X, X, Y, Y, Y, Y, Y, Y],
  FAR_ROW,
  FAR_ROW,
  FAR_ROW,
  FAR_ROW,
  FAR_ROW,
  FAR_ROW,
];

const MASK = TILE_UNITS - 1;

/** Port of viewport.cpp:GetAutorailHT (the direction part). */
export const autorailPiece = (p: OttdPoint): Track => AUTORAIL_PIECE[p.x & MASK]![p.y & MASK]!;

/**
 * Port of viewport.cpp:Check2x1AutoRail: the piece of a two-tile drag, from the press
 * sub-tile point (_tile_fract_coords) and the release point (_thd.selend).
 */
export function check2x1AutoRail(mode: 0 | 1 | 2 | 3, press: OttdPoint, end: OttdPoint): Track {
  const fxpy = (press.x & MASK) + (press.y & MASK);
  const fxmy = (press.x & MASK) - (press.y & MASK);
  const sxpy = (end.x & MASK) + (end.y & MASK);
  const sxmy = (end.x & MASK) - (end.y & MASK);
  switch (mode) {
    case 0: // end piece is lower right
      return fxpy >= 20 && sxpy <= 12 ? Track.Lower : fxmy < -3 && sxmy > 3 ? Track.Right : Track.Y;
    case 1:
      return fxmy > 3 && sxmy < -3 ? Track.Left : fxpy <= 12 && sxpy >= 20 ? Track.Upper : Track.Y;
    case 2:
      return fxmy > 3 && sxmy < -3 ? Track.Left : fxpy >= 20 && sxpy <= 12 ? Track.Lower : Track.X;
    case 3:
      return fxmy < -3 && sxmy > 3 ? Track.Right : fxpy <= 12 && sxpy >= 20 ? Track.Upper : Track.X;
  }
}

/** A rail drag's highlight: `line: false` is HT_RAIL (one piece on the end tile), true HT_LINE. */
export interface RailDrawstyle {
  line: boolean;
  track: Track;
  end: OttdPoint;
}

/**
 * Port of viewport.cpp:CalcRaildirsDrawstyle for VPM_RAILDIRS (not the forced-direction
 * tools). `press` is the press point: its tile origin is _thd.selstart (VpStartPlaceSizing)
 * and its sub-tile part _tile_fract_coords (PlaceObject). `cursor` is _thd.selend.
 */
export function calcRaildirsDrawstyle(press: OttdPoint, cursor: OttdPoint): RailDrawstyle {
  const sx = press.x & ~MASK;
  const sy = press.y & ~MASK;
  let { x, y } = cursor;
  const dx = sx - (x & ~MASK);
  const dy = sy - (y & ~MASK);
  const w = Math.abs(dx) + TILE_UNITS;
  const h = Math.abs(dy) + TILE_UNITS;
  let track: Track;
  let line = true;
  if (sx >> 4 === x >> 4 && sy >> 4 === y >> 4) {
    line = false;
    track = autorailPiece(cursor); // the release point, not the press point
  } else if (h === TILE_UNITS) {
    track =
      dx === TILE_UNITS
        ? check2x1AutoRail(3, press, cursor)
        : dx === -TILE_UNITS
          ? check2x1AutoRail(2, press, cursor)
          : Track.X;
    y = sy;
  } else if (w === TILE_UNITS) {
    track =
      dy === TILE_UNITS
        ? check2x1AutoRail(1, press, cursor)
        : dy === -TILE_UNITS
          ? check2x1AutoRail(0, press, cursor)
          : Track.Y;
    x = sx;
  } else if (w > h * 2) {
    track = Track.X;
    y = sy;
  } else if (h > w * 2) {
    track = Track.Y;
    x = sx;
  } else {
    // complicated direction; the C++ compares the unmasked cursor with selstart
    const d = w - h;
    if (x > sx) {
      if (y > sy) {
        // south
        if (d === 0) {
          track = (x & MASK) > (y & MASK) ? Track.Left : Track.Right;
        } else if (d > 0) {
          x = sx + h;
          track = Track.Left;
        } else {
          y = sy + w;
          track = Track.Right;
        }
      } else {
        // west
        if (d === 0) {
          track = (x & MASK) + (y & MASK) >= TILE_UNITS ? Track.Lower : Track.Upper;
        } else if (d > 0) {
          x = sx + h;
          track = Track.Lower;
        } else {
          y = sy - w;
          track = Track.Upper;
        }
      }
    } else if (y > sy) {
      // east
      if (d === 0) {
        track = (x & MASK) + (y & MASK) >= TILE_UNITS ? Track.Lower : Track.Upper;
      } else if (d > 0) {
        x = sx - h;
        track = Track.Upper;
      } else {
        y = sy + w;
        track = Track.Lower;
      }
    } else {
      // north
      if (d === 0) {
        track = (x & MASK) > (y & MASK) ? Track.Left : Track.Right;
      } else if (d > 0) {
        x = sx - h;
        track = Track.Right;
      } else {
        y = sy - w;
        track = Track.Left;
      }
    }
  }
  return { line, track, end: { x, y } };
}

/** The remove-station drag limit: VpSetPlaceSizingLimit(-1) into the uint8_t sizelimit. */
export const REMOVE_STATION_SIZE_LIMIT = 255;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Port of viewport.cpp:VpSelectTilesWithMethod, the VPM_X_AND_Y_LIMITED clamp. */
export function limitedAreaEnd(press: OttdPoint, cursor: OttdPoint, sizeLimit: number): OttdPoint {
  const sx = press.x & ~MASK;
  const sy = press.y & ~MASK;
  const limit = (sizeLimit - 1) * TILE_UNITS;
  return {
    x: sx + clamp(cursor.x - sx, -limit, limit),
    y: sy + clamp(cursor.y - sy, -limit, limit),
  };
}
