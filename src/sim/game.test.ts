import { describe, expect, it } from 'vitest';
import { getClearDensity } from './map/clear';
import { getTileType, TileType, tileXY } from './map/map';
import { createGame, hashGameState, takeDirtyTiles, tick } from './game';

describe('createGame', () => {
  it('builds a flat grass world at height 1 with a void border (FlatEmptyWorld)', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    expect(getTileType(map, tileXY(map, 0, 10))).toBe(TileType.Void);
    expect(getTileType(map, tileXY(map, 63, 10))).toBe(TileType.Void);
    const inner = tileXY(map, 10, 10);
    expect(getTileType(map, inner)).toBe(TileType.Clear);
    expect(map.height[inner]).toBe(1);
    expect(getClearDensity(map, inner)).toBe(3);
  });

  it('starts on 1 January 1950 with the initial loan as cash (DoStartupNewCompany)', () => {
    const game = createGame();
    expect(game.calendar).toEqual({ date: 712223, dateFract: 0, year: 1950, month: 0 });
    expect(game.economy).toEqual(game.calendar);
    expect(game.company).toEqual({ money: 100000, currentLoan: 100000 });
  });
});

describe('tick (port of openttd.cpp:StateGameLoop)', () => {
  it('advances both clocks and the tick counter', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    for (let i = 0; i < 74; i++) tick(game);
    expect([game.tickCounter, game.calendar.date, game.economy.date]).toEqual([74, 712224, 712224]);
  });

  it('does nothing while paused', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    game.paused = true;
    const before = hashGameState(game);
    tick(game);
    expect(hashGameState(game)).toBe(before);
  });

  it('reports tiles changed by the tile loop once', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(game.map, 10, 10);
    game.map.m5[t] = 0; // bare grass, counter 0
    for (let i = 0; i < 256 * 8; i++) tick(game);
    expect(takeDirtyTiles(game)).toContain(t);
    expect(takeDirtyTiles(game)).toEqual([]);
  });
});

const runSeeded = (): string => {
  const game = createGame({ mapLogX: 6, mapLogY: 6, seed: 42 });
  for (let i = 0; i < 74 * 40; i++) tick(game);
  return hashGameState(game);
};

describe('determinism', () => {
  it('produces the same hash for the same seed and ticks', () => {
    expect(runSeeded()).toBe(runSeeded());
    expect(runSeeded()).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes the hash when the state changes', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const before = hashGameState(game);
    tick(game);
    expect(hashGameState(game)).not.toBe(before);
  });
});
