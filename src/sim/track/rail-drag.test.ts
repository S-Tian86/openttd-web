import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, type GameState } from '../game';
import { makeHouseTile } from '../map/house-map';
import { getTileType, tileX, tileXY, tileY, TileType } from '../map/map';
import { getTrackBits } from '../map/rail-map';
import { newTown } from '../town/town';
import { railDragPieces } from './rail-cmd';
import { Track } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const drag = (g: GameState, sx: number, sy: number, ex: number, ey: number, track: Track) =>
  ({
    type: 'buildRailroadTrack',
    endTile: at(g, ex, ey),
    startTile: at(g, sx, sy),
    track,
  }) as const;
const pieces = (g: GameState, sx: number, sy: number, ex: number, ey: number, track: Track) =>
  railDragPieces(g.map, at(g, sx, sy), at(g, ex, ey), track)?.map((p) => [
    tileX(g.map, p.tile),
    tileY(g.map, p.tile),
    p.track,
  ]) ?? null;

describe('drag building (port of rail_cmd.cpp:CmdRailTrackHelper / ValidateAutoDrag)', () => {
  it('walks straight lines either way and staircases for corner pieces', () => {
    const g = newGame();
    expect(pieces(g, 14, 10, 10, 10, Track.X)).toEqual([
      [14, 10, 0],
      [13, 10, 0],
      [12, 10, 0],
      [11, 10, 0],
      [10, 10, 0],
    ]);
    expect(pieces(g, 10, 10, 13, 12, Track.Left)).toEqual([
      [10, 10, 4],
      [11, 10, 5],
      [11, 11, 4],
      [12, 11, 5],
      [12, 12, 4],
      [13, 12, 5],
    ]);
    expect(pieces(g, 10, 10, 12, 13, Track.X)).toBeNull();
    expect(pieces(g, 10, 10, 12, 12, Track.Upper)).toBeNull();
  });

  it('builds a 5-tile line for £450 when the cash is exactly £450', () => {
    const g = newGame();
    g.company.money = 450;
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 450 });
    expect(g.company.money).toBe(0);
  });

  it('builds nothing when the cash is £1 short of the whole drag (Review Focus 2)', () => {
    const g = newGame();
    g.company.money = 449;
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.notEnoughCash', params: { money: 450 } },
    });
    expect([g.company.money, getTileType(g.map, at(g, 10, 10))]).toEqual([449, TileType.Clear]);
  });

  it('skips obstacles at the start and stops at the first one after built track', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeHouseTile(g.map, at(g, 10, 10), 0, 0, 3, 0x06, 0);
    makeHouseTile(g.map, at(g, 13, 10), 0, 0, 3, 0x06, 0);
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 180 });
    expect(getTileType(g.map, at(g, 14, 10))).toBe(TileType.Clear);
  });

  it('counts "already built" as success one tile late, as the code does (R17)', () => {
    const g = newGame();
    execute(g, drag(g, 10, 10, 11, 10, Track.X), 'exec');
    expect(execute(g, drag(g, 10, 10, 11, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 0 });
    expect(execute(g, drag(g, 10, 10, 10, 10, Track.X), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
    expect(execute(g, drag(g, 12, 10, 11, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 90 });
  });

  it('skips the void edge at the start of a drag and refuses a drag that ends on it (CommandHelper::Do)', () => {
    const g = newGame();
    expect(execute(g, drag(g, 0, 10, 3, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 270 });
    expect(getTileType(g.map, at(g, 0, 10))).toBe(TileType.Void);
    expect(execute(g, drag(g, 3, 11, 0, 11, Track.X), 'exec')).toEqual({ ok: false, error: null });
    expect(getTileType(g.map, at(g, 3, 11))).toBe(TileType.Clear);
  });

  it('removes along a drag for a refund, and fails over empty land', () => {
    const g = newGame();
    execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec');
    const remove = {
      type: 'removeRailroadTrack',
      endTile: at(g, 14, 10),
      startTile: at(g, 10, 10),
      track: Track.X,
    } as const;
    expect(execute(g, remove, 'exec')).toEqual({ ok: true, cost: -265 });
    expect(getTrackBits(g.map, at(g, 12, 10))).toBe(0);
    expect(execute(g, remove, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.noRailroadTrack', params: {} },
    });
  });
});
