import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom } from '../core/random';
import { generateTownName, townName } from './town-names';

const NAME =
  /^(Great |Little |New |Fort )?[A-Z][a-z]*(-on-sea| Bay| Market| Cross| Bridge| Falls| City| Ridge| Springs)?$/;
const REPLACED = [
  'Ce',
  'Ci',
  'Cunt',
  'Slag',
  'Slut',
  'Drar',
  'Dreh',
  'Frar',
  'Grar',
  'Brar',
  'Wrar',
];

const randomNames = (count: number): string[] => {
  const r = createRandomizer(99);
  return Array.from({ length: count }, () => townName(nextRandom(r)));
};

describe('English (Original) town names (port of townname.cpp)', () => {
  it.each([
    [0, 'Invenville'],
    [0xffffffff, 'Fort Wenfingburg Springs'],
    [2193152, 'Kenville'],
  ])('seed %i is %s', (seed, name) => {
    expect(townName(seed)).toBe(name);
  });

  it('builds every name from the OpenTTD tables, shorter than 32 characters', () => {
    for (const name of randomNames(2000)) {
      expect(name).toMatch(NAME);
      expect(name.length).toBeLessThan(32);
    }
  });

  it('never starts a name with a replaced pattern', () => {
    for (const name of randomNames(2000))
      expect(REPLACED.some((p) => name.startsWith(p))).toBe(false);
  });

  it('draws again when the name is taken, and records the new one (GenerateTownName)', () => {
    const used = new Set([townName(536872454)]);
    expect(generateTownName(createRandomizer(12345), used)).toBe(3515126559);
    expect(used.has(townName(3515126559))).toBe(true);
  });
});
