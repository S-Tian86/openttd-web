import { describe, expect, it } from 'vitest';
import { createGame } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { groundSprite } from './ground';

describe('ground sprites', () => {
  it('picks void, grass by density, and unknown otherwise', () => {
    const { map } = createGame({ mapLogX: 6, mapLogY: 6 });
    expect(groundSprite(map, tileXY(map, 0, 0))).toBe('terrain.void');
    const t = tileXY(map, 5, 5);
    expect(groundSprite(map, t)).toBe('terrain.grass.3');
    map.m5[t] = 1;
    expect(groundSprite(map, t)).toBe('terrain.grass.1');
    map.type[t] = 3 << 4; // house: not drawn by the ground layer yet
    expect(groundSprite(map, t)).toBe('terrain.unknown');
  });
});
