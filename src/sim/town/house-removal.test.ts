import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, tick, type GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, getTileType, tileXY, TileType } from '../map/map';
import { isNormalRoadTile, makeRoadNormal, RoadBits } from '../map/road-map';
import { getHouseNorthPart } from './house-removal';
import { newTown, TownFlag } from './town';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const COMPLETED = 3;

/** A town at (20,20) with town houses (0x06, pop 30) at (21,20), a church (0x03, pop 5) at (22,20)
 * and a 2×2 stadium (0x14..0x17, pop 65) at (24..25, 20..21). */
function townWithHouses(): GameState {
  const g = newGame();
  const town = newTown(0, at(g, 20, 20), 0, false);
  g.towns.push(town);
  makeHouseTile(g.map, at(g, 21, 20), 0, 0, COMPLETED, 0x06, 0);
  makeHouseTile(g.map, at(g, 22, 20), 0, 0, COMPLETED, 0x03, 0);
  makeHouseTile(g.map, at(g, 24, 20), 0, 0, COMPLETED, 0x14, 0);
  makeHouseTile(g.map, at(g, 24, 21), 0, 0, COMPLETED, 0x15, 0);
  makeHouseTile(g.map, at(g, 25, 20), 0, 0, COMPLETED, 0x16, 0);
  makeHouseTile(g.map, at(g, 25, 21), 0, 0, COMPLETED, 0x17, 0);
  town.numHouses = 3;
  town.population = 100;
  town.flags = TownFlag.HasChurch | TownFlag.HasStadium;
  return g;
}

describe('demolishing houses (port of town_cmd.cpp:ClearTile_Town)', () => {
  it('charges (£1,200 × removal_cost) >> 8 of the tile it is given', () => {
    const g = townWithHouses();
    const cost = (x: number, y: number): unknown =>
      landscapeClear(g, at(g, x, y), DoFlag.None, COMPANY_FIRST);
    expect([cost(21, 20), cost(22, 20), cost(25, 21)]).toEqual([
      expect.objectContaining({ cost: 375 }),
      expect.objectContaining({ cost: 421 }),
      expect.objectContaining({ cost: 1171 }),
    ]);
  });

  it('refuses houses to builders (Auto)', () => {
    const g = townWithHouses();
    expect(landscapeClear(g, at(g, 21, 20), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.buildingMustBeDemolished', params: {} },
    });
  });

  it('removes a whole stadium from any tile and updates the town (ClearTownHouse)', () => {
    const g = townWithHouses();
    landscapeClear(g, at(g, 25, 21), DoFlag.Execute, COMPANY_FIRST);
    expect(
      [
        [24, 20],
        [24, 21],
        [25, 20],
        [25, 21],
      ].map(([x, y]) => getTileType(g.map, at(g, x!, y!))),
    ).toEqual([TileType.Clear, TileType.Clear, TileType.Clear, TileType.Clear]);
    const town = g.towns[0]!;
    expect([town.population, town.numHouses, town.flags]).toEqual([35, 2, TownFlag.HasChurch]);
  });

  it('estimates a stadium at four tiles in an area but charges one (R22, §4.2.2)', () => {
    const g = townWithHouses();
    const area = {
      type: 'clearArea',
      endTile: at(g, 25, 21),
      startTile: at(g, 24, 20),
      diagonal: false,
    } as const;
    expect(execute(g, area, 'test')).toEqual({ ok: true, cost: 4684 });
    expect(execute(g, area, 'exec')).toEqual({ ok: true, cost: 1171 });
    expect(g.company.money).toBe(100000 - 1171);
  });

  it('leaves a town with no houses alive and ticking (Review Focus 3)', () => {
    const g = townWithHouses();
    makeHouseTile(g.map, at(g, 23, 21), 0, 0, 1, 0x06, 0); // unfinished: no population yet
    makeRoadNormal(g.map, at(g, 23, 20), RoadBits.X, 0); // the town's road inside the area
    g.towns[0]!.numHouses = 4;
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 25, 21), startTile: at(g, 21, 20), diagonal: false },
        'exec',
      ).ok,
    ).toBe(true);
    const town = g.towns[0]!;
    expect([town.population, town.numHouses, town.flags, town.squaredZoneRadius]).toEqual([
      0,
      0,
      0,
      [4, 0, 0, 0, 0],
    ]);
    expect(isNormalRoadTile(g.map, at(g, 23, 20))).toBe(true); // houses go, roads stay (R33)
    expect(() => {
      for (let i = 0; i < 1000; i++) tick(g);
    }).not.toThrow();
  });

  it('finds the north tile of multi-tile houses (GetHouseNorthPart)', () => {
    expect([0x08, 0x15, 0x16, 0x17, 0x29, 0x06].map((id) => getHouseNorthPart(id))).toEqual([
      { id: 0x07, dx: 0, dy: -1 },
      { id: 0x14, dx: 0, dy: -1 },
      { id: 0x14, dx: -1, dy: 0 },
      { id: 0x14, dx: -1, dy: -1 },
      { id: 0x28, dx: 0, dy: -1 },
      { id: 0x06, dx: 0, dy: 0 },
    ]);
  });
});
