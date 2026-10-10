import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, type GameState } from '../game';
import { IndustryType } from '../industry/industry-specs';
import { makeIndustry } from '../map/industry-map';
import { tileXY } from '../map/map';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis } from '../track/track';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const nameOf = (g: GameState, x: number, y: number): string | undefined => {
  execute(
    g,
    { type: 'buildRailStation', tile: at(g, x, y), axis: Axis.X, numTracks: 1, platLength: 1 },
    'exec',
  );
  return g.stations.at(-1)?.nameKind;
};

describe('GenerateStationName (station_cmd.cpp)', () => {
  it('uses the town name, then Central, then the free directions', () => {
    const g = newGame();
    expect([nameOf(g, 22, 20), nameOf(g, 16, 20), nameOf(g, 30, 30), nameOf(g, 5, 5)]).toEqual([
      'town',
      'central',
      'south',
      'north',
    ]);
  });

  it('names a station next to a coal mine "Mines"', () => {
    const g = newGame();
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
    expect(nameOf(g, 42, 12)).toBe('mines');
  });

  it('names stations by eight trees "Woods" and by five sea tiles near the edge "Lakeside"', () => {
    const g = newGame();
    for (let x = 27; x <= 30; x++)
      for (const y of [37, 38])
        makeTree(g.map, at(g, x, y), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
    expect(nameOf(g, 30, 40)).toBe('woods');
    for (let x = 8; x <= 12; x++) makeSea(g.map, at(g, x, 38));
    expect(nameOf(g, 10, 40)).toBe('lakeside');
  });
});
