import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { ClearGround, getClearDensity, getClearGround, setClearGroundDensity } from '../map/clear';
import { getTileType, TileType, tileXY } from '../map/map';
import {
  getTreeCount,
  getTreeDensity,
  getTreeGround,
  getTreeGrowth,
  getTreeType,
  makeTree,
  TreeGround,
  TreeGrowth,
} from '../map/tree-map';
import { makeShore } from '../map/water';
import {
  canPlantTreesOnTile,
  createStarShapedPolygon,
  generateTrees,
  isPointInStarShapedPolygon,
  onTickTrees,
  placeTree,
  tileLoopTrees,
  treeGroupCount,
} from './trees';

const NOOP = (): void => undefined;

const advanced = (draws: number): Randomizer => {
  const r = createRandomizer(12345);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

/** 64×64 empty game with one grown tree at (5,5), ticked so (5,5) gets a tree update (cycle 111). */
const treeGame = (draws: number): { game: GameState; t: number } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.random = advanced(draws);
  game.tickCounter = 11 * 256; // cycle = 11*5 + 9*5 + 11 = 111: 111 % 16 == 15 and 111 & 7 == 7
  const t = tileXY(game.map, 5, 5);
  makeTree(game.map, t, 4, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
  return { game, t };
};

describe('placing trees (port of tree_cmd.cpp)', () => {
  it('takes type, count, growth and ground from the random bits (PlaceTree)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const a = tileXY(map, 5, 5);
    const b = tileXY(map, 6, 5);
    placeTree(map, a, 0xffffffff);
    placeTree(map, b, 0x12345678);
    expect([
      getTreeType(map, a),
      getTreeCount(map, a),
      getTreeGrowth(map, a),
      getTreeGround(map, a),
      getTreeDensity(map, a),
    ]).toEqual([11, 4, TreeGrowth.Dead, TreeGround.Rough, 3]);
    expect([
      getTreeType(map, b),
      getTreeCount(map, b),
      getTreeGrowth(map, b),
      getTreeGround(map, b),
    ]).toEqual([0, 1, TreeGrowth.Dying1, TreeGround.Rough]);
  });

  it('plants on grass and multi-corner shores, never on rocks or one-corner shores', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const rocks = tileXY(map, 5, 5);
    setClearGroundDensity(map, rocks, ClearGround.Rocks, 3);
    const shore = tileXY(map, 7, 7);
    map.height[tileXY(map, 8, 7)] = 0;
    map.height[tileXY(map, 8, 8)] = 0;
    makeShore(map, shore); // corners N, E raised
    expect([
      canPlantTreesOnTile(map, tileXY(map, 9, 9), true),
      canPlantTreesOnTile(map, rocks, true),
      canPlantTreesOnTile(map, shore, true),
    ]).toEqual([true, false, true]);
  });

  it('builds grove polygons like CreateStarShapedPolygon (float maths, ruling R3)', () => {
    const shape = createStarShapedPolygon(16, [0, 0, 0, 0], 16);
    expect(shape.map(({ x, y }) => [x, y])).toEqual([
      [8, 0],
      [11, 4],
      [9, 9],
      [4, 11],
      [0, 11],
      [-3, 9],
      [-6, 6],
      [-7, 3],
      [-7, 0],
      [-6, -2],
      [-4, -4],
      [-2, -5],
      [0, -5],
      [1, -3],
      [1, -1],
      [3, -1],
    ]);
    expect([
      isPointInStarShapedPolygon(2, 1, shape),
      isPointInStarShapedPolygon(12, 12, shape),
    ]).toEqual([true, false]);
  });

  it('scales the number of groves by map size', () => {
    expect([
      treeGroupCount(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 536872454),
      treeGroupCount(createEmptyGame().map, 536872454),
    ]).toEqual([2, 31]);
  });

  it('generates trees only where they can grow', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const rocks = tileXY(game.map, 30, 30);
    setClearGroundDensity(game.map, rocks, ClearGround.Rocks, 3);
    generateTrees(game);
    let trees = 0;
    for (let t = 0; t < game.map.size; t++)
      if (getTileType(game.map, t) === TileType.Trees) trees++;
    expect(trees).toBeGreaterThan(0);
    expect(getTileType(game.map, rocks)).toBe(TileType.Clear);
  });
});

describe('TileLoop_Trees (port of tree_cmd.cpp)', () => {
  it('starts dying on a draw of 0', () => {
    const { game, t } = treeGame(12); // next draw 386989480: & 7 == 0
    tileLoopTrees(game, t, NOOP);
    expect(getTreeGrowth(game.map, t)).toBe(TreeGrowth.Dying1);
  });

  it('adds a tree to the tile on a draw of 1', () => {
    const { game, t } = treeGame(5); // 2178421593: & 7 == 1
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([
      2,
      TreeGrowth.Growing1,
    ]);
  });

  it('seeds a neighbour on a draw of 2', () => {
    const { game, t } = treeGame(4); // 4215375298: & 7 == 2, then 2178421593 % 8 == 1 (NE)
    tileLoopTrees(game, t, NOOP);
    const ne = tileXY(game.map, 4, 5);
    expect([
      getTileType(game.map, ne),
      getTreeType(game.map, ne),
      getTreeCount(game.map, ne),
      getTreeGrowth(game.map, ne),
    ]).toEqual([TileType.Trees, 4, 1, TreeGrowth.Growing1]);
  });

  it('does nothing on draws 3..7', () => {
    const { game, t } = treeGame(0); // 536872454: & 7 == 6
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([1, TreeGrowth.Grown]);
  });

  it('removes a dead tree, leaving its grass (grown one step first: cycle & 7 == 7)', () => {
    const { game, t } = treeGame(0);
    makeTree(game.map, t, 4, 0, TreeGrowth.Dead, TreeGround.Grass, 2);
    tileLoopTrees(game, t, NOOP);
    expect([
      getTileType(game.map, t),
      getClearGround(game.map, t),
      getClearDensity(game.map, t),
    ]).toEqual([TileType.Clear, ClearGround.Grass, 3]);
    makeTree(game.map, t, 4, 1, TreeGrowth.Dead, TreeGround.Grass, 2);
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([1, TreeGrowth.Grown]);
  });

  it('grows the grass under trees every eighth visit', () => {
    const { game, t } = treeGame(0);
    makeTree(game.map, t, 4, 0, TreeGrowth.Growing1, TreeGround.Grass, 1);
    tileLoopTrees(game, t, NOOP);
    expect([getTreeDensity(game.map, t), getTreeGrowth(game.map, t)]).toEqual([
      2,
      TreeGrowth.Growing2,
    ]);
  });
});

describe('OnTick_Trees (port of tree_cmd.cpp)', () => {
  it('on 64×64 plants a random tree every 16 ticks when the counter wraps', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    game.tickCounter = 17;
    onTickTrees(game);
    expect([game.treeTickCounter, game.random]).toEqual([0, createRandomizer(0)]);
    game.tickCounter = 16;
    onTickTrees(game);
    expect(game.treeTickCounter).toBe(255);
    expect(game.random).not.toEqual(createRandomizer(0));
  });
});
