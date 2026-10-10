import { nextRandom } from '../core/random';
import type { GameState } from '../game';
import { ClearGround, getClearDensity, getClearGround, makeClear } from '../map/clear';
import {
  Dir,
  INVALID_TILE,
  scaleBySize,
  tileAddWrap,
  tileOffsByDir,
  randomTile,
} from '../map/geometry';
import { getTileType, tileX, tileY, TileType, type MapState } from '../map/map';
import { getTileSlope, getTileZ, isSlopeWithOneCornerRaised } from '../map/slope';
import {
  addTreeCount,
  addTreeGrowth,
  getTreeCount,
  getTreeDensity,
  getTreeGround,
  getTreeGrowth,
  getTreeType,
  makeTree,
  setTreeGrowth,
  setTreeGroundDensity,
  TREE_COUNT_TEMPERATE,
  TreeGround,
  TreeGrowth,
} from '../map/tree-map';
import { clearNeighbourNonFloodingStates, isCoastTile, makeShore } from '../map/water';
import { tileLoopWater } from '../map/flood';
import { WORLD } from './settings';

const f = Math.fround;

/** Port of tree_cmd.cpp:DEFAULT_TREE_STEPS. */
const DEFAULT_TREE_STEPS = 1000;
/** Port of tree_cmd.cpp:PlaceTreeGroups (GROVE_SEGMENTS, GROVE_RADIUS). */
const GROVE_SEGMENTS = 16;
const GROVE_RADIUS = 16;
/** Port of settings: MAP_HEIGHT_LIMIT_ORIGINAL. */
const MAP_HEIGHT_LIMIT_ORIGINAL = 15;
/** Port of tree_cmd.cpp:CreateRandomStarShapedPolygon PHASE_DIVISOR. */
const PHASE_DIVISOR = f((2147483647 / Math.PI) * 2);

export interface Point {
  x: number;
  y: number;
}

/** Port of tree_cmd.cpp:CanPlantTreesOnTile. */
export function canPlantTreesOnTile(map: MapState, t: number, allowDesert: boolean): boolean {
  switch (getTileType(map, t)) {
    case TileType.Water:
      return isCoastTile(map, t) && !isSlopeWithOneCornerRaised(getTileSlope(map, t));
    case TileType.Clear: {
      const ground = getClearGround(map, t);
      return (
        ground !== ClearGround.Fields &&
        ground !== ClearGround.Rocks &&
        (allowDesert || ground !== ClearGround.Desert)
      );
    }
    default:
      return false;
  }
}

/** Port of tree_cmd.cpp:PlantTreesOnTile (no snow in the temperate climate). */
function plantTreesOnTile(
  map: MapState,
  t: number,
  type: number,
  count: number,
  growth: TreeGrowth,
): void {
  let ground: TreeGround;
  let density = 3;
  if (getTileType(map, t) === TileType.Water) {
    ground = TreeGround.Shore;
    clearNeighbourNonFloodingStates(map, t);
  } else {
    const clearGround = getClearGround(map, t);
    switch (clearGround) {
      case ClearGround.Grass:
        ground = TreeGround.Grass;
        break;
      case ClearGround.Rough:
        ground = TreeGround.Rough;
        break;
      default:
        ground = TreeGround.SnowDesert;
        break;
    }
    if (clearGround !== ClearGround.Rough) density = getClearDensity(map, t);
  }
  makeTree(map, t, type, count, growth, ground, density);
}

/** Port of tree_cmd.cpp:GetRandomTreeType (temperate). */
const randomTreeType = (seed: number): number => Math.trunc((seed * TREE_COUNT_TEMPERATE) / 256);

/** Port of tree_cmd.cpp:PlaceTree (`r` is a uint32 draw). */
export function placeTree(map: MapState, t: number, r: number): void {
  const type = randomTreeType(r >>> 24);
  plantTreesOnTile(map, t, type, (r >>> 22) & 3, Math.min((r >>> 16) & 7, 6) as TreeGrowth);
  const ground = getTreeGround(map, t);
  if (
    ground !== TreeGround.SnowDesert &&
    ground !== TreeGround.RoughSnow &&
    ground !== TreeGround.Shore
  ) {
    setTreeGroundDensity(map, t, ((r >>> 28) & 1) as TreeGround, 3);
  }
}

