/** Port of settings_type.h ViewportScrollMode: which mouse button moves the map, and how. */
export type ScrollMode = 'viewportRmbLocked' | 'mapRmbLocked' | 'mapRmb' | 'mapLmb';

/** Port of settings_type.h ScrollWheelScrolling (gui.scrollwheel_scrolling). */
export type WheelMode = 'zoom' | 'scroll' | 'off';

/** OpenTTD's map control settings (gui_settings.ini). */
export interface MapControls {
  scrollMode: ScrollMode;
  wheel: WheelMode;
  /** gui.scrollwheel_multiplier, 1..15. */
  wheelSpeed: number;
}

/** OpenTTD's defaults on Unix, which includes its web build: VSM_MAP_RMB, SWS_ZOOM_MAP and 5. */
export const DEFAULT_MAP_CONTROLS: MapControls = {
  scrollMode: 'mapRmb',
  wheel: 'zoom',
  wheelSpeed: 5,
};

/** The mouse button that drags the map: the left one only in VSM_MAP_LMB (window.cpp MouseLoop). */
export const scrollButton = (mode: ScrollMode): number => (mode === 'mapLmb' ? 0 : 2);

/** The "mouse position locked" modes keep the cursor still while scrolling (_cursor.fix_at). */
export const scrollLocksPointer = (mode: ScrollMode): boolean =>
  mode === 'viewportRmbLocked' || mode === 'mapRmbLocked';

/**
 * Port of window.cpp HandleViewportScroll: the map follows the mouse, except in
 * VSM_VIEWPORT_RMB_FIXED, where the mouse moves the viewport over the map. 1 means the map
 * follows the mouse.
 */
export const scrollDirection = (mode: ScrollMode): 1 | -1 =>
  mode === 'viewportRmbLocked' ? -1 : 1;

/** How often OpenTTD's window timer scrolls for held arrow keys (window.cpp window_interval). */
export const KEY_SCROLL_INTERVAL_MS = 30;

/** Port of window.cpp scrollamt: indexed by _dirkeys (1 left, 2 up, 4 right, 8 down). */
const SCROLL_AMOUNT: readonly (readonly [number, number])[] = [
  [0, 0],
  [-2, 0],
  [0, -2],
  [-2, -1],
  [2, 0],
  [0, 0],
  [2, -1],
  [0, -2],
  [0, 2],
  [-2, 1],
  [0, 0],
  [-2, 0],
  [2, 1],
  [0, 2],
  [2, 0],
  [0, 0],
];

/**
 * Port of window.cpp HandleKeyScrolling: the screen pixels one timer step scrolls for the held
 * arrow keys, 10 times scrollamt, or 50 times with Shift.
 */
export function keyScrollDelta(dirkeys: number, shift: boolean): [number, number] {
  const [x, y] = SCROLL_AMOUNT[dirkeys & 15] ?? [0, 0];
  const factor = shift ? 50 : 10;
  // `+ 0` turns the -0 of a zero step into 0.
  return [x * factor + 0, y * factor + 0];
}

/** Pixels of a browser wheel event's delta per notch of the wheel. */
const WHEEL_NOTCH_PX = 100;
/** sdl2_v.cpp SCROLL_BUILTIN_MULTIPLIER: pixels scrolled per notch at a wheel speed of 1. */
const SCROLL_BUILTIN_MULTIPLIER = 14;

/** Port of sdl2_v.cpp's wheel handling for SWS_SCROLL_MAP: the screen pixels a wheel event scrolls. */
export function wheelScrollDelta(
  deltaX: number,
  deltaY: number,
  wheelSpeed: number,
): [number, number] {
  const scale = SCROLL_BUILTIN_MULTIPLIER * wheelSpeed;
  return [(deltaX * scale) / WHEEL_NOTCH_PX, (deltaY * scale) / WHEEL_NOTCH_PX];
}
