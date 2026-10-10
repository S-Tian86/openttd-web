import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GROUND_SPRITE_IDS,
  OBJECT_SPRITE_IDS,
  parseTheme,
  resolveSprite,
  SPRITE_IDS,
} from './theme';

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

describe('theme contract', () => {
  const blocks = parseTheme(read('public/themes/blocks/theme.json'));

  it('the default theme provides every sprite the game requests, and the files exist', () => {
    for (const id of SPRITE_IDS) {
      const file = blocks.sprites[id];
      expect(file).toBeDefined();
      expect(existsSync(`public/themes/blocks/${file}`)).toBe(true);
    }
    expect(existsSync(`public/themes/blocks/${blocks.tokens}`)).toBe(true);
  });

  it('splits sprites into ground and object lists covering every id once', () => {
    expect([...GROUND_SPRITE_IDS, ...OBJECT_SPRITE_IDS].toSorted()).toEqual(
      [...SPRITE_IDS].toSorted(),
    );
    expect(new Set(SPRITE_IDS).size).toBe(SPRITE_IDS.length);
  });

  it('lists the built-in themes in the index', () => {
    expect(read('public/themes/index.json')).toEqual([{ id: 'blocks', path: 'themes/blocks/' }]);
  });

  it('rejects malformed themes with the bad field named', () => {
    expect(() => parseTheme({ id: 'x' })).toThrow(/name/);
    expect(() => parseTheme({ ...blocks, sprites: { 'terrain.grass.0': 7 } })).toThrow(/sprites/);
    expect(() => parseTheme({ ...blocks, sprites: { 'not.a.sprite': 'a.svg' } })).toThrow(
      /not\.a\.sprite/,
    );
    expect(() => parseTheme({ ...blocks, tokens: '../evil.css' })).toThrow(/tokens/);
  });

  it('falls back to the default theme, then to the unknown sprite', () => {
    const partial = parseTheme({ ...blocks, id: 'partial', sprites: {} });
    expect(resolveSprite(partial, blocks, 'terrain.grass.3')).toBe(
      blocks.sprites['terrain.grass.3'],
    );
    const empty = parseTheme({ ...blocks, id: 'empty', sprites: { 'terrain.unknown': 'u.svg' } });
    expect(resolveSprite(empty, empty, 'terrain.void')).toBe('u.svg');
  });
});
