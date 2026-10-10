import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, tick, type GameState } from '../game';
import { getClearDensity } from '../map/clear';
import { tileLoopWater } from '../map/flood';
import { getTileType, tileXY, TileType } from '../map/map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis } from '../track/track';
import { isInUse } from './station';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const build = (g: GameState, x: number, y: number, platLength: number) =>
  execute(
    g,
    { type: 'buildRailStation', tile: at(g, x, y), axis: Axis.X, numTracks: 1, platLength },
    'exec',
  );
const removePart = (g: GameState, x1: number, x2: number, y: number) =>
  execute(g, { type: 'removeFromRailStation', start: at(g, x1, y), end: at(g, x2, y) }, 'exec');

const grayAt = (g: GameState, x: number, y: number): void => {
  build(g, x, y, 1);
  execute(g, { type: 'landscapeClear', tile: at(g, x, y) }, 'exec');
};

describe('removing stations (station_cmd.cpp)', () => {
  it('bulldozes the whole station for £37 a tile with no rail refund', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 24, 30) }, 'test')).toEqual({
      ok: true,
      cost: 185,
    });
    execute(g, { type: 'landscapeClear', tile: at(g, 24, 30) }, 'exec');
    expect(
      [22, 26].map((x) => [getTileType(g.map, at(g, x, 30)), getClearDensity(g.map, at(g, x, 30))]),
    ).toEqual([
      [TileType.Clear, 0],
      [TileType.Clear, 0],
    ]);
    const st = g.stations[0]!;
    expect([isInUse(st), st.trainStation, st.facilities, g.company.infrastructure]).toEqual([
      false,
      null,
      0,
      { rail: 0, station: 0 },
    ]);
  });

  it('removes part of a platform for £37 a tile and shrinks the station (R19)', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    expect(removePart(g, 22, 23, 30)).toEqual({ ok: true, cost: 74 });
    expect([g.stations[0]!.trainStation, g.stations[0]!.xy]).toEqual([
      { tile: at(g, 24, 30), w: 3, h: 1 },
      at(g, 24, 30),
    ]);
    removePart(g, 25, 25, 30); // a middle tile leaves the area as it is
    expect(g.stations[0]!.trainStation).toEqual({ tile: at(g, 24, 30), w: 3, h: 1 });
    expect(removePart(g, 30, 32, 40)).toEqual({
      ok: false,
      error: { key: 'error.noStation', params: {} },
    });
  });

  it('counts small ticks 0..184 while the station is in use (StationHandleSmallTick)', () => {
    const g = newGame();
    build(g, 22, 30, 1);
    for (let i = 0; i < 184; i++) tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(184);
    tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(0);
  });

  it('deletes an unused station on its eighth big tick and frees its name (StationHandleBigTick)', () => {
    const g = newGame();
    build(g, 22, 20, 1);
    execute(g, { type: 'landscapeClear', tile: at(g, 22, 20) }, 'exec');
    build(g, 12, 20, 1); // too far (8) to revive station 0
    expect(g.stations[1]!.nameKind).toBe('east'); // "town" is still held by the unused station
    for (let i = 0; i < 1999; i++) tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(7);
    tick(g); // tick 2000 = (counter + index 0) % 250 === 0 for the eighth time
    expect(g.stations[0]).toBeNull();
    build(g, 22, 24, 1);
    expect([g.stations[0]!.index, g.stations[0]!.nameKind]).toEqual([0, 'town']);
  });

  it('leaves the world untouched in test mode', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    const before = hashGameState(g);
    expect(
      execute(
        g,
        { type: 'removeFromRailStation', start: at(g, 22, 30), end: at(g, 26, 30) },
        'test',
      ),
    ).toEqual({ ok: true, cost: 185 });
    expect(hashGameState(g)).toBe(before);
  });

  it('leaves the world untouched when the bulldozer runs in test mode', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    const before = hashGameState(g);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 24, 30) }, 'test')).toEqual({
      ok: true,
      cost: 185,
    });
    expect(hashGameState(g)).toBe(before);
  });

  it('shrinks the area from the right, top and bottom sides', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    removePart(g, 26, 26, 30);
    expect(g.stations[0]!.trainStation).toEqual({ tile: at(g, 22, 30), w: 4, h: 1 });
    const h = newGame();
    execute(
      h,
      { type: 'buildRailStation', tile: at(h, 22, 30), axis: Axis.X, numTracks: 2, platLength: 3 },
      'exec',
    );
    removePart(h, 22, 24, 31); // bottom row
    expect(h.stations[0]!.trainStation).toEqual({ tile: at(h, 22, 30), w: 3, h: 1 });
    const k = newGame();
    execute(
      k,
      { type: 'buildRailStation', tile: at(k, 22, 30), axis: Axis.X, numTracks: 2, platLength: 3 },
      'exec',
    );
    removePart(k, 22, 24, 30); // top row
    expect(k.stations[0]!.trainStation).toEqual({ tile: at(k, 22, 30 + 1), w: 3, h: 1 });
  });

  it('accepts a drag ending on a void border tile like C++ (only end >= map size fails)', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    const border = at(g, 63, 63); // the last row and column are void
    expect(getTileType(g.map, border)).toBe(TileType.Void);
    expect(
      execute(g, { type: 'removeFromRailStation', start: at(g, 22, 30), end: border }, 'test').ok,
    ).toBe(true);
    expect(
      execute(g, { type: 'removeFromRailStation', start: at(g, 22, 30), end: g.map.size }, 'test'),
    ).toEqual({ ok: false, error: null });
  });

  describe('reusing an unused station (GetClosestDeletedStation)', () => {
    it('revives it within distance 7, keeping its name and index', () => {
      const g = newGame();
      grayAt(g, 22, 20);
      build(g, 15, 20, 1);
      expect([g.stations.length, isInUse(g.stations[0]!), g.stations[0]!.nameKind]).toEqual([
        1,
        true,
        'town',
      ]);
      expect(g.stations[0]!.xy).toBe(at(g, 15, 20));
    });

    it('does not revive it at distance 8', () => {
      const g = newGame();
      grayAt(g, 22, 20);
      build(g, 14, 20, 1);
      expect([g.stations.length, isInUse(g.stations[0]!)]).toEqual([2, false]);
    });

    it('prefers the lowest index on a tie', () => {
      const g = newGame();
      grayAt(g, 22, 20);
      grayAt(g, 22, 28);
      build(g, 22, 24, 1);
      expect([isInUse(g.stations[0]!), isInUse(g.stations[1]!)]).toEqual([true, false]);
    });

    it('prefers the closer one over a lower index', () => {
      const g = newGame();
      grayAt(g, 22, 20);
      grayAt(g, 22, 28);
      build(g, 22, 26, 1);
      expect([isInUse(g.stations[0]!), isInUse(g.stations[1]!)]).toEqual([false, true]);
    });

    it('never reuses a station that is in use', () => {
      const g = newGame();
      build(g, 22, 20, 1);
      build(g, 22, 24, 1);
      expect(g.stations.length).toBe(2);
    });

    it('does not revive in test mode', () => {
      const g = newGame();
      grayAt(g, 22, 20);
      const before = hashGameState(g);
      execute(
        g,
        {
          type: 'buildRailStation',
          tile: at(g, 18, 20),
          axis: Axis.X,
          numTracks: 1,
          platLength: 1,
        },
        'test',
      );
      expect(hashGameState(g)).toBe(before);
    });
  });

  it('loses a platform tile to the sea (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    build(g, 11, 11, 1);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), isInUse(g.stations[0]!)]).toEqual([true, false]);
  });
});