/** Port of tree_cmd.cpp:CreateStarShapedPolygon (harmonic i: amplitude radius >> (i+1), frequency i+1). */
export function createStarShapedPolygon(
  radius: number,
  phases: readonly number[],
  segments: number,
): Point[] {
  const amplitudes = [
    Math.trunc(radius / 2),
    Math.trunc(radius / 4),
    Math.trunc(radius / 8),
    Math.trunc(radius / 16),
  ];
  const step = f((Math.PI * 2) / segments);
  const shape: Point[] = [];
  let theta = f(0);
  for (let k = 0; k < segments; k++) {
    let deviation = f(0);
    for (let h = 0; h < 4; h++) {
      deviation = f(
        deviation + f(f(Math.sin(f(f(theta + phases[h]!) * (h + 1)))) * amplitudes[h]!),
      );
    }
    const adjusted = f(f(radius / 2) + f(deviation / 2));
    shape.push({
      x: Math.trunc(f(f(Math.cos(theta)) * adjusted)) | 0, // `| 0` turns -0 into 0
      y: Math.trunc(f(f(Math.sin(theta)) * adjusted)) | 0,
    });
    theta = f(theta + step);
  }
  return shape;
}

/** Port of tree_cmd.cpp:CreateRandomStarShapedPolygon (four phase draws, in order). */
function createRandomStarShapedPolygon(state: GameState, radius: number): Point[] {
  const phases: number[] = [];
  for (let i = 0; i < 4; i++) phases.push(f(f(nextRandom(state.random)) / PHASE_DIVISOR));
  return createStarShapedPolygon(radius, phases, GROVE_SEGMENTS);
}

/** Port of tree_cmd.cpp:IsPointInTriangle. */
function isPointInTriangle(x: number, y: number, v1: Point, v2: Point, v3: Point): boolean {
  const s = (v1.x - v3.x) * (y - v3.y) - (v1.y - v3.y) * (x - v3.x);
  const t = (v2.x - v1.x) * (y - v1.y) - (v2.y - v1.y) * (x - v1.x);
  if (s < 0 !== t < 0 && s !== 0 && t !== 0) return false;
  const d = (v3.x - v2.x) * (y - v2.y) - (v3.y - v2.y) * (x - v2.x);
  return d < 0 === s + t <= 0;
}

/** Port of tree_cmd.cpp:IsPointInStarShapedPolygon. */
export function isPointInStarShapedPolygon(x: number, y: number, shape: readonly Point[]): boolean {
  const origin = { x: 0, y: 0 };
  for (let i = 0; i < shape.length; i++) {
    const v1 = shape[i]!;
    const v2 = shape[(i + 1) % shape.length]!;
    if (isPointInTriangle(x, y, v1, v2, origin)) return true;
  }
  return false;
}

/** Number of groves from the draw `r`. Port of tree_cmd.cpp:GenerateTrees (num_groups). */
export const treeGroupCount = (map: MapState, r: number): number =>
  scaleBySize(map, (r & 0x1f) + 25);

/** Port of tree_cmd.cpp:PlaceTreeGroups. */
function placeTreeGroups(state: GameState, numGroups: number): void {
  const { map } = state;
  do {
    const centre = randomTile(map, nextRandom(state.random));
    const grove = createRandomStarShapedPolygon(state, GROVE_RADIUS);
    for (let i = 0; i < DEFAULT_TREE_STEPS; i++) {
      const r = nextRandom(state.random);
      const x = (r & 0x1f) - GROVE_RADIUS;
      const y = ((r >>> 8) & 0x1f) - GROVE_RADIUS;
      const cur = tileAddWrap(map, centre, x, y);
      if (cur === INVALID_TILE) continue;
      if (!canPlantTreesOnTile(map, cur, true)) continue;
      if (!isPointInStarShapedPolygon(x, y, grove)) continue;
      placeTree(map, cur, r);
    }
  } while (--numGroups > 0);
}

/** Port of tree_cmd.cpp:PlaceTreeAtSameHeight. */
function placeTreeAtSameHeight(state: GameState, t: number, height: number): void {
  const { map } = state;
  for (let i = 0; i < DEFAULT_TREE_STEPS; i++) {
    const r = nextRandom(state.random);
    const x = (r & 0x1f) - 16;
    const y = ((r >>> 8) & 0x1f) - 16;
    const cur = tileAddWrap(map, t, x, y);
    if (cur === INVALID_TILE) continue;
    if (Math.abs(x) + Math.abs(y) > 16) continue;
    if (!canPlantTreesOnTile(map, cur, true)) continue;
    if (Math.abs(getTileZ(map, cur) - height) > 2) continue;
    placeTree(map, cur, r);
    break;
  }
}

/** Port of tree_cmd.cpp:PlaceTreesRandomly (TP_IMPROVED, temperate). */
function placeTreesRandomly(state: GameState): void {
  const { map } = state;
  let i = scaleBySize(map, DEFAULT_TREE_STEPS);
  do {
    const r = nextRandom(state.random);
    const t = randomTile(map, r);
    if (canPlantTreesOnTile(map, t, true)) {
      placeTree(map, t, r);
      const ht = getTileZ(map, t);
      let j = ht * 2;
      if (WORLD.mapHeightLimit > MAP_HEIGHT_LIMIT_ORIGINAL) {
        j = Math.trunc((j * MAP_HEIGHT_LIMIT_ORIGINAL) / WORLD.mapHeightLimit);
      }
      while (j-- > 0) placeTreeAtSameHeight(state, t, ht);
    }
  } while (--i > 0);
}

