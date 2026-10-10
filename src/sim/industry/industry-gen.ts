import { nextRandom, randomRange } from '../core/random';
import type { GameState } from '../game';
import {
  distanceMax,
  isValidTile,
  randomTile,
  scaleByLandProportion,
  scaleBySize,
  scaleBySize1D,
  tileAddWrap,
} from '../map/geometry';
import {
  getIndustryConstructionCounter,
  getIndustryConstructionStage,
  INDUSTRY_COMPLETED,
  isIndustryCompleted,
  makeIndustry,
  setIndustryCompleted,
  setIndustryConstructionCounter,
  setIndustryConstructionStage,
} from '../map/industry-map';
import { canAutoClear, doClearSquare } from '../map/landscape';
import { tileXY, tileX, tileY, type MapState } from '../map/map';
import { hasTileWaterClass, isTileOnWater } from '../map/water';
import { closestTownFromTile } from '../town/town';
import {
  INDUSTRY_SPECS,
  IndustryType,
  type LayoutTile,
  PRODLEVEL_DEFAULT,
  TEMPERATE_LAND_INDUSTRIES,
} from './industry-specs';

/** Port of the Stage 1 subset of industry.h:Industry. */
export interface Industry {
  index: number;
  type: IndustryType;
  /** North tile (the tile the layout offsets are relative to). */
  tile: number;
  width: number;
  height: number;
  townIndex: number;
  layoutIndex: number;
  productionRate: number;
  counter: number;
  randomColour: number;
  random: number;
  prodLevel: number;
}

/** Port of settings: construction.industry_platform (default). */
const INDUSTRY_PLATFORM = 1;

/** Port of industry_cmd.cpp:GetNumberOfIndustries (difficulty.industry_density 0..5). */
export function numberOfIndustries(map: MapState, density: number): number {
  const table = [0, 0, 10, 25, 55, 80];
  return Math.min(64000, scaleBySize(map, table[density]!));
}

/**
 * The counts of GenerateIndustries for the land pass: scaled probabilities, the types forced once,
 * and the number of weighted picks left. The water pass places nothing in temperate (all creation
 * chances are 0). Port of industry_cmd.cpp:GenerateIndustries.
 */
export function industryGenerationPlan(
  map: MapState,
  density: number,
  initialLandCount: number,
): { probs: number[]; total: number; forced: number[]; randomPicks: number } | null {
  if (density === 0) return null; // ID_FUND_ONLY
  const probs = TEMPERATE_LAND_INDUSTRIES.map((s) =>
    s.scale1D ? scaleBySize1D(map, s.chance * 16) : scaleBySize(map, s.chance * 16),
  );
  const total = probs.reduce((a, b) => a + b, 0);
  const forced = TEMPERATE_LAND_INDUSTRIES.filter((_, i) => probs[i]! > 0).map(
    (s) => s.openttdType,
  );
  let amount = total > 0 ? Math.floor((total * numberOfIndustries(map, density)) / total) : 0; // water total is 0
  amount = scaleByLandProportion(amount, initialLandCount, map.size);
  if (total === 0 || amount < forced.length) amount = forced.length;
  return { probs, total, forced, randomPicks: amount - forced.length };
}

/**
 * Port of industry_cmd.cpp:CheckIfCanLevelIndustryPlatform under ruling R11: the site must already
 * be level (no terraforming), so every vertex of the platform area needs the north tile's height.
 */
export function industryPlatformIsLevel(
  map: MapState,
  t: number,
  layout: readonly LayoutTile[],
): boolean {
  let maxX = 0;
  let maxY = 0;
  for (const it of layout) {
    if (it.dx > maxX) maxX = it.dx;
    if (it.dy > maxY) maxY = it.dy;
  }
  const h = map.height[t]!;
  const x = tileX(map, t);
  const y = tileY(map, t);
  if (x <= INDUSTRY_PLATFORM + 1 || y <= INDUSTRY_PLATFORM + 1) return false;
  const left = x - INDUSTRY_PLATFORM;
  const top = y - INDUSTRY_PLATFORM;
  const w = maxX + 2 + 2 * INDUSTRY_PLATFORM;
  const ht = maxY + 2 + 2 * INDUSTRY_PLATFORM;
  if (left + w >= map.sizeX - 1 || top + ht >= map.sizeY - 1) return false;
  for (let yy = top; yy < top + ht; yy++) {
    for (let xx = left; xx < left + w; xx++) {
      if (map.height[tileXY(map, xx, yy)] !== h) return false;
    }
  }
  return true;
}

/** Port of industry_cmd.cpp:CheckIfFarEnoughFromConflictingIndustry. */
function isFarEnoughFromConflicting(state: GameState, t: number, type: IndustryType): boolean {
  const conflicting = INDUSTRY_SPECS[type]!.conflicting;
  for (const other of state.industries) {
    if (other.type !== conflicting) continue;
    if (distanceMax(state.map, t, other.tile) <= 14) return false; // within 14 tiles is close
  }
  return true;
}

/** Port of industry_cmd.cpp:CheckIfIndustryTilesAreFree (land industries; no vehicles or bridges yet). */
function industryTilesAreFree(map: MapState, t: number, layout: readonly LayoutTile[]): boolean {
  for (const it of layout) {
    const cur = tileAddWrap(map, t, it.dx, it.dy);
    if (cur === -1 || !isValidTile(map, cur)) return false;
    // Land industries (no BuiltOnWater behaviour) cannot stand on water.
    if (hasTileWaterClass(map, cur) && isTileOnWater(map, cur)) return false;
    if (!canAutoClear(map, cur, false)) return false;
  }
  return true;
}

