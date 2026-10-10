import { describe, expect, it } from 'vitest';
import type { OttdPoint } from '../render/projection';
import { createEmptyGame } from '../sim/game';
import { DiagDir } from '../sim/map/geometry';
import { tileXY } from '../sim/map/map';
import { Axis, Track } from '../sim/track/track';
import { planBuild, type BuildOptions } from './construction';

const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const T = (x: number, y: number): number => tileXY(map, x, y);
const OPTIONS: BuildOptions = { remove: false, stationAxis: Axis.X, depotDir: DiagDir.NW };

describe('planBuild: one gesture, one command (rail_gui.cpp, terraform_gui.cpp)', () => {
  it('turns a rail drag into CMD_BUILD_RAILROAD_TRACK with its ghost pieces', () => {
    const plan = planBuild(map, 'rail', OPTIONS, P(10, 10), P(14, 10), false)!;
    expect([plan.command, plan.header, plan.rails.length, plan.tiles]).toEqual([
      { type: 'buildRailroadTrack', endTile: T(14, 10), startTile: T(10, 10), track: Track.X },
      'header.cantBuildRail',
      5,
      [],
    ]);
  });

  it('turns a click into CMD_BUILD_SINGLE_RAIL, and removes in remove mode', () => {
    expect(planBuild(map, 'rail', OPTIONS, P(10, 10), P(10, 10, 2, 7), false)).toEqual({
      command: { type: 'buildRail', tile: T(10, 10), track: Track.X },
      header: 'header.cantBuildRail',
      rails: [{ tile: T(10, 10), track: Track.X }],
      tiles: [],
    });
    expect(
      planBuild(map, 'rail', { ...OPTIONS, remove: true }, P(10, 10), P(14, 10), false)?.command,
    ).toEqual({
      type: 'removeRailroadTrack',
      endTile: T(14, 10),
      startTile: T(10, 10),
      track: Track.X,
    });
  });

  it('sizes a station from the dragged rectangle and the chosen axis (HandleStationPlacement)', () => {
    expect(planBuild(map, 'station', OPTIONS, P(10, 10, 3, 3), P(30, 10), false)?.command).toEqual({
      type: 'buildRailStation',
      tile: T(10, 10),
      axis: Axis.X,
      numTracks: 1,
      platLength: 12,
    });
    const y = planBuild(
      map,
      'station',
      { ...OPTIONS, stationAxis: Axis.Y },
      P(12, 11),
      P(10, 10),
      false,
    )!;
    expect([y.command, y.tiles.length]).toEqual([
      { type: 'buildRailStation', tile: T(10, 10), axis: Axis.Y, numTracks: 3, platLength: 2 },
      6,
    ]);
    expect(
      planBuild(map, 'station', { ...OPTIONS, remove: true }, P(10, 10), P(12, 10), false)?.command,
    ).toEqual({
      type: 'removeFromRailStation',
      start: T(10, 10),
      end: T(12, 10),
    });
  });

  it('places a depot where the pointer is, facing the chosen exit', () => {
    expect(planBuild(map, 'depot', OPTIONS, P(10, 10), P(11, 12), false)).toEqual({
      command: { type: 'buildTrainDepot', tile: T(11, 12), dir: DiagDir.NW },
      header: 'header.cantBuildDepot',
      rails: [],
      tiles: [T(11, 12)],
    });
  });

  it('demolishes the dragged area, diagonally with Ctrl (CMD_CLEAR_AREA)', () => {
    const plan = planBuild(map, 'demolish', OPTIONS, P(10, 10), P(11, 11), false)!;
    expect([plan.command, plan.tiles.length]).toEqual([
      { type: 'clearArea', endTile: T(11, 11), startTile: T(10, 10), diagonal: false },
      4,
    ]);
    expect(planBuild(map, 'demolish', OPTIONS, P(10, 10), P(10, 12), true)?.tiles.length).toBe(5);
  });

  it('ignores gestures that start or end outside the map', () => {
    expect(planBuild(map, 'rail', OPTIONS, P(10, 10), { x: -3, y: 40 }, false)).toBeNull();
    expect(planBuild(map, 'demolish', OPTIONS, { x: 40, y: 64 * 16 }, P(10, 10), false)).toBeNull();
  });
});
