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
 * left mouse button builds (HandleViewportClicked runs before any scrolling, even in the LMB
 * scroll mode), the scroll mode's button pans, and any other button does nothing.
 */
export function buildPointerAction(p: {
  button: number;
  touch: boolean;
  pointers: number;
  scrollButton: number;
}): 'build' | 'pan' | 'pinch' | 'none' {
  if (p.pointers >= 2) return 'pinch';
  if (p.touch || p.button === 0) return 'build';
  return p.button === p.scrollButton ? 'pan' : 'none';
}

/**
 * What a press does with no build tool on (window.cpp MouseLoop): the left button clicks (a tap,
 * or a long press), the scroll mode's button drags the map. One finger does both.
 */
export function idlePointerRoles(p: { button: number; touch: boolean; scrollButton: number }): {
  tap: boolean;
  pan: boolean;
} {
  if (p.touch) return { tap: true, pan: true };
  return { tap: p.button === 0, pan: p.button === p.scrollButton };
}

/**
 * Whether a release ends the build press that `start` began: a mouse has one pointer for all
 * its buttons, so only the button that started the press ends it; a finger ends its own press.
 */
export const buildPressEnds = (
  start: { touch: boolean; button: number },
  up: { button: number },
): boolean => start.touch || up.button === start.button;
