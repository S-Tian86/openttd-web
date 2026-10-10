import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { nextRandom } from '../core/random';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { ClearGround, makeClear } from '../map/clear';
import { landscapeClear } from '../map/clear-tile';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, tileX, tileXY } from '../map/map';
import { getStationGfx, getStationTileRandomBits, isRailStationTile } from '../map/station-map';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis, Track } from '../track/track';
import { railStationLayout } from './build-station';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const station = (
  g: GameState,
  x: number,
  y: number,
  axis: Axis,
  numTracks: number,
  platLength: number,
  mode: 'test' | 'exec' = 'exec',
) => execute(g, { type: 'buildRailStation', tile: at(g, x, y), axis, numTracks, platLength }, mode);
const ERR = (key: string) => ({ ok: false, error: { key, params: {} } });

describe('CmdBuildRailStation costs and layout (station_cmd.cpp)', () => {
  it('charges the platform-length price by its odd counter, not once per platform (R17)', () => {
    const g = newGame();
    const before = hashGameState(g);
    expect(station(g, 22, 30, Axis.X, 1, 5, 'test')).toEqual({ ok: true, cost: 1605 }); // 5 × (150 + 75 + 15) + 3 × 135
    expect(station(g, 22, 40, Axis.Y, 2, 3, 'test')).toEqual({ ok: true, cost: 1845 }); // 6 × 240 + 3 × 135
    expect(hashGameState(g)).toBe(before);
    for (let x = 22; x <= 26; x++) makeClear(g.map, at(g, x, 30), ClearGround.Grass, 0);
    expect(station(g, 22, 30, Axis.X, 1, 5, 'test')).toEqual({ ok: true, cost: 1530 });
  });

  it("lays out OpenTTD's default tiles (RailStationTileLayout)", () => {
    expect([
      railStationLayout(1, 5),
      railStationLayout(2, 3),
      railStationLayout(1, 1),
      railStationLayout(3, 1),
    ]).toEqual([[0, 0, 2, 0, 0], [4, 4, 4, 6, 6, 6], [2], [0, 2, 0]]);
    const g = newGame();
    station(g, 30, 30, Axis.Y, 2, 3);
    expect(
      [
        [30, 30],
        [30, 32],
        [31, 30],
        [31, 32],
      ].map(([x, y]) => getStationGfx(g.map, at(g, x!, y!))),
    ).toEqual([5, 5, 7, 7]);
  });

  it('creates a station named after its town and keeps its random draws (R29)', () => {
    const g = newGame();
    const copy = { ...g.random };
    const draws = [0, 1, 2, 3].map(() => nextRandom(copy));
    expect(station(g, 22, 20, Axis.X, 1, 3)).toEqual({ ok: true, cost: 3 * 240 + 2 * 135 });
    expect(g.stations).toEqual([
      {
        index: 0,
        xy: at(g, 22, 20),
        townIndex: 0,
        nameKind: 'town',
        owner: COMPANY_FIRST,
        trainStation: { tile: at(g, 22, 20), w: 3, h: 1 },
        facilities: 1,
        deleteCtr: 0,
        buildDate: g.calendar.date,
        randomBits: draws[0]! & 0xffff,
      },
    ]);
    expect([22, 23, 24].map((x) => getStationTileRandomBits(g.map, at(g, x, 20)))).toEqual(
      draws.slice(1).map((d) => d & 0xf),
    );
    expect(g.random).toEqual(copy);
    expect(g.company.infrastructure).toEqual({ rail: 3, station: 3 });
  });

  it('extends its own platform without charging the tiles already there', () => {
    const g = newGame();
    station(g, 22, 20, Axis.X, 1, 3);
    expect(station(g, 21, 20, Axis.X, 1, 5)).toEqual({ ok: true, cost: 750 });
    expect([g.stations.length, g.stations[0]!.trainStation]).toEqual([
      1,
      { tile: at(g, 21, 20), w: 5, h: 1 },
    ]);
    expect(g.company.infrastructure).toEqual({ rail: 5, station: 5 });
  });

  it('charges a rotated tile as new, and overbuilds one aligned rail piece for a refund', () => {
    const g = newGame();
    station(g, 22, 20, Axis.X, 1, 1);
    expect(station(g, 22, 20, Axis.Y, 1, 1, 'test')).toEqual({ ok: true, cost: 360 });
    execute(g, { type: 'buildRail', tile: at(g, 30, 30), track: Track.X }, 'exec');
    execute(g, { type: 'buildRail', tile: at(g, 32, 30), track: Track.Y }, 'exec');
    expect(station(g, 30, 30, Axis.X, 1, 1, 'test')).toEqual({ ok: true, cost: 307 }); // -53 + 150 + 75 + 135
    expect(station(g, 32, 30, Axis.X, 1, 1, 'test')).toEqual(ERR('error.mustRemoveRailroadTrack'));
  });

  it('refuses slopes, water, houses, oversize drags; builders cannot clear it (R26)', () => {
    const g = newGame();
    g.map.height[at(g, 41, 41)] = 0;
    makeSea(g.map, at(g, 30, 30));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    expect([
      station(g, 40, 40, Axis.X, 1, 1, 'test'),
      station(g, 30, 30, Axis.X, 1, 1, 'test'),
      station(g, 21, 20, Axis.X, 1, 1, 'test'),
    ]).toEqual([
      ERR('error.flatLandRequired'),
      ERR('error.cantBuildOnWater'),
      ERR('error.buildingMustBeDemolished'),
    ]);
    expect(station(g, 10, 10, Axis.X, 1, 13, 'test')).toEqual({ ok: false, error: null });
    station(g, 10, 30, Axis.X, 1, 1);
    expect(landscapeClear(g, at(g, 10, 30), DoFlag.Auto, COMPANY_FIRST)).toEqual(
      ERR('error.mustDemolishRailroad'),
    );
    expect(execute(g, { type: 'buildRail', tile: at(g, 10, 30), track: Track.Y }, 'test')).toEqual(
      ERR('error.mustDemolishRailroad'),
    );
  });
});

