import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { distanceMax } from '../map/geometry';
import { getIndustryGfx, getIndustryIndex, isIndustryCompleted } from '../map/industry-map';
import { getTileType, TileType, tileXY } from '../map/map';
import { getTileSlopeZ } from '../map/slope';
import { newTown } from '../town/town';
import { createGame } from '../world/generate';
import {
  createNewIndustry,
  industryGenerationPlan,
  industryPlatformIsLevel,
  numberOfIndustries,
  tileLoopIndustry,
} from './industry-gen';
import { INDUSTRY_SPECS, IndustryType } from './industry-specs';

const NOOP = (): void => undefined;

const oneTownGame = (): GameState => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.towns.push(newTown(0, tileXY(game.map, 32, 32), 0, false));
  game.random = createRandomizer(12345);
  return game;
};

describe('industry specs (port of table/build_industry.h)', () => {
  it('keeps the coal mine and power station layouts', () => {
    const coal = INDUSTRY_SPECS[IndustryType.CoalMine]!;
    const power = INDUSTRY_SPECS[IndustryType.PowerStation]!;
    expect(coal.layouts.map((l) => l.length)).toEqual([6, 9, 6, 10]);
    expect(power.layouts.map((l) => l.length)).toEqual([8, 8, 6]);
    expect(coal.layouts[0]).toEqual([
      { dx: 1, dy: 1, gfx: 0 },
      { dx: 1, dy: 2, gfx: 2 },
      { dx: 0, dy: 0, gfx: 5 },
      { dx: 1, dy: 0, gfx: 6 },
      { dx: 2, dy: 0, gfx: 3 },
      { dx: 2, dy: 2, gfx: 3 },
    ]);
    expect([
      coal.conflicting,
      power.conflicting,
      coal.productionRate,
      power.productionRate,
    ]).toEqual([IndustryType.PowerStation, IndustryType.CoalMine, 15, 0]);
  });
});

describe('GenerateIndustries counts (port of industry_cmd.cpp, ruling R10)', () => {
  it('scales the number of industries by density and map size', () => {
    const map256 = createEmptyGame().map;
    const map64 = createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map;
    expect([0, 1, 2, 3, 4, 5].map((d) => numberOfIndustries(map256, d))).toEqual([
      0, 0, 10, 25, 55, 80,
    ]);
    expect([0, 1, 2, 3, 4, 5].map((d) => numberOfIndustries(map64, d))).toEqual([0, 0, 1, 2, 4, 5]);
  });

  it('forces one of each temperate type, then draws the rest by chance', () => {
    const plan = industryGenerationPlan(createEmptyGame().map, 4, 65536);
    expect(plan?.probs).toEqual([128, 80, 80, 80, 64, 80, 80, 144, 64, 80]);
    expect([plan?.total, plan?.forced, plan?.randomPicks]).toEqual([
      880,
      [0, 1, 2, 3, 4, 6, 8, 9, 11, 18],
      45,
    ]);
    const small = industryGenerationPlan(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 4, 4096);
    expect([small?.total, small?.randomPicks]).toEqual([67, 0]);
    expect(industryGenerationPlan(createEmptyGame().map, 0, 65536)).toBeNull();
  });
});

describe('CreateNewIndustry (port of industry_cmd.cpp)', () => {
  it('builds a coal mine with OpenTTD draws and tile fields', () => {
    const game = oneTownGame();
    const ind = createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    expect(ind).toEqual({
      index: 0,
      type: IndustryType.CoalMine,
      tile: tileXY(game.map, 20, 20),
      width: 3,
      height: 4,
      townIndex: 0,
      layoutIndex: 3,
      productionRate: 21,
      counter: 198,
      randomColour: 5,
      random: 1542,
      prodLevel: 0x10,
    });
    const t = tileXY(game.map, 20, 21); // layout 3, first tile (0,1) gfx 0
    expect([
      getTileType(game.map, t),
      getIndustryIndex(game.map, t),
      getIndustryGfx(game.map, t),
      game.map.m3[t],
      game.map.m1[t],
    ]).toEqual([TileType.Industry, 0, 0, 194, 0x6e]);
    expect(game.map.m3[tileXY(game.map, 22, 22)]).toBe(131);
  });

  it('completes a generated tile on its first tile-loop visit', () => {
    const game = oneTownGame();
    createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    const t = tileXY(game.map, 20, 21);
    tileLoopIndustry(game, t, NOOP);
    expect([isIndustryCompleted(game.map, t), game.map.m1[t]]).toEqual([true, 0xe3]);
  });

  it('refuses a conflicting industry within 14 tiles and a second one of a type per town', () => {
    const game = oneTownGame();
    createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    expect(createNewIndustry(game, tileXY(game.map, 30, 20), IndustryType.PowerStation)).toBeNull();
    expect(createNewIndustry(game, tileXY(game.map, 45, 45), IndustryType.CoalMine)).toBeNull();
  });

  it('needs a level platform (ruling R11)', () => {
    const game = oneTownGame();
    const layout = INDUSTRY_SPECS[IndustryType.CoalMine]!.layouts[0]!;
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 20, 20), layout)).toBe(true);
    game.map.height[tileXY(game.map, 24, 24)] = 0; // a vertex of the platform margin
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 20, 20), layout)).toBe(false);
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 2, 20), layout)).toBe(false); // too close to the edge
  });
});

describe('GenerateIndustries on the default world', () => {
  it('keeps the distance and one-per-town rules, on level land', () => {
    const game = createGame({ seed: 5 });
    const { map, industries } = game;
    const mines = industries.filter((i) => i.type === IndustryType.CoalMine);
    const stations = industries.filter((i) => i.type === IndustryType.PowerStation);
    expect(mines.length).toBeGreaterThan(0);
    expect(stations.length).toBeGreaterThan(0);
    for (const m of mines)
      for (const s of stations) expect(distanceMax(map, m.tile, s.tile)).toBeGreaterThan(14);
    for (const list of [mines, stations])
      expect(new Set(list.map((i) => i.townIndex)).size).toBe(list.length);
    for (let t = 0; t < map.size; t++) {
      if (getTileType(map, t) !== TileType.Industry) continue;
      expect(getTileSlopeZ(map, t)).toEqual({ slope: 0, z: 1 });
      expect(industries[getIndustryIndex(map, t)]).toBeDefined();
    }
  });
});
