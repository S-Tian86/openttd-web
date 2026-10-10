import { describe, expect, it } from 'vitest';
import { createEmptyGame } from './game';
import { IndustryType } from './industry/industry-specs';
import { makeHouseTile } from './map/house-map';
import { makeIndustry } from './map/industry-map';
import { makeClear, ClearGround } from './map/clear';
import { tileXY } from './map/map';
import { makeRoadNormal, RoadBits } from './map/road-map';
import { makeSea } from './map/water';
import { describeTile, industryInfo, townInfo } from './query';
import { newTown } from './town/town';

describe('query functions for the UI', () => {
  it('reports grass with density 0 as bare land (GetTileDesc_Clear)', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(game.map, 3, 3);
    makeClear(game.map, t, ClearGround.Grass, 0);
    expect(describeTile(game, t).kind).toBe('bare');
    makeClear(game.map, t, ClearGround.Grass, 2);
    expect(describeTile(game, t).kind).toBe('grass');
  });

  it('describes tiles with their kind, owner and location', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    game.towns.push(newTown(0, tileXY(map, 20, 20), 0, false));
    makeRoadNormal(map, tileXY(map, 20, 20), RoadBits.X, 0);
    makeHouseTile(map, tileXY(map, 21, 20), 0, 0, 3, 0x06, 0);
    makeSea(map, tileXY(map, 5, 5));
    expect(describeTile(game, tileXY(map, 10, 12))).toEqual({
      tile: tileXY(map, 10, 12),
      x: 10,
      y: 12,
      z: 1,
      kind: 'grass',
      owner: 'none',
      townIndex: null,
      industryIndex: null,
    });
    expect(describeTile(game, tileXY(map, 20, 20))).toMatchObject({
      kind: 'road',
      owner: 'town',
      townIndex: 0,
    });
    expect(describeTile(game, tileXY(map, 21, 20))).toMatchObject({
      kind: 'house',
      owner: 'town',
      townIndex: 0,
    });
    expect(describeTile(game, tileXY(map, 5, 5))).toMatchObject({ kind: 'sea', owner: 'water' });
    expect(describeTile(game, tileXY(map, 0, 5))).toMatchObject({ kind: 'void' });
  });

  it('summarises towns and industries', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 20, 30), 0, true);
    town.population = 412;
    town.numHouses = 17;
    game.towns.push(town);
    game.industries.push({
      index: 0,
      type: IndustryType.CoalMine,
      tile: tileXY(game.map, 40, 10),
      width: 3,
      height: 3,
      townIndex: 0,
      layoutIndex: 0,
      productionRate: 15,
      counter: 0,
      randomColour: 0,
      random: 0,
      prodLevel: 16,
    });
    makeIndustry(game.map, tileXY(game.map, 40, 10), 0, 5, 0);
    expect(townInfo(game, 0)).toEqual({
      index: 0,
      name: 'Invenville',
      isCity: true,
      population: 412,
      houses: 17,
      x: 20,
      y: 30,
    });
    expect(industryInfo(game, 0)).toEqual({
      index: 0,
      type: 'coalMine',
      townName: 'Invenville',
      x: 40,
      y: 10,
    });
    expect(describeTile(game, tileXY(game.map, 40, 10))).toMatchObject({
      kind: 'industry',
      industryIndex: 0,
    });
    expect([townInfo(game, 5), industryInfo(game, 5)]).toEqual([null, null]);
  });
});
