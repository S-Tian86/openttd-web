import { describe, expect, it } from 'vitest';
import { execute, type Command } from './command/command';
import { createRandomizer, randomRange } from './core/random';
import { hashGameState, tick, type GameState } from './game';
import { getTileType, TileType, tileX, tileXY, tileY } from './map/map';
import { getDepotIndex, getTrackBits, isPlainRail, isRailDepotTile } from './map/rail-map';
import { isLevelCrossingTile, LEVELCROSSING_TRACKBIT_FACTOR } from './map/road-map';
import { getStationIndex, isRailStationTile } from './map/station-map';
import type { Axis, Track } from './track/track';
import type { DiagDir } from './map/geometry';
import { railInfrastructurePieces } from './track/rail-cmd';
import { createGame } from './world/generate';

/** company.infrastructure counted from the map, as OpenTTD's AfterLoad recount does. */
function infrastructureFromMap(g: GameState): { rail: number; station: number } {
  let rail = 0;
  let station = 0;
  for (let t = 0; t < g.map.size; t++) {
    const type = getTileType(g.map, t);
    if (type === TileType.Railway) {
      rail += isPlainRail(g.map, t) ? railInfrastructurePieces(getTrackBits(g.map, t)) : 1;
    } else if (type === TileType.Road && isLevelCrossingTile(g.map, t)) {
      rail += LEVELCROSSING_TRACKBIT_FACTOR;
    } else if (isRailStationTile(g.map, t)) {
      rail++;
      station++;
    }
  }
  return { rail, station };
}

/** The first disagreement between the depot and station pools and the map, or null. */
function poolMismatch(g: GameState): string | null {
  const { map } = g;
  const inArea = (t: number, a: { tile: number; w: number; h: number }): boolean => {
    const dx = tileX(map, t) - tileX(map, a.tile);
    const dy = tileY(map, t) - tileY(map, a.tile);
    return dx >= 0 && dy >= 0 && dx < a.w && dy < a.h;
  };
  const stationTiles = new Map<number, number>();
  for (let t = 0; t < map.size; t++) {
    if (isRailDepotTile(map, t) && g.depots[getDepotIndex(map, t)]?.xy !== t) {
      return `depot tile ${t} has no depot`;
    }
    if (isRailStationTile(map, t)) {
      const index = getStationIndex(map, t);
      const area = g.stations[index]?.trainStation ?? null;
      if (area === null || !inArea(t, area)) return `station tile ${t} is outside its station`;
      stationTiles.set(index, (stationTiles.get(index) ?? 0) + 1);
    }
  }
  for (const d of g.depots) {
    if (d !== null && (!isRailDepotTile(map, d.xy) || getDepotIndex(map, d.xy) !== d.index)) {
      return `depot ${d.index} lost its tile`;
    }
  }
  for (const s of g.stations) {
    if (s !== null && s.trainStation !== null && !stationTiles.has(s.index)) {
      return `station ${s.index} has an area but no tiles`;
    }
  }
  return null;
}

/** The first disagreement of company.infrastructure or the pools with the map, or null. */
function counterMismatch(g: GameState): string | null {
  const counted = JSON.stringify(infrastructureFromMap(g));
  const kept = JSON.stringify(g.company.infrastructure);
  return kept !== counted ? `infrastructure ${kept}, map ${counted}` : poolMismatch(g);
}

