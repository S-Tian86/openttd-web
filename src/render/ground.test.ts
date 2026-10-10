import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { ClearGround, setClearGroundDensity } from '../sim/map/clear';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { makeRoadNormal, RoadBits } from '../sim/map/road-map';
import { makeTree, TreeGround, TreeGrowth } from '../sim/map/tree-map';
import { makeSea, makeShore } from '../sim/map/water';
import { groundSprite } from './ground';

describe('ground sprites', () => {
  it('picks void, grass by density, and unknown otherwise', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    expect(groundSprite(map, tileXY(map, 0, 0))).toBe('terrain.void');
    const t = tileXY(map, 5, 5);
    expect(groundSprite(map, t)).toBe('terrain.grass.3');
    map.m5[t] = 1;
    expect(groundSprite(map, t)).toBe('terrain.grass.1');
  });

  it('draws rough, rocks, sea, coast by slope, roads by bits and building ground', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const at = (x: number, y: number): number => tileXY(map, x, y);
    setClearGroundDensity(map, at(5, 5), ClearGround.Rough, 3);
    setClearGroundDensity(map, at(6, 5), ClearGround.Rocks, 3);
    makeSea(map, at(7, 5));
    for (const [x, y] of [
      [10, 10],
      [10, 11],
      [11, 11],
    ] as const)
      map.height[at(x, y)] = 0;
    makeShore(map, at(10, 10)); // only the W corner raised: slope 1
    makeRoadNormal(map, at(8, 5), RoadBits.X, 0);
    makeHouseTile(map, at(9, 5), 0, 0, 3, 0x06, 0);
    makeIndustry(map, at(12, 5), 0, 8, 0);
    makeTree(map, at(13, 5), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 2);
    makeTree(map, at(14, 5), 0, 0, TreeGrowth.Grown, TreeGround.Rough, 3);
    const tiles = [
      at(5, 5),
      at(6, 5),
      at(7, 5),
      at(10, 10),
      at(8, 5),
      at(9, 5),
      at(12, 5),
      at(13, 5),
      at(14, 5),
    ];
    expect(tiles.map((t) => groundSprite(map, t))).toEqual([
      'terrain.rough',
      'terrain.rocks',
      'water.sea',
      'water.coast.1',
      'road.10',
      'ground.house',
      'ground.industry',
      'terrain.grass.2',
      'terrain.rough',
    ]);
  });
});
