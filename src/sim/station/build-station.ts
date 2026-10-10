import { addCost, CMD_ERROR, DoFlag, fail, succeed, type CommandCost } from '../command/cost';
import { lowestFreeSlot } from '../core/pool';
import { nextRandom } from '../core/random';
import type { GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { distanceManhattan, INVALID_TILE, isValidTile, tileAddWrap } from '../map/geometry';
import { COMPANY_FIRST, getTileType, TileType, tileX, tileXY, tileY } from '../map/map';
import { getTrackBits, isPlainRail, RAILTYPE_RAIL } from '../map/rail-map';
import { getTileZ, isTileFlat } from '../map/slope';
import {
  getRailStationAxis,
  getStationIndex,
  isRailStationTile,
  makeRailStation,
  setRailStationTileFlags,
  setStationTileRandomBits,
} from '../map/station-map';
import { orthogonalTiles } from '../map/tile-area';
import { closestTownFromTile } from '../town/town';
import { cmdRemoveSingleRail, railBuildCost } from '../track/rail-cmd';
import { Axis, Track, trackToTrackBits } from '../track/track';
import { generateStationName } from './station-name';
import { isInUse, STATION_SPREAD, StationFacility, type Station, type TileArea } from './station';

/** Port of RailStationTileLayout::Iterator::operator* for stations without a NewGRF spec. */
export function railStationLayout(numTracks: number, platLength: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < numTracks * platLength; p++) {
    if (platLength === 1) {
      // 1-long platforms: all bare platforms except one small building
      out.push(p === Math.trunc((numTracks - 1) / 2) ? 2 : 0);
    } else if (p < platLength && numTracks % 2 === 1) {
      // odd number of tracks: the first platform is bare with a small building
      out.push(p === Math.trunc((platLength - 1) / 2) ? 2 : 0);
    } else if (platLength > 4 && (p % platLength === 0 || p % platLength === platLength - 1)) {
      // longer than 4 tiles: bare platforms at either end
      out.push(0);
    } else {
      out.push(Math.trunc(p / platLength) % 2 === numTracks % 2 ? 4 : 6);
    }
  }
  return out;
}

/**
 * Port of station_cmd.cpp:CheckFlatLandRailStation + CheckBuildableTile for RAILTYPE_RAIL without a
 * NewGRF spec. No bridges or vehicles exist yet; R26: no foundations, so any slope is refused.
 * `allowedZ.z` and `est.index` are the C++ in/out parameters allowed_z and station.
 */
function checkFlatLandRailStation(
  state: GameState,
  t: number,
  allowedZ: { z: number },
  flags: number,
  axis: Axis,
  est: { index: number },
): CommandCost {
  const { map } = state;
  if (!isTileFlat(map, t)) return fail('error.flatLandRequired');
  const z = getTileZ(map, t);
  if (allowedZ.z < 0) allowedZ.z = z;
  else if (allowedZ.z !== z) return fail('error.flatLandRequired');

  if (getTileType(map, t) === TileType.Station) {
    // only rail stations exist, so ClearTile_Station's error for other station types is unreachable
    const st = getStationIndex(map, t);
    if (est.index === -1) est.index = st;
    else if (est.index !== st) return fail('error.adjoinsMoreThanOne');
    return succeed(0);
  }
  if (getTileType(map, t) === TileType.Railway && isPlainRail(map, t)) {
    // HasSignals: no signals in Stage 1. HasPowerOnRail(RAIL, RAIL) holds.
    const expected = axis === Axis.X ? Track.X : Track.Y;
    // the existing track must be a single piece aligned with the station axis
    if (getTrackBits(map, t) === trackToTrackBits(expected)) {
      return cmdRemoveSingleRail(state, flags, t, expected, COMPANY_FIRST);
    }
  }
  return landscapeClear(state, t, flags, COMPANY_FIRST);
}

/**
 * Port of station_cmd.cpp:GetStationAround: the one own station touching the area expanded by a
 * tile (TileArea::Expand clamps to the map), or an error when there are several.
 */
