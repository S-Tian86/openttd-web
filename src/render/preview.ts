import { tileX, tileY, type MapState } from '../sim/map/map';
import type { Track } from '../sim/track/track';
import { TILE_PX, tileToWorld } from './projection';

/**
 * The construction ghost of the gesture in progress: rail pieces or tiles. `ok` is the whole
 * command's test result; a rail piece's own `ok` is false when the drag stops before it.
 */
export interface MapPreview {
  ok: boolean;
  rails: readonly { tile: number; track: Track; ok: boolean }[];
  tiles: readonly number[];
}

export const PREVIEW_OK_COLOUR = 0x2fbf71;
export const PREVIEW_BAD_COLOUR = 0xe5484d;

/**
 * Each track piece as a segment between tile-edge midpoints, by `Track`, in tile pixels
 * (`[x1, y1, x2, y2]`; NE edge at the top, SE right, SW bottom, NW left).
 */
export const TRACK_SEGMENTS: readonly (readonly [number, number, number, number])[] = [
  [32, 0, 32, 64], // X
  [0, 32, 64, 32], // Y
  [32, 0, 0, 32], // Upper
  [64, 32, 32, 64], // Lower
  [0, 32, 32, 64], // Left
  [32, 0, 64, 32], // Right
];

const colour = (ok: boolean): number => (ok ? PREVIEW_OK_COLOUR : PREVIEW_BAD_COLOUR);

export interface PreviewShapes {
  colour: number;
  lines: { x1: number; y1: number; x2: number; y2: number; colour: number }[];
  rects: { x: number; y: number; w: number; h: number }[];
}

/**
 * The ghost as plain shapes in world pixels, coloured by the command's test result (R31); a
 * rail piece the drag will not reach is red even when the rest builds.
 */
export function previewShapes(map: MapState, preview: MapPreview): PreviewShapes {
  const origin = (t: number): { px: number; py: number } =>
    tileToWorld(tileX(map, t), tileY(map, t));
  return {
    colour: colour(preview.ok),
    lines: preview.rails.map(({ tile, track, ok }) => {
      const { px, py } = origin(tile);
      const [a, b, c, d] = TRACK_SEGMENTS[track]!;
      return { x1: px + a, y1: py + b, x2: px + c, y2: py + d, colour: colour(preview.ok && ok) };
    }),
    rects: preview.tiles.map((tile) => {
      const { px, py } = origin(tile);
      return { x: px, y: py, w: TILE_PX, h: TILE_PX };
    }),
  };
}
