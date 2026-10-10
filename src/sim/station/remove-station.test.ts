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
    build(g, 16, 20, 1);
    expect(g.stations[1]!.nameKind).toBe('central'); // "town" is still held by the unused station
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
    execute(g, { type: 'removeFromRailStation', start: at(g, 22, 30), end: at(g, 26, 30) }, 'test');
    expect(hashGameState(g)).toBe(before);
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
