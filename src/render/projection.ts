export const TILE_PX = 64;
export const CHUNK_TILES = 32;
const CHUNK_PX = TILE_PX * CHUNK_TILES;

export const tileToWorld = (x: number, y: number): { px: number; py: number } => ({
  px: y * TILE_PX,
  py: x * TILE_PX,
});

export const worldToTile = (px: number, py: number): { x: number; y: number } => ({
  x: Math.floor(py / TILE_PX),
  y: Math.floor(px / TILE_PX),
});

/** OpenTTD world units per tile (tile_type.h:TILE_SIZE). */
export const TILE_UNITS = 16;

/** A point in OpenTTD world units: `x` along the tile X axis, so it lies in tile (x >> 4, y >> 4). */
export interface OttdPoint {
  x: number;
  y: number;
}

/** World pixels to OpenTTD world units: a 64-px tile is 16 units, and screen x is tile y. */
export const worldToOttd = (px: number, py: number): OttdPoint => ({
  x: Math.floor((py * TILE_UNITS) / TILE_PX),
  y: Math.floor((px * TILE_UNITS) / TILE_PX),
});

export const chunkOfTile = (x: number, y: number): { col: number; row: number } => ({
  col: Math.floor(y / CHUNK_TILES),
  row: Math.floor(x / CHUNK_TILES),
});

export const chunkCellToTile = (
  col: number,
  row: number,
  cx: number,
  cy: number,
): { x: number; y: number } => ({
  x: row * CHUNK_TILES + cy,
  y: col * CHUNK_TILES + cx,
});

export const tileToChunkCell = (
  x: number,
  y: number,
): { col: number; row: number; cx: number; cy: number } => ({
  col: Math.floor(y / CHUNK_TILES),
  row: Math.floor(x / CHUNK_TILES),
  cx: y % CHUNK_TILES,
  cy: x % CHUNK_TILES,
});

export function visibleChunks(
  view: { x: number; y: number; width: number; height: number },
  mapSizeX: number,
  mapSizeY: number,
): { col: number; row: number }[] {
  const maxCol = mapSizeY / CHUNK_TILES - 1;
  const maxRow = mapSizeX / CHUNK_TILES - 1;
  const c0 = Math.max(0, Math.floor(view.x / CHUNK_PX) - 1);
  const c1 = Math.min(maxCol, Math.floor((view.x + view.width - 1) / CHUNK_PX) + 1);
  const r0 = Math.max(0, Math.floor(view.y / CHUNK_PX) - 1);
  const r1 = Math.min(maxRow, Math.floor((view.y + view.height - 1) / CHUNK_PX) + 1);
  const chunks: { col: number; row: number }[] = [];
  for (let row = r0; row <= r1; row++)
    for (let col = c0; col <= c1; col++) chunks.push({ col, row });
  return chunks;
}
