import { describe, expect, it } from 'vitest';
import { computePrices, INFLATION_ONE } from './prices';

describe('RecomputePrices (port of economy.cpp)', () => {
  it('gives the default (Low) prices at the start of a game', () => {
    expect(computePrices(0, 0, INFLATION_ONE)).toEqual({
      stationValue: 100,
      buildRail: 75,
      buildRoad: 71,
      buildDepotTrain: 450,
      buildStationRail: 150,
      buildStationRailLength: 135,
      buildFoundation: 187,
      clearGrass: 15,
      clearRough: 30,
      clearRocks: 150,
      clearFields: 375,
      clearTrees: 15,
      clearRail: -53,
      clearDepotTrain: 60,
      clearStationRail: 37,
      clearHouse: 1200,
      clearRoad: 30,
      clearWater: 7500,
    });
  });

  it('rounds toward minus infinity on Medium and High (arithmetic shift)', () => {
    const medium = computePrices(1, 1, INFLATION_ONE);
    const high = computePrices(2, 2, INFLATION_ONE);
    expect([medium.buildRail, medium.clearRail, high.buildRail, high.clearRail]).toEqual([
      100, -70, 112, -79,
    ]);
    expect(high.stationValue).toBe(100); // PCAT_NONE is always ×8 >> 3
  });
});
