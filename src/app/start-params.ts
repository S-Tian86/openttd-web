export interface StartParams {
  seed?: number;
  mapLogX?: number;
  mapLogY?: number;
  /** Initial camera tile. */
  focus?: { x: number; y: number };
}

const MAX_SEED = 0xffffffff;

/** log2 of a power of two in 64..1024, or null. */
function mapLog(text: string): number | null {
  const size = Number(text);
  const log = Math.log2(size);
  return Number.isInteger(log) && log >= 6 && log <= 10 ? log : null;
}

/** Reads `?seed=N&size=WxH&tile=X,Y` (ruling R14); invalid values are ignored. */
export function parseStartParams(search: string): StartParams {
  const query = new URLSearchParams(search);
  const params: StartParams = {};

  const seed = query.get('seed');
  if (seed !== null && /^\d+$/.test(seed) && Number(seed) <= MAX_SEED) params.seed = Number(seed);

  const size = /^(\d+)x(\d+)$/.exec(query.get('size') ?? '');
  if (size !== null) {
    const logX = mapLog(size[1]!);
    const logY = mapLog(size[2]!);
    if (logX !== null && logY !== null) {
      params.mapLogX = logX;
      params.mapLogY = logY;
    }
  }

  const tile = /^(\d+),(\d+)$/.exec(query.get('tile') ?? '');
  if (tile !== null) params.focus = { x: Number(tile[1]), y: Number(tile[2]) };

  return params;
}
