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

export const chunkOfTile = (x: number, y: number): { col: number; row: number } => ({
  col: Math.floor(y / CHUNK_TILES),
  row: Math.floor(x / CHUNK_TILES),
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
