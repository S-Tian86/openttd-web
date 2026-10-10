import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { IndustryType } from '../industry/industry-specs';
import { ClearGround, getClearDensity, getClearGround, makeClear } from './clear';
import { clearArea, landscapeClear } from './clear-tile';
import { makeIndustry } from './industry-map';
import { COMPANY_FIRST, getTileType, OWNER_TOWN, tileXY, TileType } from './map';
import { makeTree, TreeGrowth, TreeGround } from './tree-map';
import { makeSea, makeShore } from './water';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const testCost = (g: GameState, t: number): number | null => {
  const r = landscapeClear(g, t, DoFlag.None, COMPANY_FIRST);
  return r.ok ? r.cost : null;
};
const addIndustry = (g: GameState): void => {
  g.industries.push({
    index: 0,
    type: IndustryType.CoalMine,
    tile: at(g, 40, 10),
    width: 4,
    height: 4,
    townIndex: 0,
    layoutIndex: 0,
    productionRate: 15,
    counter: 0,
    randomColour: 0,
    random: 0,
    prodLevel: 16,
  });
  makeIndustry(g.map, at(g, 40, 10), 0, 0, 0);
  makeIndustry(g.map, at(g, 41, 10), 0, 1, 0);
};

describe('CmdLandscapeClear per tile type (construction.md §4.2)', () => {
  it('charges OpenTTD start prices for natural ground and leaves bare grass', () => {
    const g = newGame();
    makeClear(g.map, at(g, 11, 10), ClearGround.Grass, 0);
    makeClear(g.map, at(g, 12, 10), ClearGround.Rough, 3);
    makeClear(g.map, at(g, 13, 10), ClearGround.Rocks, 3);
    makeTree(g.map, at(g, 14, 10), 0, 2, TreeGrowth.Grown, TreeGround.Grass, 3); // three trees
    const tiles = [10, 11, 12, 13, 14].map((x) => at(g, x, 10));
    expect(tiles.map((t) => testCost(g, t))).toEqual([15, 0, 30, 150, 45]);
    for (const t of tiles) landscapeClear(g, t, DoFlag.Execute, COMPANY_FIRST);
    expect(
      tiles.map((t) => [
        getTileType(g.map, t),
        getClearGround(g.map, t),
        getClearDensity(g.map, t),
      ]),
    ).toEqual(tiles.map(() => [TileType.Clear, ClearGround.Grass, 0]));
  });

  it('charges £7,500 for sea and one-corner coast, £30 for other coast (ClearTile_Water)', () => {
    const g = newGame();
    makeSea(g.map, at(g, 20, 20));
    for (const [x, y] of [
      [31, 30],
      [30, 31],
      [31, 31],
    ] as const)
      g.map.height[at(g, x, y)] = 0;
    makeShore(g.map, at(g, 30, 30)); // only the N corner is raised
    g.map.height[at(g, 41, 41)] = 0;
    g.map.height[at(g, 41, 40)] = 0;
    makeShore(g.map, at(g, 40, 40)); // N and E corners raised
    expect([
      testCost(g, at(g, 20, 20)),
      testCost(g, at(g, 30, 30)),
      testCost(g, at(g, 40, 40)),
    ]).toEqual([7500, 7500, 30]);
  });

  it('refuses water to builders (NoWater) and houses and industries to Auto clears', () => {
    const g = newGame();
    makeSea(g.map, at(g, 20, 20));
    addIndustry(g);
    expect(landscapeClear(g, at(g, 20, 20), DoFlag.NoWater, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.cantBuildOnWater', params: {} },
    });
    expect(landscapeClear(g, at(g, 40, 10), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.objectInTheWay', params: { industry: 0 } },
    });
    // The bulldozer cannot remove an industry either; OpenTTD shows no detail line.
    expect(landscapeClear(g, at(g, 40, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
  });

  it('refuses the map edge with a bare error (CommandHelper::Do)', () => {
    const g = newGame();
    expect(landscapeClear(g, at(g, 0, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
  });

  it('uses one tile of the clearing limit per executed clear, even a free one (R28)', () => {
    const g = newGame();
    makeClear(g.map, at(g, 10, 10), ClearGround.Grass, 0);
    g.company.clearLimit = 1 << 16;
    landscapeClear(g, at(g, 11, 10), DoFlag.None, COMPANY_FIRST); // test: no use
    landscapeClear(g, at(g, 12, 10), DoFlag.Execute | DoFlag.Auto, COMPANY_FIRST); // Auto: no use
    expect(g.company.clearLimit).toBe(1 << 16);
    expect(landscapeClear(g, at(g, 10, 10), DoFlag.Execute, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: 0,
    });
    expect(g.company.clearLimit).toBe(0);
    expect(landscapeClear(g, at(g, 11, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.clearingLimitReached', params: {} },
    });
  });
});

describe('landscapeClear through the command pipeline', () => {
  it('refuses a clear the company cannot pay for, and tiles outside the map', () => {
    const g = newGame();
    makeSea(g.map, at(g, 20, 20));
    g.company.money = 100;
    const before = hashGameState(g);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 20, 20) }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.notEnoughCash', params: { money: 7500 } },
    });
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 0, 10) }, 'exec')).toEqual({
      ok: false,
      error: null,
    });
    expect(hashGameState(g)).toBe(before);
  });
});