/** Port of tree_cmd.cpp:GenerateTrees (TP_IMPROVED, temperate). */
export function generateTrees(state: GameState): void {
  const numGroups = treeGroupCount(state.map, nextRandom(state.random));
  if (numGroups !== 0) placeTreeGroups(state, numGroups);
  for (let i = 2; i !== 0; i--) placeTreesRandomly(state);
}

/** Port of tree_cmd.cpp:TileLoop_Trees (temperate, ETP_SPREAD_ALL). */
export function tileLoopTrees(state: GameState, t: number, markDirty: (t: number) => void): void {
  const { map } = state;
  if (getTreeGround(map, t) === TreeGround.Shore) tileLoopWater(map, t, markDirty);

  const cycle = 11 * tileX(map, t) + 9 * tileY(map, t) + (state.tickCounter >>> 8);

  if ((cycle & 7) === 7 && getTreeGround(map, t) === TreeGround.Grass) {
    const density = getTreeDensity(map, t);
    if (density < 3) {
      setTreeGroundDensity(map, t, TreeGround.Grass, density + 1);
      markDirty(t);
    }
  }

  if (cycle % 16 !== 15) return;

  let tile = t;
  switch (getTreeGrowth(map, tile)) {
    case TreeGrowth.Grown: {
      let draw = nextRandom(state.random) & 7;
      if (draw === 0) {
        addTreeGrowth(map, tile, 1);
        break;
      }
      if (draw === 1) {
        if (getTreeCount(map, tile) < 4) {
          addTreeCount(map, tile, 1);
          setTreeGrowth(map, tile, TreeGrowth.Growing1);
          break;
        }
        draw = 2; // fall through to the neighbouring tree
      }
      if (draw !== 2) return;
      const type = getTreeType(map, tile);
      tile += tileOffsByDir(map, (nextRandom(state.random) % 8) as Dir);
      if (!canPlantTreesOnTile(map, tile, false)) return;
      // Do not plant on freshly cleared ground.
      if (
        getTileType(map, tile) === TileType.Clear &&
        getClearGround(map, tile) === ClearGround.Grass &&
        getClearDensity(map, tile) !== 3
      ) {
        return;
      }
      plantTreesOnTile(map, tile, type, 0, TreeGrowth.Growing1);
      break;
    }
    case TreeGrowth.Dead:
      if (getTreeCount(map, tile) > 1) {
        addTreeCount(map, tile, -1);
        setTreeGrowth(map, tile, TreeGrowth.Grown);
      } else {
        switch (getTreeGround(map, tile)) {
          case TreeGround.Shore:
            makeShore(map, tile);
            break;
          case TreeGround.Grass:
            makeClear(map, tile, ClearGround.Grass, getTreeDensity(map, tile));
            break;
          case TreeGround.Rough:
            makeClear(map, tile, ClearGround.Rough, 3);
            break;
          default:
            makeClear(map, tile, ClearGround.Grass, 3);
            break;
        }
      }
      break;
    default:
      addTreeGrowth(map, tile, 1);
      break;
  }
  markDirty(tile);
}

/** Port of tree_cmd.cpp:DecrementTreeCounter (uint8 underflow). */
function decrementTreeCounter(state: GameState): boolean {
  const old = state.treeTickCounter;
  state.treeTickCounter = (old - scaleBySize(state.map, 1)) & 0xff;
  return old <= state.treeTickCounter;
}

/** Port of tree_cmd.cpp:PlantRandomTree (temperate, no rainforest). */
function plantRandomTree(state: GameState): void {
  const { map } = state;
  const r = nextRandom(state.random);
  const t = randomTile(map, r);
  if (!canPlantTreesOnTile(map, t, false)) return;
  plantTreesOnTile(map, t, randomTreeType(r >>> 24), 0, TreeGrowth.Growing1);
  state.dirtyTiles.add(t);
}

/** Port of tree_cmd.cpp:OnTick_Trees (ETP_SPREAD_ALL, temperate). */
export function onTickTrees(state: GameState): void {
  // Maps below 256×256 skip ticks so the density of new trees stays the same.
  const skip = scaleBySize(state.map, 16);
  if (skip < 16 && (state.tickCounter & (16 / skip - 1)) !== 0) return;
  if (!decrementTreeCounter(state)) return;
  plantRandomTree(state);
}
