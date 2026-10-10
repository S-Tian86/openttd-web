import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { makeTree, TreeGround, TreeGrowth } from '../sim/map/tree-map';
import { HOUSE_SPECS } from '../sim/town/house-specs';
import { chunkObjects, houseSprite, objectSprites, TREE_OFFSETS } from './objects';

describe('object sprites', () => {
  it('draws one sprite per tree, sized by growth', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 0, 2, TreeGrowth.Grown, TreeGround.Grass, 3);
    expect(objectSprites(map, t)).toEqual(
      TREE_OFFSETS[2]!.map(([dx, dy]) => ({ sprite: 'tree.large', dx, dy })),
    );
  });

  it('draws houses by type or construction stage, and industry tiles by gfx', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeHouseTile(map, tileXY(map, 5, 5), 0, 0, 3, 0x03, 0);
    makeHouseTile(map, tileXY(map, 6, 5), 0, 2, 1, 0x06, 0);
    makeIndustry(map, tileXY(map, 7, 5), 0, 8, 0);
    expect([5, 6, 7].map((x) => objectSprites(map, tileXY(map, x, 5))[0]?.sprite)).toEqual([
      'house.church',
      'house.construction.1',
      'industry.gfx.8',
    ]);
  });

  it('has a sprite for every house that can exist in 1950', () => {
    const missing = HOUSE_SPECS.filter(
      (spec) =>
        spec.minYear <= 1950 && 1950 <= spec.maxYear && houseSprite(spec.id) === 'object.unknown',
    ).map((spec) => spec.id.toString(16));
    expect(missing).toEqual([]);
  });

  it('lists a chunk top row first, left to right, anchored at the tile bottom centre', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeTree(map, tileXY(map, 2, 3), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
    makeHouseTile(map, tileXY(map, 1, 5), 0, 0, 3, 0x06, 0);
    expect(chunkObjects(map, 0, 0)).toEqual([
      { sprite: 'house.town-houses', px: 5 * 64 + 32, py: 1 * 64 + 64 },
      { sprite: 'tree.large', px: 3 * 64 + 32, py: 2 * 64 + 64 },
    ]);
  });
});
