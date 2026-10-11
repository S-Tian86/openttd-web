/** Sprites drawn as 64x64 ground tiles (the tilemap layer). */
export const GROUND_SPRITE_IDS = [
  'terrain.void',
  'terrain.grass.0',
  'terrain.grass.1',
  'terrain.grass.2',
  'terrain.grass.3',
  'terrain.unknown',
  'terrain.rough',
  'terrain.rocks',
  'water.sea',
  'water.coast.1',
  'water.coast.2',
  'water.coast.3',
  'water.coast.4',
  'water.coast.6',
  'water.coast.7',
  'water.coast.8',
  'water.coast.9',
  'water.coast.11',
  'water.coast.12',
  'water.coast.13',
  'water.coast.14',
  'road.1',
  'road.2',
  'road.3',
  'road.4',
  'road.5',
  'road.6',
  'road.7',
  'road.8',
  'road.9',
  'road.10',
  'road.11',
  'road.12',
  'road.13',
  'road.14',
  'road.15',
  'ground.house',
  'ground.industry',
] as const;

/** Sprites drawn as tall 64x128 objects on the blitter layer; the tile footprint is the bottom 64 px. */
export const OBJECT_SPRITE_IDS = [
  'tree.small',
  'tree.medium',
  'tree.large',
  'tree.dying',
  'tree.dead',
  'house.construction.0',
  'house.construction.1',
  'house.construction.2',
  'house.church',
  'house.town-houses',
  'house.statue',
  'house.fountain',
  'house.park',
  'house.shops-offices',
  'house.stadium.0',
  'house.stadium.1',
  'house.stadium.2',
  'house.stadium.3',
  'house.old-houses',
  'house.cottages',
  'house.houses',
  'house.flats',
  'house.theatre',
  'house.cinema',
  'industry.gfx.0',
  'industry.gfx.1',
  'industry.gfx.2',
  'industry.gfx.3',
  'industry.gfx.4',
  'industry.gfx.5',
  'industry.gfx.6',
  'industry.gfx.7',
  'industry.gfx.8',
  'industry.gfx.9',
  'industry.gfx.10',
  'object.unknown',
] as const;

/** Height in pixels of an object sprite. */
export const OBJECT_PX_HEIGHT = 128;

/** Every logical sprite the game draws. Grows with each block. */
export const SPRITE_IDS = [...GROUND_SPRITE_IDS, ...OBJECT_SPRITE_IDS] as const;
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
