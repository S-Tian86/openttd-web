/** Every logical sprite the game draws in block 1.1. Grows with each block. */
export const SPRITE_IDS = [
  'terrain.void',
  'terrain.grass.0',
  'terrain.grass.1',
  'terrain.grass.2',
  'terrain.grass.3',
  'terrain.unknown',
] as const;
export type SpriteId = (typeof SPRITE_IDS)[number];

export const THEMES_INDEX_PATH = 'themes/index.json';

export interface Theme {
  id: string;
  name: string;
  author: string;
  license: string;
  tokens: string;
  sprites: Partial<Record<SpriteId, string>>;
}

const SPRITE_ID_SET: ReadonlySet<string> = new Set(SPRITE_IDS);
/** Files stay inside the theme folder: no absolute paths, no "..", no URLs. */
const SAFE_PATH = /^(?!.*\.\.)[a-z0-9][a-z0-9._/-]*$/i;

function requireString(obj: Record<string, unknown>, field: string, path = false): string {
  const value = obj[field];
  if (typeof value !== 'string' || value === '' || (path && !SAFE_PATH.test(value))) {
    throw new Error(`Invalid theme field "${field}"`);
  }
  return value;
}

/** Validates an untrusted theme.json (master plan §2.10, §2.12). */
export function parseTheme(json: unknown): Theme {
  if (typeof json !== 'object' || json === null) throw new Error('Invalid theme: not an object');
  const obj = json as Record<string, unknown>;
  const id = requireString(obj, 'id');
  const name = requireString(obj, 'name');
  const author = requireString(obj, 'author');
  const license = requireString(obj, 'license');
  const tokens = requireString(obj, 'tokens', true);
  const sprites = obj['sprites'];
  if (typeof sprites !== 'object' || sprites === null)
    throw new Error('Invalid theme field "sprites"');
  const parsed: Partial<Record<SpriteId, string>> = {};
  for (const [spriteId, file] of Object.entries(sprites)) {
    if (!SPRITE_ID_SET.has(spriteId)) throw new Error(`Invalid theme sprite id "${spriteId}"`);
    if (typeof file !== 'string' || !SAFE_PATH.test(file))
      throw new Error(`Invalid theme field "sprites.${spriteId}"`);
    parsed[spriteId as SpriteId] = file;
  }
  return { id, name, author, license, tokens, sprites: parsed };
}

/** The file for a sprite: the theme's, else the fallback theme's, else "terrain.unknown". */
export function resolveSprite(theme: Theme, fallback: Theme, id: SpriteId): string {
  return (
    theme.sprites[id] ??
    fallback.sprites[id] ??
    theme.sprites['terrain.unknown'] ??
    fallback.sprites['terrain.unknown'] ??
    ''
  );
}
