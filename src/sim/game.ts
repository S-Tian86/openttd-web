import { createRandomizer, type Randomizer } from './core/random';
import {
  createCompany,
  DEFAULT_MAX_LOAN,
  economyMaxLoan,
  updateLandscapingLimit,
  type CompanyState,
} from './economy/company';
import { computePrices, INFLATION_ONE, type Prices } from './economy/prices';
import { ClearGround, makeClear, tileLoopClear } from './map/clear';
import { createMap, isInnerTile, makeVoid, TileType, type MapState } from './map/map';
import { tileLoopVoid, tileLoopWater } from './map/flood';
import type { Town } from './town/town';
import { tileLoopIndustry, type Industry } from './industry/industry-gen';
import { tileLoopTown } from './town/houses';
import { tileLoopRoad } from './town/town-roads';
import { onTickTrees, tileLoopTrees } from './world/trees';
import { runTileLoop, type TileLoopProcs } from './map/tile-loop';
import { advanceDate, createDateState, type DateState } from './time/clock';
import { DEF_START_YEAR } from './time/date';

export interface GameOptions {
  mapLogX: number;
  mapLogY: number;
  seed: number;
  startingYear: number;
  /** difficulty.number_towns, 0..3. */
  townCount: number;
  /** difficulty.industry_density, 0..5. */
  industryDensity: number;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  mapLogX: 8,
  mapLogY: 8,
  seed: 0,
  startingYear: DEF_START_YEAR,
  townCount: 2,
  industryDensity: 4,
};

export interface GameState {
  options: GameOptions;
  random: Randomizer;
  map: MapState;
  /** Port of TimerGameTick::counter. */
  tickCounter: number;
  calendar: DateState;
  economy: DateState;
  paused: boolean;
  company: CompanyState;
  /** Derived from the settings (port of _price); not hashed. */
  prices: Prices;
  /** Tiles to redraw (port of MarkTileDirtyByTile). Transient: not part of the hash. */
  dirtyTiles: Set<number>;
  /** Port of _settings_game.game_creation.initial_land_count; 0 until generated. */
  initialLandCount: number;
  /** Port of tree_cmd.cpp:_trees_tick_ctr (uint8). */
  treeTickCounter: number;
  towns: Town[];
  industries: Industry[];
}

/** Allocates the map and seeds the generator; no tile is touched. Port of misc.cpp:InitializeGame. */
export function newGameState(options: GameOptions): GameState {
  return {
    options,
    random: createRandomizer(options.seed),
    map: createMap(options.mapLogX, options.mapLogY),
    tickCounter: 0,
    calendar: createDateState(options.startingYear),
    economy: createDateState(options.startingYear),
    paused: false,
    company: createCompany(economyMaxLoan(DEFAULT_MAX_LOAN, INFLATION_ONE)),
    prices: computePrices(0, 0, INFLATION_ONE),
    dirtyTiles: new Set(),
    initialLandCount: 0,
    treeTickCounter: 0,
    towns: [],
    industries: [],
  };
}

/** Flat land at height 1, void border. Port of heightmap.cpp:FlatEmptyWorld (flat height 1). */
export function createEmptyGame(options: Partial<GameOptions> = {}): GameState {
  const state = newGameState({ ...DEFAULT_GAME_OPTIONS, ...options });
  const { map } = state;
  for (let t = 0; t < map.size; t++) {
    if (isInnerTile(map, t)) {
      makeClear(map, t, ClearGround.Grass, 3);
    } else {
      makeVoid(map, t);
    }
    map.height[t] = 1; // FlatEmptyWorld raises every row and column, the void border too
  }
  return state;
}

/** The tile-loop handlers of the tile types that exist so far. */
export function tileLoopProcs(state: GameState): TileLoopProcs {
  const markDirty = (t: number): void => void state.dirtyTiles.add(t);
  return {
    [TileType.Clear]: (t) => tileLoopClear(state.map, t, markDirty),
    [TileType.Water]: (t) => tileLoopWater(state.map, t, markDirty),
    [TileType.House]: (t) => tileLoopTown(state, t, markDirty),
    [TileType.Road]: (t) => tileLoopRoad(state, t, markDirty),
    [TileType.Trees]: (t) => tileLoopTrees(state, t, markDirty),
    [TileType.Industry]: (t) => tileLoopIndustry(state, t, markDirty),
    [TileType.Void]: (t) => tileLoopVoid(state.map, t, markDirty),
  };
}

/** One game tick, in OpenTTD's order. Port of openttd.cpp:StateGameLoop. */
export function tick(state: GameState): void {
  if (state.paused) {
    updateLandscapingLimit(state.company);
    return;
  }
  advanceDate(state.calendar);
  advanceDate(state.economy);
  state.tickCounter++;
  runTileLoop(state.map, state.tickCounter, tileLoopProcs(state));
  onTickTrees(state);
  updateLandscapingLimit(state.company);
}

/** Returns the tiles to redraw since the last call and forgets them. */
export function takeDirtyTiles(state: GameState): number[] {
  const tiles = [...state.dirtyTiles];
  state.dirtyTiles.clear();
  return tiles;
}

/** FNV-1a (32-bit) over the whole persistent state. Used by replay tests. */
export function hashGameState(state: GameState): string {
  let h = 0x811c9dc5;
  const byte = (b: number): void => {
    h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0;
  };
  const num = (n: number): void => {
    const s = String(n);
    for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i));
    byte(0x2c);
  };
  const { map } = state;
  for (const arr of [map.type, map.height, map.m1, map.m3, map.m4, map.m5, map.m6, map.m7]) {
    for (let i = 0; i < arr.length; i++) byte(arr[i]!);
  }
  for (const arr of [map.m2, map.m8]) {
    for (let i = 0; i < arr.length; i++) {
      byte(arr[i]!);
      byte(arr[i]! >>> 8);
    }
  }
  const o = state.options;
  [o.mapLogX, o.mapLogY, o.seed, o.startingYear].forEach(num);
  [o.townCount, o.industryDensity, state.initialLandCount].forEach(num);
  num(state.treeTickCounter);
  [state.random.state0, state.random.state1, map.tileLoopTile, state.tickCounter].forEach(num);
  for (const d of [state.calendar, state.economy])
    [d.date, d.dateFract, d.year, d.month].forEach(num);
  for (const town of state.towns) {
    [town.index, town.xy, town.nameParts, town.isCity ? 1 : 0].forEach(num);
    [town.numHouses, town.population, ...town.squaredZoneRadius, town.flags].forEach(num);
  }
  for (const i of state.industries) {
    [i.index, i.type, i.tile, i.width, i.height, i.townIndex, i.layoutIndex].forEach(num);
    [i.productionRate, i.counter, i.randomColour, i.random, i.prodLevel].forEach(num);
  }
  const c = state.company;
  [state.paused ? 1 : 0, c.money, c.currentLoan, c.maxLoan, c.clearLimit].forEach(num);
  c.yearlyExpenses.forEach((year) => year.forEach(num));
  [c.infrastructure.rail, c.infrastructure.station].forEach(num);
  return h.toString(16).padStart(8, '0');
}
