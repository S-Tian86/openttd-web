import { describe, expect, it } from 'vitest';
import type { OttdPoint } from '../render/projection';
import { Track } from '../sim/track/track';
import { calcRaildirsDrawstyle, limitedAreaEnd } from './autorail';

const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const style = (press: OttdPoint, cursor: OttdPoint): [boolean, Track, number, number] => {
  const s = calcRaildirsDrawstyle(press, cursor);
  return [s.line, s.track, s.end.x >> 4, s.end.y >> 4];
};

describe('autorail (port of viewport.cpp:CalcRaildirsDrawstyle)', () => {
  it('picks the single piece from the release point inside the press tile (_autorail_piece)', () => {
    const press = P(10, 10);
    expect(
      [
        [2, 2],
        [2, 7],
        [8, 2],
        [12, 2],
        [12, 12],
        [2, 12],
      ].map(([fx, fy]) => style(press, P(10, 10, fx, fy))),
    ).toEqual([
      [false, Track.Upper, 10, 10],
      [false, Track.X, 10, 10],
      [false, Track.Y, 10, 10],
      [false, Track.Left, 10, 10],
      [false, Track.Lower, 10, 10],
      [false, Track.Right, 10, 10],
    ]);
  });

  it('draws straight lines along X and Y', () => {
    expect([
      style(P(10, 10), P(14, 10)),
      style(P(10, 10), P(10, 13)),
      style(P(10, 10), P(7, 10)),
      style(P(10, 10), P(14, 11)),
    ]).toEqual([
      [true, Track.X, 14, 10],
      [true, Track.Y, 10, 13],
      [true, Track.X, 7, 10],
      [true, Track.X, 14, 10], // w > 2h: snapped to the press row
    ]);
  });

  it('uses both press and release sub-tile points for two-tile drags (Check2x1AutoRail)', () => {
    expect(style(P(10, 10), P(11, 10))).toEqual([true, Track.X, 11, 10]);
    expect(style(P(10, 10, 13, 2), P(11, 10, 2, 13))).toEqual([true, Track.Left, 11, 10]);
  });

  it('pins every Check2x1AutoRail result and its condition order (modes 0-3)', () => {
    expect([
      // mode 0: dy = -16
      style(P(10, 10, 12, 12), P(10, 11, 2, 2)),
      style(P(10, 10, 2, 12), P(10, 11, 12, 2)),
      style(P(10, 10), P(10, 11)),
      style(P(10, 10, 5, 15), P(10, 11, 8, 0)), // both tests match: Lower wins
      // mode 1: dy = +16
      style(P(10, 10, 12, 2), P(10, 9, 2, 12)),
      style(P(10, 10, 2, 2), P(10, 9, 12, 12)),
      style(P(10, 10), P(10, 9)),
      style(P(10, 10, 10, 0), P(10, 9, 5, 15)), // both tests match: Left wins
      // mode 2: dx = -16
      style(P(10, 10, 12, 12), P(11, 10, 2, 2)),
      style(P(10, 10, 15, 5), P(11, 10, 0, 8)), // both tests match: Left wins
      // mode 3: dx = +16
      style(P(10, 10, 2, 12), P(9, 10, 12, 2)),
      style(P(10, 10, 2, 2), P(9, 10, 12, 12)),
      style(P(10, 10), P(9, 10)),
      style(P(10, 10, 0, 10), P(9, 10, 15, 5)), // both tests match: Right wins
    ]).toEqual([
      [true, Track.Lower, 10, 11],
      [true, Track.Right, 10, 11],
      [true, Track.Y, 10, 11],
      [true, Track.Lower, 10, 11],
      [true, Track.Left, 10, 9],
      [true, Track.Upper, 10, 9],
      [true, Track.Y, 10, 9],
      [true, Track.Left, 10, 9],
      [true, Track.Lower, 11, 10],
      [true, Track.Left, 11, 10],
      [true, Track.Right, 9, 10],
      [true, Track.Upper, 9, 10],
      [true, Track.X, 9, 10],
      [true, Track.Right, 9, 10],
    ]);
  });

  it('pins every quadrant of the complicated-direction branch', () => {
    const press = P(10, 10);
    expect(
      [
        P(12, 14), // south, d < 0
        P(14, 8), // west, d > 0
        P(12, 6), // west, d < 0
        P(12, 8, 8, 8), // west, d == 0
        P(12, 8, 3, 4),
        P(6, 12), // east, d > 0
        P(8, 14), // east, d < 0
        P(8, 12, 8, 8), // east, d == 0
        P(8, 12, 3, 4),
        P(6, 8), // north, d > 0
        P(8, 6), // north, d < 0
        P(8, 8, 9, 3), // north, d == 0
        P(8, 8, 3, 9),
      ].map((cursor) => style(press, cursor)),
    ).toEqual([
      [true, Track.Right, 12, 13],
      [true, Track.Lower, 13, 8],
      [true, Track.Upper, 12, 7],
      [true, Track.Lower, 12, 8],
      [true, Track.Upper, 12, 8],
      [true, Track.Upper, 7, 12],
      [true, Track.Lower, 8, 13],
      [true, Track.Lower, 8, 12],
      [true, Track.Upper, 8, 12],
      [true, Track.Right, 7, 8],
      [true, Track.Left, 8, 7],
      [true, Track.Left, 8, 8],
      [true, Track.Right, 8, 8],
    ]);
  });

  it('snaps diagonal drags to a staircase end tile', () => {
    expect([
      style(P(10, 10), P(13, 12)),
      style(P(10, 10), P(13, 11)),
      style(P(10, 10), P(12, 12, 3, 9)),
      style(P(10, 10), P(12, 12, 9, 3)),
    ]).toEqual([
      [true, Track.Left, 13, 12],
      [true, Track.Left, 12, 11],
      [true, Track.Right, 12, 12],
      [true, Track.Left, 12, 12],
    ]);
  });

  it('limits a station drag to 12 tiles each way (VPM_X_AND_Y_LIMITED)', () => {
    const end = limitedAreaEnd(P(10, 10, 3, 3), P(30, 10), 12);
    expect([end.x >> 4, end.y >> 4]).toEqual([21, 10]);
    const back = limitedAreaEnd(P(10, 10, 3, 3), P(1, 10, 0, 0), 12);
    expect([back.x >> 4, back.y >> 4]).toEqual([1, 10]);
  });
});
