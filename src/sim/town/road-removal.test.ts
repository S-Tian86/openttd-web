import { describe, expect, it } from 'vitest';
import { DoFlag } from '../command/cost';
import { createEmptyGame, type GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { execute } from '../command/command';
import { COMPANY_FIRST, getTileType, tileXY, TileType } from '../map/map';
import { getRoadBits, makeRoadNormal, RoadBits } from '../map/road-map';
import { newTown } from './town';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);

describe('town roads and the bulldozer (road_cmd.cpp, R33)', () => {
  it('refuses to demolish a town road and leaves it untouched (D2)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.X, 0);
    makeRoadNormal(g.map, at(g, 20, 22), RoadBits.NE, 0);
    const refused = {
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    };
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 20, 21) }, 'exec')).toEqual(refused);
    expect(landscapeClear(g, at(g, 20, 22), DoFlag.None, COMPANY_FIRST)).toEqual(refused); // even a stub
    expect([getRoadBits(g.map, at(g, 20, 21)), g.company.clearLimit]).toEqual([
      RoadBits.X,
      4096 << 16,
    ]);
  });

  it('skips town roads in an area, silently unless nothing else was cleared', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.X, 0);
    const area = (ex: number) =>
      ({
        type: 'clearArea',
        endTile: at(g, ex, 21),
        startTile: at(g, 20, 21),
        diagonal: false,
      }) as const;
    expect(execute(g, area(21), 'exec')).toEqual({ ok: true, cost: 15 });
    expect(getTileType(g.map, at(g, 20, 21))).toBe(TileType.Road);
    expect(execute(g, area(20), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    });
  });

  it('lets builders remove a one-piece stub only (ClearTile_Road with Auto, R16)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.NE, 0);
    makeRoadNormal(g.map, at(g, 20, 22), RoadBits.X, 0);
    expect(landscapeClear(g, at(g, 20, 21), DoFlag.Auto, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: 30,
    });
    expect(landscapeClear(g, at(g, 20, 22), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRoadFirst', params: {} },
    });
  });
});
