import {
  addCost,
  CMD_ERROR,
  DoFlag,
  fail,
  succeed,
  type CommandCost,
  type ErrorKey,
} from '../command/cost';
import type { Prices } from '../economy/prices';
import type { GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { FloodingBehaviour, getFloodingBehaviour } from '../map/flood';
import { DiagDir, isValidTile, tileDiffXY, tileOffsByDiagDir } from '../map/geometry';
import { doClearSquare } from '../map/landscape';
import {
  COMPANY_FIRST,
  getTileOwner,
  getTileType,
  OWNER_WATER,
  TileType,
  tileX,
  tileY,
  type MapState,
} from '../map/map';
import {
  getCrossingRailBits,
  getCrossingRoadBits,
  getRoadBits,
  getRoadOwner,
  getTownIndex,
  isLevelCrossingTile,
  isNormalRoadTile,
  LEVELCROSSING_TRACKBIT_FACTOR,
  makeRoadCrossing,
  makeRoadNormal,
  RoadBits,
} from '../map/road-map';
import {
  getRailGroundType,
  getTrackBits,
  isPlainRail,
  makeRailNormal,
  RAILTYPE_RAIL,
  RailGroundType,
  setRailGroundType,
  setTrackBits,
} from '../map/rail-map';
import { Slope, getTileSlopeZ } from '../map/slope';
import { removeTrainDepot } from './depot';
import {
  Axis,
  countBits,
  isDiagonalTrack,
  Track,
  TrackBits,
  TRACK_BITS_AT_EDGE,
  TRACKDELTA,
  trackToTrackBits,
  tracksOverlap,
} from './track';

/** Port of rail.h:RailBuildCost for RAILTYPE_RAIL (cost_multiplier 8, >> 3). */
export const railBuildCost = (p: Prices): number => Math.floor((p.buildRail * 8) / 8);

/** Port of road.h:RoadBuildCost for ROADTYPE_ROAD (cost_multiplier 8, >> 3). */
export const roadBuildCost = (p: Prices): number => (p.buildRoad * 8) >> 3;

/** Port of rail.h:RailClearCost for RAILTYPE_RAIL: max(-53, -56) = -53. */
export const railClearCost = (p: Prices): number =>
  Math.max(p.clearRail, Math.trunc((-railBuildCost(p) * 3) / 4));

/** Infrastructure pieces of a tile's track bits: overlapping pieces count squared (track.md 4.7). */
export const railInfrastructurePieces = (bits: number): number =>
  tracksOverlap(bits) ? countBits(bits) ** 2 : countBits(bits);

const errorKey = (c: CommandCost): ErrorKey | null =>
  c.ok || c.error === null ? null : c.error.key;

/** Port of rail_cmd.cpp:_valid_tracks_on_leveled_foundation, by non-steep Slope (0..14). */
const VALID_TRACKS_ON_LEVELED_FOUNDATION: readonly number[] = [
  TrackBits.None,
  TrackBits.Left,
  TrackBits.Lower,
  TrackBits.Y | TrackBits.Lower | TrackBits.Left,
  TrackBits.Right,
  TrackBits.All,
  TrackBits.X | TrackBits.Lower | TrackBits.Right,
  TrackBits.All,
  TrackBits.Upper,
  TrackBits.X | TrackBits.Upper | TrackBits.Left,
  TrackBits.All,
  TrackBits.All,
  TrackBits.Y | TrackBits.Upper | TrackBits.Right,
  TrackBits.All,
  TrackBits.All,
];

/**
 * Port of rail_cmd.cpp:CheckRailSlope for Stage 1 (R26: no foundations, so any slope is refused
 * after the coast check). `existing` is the track already on the tile.
 */
export function checkRailSlope(
  map: MapState,
  t: number,
  railBits: number,
  existing: number,
): CommandCost {
  const { slope } = getTileSlopeZ(map, t);
  // don't allow building on the lower side of a coast
  if (
    getFloodingBehaviour(map, t) !== FloodingBehaviour.None &&
    (slope & Slope.Steep) === 0 &&
    (~VALID_TRACKS_ON_LEVELED_FOUNDATION[slope]! & (railBits | existing)) !== 0
  ) {
    return fail('error.cantBuildOnWater');
  }
  if (slope !== Slope.Flat) return fail('error.flatLandRequired');
  return succeed(0);
}

/** Port of rail_cmd.cpp:CmdBuildSingleRail (MP_RAILWAY, MP_ROAD and default branches). */
export function cmdBuildSingleRail(
  state: GameState,
  flags: number,
  t: number,
  track: Track,
): CommandCost {
  const { map } = state;
  if (!isValidTile(map, t) || track < 0 || track > 5) return CMD_ERROR;
  const exec = (flags & DoFlag.Execute) !== 0;
  const bit = trackToTrackBits(track);
  let cost = succeed(0);
  if (getTileType(map, t) === TileType.Railway) {
    if (getTileOwner(map, t) !== COMPANY_FIRST) return CMD_ERROR; // CheckTileOwnership: single player
    if (!isPlainRail(map, t)) return landscapeClear(state, t, flags, COMPANY_FIRST); // the depot's error
    const bits = getTrackBits(map, t);
    if ((bits | bit) === bits) return fail('error.alreadyBuilt'); // CheckTrackCombination
    // EnsureNoTrainOnTrack: no trains until block 1.4
    cost = addCost(cost, checkRailSlope(map, t, bit, bits));
    if (!cost.ok) return cost;
    if (exec) {
      setRailGroundType(map, t, RailGroundType.Barren);
      setTrackBits(map, t, bits | bit);
      state.company.infrastructure.rail +=
        railInfrastructurePieces(bits | bit) - railInfrastructurePieces(bits);
    }
  } else {
    if (getTileType(map, t) === TileType.Road) {
      // Port of case MP_ROAD: flat by R11, crossing_with_competitor, no vehicles, no road works
      // and no one-way roads in Stage 1.
      if (isNormalRoadTile(map, t)) {
        const road = getRoadBits(map, t);
        if (
          (track === Track.X && (road & RoadBits.X) === 0) ||
          (track === Track.Y && (road & RoadBits.Y) === 0)
        ) {
          const newPieces = road !== RoadBits.None ? 2 - countBits(road) : 0;
          const crossing = succeed(newPieces * roadBuildCost(state.prices));
          if (exec) {
            makeRoadCrossing(
              map,
              t,
              getRoadOwner(map, t),
              COMPANY_FIRST,
              track === Track.X ? Axis.Y : Axis.X,
              RAILTYPE_RAIL,
              getTownIndex(map, t),
            );
            // UpdateLevelCrossing: no trains yet, so the crossing is never barred.
            state.company.infrastructure.rail += LEVELCROSSING_TRACKBIT_FACTOR;
            state.dirtyTiles.add(t);
          }
          return addCost(crossing, succeed(railBuildCost(state.prices)));
        }
      }
      if (isLevelCrossingTile(map, t) && getCrossingRailBits(map, t) === bit) {
        return fail('error.alreadyBuilt');
      }
      // anything else falls through to the default branch, which refuses to clear the road
    }
    cost = addCost(cost, checkRailSlope(map, t, bit, 0));
    if (!cost.ok) return cost;
    cost = addCost(cost, landscapeClear(state, t, flags, COMPANY_FIRST));
    if (!cost.ok) return cost;
    if (exec) {
      makeRailNormal(map, t, COMPANY_FIRST, bit, RAILTYPE_RAIL);
      state.company.infrastructure.rail++;
    }
  }
  if (exec) state.dirtyTiles.add(t);
  return addCost(cost, succeed(railBuildCost(state.prices)));
}

/** Port of rail_cmd.cpp:CmdRemoveSingleRail (MP_RAILWAY and MP_ROAD crossing branches). `actor` is _current_company. */
export function cmdRemoveSingleRail(
  state: GameState,
  flags: number,
  t: number,
  track: Track,
  actor: number,
): CommandCost {
  const { map } = state;
  if (!isValidTile(map, t) || track < 0 || track > 5) return CMD_ERROR;
  const bit = trackToTrackBits(track);
  if (getTileType(map, t) === TileType.Road) {
    if (!isLevelCrossingTile(map, t) || getCrossingRailBits(map, t) !== bit) {
      return fail('error.noRailroadTrack');
    }
    if (actor !== OWNER_WATER && getTileOwner(map, t) !== actor) return CMD_ERROR; // CheckTileOwnership
    if ((flags & DoFlag.Execute) !== 0) {
      state.company.infrastructure.rail -= LEVELCROSSING_TRACKBIT_FACTOR;
      // roads are town-owned in Stage 1, so the tile returns to its town
      makeRoadNormal(map, t, getCrossingRoadBits(map, t), getTownIndex(map, t));
      state.dirtyTiles.add(t);
    }
    return succeed(railClearCost(state.prices));
  }
  if (getTileType(map, t) !== TileType.Railway || !isPlainRail(map, t)) {
    return fail('error.noRailroadTrack');
  }
  if (actor !== OWNER_WATER && getTileOwner(map, t) !== actor) return CMD_ERROR; // CheckTileOwnership
  // EnsureNoTrainOnTrack: no trains until block 1.4
  const bits = getTrackBits(map, t);
  if ((bits & bit) === 0) return fail('error.noRailroadTrack');
  if ((flags & DoFlag.Execute) !== 0) {
    const left = bits ^ bit;
    state.company.infrastructure.rail -=
      railInfrastructurePieces(bits) - railInfrastructurePieces(left);
    if (left === 0) doClearSquare(map, t, false);
    else setTrackBits(map, t, left);
    state.dirtyTiles.add(t);
  }
  return succeed(railClearCost(state.prices));
}

/** Port of rail_cmd.cpp:ValidateAutoDrag: the starting trackdir turned the right way, or null. */
export function validateAutoDrag(
  track: Track,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number | null {
  const dx = endX - startX;
  const dy = endY - startY;
  let td: number = track; // TrackToTrackdir(track) is the track itself
  let [trdx, trdy] = TRACKDELTA[td]!;
  if (!isDiagonalTrack((td & 7) as Track)) {
    trdx += TRACKDELTA[td ^ 1]![0];
    trdy += TRACKDELTA[td ^ 1]![1];
  }
  // the first direction, else the reverse one; if neither fits the drag is invalid
  const fits = (sx: number, sy: number): boolean =>
    !((sx <= 0 && dx > 0) || (sx >= 0 && dx < 0) || (sy <= 0 && dy > 0) || (sy >= 0 && dy < 0));
  if (!fits(trdx, trdy)) {
    td |= 8;
    if (!fits(-trdx, -trdy)) return null;
  }
  if (!isDiagonalTrack((td & 7) as Track)) {
    [trdx, trdy] = TRACKDELTA[td]!;
    if (
      Math.abs(dx) !== Math.abs(dy) &&
      Math.abs(dx) + Math.abs(trdy) !== Math.abs(dy) + Math.abs(trdx)
    ) {
      return null;
    }
  }
  return td;
}

/**
 * The pieces of a drag, in build order: validateAutoDrag plus the _trackdelta walk of
 * CmdRailTrackHelper. Null when the drag is invalid. The ghost draws the same pieces.
 */
export function railDragPieces(
  map: MapState,
  startTile: number,
  endTile: number,
  track: Track,
): { tile: number; track: Track }[] | null {
  if (track < 0 || track > 5) return null; // ValParamTrackOrientation
  if (startTile < 0 || startTile >= map.size || endTile < 0 || endTile >= map.size) return null;
  let td = validateAutoDrag(
    track,
    tileX(map, startTile),
    tileY(map, startTile),
    tileX(map, endTile),
    tileY(map, endTile),
  );
  if (td === null) return null;
  const pieces: { tile: number; track: Track }[] = [];
  let tile = startTile;
  for (;;) {
    pieces.push({ tile, track: (td & 7) as Track });
    if (tile === endTile) return pieces;
    const [dx, dy] = TRACKDELTA[td]!;
    tile += tileDiffXY(map, dx, dy);
    if ((td & 7) > 1) td ^= 1; // toggle UPPER/LOWER, LEFT/RIGHT
  }
}

/** Port of rail_cmd.cpp:CmdRailTrackHelper (build and remove; no signals, no fail_on_obstacle). */
export function cmdRailTrackHelper(
  state: GameState,
  flags: number,
  startTile: number,
  endTile: number,
  track: Track,
  remove: boolean,
): CommandCost {
  const pieces = railDragPieces(state.map, startTile, endTile, track);
  if (pieces === null) return CMD_ERROR;
  let hadSuccess = false;
  let lastError: CommandCost = CMD_ERROR;
  let total = succeed(0);
  for (const piece of pieces) {
    const ret = remove
      ? cmdRemoveSingleRail(state, flags, piece.tile, piece.track, COMPANY_FIRST)
      : cmdBuildSingleRail(state, flags, piece.tile, piece.track);
    if (!remove && errorKey(lastError) === 'error.alreadyBuilt') hadSuccess = true;
    if (!ret.ok) {
      lastError = ret;
      if (errorKey(lastError) !== 'error.alreadyBuilt' && !remove && hadSuccess) break;
    } else {
      hadSuccess = true;
      total = addCost(total, ret);
    }
  }
  return hadSuccess ? total : lastError;
}

/** Port of rail_cmd.cpp:ClearTile_Track. */
export function clearTileTrack(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  const { map } = state;
  if ((flags & DoFlag.Auto) !== 0) {
    if (getTileOwner(map, t) !== actor) return fail('error.areaIsOwnedByAnother');
    return isPlainRail(map, t)
      ? fail('error.mustRemoveRailroadTrack')
      : fail('error.buildingMustBeDemolished');
  }
  if (!isPlainRail(map, t)) return removeTrainDepot(state, t, flags, actor);
  let cost = succeed(0);
  for (let bits = getTrackBits(map, t); bits !== 0; bits &= bits - 1) {
    const track = (31 - Math.clz32(bits & -bits)) as Track; // RemoveFirstTrack: lowest bit first
    cost = addCost(cost, cmdRemoveSingleRail(state, flags, t, track, actor));
    if (!cost.ok) return cost;
  }
  return cost;
}

/** The fence ground for a set of fenced edges (bit per DiagDir), as in TileLoop_Track's switch. */
const FENCE_GROUND: Readonly<Record<number, RailGroundType>> = {
  0: RailGroundType.Grass,
  [1 << DiagDir.NE]: RailGroundType.FenceNE,
  [1 << DiagDir.SE]: RailGroundType.FenceSE,
  [1 << DiagDir.SW]: RailGroundType.FenceSW,
  [1 << DiagDir.NW]: RailGroundType.FenceNW,
  [(1 << DiagDir.NE) | (1 << DiagDir.SW)]: RailGroundType.FenceNESW,
  [(1 << DiagDir.SE) | (1 << DiagDir.NW)]: RailGroundType.FenceSENW,
  [(1 << DiagDir.NE) | (1 << DiagDir.SE)]: RailGroundType.FenceVert1,
  [(1 << DiagDir.NE) | (1 << DiagDir.NW)]: RailGroundType.FenceHoriz2,
  [(1 << DiagDir.SE) | (1 << DiagDir.SW)]: RailGroundType.FenceHoriz1,
  [(1 << DiagDir.SW) | (1 << DiagDir.NW)]: RailGroundType.FenceVert2,
};

/** Port of rail_cmd.cpp:TileLoop_Track (temperate): grass, then fences next to foreign tiles. */
export function tileLoopTrack(state: GameState, t: number, markDirty: (t: number) => void): void {
  const { map } = state;
  const oldGround = getRailGroundType(map, t);
  let newGround: RailGroundType = RailGroundType.Grass;
  if (isPlainRail(map, t) && oldGround !== RailGroundType.Barren) {
    // wait until bottom is green
    const rail = getTrackBits(map, t);
    const owner = getTileOwner(map, t);
    let fences = 0;
    for (const d of [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW]) {
      if ((rail & TRACK_BITS_AT_EDGE[d]!) !== 0) continue; // track on this edge: no fence
      const t2 = t + tileOffsByDiagDir(map, d);
      if (!isValidTile(map, t2)) {
        fences |= 1 << d;
        continue;
      }
      const type2 = getTileType(map, t2);
      if (
        type2 === TileType.House ||
        type2 === TileType.Industry ||
        type2 === TileType.Road ||
        getTileOwner(map, t2) !== owner
      ) {
        fences |= 1 << d;
      }
    }
    newGround = FENCE_GROUND[fences]!;
  }
  if (oldGround !== newGround) {
    setRailGroundType(map, t, newGround);
    markDirty(t);
  }
}
