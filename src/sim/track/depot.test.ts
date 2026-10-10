import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { getClearDensity } from '../map/clear';
import { tileLoopWater } from '../map/flood';
import { DiagDir } from '../map/geometry';
import { makeHouseTile } from '../map/house-map';
import { getTileType, tileXY, TileType } from '../map/map';
import { makeTree, TreeGrowth, TreeGround } from '../map/tree-map';
import { getRailDepotDirection, isRailDepotTile } from '../map/rail-map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { depotExtraRail } from './depot';
import { Track } from './track';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const depot = (g: GameState, t: number, dir: DiagDir, mode: 'test' | 'exec' = 'exec') =>
  execute(g, { type: 'buildTrainDepot', tile: t, dir }, mode);

describe('train depots (port of rail_cmd.cpp:CmdBuildTrainDepot)', () => {
  it('costs £450 + £75 + clearing and is named after the closest town', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    const before = hashGameState(g);
    expect(depot(g, t, DiagDir.NW, 'test')).toEqual({ ok: true, cost: 540 });
    expect(hashGameState(g)).toBe(before);
    expect(depot(g, t, DiagDir.NW)).toEqual({ ok: true, cost: 540 });
    expect([
      isRailDepotTile(g.map, t),
      g.map.m5[t],
      g.map.m2[t],
      g.company.infrastructure.rail,
    ]).toEqual([true, 0xc3, 0, 1]);
    expect(g.depots).toEqual([
      { index: 0, xy: t, townIndex: 0, townCn: 0, buildDate: g.calendar.date },
    ]);
  });

  it('is refused on a town-less game before anything changes (S2: OpenTTD assumes a town)', () => {
    const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = at(g, 22, 22);
    const before = hashGameState(g);
    expect([depot(g, t, DiagDir.NW, 'test'), depot(g, t, DiagDir.NW)]).toEqual([
      { ok: false, error: null },
      { ok: false, error: null },
    ]);
    expect(hashGameState(g)).toBe(before);
  });

  it('numbers depots per town and reuses freed numbers and slots (MakeDefaultName)', () => {
    const g = newGame();
    depot(g, at(g, 22, 22), DiagDir.NW);
    depot(g, at(g, 24, 24), DiagDir.NW);
    expect(g.depots.map((d) => d?.townCn)).toEqual([0, 1]);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 22, 22) }, 'exec')).toEqual({
      ok: true,
      cost: 60,
    });
    expect(g.depots[0]).toBeNull();
    depot(g, at(g, 26, 26), DiagDir.NW);
    expect([g.depots[0]?.xy, g.depots[0]?.townCn]).toEqual([at(g, 26, 26), 0]);
  });

  it('rotates its own depot for £525 and charges nothing for the same direction', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    depot(g, t, DiagDir.NW);
    expect(depot(g, t, DiagDir.NE)).toEqual({ ok: true, cost: 525 });
    expect(getRailDepotDirection(g.map, t)).toBe(DiagDir.NE);
    expect(depot(g, t, DiagDir.NE)).toEqual({ ok: true, cost: 0 });
    expect(g.company.infrastructure.rail).toBe(1);
  });

  it('refuses slopes, water, houses and track (R26)', () => {
    const g = newGame();
    g.map.height[at(g, 41, 41)] = 0;
    makeSea(g.map, at(g, 30, 30));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    execute(g, { type: 'buildRail', tile: at(g, 10, 10), track: Track.X }, 'exec');
    expect(
      [at(g, 40, 40), at(g, 30, 30), at(g, 21, 20), at(g, 10, 10)].map((t) =>
        depot(g, t, DiagDir.NW, 'test'),
      ),
    ).toEqual([
      { ok: false, error: { key: 'error.flatLandRequired', params: {} } },
      { ok: false, error: { key: 'error.cantBuildOnWater', params: {} } },
      { ok: false, error: { key: 'error.buildingMustBeDemolished', params: {} } },
      { ok: false, error: { key: 'error.mustRemoveRailroadTrack', params: {} } },
    ]);
  });

  it('is bulldozed for £60 and refused to builders (RemoveTrainDepot, ClearTile_Track)', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    depot(g, t, DiagDir.NW);
    expect(execute(g, { type: 'buildRail', tile: t, track: Track.Y }, 'test')).toEqual({
      ok: false,
      error: { key: 'error.buildingMustBeDemolished', params: {} },
    });
    execute(g, { type: 'landscapeClear', tile: t }, 'exec');
    expect([
      getTileType(g.map, t),
      getClearDensity(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([TileType.Clear, 0, 0]);
  });

  it('proposes the follow-up rails of CcRailDepot from the tile in front of the exit', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    depot(g, t, DiagDir.NW); // exit towards (10,9)
    execute(g, { type: 'buildRail', tile: at(g, 10, 9), track: Track.X }, 'exec');
    expect(([0, 1, 2] as const).map((step) => depotExtraRail(g, t, DiagDir.NW, step))).toEqual([
      { tile: at(g, 10, 9), track: Track.Right },
      null,
      { tile: at(g, 10, 9), track: Track.Lower },
    ]);
    const h = newGame();
    depot(h, at(h, 10, 10), DiagDir.NW);
    execute(h, { type: 'buildRail', tile: at(h, 10, 9), track: Track.Y }, 'exec');
    expect(
      ([0, 1, 2] as const).map((step) => depotExtraRail(h, at(h, 10, 10), DiagDir.NW, step)),
    ).toEqual([null, { tile: at(h, 10, 9), track: Track.Y }, null]);
    depot(h, at(h, 10, 8), DiagDir.SE); // another depot across: no straight piece
    expect(depotExtraRail(h, at(h, 10, 10), DiagDir.NW, 1)).toBeNull();
  });

  it('is washed away on a cleared sea tile (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    depot(g, at(g, 11, 11), DiagDir.NW);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), g.depots[0], g.company.infrastructure.rail]).toEqual(
      [true, null, 0],
    );
  });

  it('leaves the state untouched in test mode when rotating and removing', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    depot(g, t, DiagDir.NW);
    const before = hashGameState(g);
    expect(depot(g, t, DiagDir.NE, 'test')).toEqual({ ok: true, cost: 525 });
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'test')).toEqual({ ok: true, cost: 60 });
    expect(hashGameState(g)).toBe(before);
  });

  it('builds a real depot on a 4-tree tile, not a rotation (IsRailDepotTile)', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    makeTree(g.map, t, 0, 3, TreeGrowth.Grown, TreeGround.Grass, 0); // m5 >> 6 === 3
    const trees = 4 * g.prices.clearTrees;
    expect(depot(g, t, DiagDir.NW)).toEqual({ ok: true, cost: trees + 525 });
    expect([getTileType(g.map, t), isRailDepotTile(g.map, t), g.depots.length]).toEqual([
      TileType.Railway,
      true,
      1,
    ]);
  });

  it('ignores a 4-tree tile across the exit when proposing the straight piece', () => {
    const g = newGame();
    depot(g, at(g, 10, 10), DiagDir.NW);
    execute(g, { type: 'buildRail', tile: at(g, 10, 9), track: Track.Y }, 'exec');
    makeTree(g.map, at(g, 10, 8), 0, 3, TreeGrowth.Grown, TreeGround.Grass, 0);
    expect(depotExtraRail(g, at(g, 10, 10), DiagDir.NW, 1)).toEqual({
      tile: at(g, 10, 9),
      track: Track.Y,
    });
  });

  it('names a depot after the closest town and numbers depots per town', () => {
    const g = newGame();
    g.towns.push(newTown(1, tileXY(g.map, 50, 50), 0, false));
    depot(g, at(g, 22, 22), DiagDir.NW);
    depot(g, at(g, 48, 48), DiagDir.NW);
    depot(g, at(g, 24, 24), DiagDir.NW);
    depot(g, at(g, 52, 52), DiagDir.NW);
    expect(g.depots.map((d) => [d?.townIndex, d?.townCn])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });
});
