import { describe, expect, it } from 'vitest';
import { execute } from '../sim/command/command';
import { createEmptyGame } from '../sim/game';
import { DiagDir } from '../sim/map/geometry';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { makeTree, TreeGround, TreeGrowth } from '../sim/map/tree-map';
import { HOUSE_SPECS } from '../sim/town/house-specs';
import { newTown } from '../sim/town/town';
import { Axis, Track } from '../sim/track/track';
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

  it('draws one flat sprite per track piece, depots by exit and station buildings by section', () => {
    const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
    const at = (x: number, y: number): number => tileXY(g.map, x, y);
    execute(g, { type: 'buildRail', tile: at(5, 5), track: Track.Y }, 'exec');
    execute(g, { type: 'buildRail', tile: at(5, 5), track: Track.Upper }, 'exec');
    execute(g, { type: 'buildTrainDepot', tile: at(6, 5), dir: DiagDir.SW }, 'exec');
    execute(
      g,
      { type: 'buildRailStation', tile: at(10, 5), axis: Axis.X, numTracks: 2, platLength: 3 },
      'exec',
    );
    expect(objectSprites(g.map, at(5, 5)).map((o) => o.sprite)).toEqual([
      'rail.track.y',
      'rail.track.upper',
    ]);
    expect(objectSprites(g.map, at(6, 5)).map((o) => o.sprite)).toEqual(['depot.rail.sw']);
    expect(objectSprites(g.map, at(10, 5)).map((o) => o.sprite)).toEqual(['station.roof.x']); // 2×3 layout: sections 4 and 6
    execute(
      g,
      { type: 'buildRailStation', tile: at(10, 20), axis: Axis.Y, numTracks: 1, platLength: 1 },
      'exec',
    );
    expect(objectSprites(g.map, at(10, 20)).map((o) => o.sprite)).toEqual(['station.building.y']);
  });
});
