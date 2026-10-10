import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { ClearGround, getClearDensity, makeClear } from '../map/clear';
import { landscapeClear } from '../map/clear-tile';
import { tileLoopWater } from '../map/flood';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, getTileType, OWNER_TOWN, tileXY, TileType } from '../map/map';
import { getRailGroundType, getTrackBits, RailGroundType } from '../map/rail-map';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { tileLoopTrack } from './rail-cmd';
import { Track, TrackBits } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const build = (g: GameState, t: number, track: Track) =>
  execute(g, { type: 'buildRail', tile: t, track }, 'exec');

describe('CmdBuildSingleRail / CmdRemoveSingleRail (port of rail_cmd.cpp)', () => {
  it('lays a piece on generated grass for £90 and adds pieces for £75 each', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    const before = hashGameState(g);
    expect(execute(g, { type: 'buildRail', tile: t, track: Track.X }, 'test')).toEqual({
      ok: true,
      cost: 90,
    });
    expect(hashGameState(g)).toBe(before); // test mode changes nothing
    expect(build(g, t, Track.X)).toEqual({ ok: true, cost: 90 });
    expect([getTileType(g.map, t), getTrackBits(g.map, t), getRailGroundType(g.map, t)]).toEqual([
      TileType.Railway,
      TrackBits.X,
      RailGroundType.Barren,
    ]);
    expect(build(g, t, Track.Y)).toEqual({ ok: true, cost: 75 });
    expect([g.company.money, g.company.infrastructure.rail]).toEqual([100000 - 165, 4]);
  });

  it('combines all six pieces on one flat tile and counts overlapping pieces squared', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    const counts = [Track.X, Track.Y, Track.Upper, Track.Lower, Track.Left, Track.Right].map(
      (track) => {
        build(g, t, track);
        return g.company.infrastructure.rail;
      },
    );
    expect(counts).toEqual([1, 4, 9, 16, 25, 36]);
    expect(getTrackBits(g.map, t)).toBe(TrackBits.All);
    expect(build(g, t, Track.X)).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
  });

  it('clears trees and rough land as part of the price', () => {
    const g = newGame();
    makeTree(g.map, at(g, 10, 10), 0, 1, TreeGrowth.Grown, TreeGround.Grass, 3); // two trees
    makeClear(g.map, at(g, 11, 10), ClearGround.Rough, 3);
    makeClear(g.map, at(g, 12, 10), ClearGround.Grass, 0);
    expect(
      [10, 11, 12].map((x) =>
        execute(g, { type: 'buildRail', tile: at(g, x, 10), track: Track.X }, 'test'),
      ),
    ).toEqual([105, 105, 75].map((cost) => ({ ok: true, cost })));
  });

  it('refuses houses, water, slopes and the map edge (R26)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    makeSea(g.map, at(g, 30, 30));
    g.map.height[at(g, 41, 41)] = 0; // tile (40,40) gets a lowered S corner
    const test = (t: number) => execute(g, { type: 'buildRail', tile: t, track: Track.X }, 'test');
    expect([
      test(at(g, 21, 20)),
      test(at(g, 30, 30)),
      test(at(g, 40, 40)),
      test(at(g, 0, 10)),
    ]).toEqual([
      { ok: false, error: { key: 'error.buildingMustBeDemolished', params: {} } },
      { ok: false, error: { key: 'error.cantBuildOnWater', params: {} } },
      { ok: false, error: { key: 'error.flatLandRequired', params: {} } },
      { ok: false, error: null },
    ]);
  });

  it('refunds £53 per removed piece and leaves bare grass after the last one', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    build(g, t, Track.Y);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([getTrackBits(g.map, t), g.company.infrastructure.rail]).toEqual([TrackBits.Y, 1]);
    execute(g, { type: 'removeRail', tile: t, track: Track.Y }, 'exec');
    expect([
      getTileType(g.map, t),
      getClearDensity(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([TileType.Clear, 0, 0]);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.Y }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.noRailroadTrack', params: {} },
    });
  });

  it('is bulldozed with every piece refunded, but never cleared by builders (ClearTile_Track)', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    build(g, t, Track.Y);
    expect(landscapeClear(g, t, DoFlag.None, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: -106,
    });
    expect(landscapeClear(g, t, DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRailroadTrack', params: {} },
    });
    expect(landscapeClear(g, t, DoFlag.Auto, OWNER_TOWN)).toEqual({
      ok: false,
      error: { key: 'error.areaIsOwnedByAnother', params: {} },
    });
  });

  it('grows grass and then fences on edges without track (TileLoop_Track, R32)', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.Grass); // was barren: no fences yet
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.FenceSENW); // grass neighbours belong to nobody
    build(g, at(g, 10, 11), Track.Y); // our own rail on the SE side
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.FenceNW);
  });

  it('is washed away when built on a cleared sea tile (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    build(g, at(g, 11, 11), Track.X);
    expect(g.company.infrastructure.rail).toBe(1);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), g.company.infrastructure.rail]).toEqual([true, 0]);
  });
});
