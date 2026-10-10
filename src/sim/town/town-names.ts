import { nextRandom, type Randomizer } from '../core/random';

// Port of table/townname.h: _name_original_english_1.._6
const PREFIX = ['Great ', 'Little ', 'New ', 'Fort '] as const;
const PART_2 = [
  'Wr',
  'B',
  'C',
  'Ch',
  'Br',
  'D',
  'Dr',
  'F',
  'Fr',
  'Fl',
  'G',
  'Gr',
  'H',
  'L',
  'M',
  'N',
  'P',
  'Pr',
  'Pl',
  'R',
  'S',
  'S',
  'Sl',
  'T',
  'Tr',
  'W',
] as const;
const PART_3 = ['ar', 'a', 'e', 'in', 'on', 'u', 'un', 'en'] as const;
const PART_4 = ['n', 'ning', 'ding', 'd', '', 't', 'fing'] as const;
const PART_5 = [
  'ville',
  'ham',
  'field',
  'ton',
  'town',
  'bridge',
  'bury',
  'wood',
  'ford',
  'hall',
  'ston',
  'way',
  'stone',
  'borough',
  'ley',
  'head',
  'bourne',
  'pool',
  'worth',
  'hill',
  'well',
  'hattan',
  'burg',
] as const;
const SUFFIX = [
  '-on-sea',
  ' Bay',
  ' Market',
  ' Cross',
  ' Bridge',
  ' Falls',
  ' City',
  ' Ridge',
  ' Springs',
] as const;

/** Port of townname.cpp:ReplaceEnglishWords (original generator), in C++ order. */
const REPLACEMENTS: readonly (readonly [string, string])[] = [
  ['Ce', 'Ke'],
  ['Ci', 'Ki'],
  ['Cunt', 'East'],
  ['Slag', 'Pits'],
  ['Slut', 'Edin'],
  ['Drar', 'Quar'],
  ['Dreh', 'Bash'],
  ['Frar', 'Shor'],
  ['Grar', 'Aber'],
  ['Brar', 'Over'],
  ['Wrar', 'Inve'],
];

/** Port of townname.cpp:MAX_LENGTH_TOWN_NAME_CHARS. */
const MAX_NAME_LENGTH = 32;

/** Port of townname.cpp:SeedChance. */
const seedChance = (shift: number, max: number, seed: number): number =>
  Math.floor(((((seed >>> shift) & 0xffff) * max) >>> 0) / 0x10000);

/** Port of townname.cpp:SeedChanceBias. */
const seedChanceBias = (shift: number, max: number, seed: number, bias: number): number =>
  seedChance(shift, max + bias, seed) - bias;

/** Port of townname.cpp:MakeEnglishOriginalTownName (the name is rebuilt from the 32-bit seed). */
export function townName(seed: number): string {
  let name = '';
  const first = seedChanceBias(0, PREFIX.length, seed, 50);
  if (first >= 0) name += PREFIX[first]!;
  name += PART_2[seedChance(4, PART_2.length, seed)]!;
  name += PART_3[seedChance(7, PART_3.length, seed)]!;
  name += PART_4[seedChance(10, PART_4.length, seed)]!;
  name += PART_5[seedChance(13, PART_5.length, seed)]!;
  const last = seedChanceBias(15, SUFFIX.length, seed, 60);
  if (last >= 0) name += SUFFIX[last]!;
  for (const [from, to] of REPLACEMENTS)
    if (name.startsWith(from)) name = to + name.slice(from.length);
  return name;
}

/**
 * Port of townname.cpp:GenerateTownName / VerifyTownName. With `used`, a name already in the set is
 * refused and the accepted one is inserted; with `used === null` the name must differ from
 * `existing` (the names of the towns on the map). Returns the 32-bit seed or null.
 */
export function generateTownName(
  random: Randomizer,
  used: Set<string> | null,
  existing: readonly string[] = [],
): number | null {
  for (let tries = 1000; tries > 0; tries--) {
    const seed = nextRandom(random);
    const name = townName(seed);
    if (name.length >= MAX_NAME_LENGTH) continue;
    if (used === null) {
      if (existing.includes(name)) continue;
    } else {
      if (used.has(name)) continue;
      used.add(name);
    }
    return seed;
  }
  return null;
}
