import { createRandomizer, type Randomizer } from './core/random';
import { createCompany, DEFAULT_MAX_LOAN, type CompanyState } from './economy/company';
import { ClearGround, makeClear, tileLoopClear } from './map/clear';
import { createMap, isInnerTile, makeVoid, TileType, type MapState } from './map/map';
import { tileLoopVoid, tileLoopWater } from './map/flood';
import { runTileLoop } from './map/tile-loop';
import { advanceDate, createDateState, type DateState } from './time/clock';
import { DEF_START_YEAR } from './time/date';

export interface GameOptions {
  mapLogX: number;
  mapLogY: number;
  seed: number;
  startingYear: number;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  mapLogX: 8,
  mapLogY: 8,
  seed: 0,
  startingYear: DEF_START_YEAR,
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
  /** Tiles to redraw (port of MarkTileDirtyByTile). Transient: not part of the hash. */
  dirtyTiles: Set<number>;
}

/** Flat land at height 1, void border. Port of heightmap.cpp:FlatEmptyWorld (flat height 1). */
export function createEmptyGame(options: Partial<GameOptions> = {}): GameState {
  const opts = { ...DEFAULT_GAME_OPTIONS, ...options };
  const map = createMap(opts.mapLogX, opts.mapLogY);
  for (let t = 0; t < map.size; t++) {
    if (isInnerTile(map, t)) {
      makeClear(map, t, ClearGround.Grass, 3);
    } else {
      makeVoid(map, t);
    }
    map.height[t] = 1; // FlatEmptyWorld raises every row and column, the void border too
  }
  return {
    options: opts,
    random: createRandomizer(opts.seed),
    map,
    tickCounter: 0,
    calendar: createDateState(opts.startingYear),
    economy: createDateState(opts.startingYear),
    paused: false,
    company: createCompany(DEFAULT_MAX_LOAN),
    dirtyTiles: new Set(),
  };
}

/** Replaced by the world generator in Task 4. */
export const createGame = createEmptyGame;

/** One game tick, in OpenTTD's order. Port of openttd.cpp:StateGameLoop. */
export function tick(state: GameState): void {
  if (state.paused) return;
  advanceDate(state.calendar);
  advanceDate(state.economy);
  state.tickCounter++;
  const markDirty = (t: number): void => void state.dirtyTiles.add(t);
  runTileLoop(state.map, state.tickCounter, {
    [TileType.Clear]: (t) => tileLoopClear(state.map, t, markDirty),
    [TileType.Water]: (t) => tileLoopWater(state.map, t, markDirty),
    [TileType.Void]: (t) => tileLoopVoid(state.map, t, markDirty),
  });
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
  [state.random.state0, state.random.state1, map.tileLoopTile, state.tickCounter].forEach(num);
  for (const d of [state.calendar, state.economy])
    [d.date, d.dateFract, d.year, d.month].forEach(num);
  [state.paused ? 1 : 0, state.company.money, state.company.currentLoan].forEach(num);
  return h.toString(16).padStart(8, '0');
}
