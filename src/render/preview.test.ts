import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { Track } from '../sim/track/track';
import { PREVIEW_BAD_COLOUR, PREVIEW_OK_COLOUR, previewShapes } from './preview';

const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });

describe('construction ghost (spec §4, R31)', () => {
  it('draws rail pieces as segments between tile edges, in world pixels', () => {
    const shapes = previewShapes(map, {
      ok: true,
      rails: [
        { tile: tileXY(map, 10, 12), track: Track.X },
        { tile: tileXY(map, 10, 12), track: Track.Left },
      ],
      tiles: [],
    });
    expect(shapes).toEqual({
      colour: PREVIEW_OK_COLOUR,
      lines: [
        { x1: 800, y1: 640, x2: 800, y2: 704 }, // NE edge (top) to SW edge (bottom)
        { x1: 768, y1: 672, x2: 800, y2: 704 }, // NW edge (left) to SW edge (bottom)
      ],
      rects: [],
    });
  });

  it('fills whole tiles in red when the build would fail', () => {
    expect(previewShapes(map, { ok: false, rails: [], tiles: [tileXY(map, 3, 5)] })).toEqual({
      colour: PREVIEW_BAD_COLOUR,
      lines: [],
      rects: [{ x: 320, y: 192, w: 64, h: 64 }],
    });
  });
});
