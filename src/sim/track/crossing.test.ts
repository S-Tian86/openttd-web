import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import {
  COMPANY_FIRST,
  getTileOwner,
  getTileType,
  OWNER_TOWN,
  OWNER_WATER,
  tileXY,
  TileType,
} from '../map/map';
import { getTrackBits } from '../map/rail-map';
import {
  getCrossingRailBits,
  getRoadBits,
  getRoadOwner,
  getRoadside,
  getTownIndex,
  getTownRoadBits,
  isLevelCrossingTile,
  isNormalRoadTile,
  makeRoadNormal,
  RoadBits,
  Roadside,
} from '../map/road-map';
import { closestTownFromTile, newTown } from '../town/town';
import { tileLoopRoad } from '../town/town-roads';
import { Track, TrackBits } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
/** A town at (20,20) owning a road with `bits` at (20,40). */
function withRoad(bits: number): { g: GameState; t: number } {
  const g = newGame();
  g.towns.push(newTown(0, at(g, 20, 20), 0, false));
  const t = at(g, 20, 40);
  makeRoadNormal(g.map, t, bits, 0);
  return { g, t };
}
const rail = (g: GameState, t: number, track: Track, mode: 'test' | 'exec' = 'exec') =>
  execute(g, { type: 'buildRail', tile: t, track }, mode);

describe('level crossings (port of rail_cmd.cpp case MP_ROAD, roads.md §4.1)', () => {
  it('turns a straight town road into a crossing for the price of the rail', () => {
    const { g, t } = withRoad(RoadBits.Y);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 75 });
    expect([
      isLevelCrossingTile(g.map, t),
      getTileOwner(g.map, t),
      getRoadOwner(g.map, t),
      getTownIndex(g.map, t),
      getCrossingRailBits(g.map, t),
      getRoadside(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, COMPANY_FIRST, OWNER_TOWN, 0, TrackBits.X, Roadside.Barren, 2]);
  });

  it('completes a one-piece stub across the rail for £75 + £71 (R16)', () => {
    const { g, t } = withRoad(RoadBits.NW);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 146 });
    expect(getTownRoadBits(g.map, t)).toBe(RoadBits.Y);
  });

  it('replaces a one-piece stub along the rail for £30 + £75 (R16)', () => {
    const { g, t } = withRoad(RoadBits.NE);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 105 });
    expect([getTileType(g.map, t), getTrackBits(g.map, t)]).toEqual([
      TileType.Railway,
      TrackBits.X,
    ]);
  });

  it('refuses roads that run along the rail or branch', () => {
    for (const [bits, track] of [
      [RoadBits.X, Track.X],
      [RoadBits.X | RoadBits.SE, Track.Y],
    ] as const) {
      const { g, t } = withRoad(bits);
      expect(rail(g, t, track, 'test')).toEqual({
        ok: false,
        error: { key: 'error.mustRemoveRoadFirst', params: {} },
      });
    }
  });

  it('allows one track per crossing', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(rail(g, t, Track.X, 'test')).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
    expect(rail(g, t, Track.Y, 'test')).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRoadFirst', params: {} },
    });
  });

  it('gives the town its road back when the rail is removed, for a £53 refund', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([
      isNormalRoadTile(g.map, t),
      getRoadBits(g.map, t),
      getRoadOwner(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, RoadBits.Y, OWNER_TOWN, 0]);
  });

  it('loses only its rail to the bulldozer, for a £53 refund (R33, D2)', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'test')).toEqual({
      ok: true,
      cost: -53,
    });
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([
      isNormalRoadTile(g.map, t),
      getRoadBits(g.map, t),
      getRoadOwner(g.map, t),
      getTownIndex(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, RoadBits.Y, OWNER_TOWN, 0, 0]);
    expect(g.company.clearLimit).toBe((4096 - 1) << 16); // one executed clear (R28)
    // The town road left behind is refused like any other (Review Focus 3).
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'test')).toEqual({
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    });
  });

  it('still belongs to its town for the town helpers (roads.md §4.5)', () => {
    const { g, t } = withRoad(RoadBits.Y);
    g.towns.push(newTown(1, at(g, 21, 41), 1, false)); // closer by distance
    rail(g, t, Track.X);
    expect(closestTownFromTile(g, t, Infinity)?.index).toBe(0);
    tileLoopRoad(g, t, NOOP); // edge zone: barren → grass, as on any town road
    expect(getRoadside(g.map, t)).toBe(Roadside.Grass);
  });

  it('changes nothing in test mode and prices it like exec', () => {
    const { g, t } = withRoad(RoadBits.Y);
    const before = hashGameState(g);
    const built = rail(g, t, Track.X, 'test');
    expect(hashGameState(g)).toBe(before);
    expect(rail(g, t, Track.X)).toEqual(built);
    const crossed = hashGameState(g);
    const removal = execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'test');
    expect(hashGameState(g)).toBe(crossed);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'exec')).toEqual(removal);
  });

  it('is cleared whole by the sea: rail then road (road_cmd.cpp ClearTile_Road)', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    // RemoveRoad leaves plain rail (count 2 -> 1); the nested landscape clear removes that too.
    expect(landscapeClear(g, t, DoFlag.Execute, OWNER_WATER).ok).toBe(true);
    expect([getTileType(g.map, t), g.company.infrastructure.rail]).toEqual([TileType.Clear, 0]);
  });
});
