import { describe, expect, it } from 'vitest';
import { DAY_TICKS, MILLISECONDS_PER_TICK, TILE_SIZE } from './constants';

// Fidelity: values copied from OpenTTD 15.3. Changing them changes the game.
describe('core constants (OpenTTD 15.3)', () => {
  it('has 74 ticks per day', () => {
    expect(DAY_TICKS).toBe(74);
  });

  it('runs a tick every 27 ms at normal speed', () => {
    expect(MILLISECONDS_PER_TICK).toBe(27);
  });

  it('divides a tile edge into 16 world units', () => {
    expect(TILE_SIZE).toBe(16);
  });
});
