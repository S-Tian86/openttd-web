import { describe, expect, it } from 'vitest';
import { createMap, TileType } from './map';
import { runTileLoop } from './tile-loop';

describe('RunTileLoop (port of landscape.cpp)', () => {
  it('visits tiles in OpenTTD LFSR order, size/256 per tick', () => {
    const map = createMap(6, 6); // 4096 tiles → 16 per tick
    const visited: number[] = [];
    runTileLoop(map, 1, { [TileType.Clear]: (t) => visited.push(t) });
    expect(visited.slice(0, 6)).toEqual([1, 3471, 2888, 1444, 722, 361]);
    expect(visited).toHaveLength(16);
  });

  it('visits every tile exactly once per 256 ticks, tile 0 on counter % 256 == 0', () => {
    const map = createMap(6, 6);
    const counts = new Map<number, number>();
    const visit = (t: number): void => void counts.set(t, (counts.get(t) ?? 0) + 1);
    for (let counter = 1; counter <= 256; counter++) {
      runTileLoop(map, counter, { [TileType.Clear]: visit });
    }
    expect(counts.size).toBe(4096);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
  });
});
