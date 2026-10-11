import { describe, expect, it } from 'vitest';
import { buildPointerAction, buildPressEnds, classifyPress, idlePointerRoles } from './gesture';

const down = { x: 100, y: 100, at: 1000 };
const action = (button: number, touch: boolean, pointers: number, scroll = 2) =>
  buildPointerAction({ button, touch, pointers, scrollButton: scroll });
const roles = (button: number, touch: boolean, scroll = 2) =>
  idlePointerRoles({ button, touch, scrollButton: scroll });

describe('tap, long press and drag (Review Focus 4)', () => {
  it('is a tap when short and still', () => {
    expect(classifyPress(down, { x: 103, y: 104, at: 1200 }, false)).toBe('tap');
  });
  it('is a long press when held still for 500 ms', () => {
    expect(classifyPress(down, { x: 101, y: 100, at: 1500 }, false)).toBe('long');
  });
  it('is a drag once the pointer moved past the slop, even if it came back', () => {
    expect(classifyPress(down, { x: 100, y: 100, at: 1100 }, true)).toBe('drag');
    expect(classifyPress(down, { x: 120, y: 100, at: 1100 }, false)).toBe('drag');
  });
});

describe('pointers while a build tool is on (R30, Review Focus 1)', () => {
  it('builds with the left button or one finger, pans with the scroll button, pinches with two fingers', () => {
    expect([
      action(0, false, 1),
      action(2, false, 1),
      action(1, false, 1),
      action(0, true, 1),
      action(0, true, 2),
    ]).toEqual(['build', 'pan', 'none', 'build', 'pinch']);
  });

  it('still builds with the left button in the LMB scroll mode (HandleViewportClicked comes first)', () => {
    expect([action(0, false, 1, 0), action(2, false, 1, 0)]).toEqual(['build', 'none']);
  });
});

describe('pointers with no build tool on (window.cpp MouseLoop)', () => {
  it('taps with the left button and pans only with the scroll button', () => {
    expect(roles(0, false)).toEqual({ tap: true, pan: false });
    expect(roles(2, false)).toEqual({ tap: false, pan: true });
    expect(roles(1, false)).toEqual({ tap: false, pan: false });
  });

  it('taps and pans with the left button in the LMB scroll mode', () => {
    expect(roles(0, false, 0)).toEqual({ tap: true, pan: true });
    expect(roles(2, false, 0)).toEqual({ tap: false, pan: false });
  });

  it('taps and pans with one finger whatever the mouse setting', () => {
    expect(roles(0, true)).toEqual({ tap: true, pan: true });
  });
});

describe('the end of a build press (R30)', () => {
  it('ends only on the button that started it; a finger always ends its own press', () => {
    expect([
      buildPressEnds({ touch: false, button: 0 }, { button: 0 }),
      buildPressEnds({ touch: false, button: 0 }, { button: 2 }),
      buildPressEnds({ touch: false, button: 0 }, { button: 1 }),
      buildPressEnds({ touch: true, button: 0 }, { button: 0 }),
    ]).toEqual([true, false, false, true]);
  });
});
