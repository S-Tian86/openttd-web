import type { OttdPoint } from './projection';

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

/**
 * One step of a build-tool gesture, in OpenTTD world units: `hover` follows a mouse with no
 * button down, `move` a press being dragged, `end` the release, `cancel` an abandoned press.
 */
export interface BuildGesture {
  phase: 'hover' | 'move' | 'end' | 'cancel';
  press: OttdPoint;
  current: OttdPoint;
  touch: boolean;
  ctrl: boolean;
}

/**
 * What a new press does while a build tool is on (R30): two fingers pinch, one finger or the
 * left mouse button builds, any other mouse button pans, so the map can still be moved.
 */
export function buildPointerAction(p: {
  button: number;
  touch: boolean;
  pointers: number;
}): 'build' | 'pan' | 'pinch' {
  if (p.pointers >= 2) return 'pinch';
  return p.touch || p.button === 0 ? 'build' : 'pan';
}
