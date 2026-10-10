import { describe, expect, it } from 'vitest';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, pinchZoom, wheelZoom } from './camera';

describe('camera math', () => {
  it('clamps zoom', () => {
    expect([clampZoom(0.1), clampZoom(1), clampZoom(9)]).toEqual([MIN_ZOOM, 1, MAX_ZOOM]);
  });

  it('zooms by 1.2 per 100 px of wheel, scrolling up zooms in', () => {
    expect(wheelZoom(1, -100)).toBeCloseTo(1.2);
    expect(wheelZoom(1, 100)).toBeCloseTo(1 / 1.2);
    expect(wheelZoom(MAX_ZOOM, -100)).toBe(MAX_ZOOM);
  });

  it('scales zoom with the distance between two fingers', () => {
    expect(pinchZoom(1, 100, 150)).toBeCloseTo(1.5);
    expect(pinchZoom(1, 100, 10)).toBe(MIN_ZOOM);
  });
});