describe('CmdClearArea (landscape.cpp)', () => {
  it('pays tile by tile and stops before the cash runs out (R22, Review Focus 2)', () => {
    const g = newGame();
    for (const x of [10, 11, 12]) makeClear(g.map, at(g, x, 10), ClearGround.Rocks, 3);
    const area = {
      type: 'clearArea',
      endTile: at(g, 12, 10),
      startTile: at(g, 10, 10),
      diagonal: false,
    } as const;
    g.company.money = 300;
    const before = hashGameState(g);
    expect(execute(g, area, 'test')).toEqual({ ok: true, cost: 450 }); // the estimate is never refused for money
    expect(hashGameState(g)).toBe(before); // test mode changes nothing
    expect(execute(g, area, 'exec')).toEqual({ ok: true, cost: 300 });
    expect(g.company.money).toBe(0);
    expect([10, 11, 12].map((x) => getClearGround(g.map, at(g, x, 10)))).toEqual([
      ClearGround.Grass,
      ClearGround.Grass,
      ClearGround.Rocks,
    ]);
  });

  it('fails with the price of the first tile when it could pay nothing', () => {
    const g = newGame();
    for (const x of [10, 11, 12]) makeClear(g.map, at(g, x, 10), ClearGround.Rocks, 3);
    g.company.money = 100;
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 12, 10), startTile: at(g, 10, 10), diagonal: false },
        'exec',
      ),
    ).toEqual({ ok: false, error: { key: 'error.notEnoughCash', params: { money: 150 } } });
    expect(g.company.money).toBe(100);
    expect(getClearGround(g.map, at(g, 10, 10))).toBe(ClearGround.Rocks);
  });

  it('skips tiles that fail and reports the last error only when every tile failed', () => {
    const g = newGame();
    addIndustry(g);
    expect(clearArea(g, DoFlag.None, at(g, 41, 10), at(g, 40, 10), false, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 42, 10), startTile: at(g, 40, 10), diagonal: false },
        'exec',
      ),
    ).toEqual({ ok: true, cost: 15 });
    expect(getTileType(g.map, at(g, 40, 10))).toBe(TileType.Industry);
  });

  it('does not use the company limit when someone else clears (Company::GetIfValid)', () => {
    const g = newGame();
    g.company.clearLimit = 0;
    expect(landscapeClear(g, at(g, 10, 10), DoFlag.Execute, OWNER_TOWN)).toMatchObject({
      ok: true,
      cost: 15,
    });
    expect(g.company.clearLimit).toBe(0);
  });
});
