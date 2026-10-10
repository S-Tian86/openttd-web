import type { HouseZone } from './town';

export const MAX_YEAR = 5_000_000;
/** Relative probability of every original house (HouseSpec::probability). */
export const HOUSE_PROBABILITY = 16;

export type HouseSize = '1x1' | '1x2' | '2x2' | 'part';

/** The HouseSpec fields Stage 1 uses. Port of table/town_land.h:_original_house_specs. */
export interface HouseSpec {
  id: number;
  minYear: number;
  maxYear: number;
  population: number;
  mailGeneration: number;
  /** Acceptance in eighths: passengers, mail, goods. */
  acceptance: readonly [number, number, number];
  size: HouseSize;
  church: boolean;
  stadium: boolean;
  /** Bit `1 << HouseZone` per town zone the house may appear in. */
  zones: number;
}

/** Zone bits. */
const Z = { E: 1, O: 2, OS: 4, IS: 8, C: 16 } as const;

const spec = (
  id: number,
  minYear: number,
  maxYear: number,
  population: number,
  mailGeneration: number,
  acceptance: readonly [number, number, number],
  size: HouseSize,
  zones: number,
  flags: { church?: boolean; stadium?: boolean } = {},
): HouseSpec => ({
  id,
  minYear,
  maxYear,
  population,
  mailGeneration,
  acceptance,
  size,
  church: flags.church === true,
  stadium: flags.stadium === true,
  zones,
});

// id, years, population, mail, acceptance [passengers, mail, goods] (eighths), size/flags, zones
export const HOUSE_SPECS: readonly HouseSpec[] = [
  spec(0x00, 1963, MAX_YEAR, 187, 70, [8, 3, 4], '1x1', Z.C),
  spec(0x01, 1957, MAX_YEAR, 85, 55, [8, 3, 4], '1x1', Z.C | Z.IS),
  spec(0x02, 1968, MAX_YEAR, 40, 20, [8, 3, 1], '1x1', Z.IS | Z.OS | Z.O),
  spec(0x03, 0, MAX_YEAR, 5, 2, [2, 0, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E, { church: true }),
  spec(0x04, 1975, MAX_YEAR, 220, 85, [10, 4, 6], '1x1', Z.C),
  spec(0x06, 0, MAX_YEAR, 30, 12, [4, 1, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E),
  spec(0x07, 1959, MAX_YEAR, 140, 22, [6, 1, 2], '1x2', Z.C | Z.OS),
  spec(0x08, 1959, MAX_YEAR, 0, 22, [6, 1, 2], 'part', 0),
  spec(0x09, 1945, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.C | Z.IS),
  spec(0x0a, 1945, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.C),
  spec(0x0b, 0, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.OS),
  spec(0x0c, 1935, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.IS),
  spec(0x0d, 1951, MAX_YEAR, 150, 65, [8, 2, 4], '1x1', Z.C | Z.IS),
  spec(0x0e, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x0f, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x10, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x11, 1977, MAX_YEAR, 130, 50, [10, 3, 6], '1x1', Z.C),
  spec(0x12, 1983, MAX_YEAR, 6, 10, [6, 3, 8], '1x1', Z.C),
  spec(0x13, 1985, MAX_YEAR, 110, 55, [6, 2, 6], '1x1', Z.C),
  spec(0x14, 0, MAX_YEAR, 65, 5, [4, 0, 0], '2x2', Z.IS | Z.OS | Z.O | Z.E, { stadium: true }),
  spec(0x15, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x16, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x17, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x18, 0, 1951, 15, 6, [3, 1, 0], '1x1', Z.O | Z.E),
  spec(0x19, 0, 1952, 12, 7, [3, 1, 0], '1x1', Z.E),
  spec(0x1a, 1931, MAX_YEAR, 13, 8, [3, 1, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E),
  spec(0x1b, 1935, MAX_YEAR, 100, 35, [7, 2, 2], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1c, 1963, MAX_YEAR, 170, 50, [8, 3, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1d, 0, 1955, 100, 40, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1e, 1973, MAX_YEAR, 180, 64, [8, 3, 3], '1x1', Z.C | Z.OS),
  spec(0x1f, 0, MAX_YEAR, 35, 23, [8, 2, 2], '1x1', Z.C | Z.IS),
  spec(0x20, 1958, MAX_YEAR, 65, 5, [4, 0, 0], '2x2', Z.IS | Z.OS | Z.O | Z.E, { stadium: true }),
  spec(0x21, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x22, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x23, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x24, 2000, MAX_YEAR, 140, 65, [8, 3, 2], '1x1', Z.C | Z.IS),
  spec(0x27, 1945, MAX_YEAR, 35, 23, [8, 2, 2], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x28, 1983, MAX_YEAR, 180, 5, [8, 2, 3], '2x2', Z.C | Z.IS | Z.OS | Z.O),
  spec(0x29, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
  spec(0x2a, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
  spec(0x2b, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
];

const BY_ID = new Map(HOUSE_SPECS.map((s) => [s.id, s]));

export function houseSpec(id: number): HouseSpec {
  const found = BY_ID.get(id);
  if (found === undefined) throw new RangeError(`Unknown temperate house id ${id}`);
  return found;
}

/** Houses that may appear in a zone, in table order (the temperate bit is implied). */
export const houseCandidates = (zone: HouseZone): HouseSpec[] =>
  HOUSE_SPECS.filter((s) => (s.zones & (1 << zone)) !== 0);
