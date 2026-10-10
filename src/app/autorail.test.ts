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

describe('autorail (port of viewport.cpp:CalcRaildirsDrawstyle, Review Focus 1)', () => {
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
