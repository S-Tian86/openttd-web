import { describe, expect, it } from 'vitest';
import { execute } from './command/command';
import { convertDateToYMD } from './time/date';
import { createEmptyGame, hashGameState } from './game';
import { IndustryType } from './industry/industry-specs';
import { makeHouseTile } from './map/house-map';
import { makeIndustry } from './map/industry-map';
import { makeClear, ClearGround } from './map/clear';
import { DiagDir } from './map/geometry';
import { COMPANY_FIRST, tileXY } from './map/map';
import { makeRoadCrossing, makeRoadNormal, RoadBits } from './map/road-map';
import { makeSea } from './map/water';
import { depotInfo, describeTile, industryInfo, stationInfo, townInfo } from './query';
import { newTown } from './town/town';
import { Axis, Track } from './track/track';

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
      stationIndex: null,
      depotIndex: null,
      costToClear: 15,
      roadOwner: null,
      railType: null,
      railSpeed: null,
      buildDate: null,
    });
    expect(describeTile(game, tileXY(map, 20, 20))).toMatchObject({
      kind: 'road',
      owner: 'town',
      townIndex: 0,
      costToClear: null, // a town road is refused (R33)
    });
    expect(describeTile(game, tileXY(map, 21, 20))).toMatchObject({
      kind: 'house',
      owner: 'town',
      townIndex: 0,
      costToClear: 375,
    });
    expect(describeTile(game, tileXY(map, 5, 5))).toMatchObject({
      kind: 'sea',
      owner: 'water',
      costToClear: 7500,
    });
    expect(describeTile(game, tileXY(map, 0, 5))).toMatchObject({
      kind: 'void',
      costToClear: null,
    });
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

  it('describes rail, depots, stations and crossings with their cost to clear', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const at = (x: number, y: number): number => tileXY(game.map, x, y);
    game.towns.push(newTown(0, at(20, 20), 0, false));
    execute(game, { type: 'buildRail', tile: at(10, 10), track: Track.X }, 'exec');
    execute(game, { type: 'buildTrainDepot', tile: at(12, 10), dir: DiagDir.NW }, 'exec');
    execute(
      game,
      { type: 'buildRailStation', tile: at(14, 10), axis: Axis.X, numTracks: 1, platLength: 2 },
      'exec',
    );
    makeRoadNormal(game.map, at(20, 30), RoadBits.Y, 0);
    execute(game, { type: 'buildRail', tile: at(20, 30), track: Track.X }, 'exec');
    expect(describeTile(game, at(10, 10))).toEqual({
      tile: at(10, 10),
      x: 10,
      y: 10,
      z: 1,
      kind: 'rail',
      owner: 'company',
      townIndex: null,
      industryIndex: null,
      stationIndex: null,
      depotIndex: null,
      costToClear: -53,
      roadOwner: null,
      railType: 'rail',
      railSpeed: null,
      buildDate: null,
    });
    expect(describeTile(game, at(12, 10))).toMatchObject({
      kind: 'depot',
      owner: 'company',
      depotIndex: 0,
      costToClear: 60,
      railType: 'rail',
      railSpeed: 61, // GetTileDesc_Track: depots under the realistic acceleration model
      buildDate: convertDateToYMD(game.calendar.date),
    });
    expect(describeTile(game, at(15, 10))).toMatchObject({
      kind: 'station',
      owner: 'company',
      stationIndex: 0,
      costToClear: 74,
      railType: 'rail',
      railSpeed: null,
      buildDate: convertDateToYMD(game.calendar.date),
    });
    expect(describeTile(game, at(20, 30))).toMatchObject({
      kind: 'crossing',
      owner: 'company',
      townIndex: 0,
      costToClear: -53,
      roadOwner: 'town',
      railType: 'rail',
    });
    expect(stationInfo(game, 0)).toEqual({ index: 0, townName: 'Invenville', nameKind: 'north' });
    expect(depotInfo(game, 0)).toEqual({ index: 0, townName: 'Invenville', townCn: 0 });
    expect([stationInfo(game, 3), depotInfo(game, 3)]).toEqual([null, null]);
  });

  it('keeps a town with no houses left describable (Review Focus 3)', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    game.towns.push(newTown(0, tileXY(game.map, 20, 30), 0, true));
    expect(townInfo(game, 0)).toMatchObject({ population: 0, houses: 0 });
  });

  it('names the stored road owner of a crossing', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(game.map, 20, 30);
    game.towns.push(newTown(0, tileXY(game.map, 20, 20), 0, false));
    makeRoadCrossing(game.map, t, COMPANY_FIRST, COMPANY_FIRST, Axis.Y, 0, 0);
    expect(describeTile(game, t)).toMatchObject({ kind: 'crossing', roadOwner: 'company' });
  });

  it('never changes the game while querying (test run only)', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const at = (x: number, y: number): number => tileXY(game.map, x, y);
    game.towns.push(newTown(0, at(20, 20), 0, false));
    execute(game, { type: 'buildTrainDepot', tile: at(12, 10), dir: DiagDir.NW }, 'exec');
    execute(
      game,
      { type: 'buildRailStation', tile: at(14, 10), axis: Axis.X, numTracks: 1, platLength: 2 },
      'exec',
    );
    makeRoadNormal(game.map, at(20, 30), RoadBits.Y, 0);
    execute(game, { type: 'buildRail', tile: at(20, 30), track: Track.X }, 'exec');
    makeRoadNormal(game.map, at(20, 20), RoadBits.X, 0);
    const before = [hashGameState(game), game.company.clearLimit];
    for (const t of [at(12, 10), at(14, 10), at(20, 30), at(20, 20)]) describeTile(game, t);
    expect([hashGameState(game), game.company.clearLimit]).toEqual(before);
  });
});
