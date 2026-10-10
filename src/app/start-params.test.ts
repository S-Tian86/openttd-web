import { describe, expect, it } from 'vitest';
import { parseStartParams } from './start-params';

describe('start parameters (ruling R14)', () => {
  it('reads seed, size and focus tile', () => {
    expect(parseStartParams('?seed=42&size=64x128&tile=10,20')).toEqual({
      seed: 42,
      mapLogX: 6,
      mapLogY: 7,
      focus: { x: 10, y: 20 },
    });
  });

  it('ignores invalid values', () => {
    expect(parseStartParams('?seed=-1&size=100x64&tile=a,b')).toEqual({});
    expect(parseStartParams('?seed=4294967296&size=2048x2048')).toEqual({});
    expect(parseStartParams('')).toEqual({});
  });
});
