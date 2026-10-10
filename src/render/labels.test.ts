import { describe, expect, it } from 'vitest';
import { isSmallLabel } from './labels';

describe('isSmallLabel (viewport.cpp ViewportAddKdtreeSigns)', () => {
  it('uses small signs from 4× out of the normal zoom', () => {
    expect([2, 1, 0.5, 0.26].map(isSmallLabel)).toEqual([false, false, false, false]);
    expect([0.25, 0.125].map(isSmallLabel)).toEqual([true, true]);
  });
});
