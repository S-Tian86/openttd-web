// tools/blocks-theme.mjs — placeholder sprites for the "blocks" theme (block 1.2). Run: node tools/blocks-theme.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'public/themes/blocks';
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const grid =
  '<rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="#ffffff" stroke-opacity="0.3"/>';
const tile = (fill, extra = '') =>
  svg(64, 64, `<rect width="64" height="64" fill="${fill}"/>${extra}${grid}`);
const CORNERS = { 1: [0, 64], 2: [64, 64], 4: [64, 0], 8: [0, 0] }; // W, S, E, N
const corner = ([x, y]) =>
  `<polygon points="${x},${y} ${x === 0 ? 36 : 28},${y} ${x},${y === 0 ? 36 : 28}" fill="#e8d9a8"/>`;
const coast = (slope) =>
  tile(
    '#6ec6e8',
    Object.entries(CORNERS)
      .filter(([bit]) => slope & Number(bit))
      .map(([, c]) => corner(c))
      .join(''),
  );
const ARMS = {
  1: '<rect x="0" y="22" width="32" height="20"/>',
  2: '<rect x="22" y="32" width="20" height="32"/>',
  4: '<rect x="32" y="22" width="32" height="20"/>',
  8: '<rect x="22" y="0" width="20" height="32"/>',
};
const road = (bits) =>
  tile(
    '#8fd18a',
    `<g fill="#8a8d91"><rect x="22" y="22" width="20" height="20"/>${Object.entries(ARMS)
      .filter(([bit]) => bits & Number(bit))
      .map(([, r]) => r)
      .join('')}</g>`,
  );
const object = (body) => svg(64, 128, body);
const tree = (r, crown) =>
  object(
    `<rect x="30" y="${116 - r}" width="4" height="${r}" fill="#7a5230"/><circle cx="32" cy="${112 - r}" r="${r}" fill="${crown}"/>`,
  );
const house = (h, wall, roof) =>
  object(
    `<rect x="10" y="${120 - h}" width="44" height="${h}" fill="${wall}" stroke="#2d4a3e"/><polygon points="6,${122 - h} 32,${100 - h} 58,${122 - h}" fill="${roof}" stroke="#2d4a3e"/>`,
  );

const sprites = {
  'terrain.rough': tile(
    '#a3c27a',
    '<g fill="#7f9c5a"><circle cx="16" cy="18" r="4"/><circle cx="44" cy="30" r="5"/><circle cx="24" cy="46" r="4"/></g>',
  ),
  'terrain.rocks': tile(
    '#b9b4a8',
    '<g fill="#8c877c"><ellipse cx="20" cy="22" rx="9" ry="6"/><ellipse cx="44" cy="40" rx="10" ry="7"/></g>',
  ),
  'water.sea': tile(
    '#6ec6e8',
    '<path d="M8 32 q8 -6 16 0 t16 0 t16 0" fill="none" stroke="#a8e0f2" stroke-width="3"/>',
  ),
  'ground.house': tile('#d9cfc0'),
  'ground.industry': tile(
    '#c2b8a8',
    '<rect x="4" y="4" width="56" height="56" fill="none" stroke="#9a9080" stroke-width="2"/>',
  ),
  'tree.small': tree(8, '#5fbf6a'),
  'tree.medium': tree(12, '#4caf5c'),
  'tree.large': tree(16, '#3f9b4f'),
  'tree.dying': tree(14, '#c9a24a'),
  'tree.dead': object(
    '<path d="M32 118 V90 M32 100 l-8 -8 M32 96 l8 -10" stroke="#7a5230" stroke-width="4" fill="none"/>',
  ),
  'house.church': object(
    '<rect x="14" y="70" width="36" height="50" fill="#f4efe6" stroke="#2d4a3e"/><polygon points="24,70 32,30 40,70" fill="#ff8fab" stroke="#2d4a3e"/>',
  ),
  'house.town-houses': house(36, '#ffd6a5', '#e76f51'),
  'house.statue': object(
    '<rect x="26" y="100" width="12" height="18" fill="#b9b4a8"/><circle cx="32" cy="92" r="7" fill="#b9b4a8"/>',
  ),
  'house.fountain': object(
    '<ellipse cx="32" cy="108" rx="20" ry="8" fill="#6ec6e8" stroke="#8c877c" stroke-width="3"/>',
  ),
  'house.park': object(
    '<rect x="8" y="72" width="48" height="48" rx="10" fill="#7fd17a"/><circle cx="24" cy="92" r="8" fill="#3f9b4f"/>',
  ),
  'house.shops-offices': house(56, '#cdb4db', '#6d597a'),
  'house.old-houses': house(28, '#e9c46a', '#9c6644'),
  'house.cottages': house(24, '#f4a261', '#9c6644'),
  'house.houses': house(32, '#ffe5ec', '#e76f51'),
  'house.flats': house(76, '#bde0fe', '#457b9d'),
  'house.theatre': house(48, '#ffc8dd', '#b5179e'),
  'house.cinema': house(44, '#fdffb6', '#ef476f'),
  'object.unknown': object(
    '<rect x="12" y="76" width="40" height="40" fill="#ff4fd8"/><path d="M12 76 L52 116 M52 76 L12 116" stroke="#fff" stroke-width="4"/>',
  ),
};
for (const slope of [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14])
  sprites[`water.coast.${slope}`] = coast(slope);
for (let bits = 1; bits <= 15; bits++) sprites[`road.${bits}`] = road(bits);
for (let stage = 0; stage <= 2; stage++)
  sprites[`house.construction.${stage}`] = object(
    `<rect x="10" y="${104 - stage * 16}" width="44" height="${16 + stage * 16}" fill="#e9d8a6"/><path d="M10 120 V${88 - stage * 16} M54 120 V${88 - stage * 16} M10 ${96 - stage * 16} H54" stroke="#9c6644" stroke-width="3"/>`,
  );
for (let part = 0; part <= 3; part++)
  sprites[`house.stadium.${part}`] = object(
    `<rect x="0" y="64" width="64" height="64" fill="#7fd17a"/><rect x="0" y="${part < 2 ? 64 : 112}" width="64" height="16" fill="#f4efe6" stroke="#2d4a3e"/>`,
  );
for (let gfx = 0; gfx <= 10; gfx++) {
  const tall = gfx === 1 || gfx === 8;
  const colour = gfx <= 6 ? '#5c5c66' : '#9aa5b1';
  const top = tall ? 20 : 76;
  const sparks =
    gfx === 10
      ? '<path d="M20 70 l8 10 l-6 4 l10 12" stroke="#ffd166" stroke-width="4" fill="none"/>'
      : '';
  sprites[`industry.gfx.${gfx}`] = object(
    `<rect x="${tall ? 22 : 8}" y="${top}" width="${tall ? 20 : 48}" height="${120 - top}" fill="${colour}" stroke="#2d4a3e"/>${sparks}`,
  );
}

const themePath = `${DIR}/theme.json`;
const theme = JSON.parse(readFileSync(themePath, 'utf8'));
for (const [id, body] of Object.entries(sprites)) {
  const file = `sprites/${id.replaceAll('.', '-')}.svg`;
  writeFileSync(`${DIR}/${file}`, body);
  theme.sprites[id] = file;
}
writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);
