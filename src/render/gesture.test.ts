import { describe, expect, it } from 'vitest';
import { classifyPress } from './gesture';

const down = { x: 100, y: 100, at: 1000 };

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
