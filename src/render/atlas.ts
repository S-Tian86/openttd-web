export const ATLAS_COLUMNS = 16;

/** Pixel position of cell `index` in a sprite atlas laid out in rows of ATLAS_COLUMNS cells. */
export const atlasCell = (
  index: number,
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: (index % ATLAS_COLUMNS) * width,
  y: Math.floor(index / ATLAS_COLUMNS) * height,
});
