/** Movement allowed during a tap, in screen pixels. */
export const TAP_SLOP_PX = 8;
/** Hold time that turns a still press into a long press. */
export const LONG_PRESS_MS = 500;

export interface PressPoint {
  x: number;
  y: number;
  at: number;
}

/** A press is classified once; a drag (or pinch, reported as `moved`) is never a tap. */
export function classifyPress(
  down: PressPoint,
  up: PressPoint,
  moved: boolean,
): 'tap' | 'long' | 'drag' {
  if (moved || Math.max(Math.abs(up.x - down.x), Math.abs(up.y - down.y)) > TAP_SLOP_PX) {
    return 'drag';
  }
  return up.at - down.at >= LONG_PRESS_MS ? 'long' : 'tap';
}