function getStationAround(
  state: GameState,
  area: TileArea,
  closest: number,
): { ok: true; index: number } | { ok: false; cost: CommandCost } {
  const { map } = state;
  const x = tileX(map, area.tile);
  const y = tileY(map, area.tile);
  const sx = Math.max(x - 1, 0);
  const sy = Math.max(y - 1, 0);
  const ex = Math.min(x + area.w + 1, map.sizeX);
  const ey = Math.min(y + area.h + 1, map.sizeY);
  for (const t of orthogonalTiles(map, tileXY(map, sx, sy), tileXY(map, ex - 1, ey - 1))) {
    if (getTileType(map, t) !== TileType.Station) continue;
    const index = getStationIndex(map, t);
    const st = state.stations[index];
    if (st === undefined || st === null || st.owner !== COMPANY_FIRST) continue;
    if (closest === -1) closest = index;
    else if (closest !== index) return { ok: false, cost: fail('error.adjoinsMoreThanOne') };
  }
  return { ok: true, index: closest };
}

/**
 * Port of station_cmd.cpp:GetClosestDeletedStation: the own unused station (gray sign) closest to
 * the tile, within Manhattan distance 7; ties go to the lowest index.
 */
function getClosestDeletedStation(state: GameState, t: number): Station | null {
  let threshold = 8;
  let best: Station | null = null;
  for (const st of state.stations) {
    if (st === null || isInUse(st) || st.owner !== COMPANY_FIRST) continue;
    const dist = distanceManhattan(state.map, t, st.xy);
    if (dist < threshold) {
      threshold = dist;
      best = st;
    }
  }
  return best;
}

/** Port of station_cmd.cpp:CanExpandRailStation: the union area, or the spread error. */
function canExpandRailStation(
  state: GameState,
  cur: TileArea,
  area: TileArea,
): { ok: true; area: TileArea } | { ok: false; cost: CommandCost } {
  const { map } = state;
  const x = Math.min(tileX(map, cur.tile), tileX(map, area.tile));
  const y = Math.min(tileY(map, cur.tile), tileY(map, area.tile));
  const w = Math.max(tileX(map, cur.tile) + cur.w, tileX(map, area.tile) + area.w) - x;
  const h = Math.max(tileY(map, cur.tile) + cur.h, tileY(map, area.tile) + area.h) - y;
  if (w > STATION_SPREAD || h > STATION_SPREAD) {
    return { ok: false, cost: fail('error.stationTooSpreadOut') };
  }
  return { ok: true, area: { tile: tileXY(map, x, y), w, h } };
}

/**
 * Port of station_cmd.cpp:CmdBuildRailStation for RAILTYPE_RAIL, the default station class,
 * station_to_join = NEW_STATION and adjacent = false (R18).
 */
