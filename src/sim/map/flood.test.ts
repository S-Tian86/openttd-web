import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, tick } from '../game';
import { newTown } from '../town/town';
import { Axis, Track } from '../track/track';
import { DiagDir } from './geometry';
import { getTileType, tileXY, TileType } from './map';
import { makeRoadNormal, RoadBits } from './road-map';
import { makeSea } from './water';

describe('flooding player construction (water_cmd.cpp:DoFloodTile)', () => {
  it('washes away rail, a depot, a station and a crossing, and their counters and pools', () => {
    const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const at = (x: number, y: number): number => tileXY(g.map, x, y);
    g.towns.push(newTown(0, at(50, 50), 0, false));
    // A basin at height 0: sea round flat land at sea level, as after bulldozing sea.
    for (let y = 10; y <= 30; y++) for (let x = 10; x <= 30; x++) g.map.height[at(x, y)] = 0;
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        if (y < 15 || y > 25 || x < 15 || x > 25) makeSea(g.map, at(x, y));
      }
    }
    makeRoadNormal(g.map, at(15, 20), RoadBits.Y, 0);
    const built = [
      execute(g, { type: 'buildRail', tile: at(15, 20), track: Track.X }, 'exec'), // crossing
      execute(g, { type: 'buildRail', tile: at(15, 17), track: Track.X }, 'exec'),
      execute(g, { type: 'buildRail', tile: at(15, 17), track: Track.Y }, 'exec'),
      execute(g, { type: 'buildTrainDepot', tile: at(15, 22), dir: DiagDir.NE }, 'exec'),
      execute(
        g,
        { type: 'buildRailStation', tile: at(16, 15), axis: Axis.X, numTracks: 1, platLength: 3 },
        'exec',
      ),
    ];
    expect(built.map((r) => r.ok)).toEqual([true, true, true, true, true]);
    expect(getTileType(g.map, at(15, 20))).toBe(TileType.Road); // a level crossing
    // crossing 2, two crossed tracks 4 (railInfrastructurePieces), depot 1, station 3
    expect(g.company.infrastructure).toEqual({ rail: 2 + 4 + 1 + 3, station: 3 });
    expect([g.depots.length, g.stations.length]).toEqual([1, 1]);

    for (let i = 0; i < 20_000; i++) tick(g);

    const tiles = [at(15, 20), at(15, 17), at(15, 22), at(16, 15), at(17, 15), at(18, 15)];
    expect(tiles.map((t) => getTileType(g.map, t))).toEqual(tiles.map(() => TileType.Water));
    expect(g.company.infrastructure).toEqual({ rail: 0, station: 0 });
    expect(g.depots).toEqual([null]); // the slot is freed
    expect(g.stations).toEqual([null]); // deleted by onTickStation once unused
  });
});