describe('joining stations (FindJoiningBaseStation, R18, Review Focus 5)', () => {
  it('joins the single neighbour, also diagonally', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 23, 30, Axis.X, 1, 1);
    station(g, 24, 31, Axis.X, 1, 1);
    expect([g.stations.length, g.stations[0]!.trainStation]).toEqual([
      1,
      { tile: at(g, 22, 30), w: 3, h: 2 },
    ]);
  });

  it('builds a separate station two tiles away', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 24, 30, Axis.X, 1, 1);
    expect(g.stations.map((s) => s?.index)).toEqual([0, 1]);
  });

  it('refuses a drag that touches two of its stations', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 25, 30, Axis.X, 1, 1);
    const before = hashGameState(g);
    expect(station(g, 23, 30, Axis.X, 1, 2)).toEqual(ERR('error.adjoinsMoreThanOne'));
    expect(hashGameState(g)).toBe(before);
  });

  it('refuses a join that would spread the station over more than 12 tiles', () => {
    const g = newGame();
    station(g, 10, 30, Axis.X, 1, 12);
    expect(tileX(g.map, g.stations[0]!.trainStation!.tile)).toBe(10);
    expect(station(g, 22, 30, Axis.X, 1, 1, 'test')).toEqual(ERR('error.stationTooSpreadOut'));
  });
});

describe('test mode and station tile predicates', () => {
  it('charges in test mode what exec charges, and test mode changes nothing', () => {
    const g = newGame();
    makeClear(g.map, at(g, 23, 20), ClearGround.Rough, 3);
    const before = hashGameState(g);
    const test = station(g, 22, 20, Axis.Y, 2, 4, 'test');
    expect(hashGameState(g)).toBe(before);
    expect(station(g, 22, 20, Axis.Y, 2, 4)).toEqual(test);
  });

  it('does not take a tree or house tile for a rail station (other types reuse m5 and m6)', () => {
    const g = newGame();
    makeTree(g.map, at(g, 30, 30), 0, 3, TreeGrowth.Grown, TreeGround.Grass, 3);
    makeHouseTile(g.map, at(g, 31, 30), 0, 0, 3, 0x06, 0);
    expect([at(g, 30, 30), at(g, 31, 30)].map((t) => isRailStationTile(g.map, t))).toEqual([
      false,
      false,
    ]);
  });

  it('does not join a station through a tree or house tile whose m2 holds its index', () => {
    const g = newGame();
    station(g, 20, 30, Axis.X, 1, 1);
    makeTree(g.map, at(g, 24, 30), 0, 3, TreeGrowth.Grown, TreeGround.Grass, 0);
    makeHouseTile(g.map, at(g, 24, 31), 0, 0, 3, 0x06, 0);
    expect([g.map.m2[at(g, 24, 30)], g.map.m2[at(g, 24, 31)]]).toEqual([0, 0]); // station 0
    station(g, 25, 30, Axis.X, 1, 1);
    expect(g.stations.map((s) => s?.trainStation)).toEqual([
      { tile: at(g, 20, 30), w: 1, h: 1 },
      { tile: at(g, 25, 30), w: 1, h: 1 },
    ]);
  });
});

describe('SetRailStationTileFlags (station_cmd.cpp, no NewGRF spec)', () => {
  it('gives every tile wires and the tiles below gfx 4 pylons; none is blocked', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 3); // gfx 0, 2, 0
    station(g, 22, 40, Axis.X, 2, 3); // gfx 4, 4, 4 / 6, 6, 6
    const flags = (x: number, y: number): number => g.map.m3[at(g, x, y)]! & 0x0f;
    expect([flags(22, 30), flags(23, 30), flags(24, 30)]).toEqual([6, 6, 6]);
    expect([flags(22, 40), flags(24, 40), flags(22, 41), flags(24, 41)]).toEqual([2, 2, 2, 2]);
  });
});

describe('a map without towns', () => {
  it('refuses a new station before touching anything (OpenTTD assumes a town exists)', () => {
    const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeClear(g.map, at(g, 22, 30), ClearGround.Rough, 3);
    const before = hashGameState(g);
    expect(station(g, 22, 30, Axis.X, 1, 1, 'test')).toEqual({ ok: false, error: null });
    expect(station(g, 22, 30, Axis.X, 1, 1)).toEqual({ ok: false, error: null });
    expect(hashGameState(g)).toBe(before);
  });
});
