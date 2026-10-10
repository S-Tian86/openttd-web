import { nextRandom, type Randomizer } from '../core/random';
import { ClearGround, setClearGroundDensity } from '../map/clear';
import { randomTile, scaleBySize, tileOffsByDiagDir, type DiagDir } from '../map/geometry';
import { getTileType, TileType, type MapState } from '../map/map';

/** i and gi of GenerateClearTile, from its first two draws. */
export function clearTileAttempts(
  map: MapState,
  r1: number,
  r2: number,
): { rough: number; rocks: number } {
  return {
    rough: scaleBySize(map, (r1 & 0x3ff) + 0x400),
    rocks: scaleBySize(map, (r2 & 0x7f) + 0x80),
  };
}

/** Port of clear_cmd.cpp:GenerateClearTile (temperate: no desert). */
export function generateClearTile(map: MapState, random: Randomizer): void {
  const { rough, rocks } = clearTileAttempts(map, nextRandom(random), nextRandom(random));
  for (let i = 0; i < rough; i++) {
    const t = randomTile(map, nextRandom(random));
    if (getTileType(map, t) === TileType.Clear) setClearGroundDensity(map, t, ClearGround.Rough, 3);
  }
  for (let i = 0; i < rocks; i++) {
    const r = nextRandom(random);
    let t = randomTile(map, r);
    if (getTileType(map, t) !== TileType.Clear) continue;
    let j = ((r >>> 16) & 0xf) + 5;
    patch: for (;;) {
      setClearGroundDensity(map, t, ClearGround.Rocks, 3);
      let next: number;
      do {
        if (--j === 0) break patch;
        next = t + tileOffsByDiagDir(map, (nextRandom(random) & 3) as DiagDir);
      } while (getTileType(map, next) !== TileType.Clear);
      t = next;
    }
  }
}