describe('construction invariants (fuzz)', () => {
  it('keeps test mode pure, test and exec in step, and the counters in step with the map', () => {
    const g = createGame({ mapLogX: 6, mapLogY: 6, seed: 1, townCount: 1 });
    g.company.money = 50_000_000;
    const r = createRandomizer(117);
    const rnd = (n: number): number => randomRange(r, n);
    const town = g.towns[0]!;
    const near = (x: number, y: number, d: number): number =>
      tileXY(
        g.map,
        Math.min(Math.max(x + rnd(2 * d + 1) - d, 1), g.map.sizeX - 2),
        Math.min(Math.max(y + rnd(2 * d + 1) - d, 1), g.map.sizeY - 2),
      );
    const nearBy = (t: number, d: number): number => near(tileX(g.map, t), tileY(g.map, t), d);
    const seen = new Set<string>();
    /** The last rail built: half of the removals aim at it, or they would rarely hit rail. */
    let built: { tile: number; track: Track } | null = null;
    let problem: string | null = null;
    for (let step = 0; step < 1000 && problem === null; step++) {
      const random = near(tileX(g.map, town.xy), tileY(g.map, town.xy), 10);
      const target: { tile: number; track: Track } =
        built !== null && rnd(2) === 0 ? built : { tile: random, track: rnd(6) as Track };
      const { tile: a, track } = target;
      const commands: Command[] = [
        { type: 'landscapeClear', tile: a },
        { type: 'clearArea', endTile: nearBy(a, 3), startTile: a, diagonal: rnd(4) === 0 },
        { type: 'buildRail', tile: a, track },
        { type: 'buildRail', tile: a, track },
        { type: 'removeRail', tile: a, track },
        { type: 'buildRailroadTrack', endTile: nearBy(a, 6), startTile: a, track },
        { type: 'buildRailroadTrack', endTile: nearBy(a, 6), startTile: a, track },
        { type: 'removeRailroadTrack', endTile: nearBy(a, 6), startTile: a, track },
        { type: 'buildTrainDepot', tile: a, dir: rnd(4) as DiagDir },
        {
          type: 'buildRailStation',
          tile: a,
          axis: rnd(2) as Axis,
          numTracks: 1 + rnd(3),
          platLength: 1 + rnd(5),
        },
        { type: 'removeFromRailStation', start: a, end: nearBy(a, 2) },
      ];
      const command = commands[rnd(commands.length)]!;
      const before = hashGameState(g);
      const dirtyBefore = JSON.stringify([...g.dirtyTiles]);
      const test = execute(g, command, 'test');
      const testMutated =
        hashGameState(g) !== before || JSON.stringify([...g.dirtyTiles]) !== dirtyBefore;
      const exec = execute(g, command, 'exec');
      seen.add(`${command.type}:${exec.ok}`);
      if (exec.ok && (command.type === 'buildRail' || command.type === 'buildRailroadTrack')) {
        built = { tile: a, track };
      }
      for (let t = 0; t < g.map.size; t++) if (isLevelCrossingTile(g.map, t)) seen.add('crossing');
      if (testMutated) problem = 'test mode changed the state';
      else if (!exec.ok && hashGameState(g) !== before) problem = 'a failed exec changed the state';
      // clearArea is NoTest: OpenTTD runs it without the test pass, so they may differ.
      else if (command.type !== 'clearArea' && JSON.stringify(exec) !== JSON.stringify(test)) {
        problem = `test ${JSON.stringify(test)} but exec ${JSON.stringify(exec)}`;
      } else problem = counterMismatch(g);
      if (problem === null && step % 10 === 9) {
        for (let i = 0; i < 50; i++) tick(g);
        problem = counterMismatch(g);
        if (problem !== null) problem = `after ticks, ${problem}`;
      }
      if (problem !== null) problem = `step ${step}, ${JSON.stringify(command)}: ${problem}`;
    }
    expect(problem).toBeNull();
    // Positive control: every command type both succeeded and failed, and a crossing was built.
    expect([...seen].toSorted()).toEqual(
      [
        'buildRail',
        'buildRailStation',
        'buildRailroadTrack',
        'buildTrainDepot',
        'clearArea',
        'crossing',
        'landscapeClear',
        'removeFromRailStation',
        'removeRail',
        'removeRailroadTrack',
      ]
        .flatMap((t) => (t === 'crossing' ? [t] : [`${t}:false`, `${t}:true`]))
        .toSorted(),
    );
  });
});
