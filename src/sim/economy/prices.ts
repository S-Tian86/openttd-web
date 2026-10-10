/** Port of economy.cpp:RecomputePrices (without NewGRF multipliers) and table/pricebase.h. */
export type PriceName =
  | 'stationValue'
  | 'buildRail'
  | 'buildRoad'
  | 'buildDepotTrain'
  | 'buildStationRail'
  | 'buildStationRailLength'
  | 'buildFoundation'
  | 'clearGrass'
  | 'clearRough'
  | 'clearRocks'
  | 'clearFields'
  | 'clearTrees'
  | 'clearRail'
  | 'clearDepotTrain'
  | 'clearStationRail'
  | 'clearHouse'
  | 'clearRoad'
  | 'clearWater';

export type Prices = Readonly<Record<PriceName, number>>;

/** inflation_prices starts at 1.0 in 16.16 fixed point (economy.cpp:InitializeEconomy). */
export const INFLATION_ONE = 1 << 16;

type PriceCategory = 'none' | 'construction' | 'running';

/** Start prices, before difficulty and inflation (table/pricebase.h). */
export const PRICE_BASES: Readonly<Record<PriceName, { start: number; category: PriceCategory }>> =
  {
    stationValue: { start: 100, category: 'none' },
    buildRail: { start: 100, category: 'construction' },
    buildRoad: { start: 95, category: 'construction' },
    buildDepotTrain: { start: 600, category: 'construction' },
    buildStationRail: { start: 200, category: 'construction' },
    buildStationRailLength: { start: 180, category: 'construction' },
    buildFoundation: { start: 250, category: 'construction' },
    clearGrass: { start: 20, category: 'construction' },
    clearRough: { start: 40, category: 'construction' },
    clearRocks: { start: 200, category: 'construction' },
    clearFields: { start: 500, category: 'construction' },
    clearTrees: { start: 20, category: 'construction' },
    clearRail: { start: -70, category: 'construction' },
    clearDepotTrain: { start: 80, category: 'construction' },
    clearStationRail: { start: 50, category: 'construction' },
    clearHouse: { start: 1600, category: 'construction' },
    clearRoad: { start: 40, category: 'construction' },
    clearWater: { start: 10000, category: 'construction' },
  };

const MULTIPLIER = [6, 8, 9] as const; // difficulty Low / Medium / High

export function computePrices(
  constructionCost: number,
  runningCost: number,
  inflationPrices: number,
): Prices {
  const prices = {} as Record<PriceName, number>;
  for (const [name, base] of Object.entries(PRICE_BASES) as [
    PriceName,
    (typeof PRICE_BASES)[PriceName],
  ][]) {
    const mod =
      base.category === 'construction'
        ? constructionCost
        : base.category === 'running'
          ? runningCost
          : 1;
    // price * {6,8,9}[mod] * inflation_prices, then >> (16 + 3): arithmetic shift = floor
    let price = Math.floor((base.start * MULTIPLIER[mod]! * inflationPrices) / 2 ** 19);
    if (price === 0) price = Math.min(1, Math.max(-1, base.start));
    prices[name] = price;
  }
  return prices;
}
