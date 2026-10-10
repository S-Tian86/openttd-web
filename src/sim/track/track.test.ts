import { describe, expect, it } from 'vitest';
import { DiagDir } from '../map/geometry';
import { diagDirToDiagTrack, Track, TrackBits, tracksOverlap } from './track';

describe('track helpers (port of track_func.h)', () => {
  it('knows which piece combinations overlap (TracksOverlap)', () => {
    expect(
      [
        TrackBits.X,
        TrackBits.Cross,
        TrackBits.Horz,
        TrackBits.Vert,
        TrackBits.X | TrackBits.Upper,
        0,
      ].map(tracksOverlap),
    ).toEqual([false, true, false, false, true, false]);
  });
  it('maps a depot exit to its straight track (DiagDirToDiagTrack)', () => {
    expect([DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW].map(diagDirToDiagTrack)).toEqual([
      Track.X,
      Track.Y,
      Track.X,
      Track.Y,
    ]);
  });
});
