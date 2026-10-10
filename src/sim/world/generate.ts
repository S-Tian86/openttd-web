import {
  DEFAULT_GAME_OPTIONS,
  newGameState,
  tileLoopProcs,
  type GameOptions,
  type GameState,
} from '../game';
import { convertGroundTilesIntoWaterTiles } from '../map/flood';
import { runTileLoop } from '../map/tile-loop';
import { isWaterTile } from '../map/water';
import type { MapState } from '../map/map';
import { generateClearTile } from './clear-gen';
import { generateTowns } from '../town/town-gen';
import { generateTerrain } from './tgp';
import { generateTrees } from './trees';

export interface GenerationProgress {
  /** 0..1, rising. */
  fraction: number;
}

/** Tile-loop passes after generation so grass, trees and shores settle. Port of genworld.cpp (0x500). */
export const SETTLE_PASSES = 0x500;

/** Port of map.cpp:Map::CountLandTiles (coast and void count as land). */
export function countLandTiles(map: MapState): number {
  let land = 0;
  for (let t = 0; t < map.size; t++) if (!isWaterTile(map, t)) land++;
  return Math.min(land + Math.floor(land / 12), map.size);
}

/**
 * Builds a new world in OpenTTD's order, yielding progress between steps.
 * Port of genworld.cpp:_GenerateWorld (new game, TerraGenesis, temperate).
 */
export function* generateGame(
  options: Partial<GameOptions> = {},
): Generator<GenerationProgress, GameState, void> {
  const state = newGameState({ ...DEFAULT_GAME_OPTIONS, ...options });
  // Step 2 (StartupEconomy's draw) is not replicated: it has no effect on the map (ruling R1).
  generateTerrain(state.map, state.random, state.options.seed >>> 0);
  yield { fraction: 0.2 };
  convertGroundTilesIntoWaterTiles(state.map);
  // CreateRivers is skipped: no spring exists on a two-level map (world-generation.md §4.8, ruling R1).
  generateClearTile(state.map, state.random);
  state.initialLandCount = countLandTiles(state.map);
  yield { fraction: 0.25 };
  for (const p of generateTowns(state)) yield { fraction: 0.25 + 0.3 * p };
  // Industries (Task 10) are inserted here, before the trees.
  generateTrees(state);
  yield { fraction: 0.8 };
  const procs = tileLoopProcs(state);
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    runTileLoop(state.map, state.tickCounter, procs);
    state.tickCounter++;
    if (pass % 64 === 63) yield { fraction: 0.8 + (0.2 * (pass + 1)) / SETTLE_PASSES };
  }
  state.dirtyTiles.clear();
  return state;
}

/** Runs generateGame to the end. */
export function createGame(options: Partial<GameOptions> = {}): GameState {
  const gen = generateGame(options);
  let step = gen.next();
  while (step.done !== true) step = gen.next();
  return step.value;
}