export function cmdBuildRailStation(
  state: GameState,
  flags: number,
  tileOrg: number,
  axis: Axis,
  numTracks: number,
  platLength: number,
): CommandCost {
  const { map, prices: p } = state;
  // BuildStationPart names a new station after ClosestTownFromTile: OpenTTD assumes a town exists.
  if (state.towns.length === 0) return CMD_ERROR;
  // CheckIfAuthorityAllowsNewStation: the rating stays at 500 > RATING_VERYPOOR (R15), so allowed.
  if (axis !== Axis.X && axis !== Axis.Y) return CMD_ERROR;
  if (platLength < 1 || numTracks < 1) return CMD_ERROR;
  const w = axis === Axis.X ? platLength : numTracks;
  const h = axis === Axis.X ? numTracks : platLength;
  if (!isValidTile(map, tileOrg) || tileAddWrap(map, tileOrg, w - 1, h - 1) === INVALID_TILE) {
    return CMD_ERROR;
  }
  if (w > STATION_SPREAD || h > STATION_SPREAD) return CMD_ERROR;
  let area: TileArea = { tile: tileOrg, w, h };

  // CalculateRailStationCost: clears the land below the station (or checks it in test mode)
  const allowedZ = { z: -1 };
  const est = { index: -1 };
  let cost = succeed(0);
  let lengthPriceReady = true;
  let tracknum = 0;
  const corner = tileXY(map, tileX(map, tileOrg) + w - 1, tileY(map, tileOrg) + h - 1);
  for (const t of orthogonalTiles(map, tileOrg, corner)) {
    const ret = checkFlatLandRailStation(state, t, allowedZ, flags, axis, est);
    if (!ret.ok) return ret;
    // "Only add PR_BUILD_STATION_RAIL_LENGTH once for each valid plat_len": the code, not the
    // comment (R17).
    if (tracknum === numTracks) {
      lengthPriceReady = true;
      tracknum = 0;
    } else {
      tracknum++;
    }
    // new or rotated rail station tiles only
    if (!isRailStationTile(map, t) || getRailStationAxis(map, t) !== axis) {
      cost = addCost(cost, ret);
      cost = addCost(cost, succeed(p.buildStationRail + railBuildCost(p)));
      if (lengthPriceReady) {
        cost = addCost(cost, succeed(p.buildStationRailLength));
        lengthPriceReady = false;
      }
    }
  }

  // FindJoiningBaseStation: building over our station extends it without looking around
  let st: Station | null = null;
  if (est.index !== -1) {
    st = state.stations[est.index] ?? null;
  }
  if (st === null) {
    const around = getStationAround(state, area, est.index);
    if (!around.ok) return around.cost;
    st = around.index === -1 ? null : state.stations[around.index]!;
  }

  // BuildStationPart (reuse = true: the GUI sends StationID::Invalid(), not NEW_STATION). A found
  // station is always ours; its rect.BeforeAddRect (ADD_TEST) is CanExpandRailStation's check on
  // the same rectangle (R29).
  if (st === null) st = getClosestDeletedStation(state, area.tile);
  if (st === null && (flags & DoFlag.Execute) !== 0) {
    const index = lowestFreeSlot(state.stations);
    st = {
      index,
      xy: area.tile,
      townIndex: closestTownFromTile(state, area.tile, Infinity)!.index, // a town exists (above)
      nameKind: 'town',
      owner: COMPANY_FIRST,
      trainStation: null,
      facilities: 0,
      deleteCtr: 0,
      buildDate: state.calendar.date,
      randomBits: 0,
    };
    state.stations[index] = st;
    st.nameKind = generateStationName(state, st, area.tile);
  }

  if (st !== null && st.trainStation !== null) {
    const expanded = canExpandRailStation(state, st.trainStation, area);
    if (!expanded.ok) return expanded.cost;
    area = expanded.area;
  }

  if ((flags & DoFlag.Execute) !== 0 && st !== null) {
    st.trainStation = area;
    // Station::AddFacility
    if (st.facilities === 0) {
      st.xy = area.tile;
      st.randomBits = nextRandom(state.random) & 0xffff;
    }
    st.facilities |= StationFacility.Train;
    st.owner = COMPANY_FIRST;
    st.buildDate = state.calendar.date;

    const layout = railStationLayout(numTracks, platLength);
    const infra = state.company.infrastructure;
    // tile_delta runs along the platform, track_delta to the next platform
    const [tdx, tdy] = axis === Axis.X ? [1, 0] : [0, 1];
    for (let i = 0; i < numTracks; i++) {
      for (let j = 0; j < platLength; j++) {
        const t = tileXY(
          map,
          tileX(map, tileOrg) + tdy * i + tdx * j,
          tileY(map, tileOrg) + tdx * i + tdy * j,
        );
        if (isRailStationTile(map, t)) {
          infra.rail--; // default station tiles are never blocked
          infra.station--;
        }
        makeRailStation(
          map,
          t,
          COMPANY_FIRST,
          st.index,
          axis,
          layout[i * platLength + j]!,
          RAILTYPE_RAIL,
        );
        setStationTileRandomBits(map, t, nextRandom(state.random) & 0xf);
        setRailStationTileFlags(map, t);
        infra.rail++;
        infra.station++;
        state.dirtyTiles.add(t);
      }
    }
    // AfterStationTileSetChange: catchment and acceptance come with block 1.5.
  }
  return cost;
}
