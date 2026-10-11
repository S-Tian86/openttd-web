import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_CONTROLS,
  keyScrollDelta,
  scrollButton,
  scrollDirection,
  scrollLocksPointer,
  wheelScrollDelta,
} from './controls';

const LEFT = 1;
const UP = 2;
const RIGHT = 4;
const DOWN = 8;

describe('arrow key scrolling (window.cpp HandleKeyScrolling)', () => {
  it('moves 20 screen pixels per step, 100 with Shift', () => {
    expect(keyScrollDelta(LEFT, false)).toEqual([-20, 0]);
    expect(keyScrollDelta(UP, false)).toEqual([0, -20]);
    expect(keyScrollDelta(RIGHT, true)).toEqual([100, 0]);
    expect(keyScrollDelta(DOWN, true)).toEqual([0, 100]);
  });

  it('follows scrollamt for key combinations, opposite keys cancel', () => {
    expect(keyScrollDelta(LEFT | UP, false)).toEqual([-20, -10]);
    expect(keyScrollDelta(RIGHT | DOWN, false)).toEqual([20, 10]);
    expect(keyScrollDelta(LEFT | RIGHT, false)).toEqual([0, 0]);
    expect(keyScrollDelta(LEFT | RIGHT | UP, false)).toEqual([0, -20]);
    expect(keyScrollDelta(LEFT | UP | RIGHT | DOWN, false)).toEqual([0, 0]);
  });

  it('does nothing without keys', () => {
    expect(keyScrollDelta(0, true)).toEqual([0, 0]);
  });
});

describe('scroll modes (settings_type.h ViewportScrollMode)', () => {
  it('defaults to OpenTTD Unix and web builds: map, right button, cursor free', () => {
    expect(DEFAULT_MAP_CONTROLS).toEqual({ scrollMode: 'mapRmb', wheel: 'zoom', wheelSpeed: 5 });
  });

  it('pans with the left button only in the LMB mode', () => {
    expect([
      scrollButton('viewportRmbLocked'),
      scrollButton('mapRmbLocked'),
      scrollButton('mapRmb'),
      scrollButton('mapLmb'),
    ]).toEqual([2, 2, 2, 0]);
  });

  it('locks the pointer in the two "mouse position locked" modes', () => {
    expect([
      scrollLocksPointer('viewportRmbLocked'),
      scrollLocksPointer('mapRmbLocked'),
      scrollLocksPointer('mapRmb'),
      scrollLocksPointer('mapLmb'),
    ]).toEqual([true, true, false, false]);
  });

  it('moves the viewport, not the map, with the mouse in VSM_VIEWPORT_RMB_FIXED', () => {
    expect([
      scrollDirection('viewportRmbLocked'),
      scrollDirection('mapRmbLocked'),
      scrollDirection('mapRmb'),
      scrollDirection('mapLmb'),
    ]).toEqual([-1, 1, 1, 1]);
  });
});

describe('scroll wheel scrolling (sdl2_v.cpp, SCROLL_BUILTIN_MULTIPLIER)', () => {
  it('moves 14 pixels per notch times the wheel speed', () => {
    // A browser reports one notch as 100 pixels of deltaY.
    expect(wheelScrollDelta(0, 100, 5)).toEqual([0, 70]);
    expect(wheelScrollDelta(-100, 0, 1)).toEqual([-14, 0]);
    expect(wheelScrollDelta(50, -200, 15)).toEqual([105, -420]);
  });
});