/** Port of industry_cmd.cpp:DoCreateNewIndustry (+ the tile planting of the generation case). */
function doCreateNewIndustry(
  state: GameState,
  t: number,
  type: IndustryType,
  layoutIndex: number,
  townIndex: number,
  initialRandomBits: number,
): Industry {
  const { map, random } = state;
  const spec = INDUSTRY_SPECS[type]!;
  const layout = spec.layouts[layoutIndex]!;
  let productionRate = spec.productionRate;
  // Smooth economy: the initial production of a produced cargo is randomised.
  if (productionRate > 0) {
    productionRate = Math.min(255, ((randomRange(random, 256) + 128) * productionRate) >> 8);
  }
  const r = nextRandom(random) & 0xffff;
  const index = state.industries.length;
  let width = 0;
  let height = 0;
  for (const it of layout) {
    width = Math.max(width, it.dx + 1);
    height = Math.max(height, it.dy + 1);
    const cur = tileAddWrap(map, t, it.dx, it.dy);
    doClearSquare(map, cur, true);
    makeIndustry(map, cur, index, it.gfx, nextRandom(random) & 0xff);
    setIndustryConstructionCounter(map, cur, 3); // generation: nearly finished
    setIndustryConstructionStage(map, cur, 2);
    state.dirtyTiles.add(cur);
  }
  const industry: Industry = {
    index,
    type,
    tile: t,
    width,
    height,
    townIndex,
    layoutIndex,
    productionRate,
    counter: (r >>> 4) & 0xfff,
    randomColour: r & 0xf,
    random: initialRandomBits,
    prodLevel: PRODLEVEL_DEFAULT,
  };
  state.industries.push(industry);
  return industry;
}

/**
 * Port of industry_cmd.cpp:CreateNewIndustry + CreateNewIndustryHelper. The NewGRF random_var8f draw
 * is not replicated (ruling R1). Returns null when a check fails.
 */
export function createNewIndustry(
  state: GameState,
  t: number,
  type: IndustryType,
): Industry | null {
  const spec = INDUSTRY_SPECS[type]!;
  const initialRandomBits = nextRandom(state.random) & 0xffff;
  const layoutIndex = randomRange(state.random, spec.layouts.length);
  const layout = spec.layouts[layoutIndex]!;

  if (!isFarEnoughFromConflicting(state, t, type)) return null;
  // FindTownForIndustry: one industry of a type per town (multiple_industry_per_town is off).
  const town = closestTownFromTile(state, t, Infinity);
  if (town === undefined) return null;
  if (state.industries.some((i) => i.type === type && i.townIndex === town.index)) return null;
  if (!industryTilesAreFree(state.map, t, layout)) return null;
  // check_proc is CHECK_NOTHING for both types; CheckIfIndustryTileSlopes passes under TerraGenesis.
  if (!industryPlatformIsLevel(state.map, t, layout)) return null;
  return doCreateNewIndustry(state, t, type, layoutIndex, town.index, initialRandomBits);
}

/** Port of industry_cmd.cpp:PlaceIndustry (+ PlaceInitialIndustry; other types place nothing). */
function placeInitialIndustry(state: GameState, type: IndustryType | null, tryHard: boolean): void {
  if (type === null) return;
  for (let tries = tryHard ? 10000 : 2000; tries > 0; tries--) {
    const t = randomTile(state.map, nextRandom(state.random));
    if (createNewIndustry(state, t, type) !== null) return;
  }
}

/** Port of industry_cmd.cpp:GenerateIndustries. Yields its progress in 0..1. */
export function* generateIndustries(state: GameState): Generator<number, void, void> {
  const plan = industryGenerationPlan(
    state.map,
    state.options.industryDensity,
    state.initialLandCount,
  );
  if (plan === null) return;
  const steps = plan.forced.length + plan.randomPicks;
  let done = 0;
  for (const [i, spec] of TEMPERATE_LAND_INDUSTRIES.entries()) {
    if (plan.probs[i] === 0) continue;
    placeInitialIndustry(state, spec.stage1, true);
    done++;
    yield done / steps;
  }
  for (let n = 0; n < plan.randomPicks; n++) {
    let r = randomRange(state.random, plan.total);
    let i = 0;
    while (r >= plan.probs[i]!) {
      r -= plan.probs[i]!;
      i++;
    }
    placeInitialIndustry(state, TEMPERATE_LAND_INDUSTRIES[i]!.stage1, false);
    done++;
    yield done / steps;
  }
}

/** Port of industry_cmd.cpp:TileLoop_Industry (construction only; production is block 1.5). */
export function tileLoopIndustry(
  state: GameState,
  t: number,
  markDirty: (t: number) => void,
): void {
  const { map } = state;
  if (isIndustryCompleted(map, t)) return;
  // Port of MakeIndustryTileBigger.
  const counter = getIndustryConstructionCounter(map, t) + 1;
  if (counter !== 4) {
    setIndustryConstructionCounter(map, t, counter);
    return;
  }
  const stage = getIndustryConstructionStage(map, t) + 1;
  setIndustryConstructionCounter(map, t, 0);
  setIndustryConstructionStage(map, t, stage);
  if (stage === INDUSTRY_COMPLETED) setIndustryCompleted(map, t);
  markDirty(t);
}
