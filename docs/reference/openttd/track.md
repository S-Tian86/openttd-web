# Track — track bits, rail tiles, building and removing rail

Source: OpenTTD 15.3, `reference/OpenTTD/src`. All paths below are relative to that `src/`.

## 1. Purpose

A rail tile holds up to six track pieces (the two diagonals and four corner pieces). The
`Track`/`Trackdir`/`DiagDirection` enums and lookup tables describe which tile edges each piece
joins and in which direction a train runs along it; train movement and pathfinding are built on
them. The build/remove commands decide what may be placed on a tile, what it costs, and keep
the company's infrastructure counters up to date.

## 2. Source files

- `track_type.h` — `Track`, `TrackBits`, `Trackdir`, `TrackdirBits` enums.
- `track_func.h` — conversions: `TrackToTrackBits`, `TrackdirToTrack`, `ReverseTrackdir`, `TrackdirToExitdir`, `TrackExitdirToTrackdir`, `TrackEnterdirToTrackdir`, `DiagdirReachesTrackdirs`, `TracksOverlap`, `VehicleExitDir`.
- `table/track_data.h` — the lookup tables used by `track_func.h`.
- `direction_type.h` / `direction_func.h` — `Direction`, `DiagDirection`, `Axis`; `ReverseDiagDir`, `DiagDirToAxis`, `DirToDiagDir`, `ChangeDiagDir`.
- `map.cpp` — `_tileoffs_by_diagdir` (neighbour offsets), used by `map_func.h:TileOffsByDiagDir`.
- `rail_map.h` — rail tile bit layout: `GetRailTileType`, `GetTrackBits`/`SetTrackBits`, `GetRailType`, `GetRailDepotDirection`, `GetRailGroundType`, `MakeRailNormal`, `MakeRailDepot`.
- `rail_type.h` — `RailType` enum.
- `rail.h` — `RailBuildCost`, `RailClearCost`, `RailMaintenanceCost`, `IsCompatibleRail`, `HasPowerOnRail`.
- `rail.cpp` — `ValParamRailType`, `HasRailTypeAvail`, `GetCompanyRailTypes`.
- `rail_cmd.cpp` — `CmdBuildSingleRail`, `CmdRemoveSingleRail`, `CmdRailTrackHelper` (+ `CmdBuildRailroadTrack`, `CmdRemoveRailroadTrack`), `ValidateAutoDrag`, `CmdBuildTrainDepot`, `RemoveTrainDepot`, `ClearTile_Track`, `CheckTrackCombination`, `CheckRailSlope`, `GetRailFoundation`, `TileLoop_Track`, `GetTileTrackStatus_Track`.
- `rail_cmd.h` — command flags (`DEF_CMD_TRAIT`).
- `table/railtypes.h` — the four original rail types.
- `table/pricebase.h` — base prices. `economy.cpp:RecomputePrices` turns them into `_price[]`.
- Clearing helpers called by the build commands: `clear_cmd.cpp:ClearTile_Clear`, `tree_cmd.cpp:ClearTile_Trees`, `water_cmd.cpp:ClearTile_Water`, `water_cmd.cpp:GetFloodingBehaviour`, `landscape.cpp:CmdLandscapeClear`, `landscape.cpp:DoClearSquare`.

## 3. State

### Enums (values are load-bearing: tables are indexed by them)

| Track                        | value | joins tile edges | TrackBits |
| ---------------------------- | ----- | ---------------- | --------- |
| `TRACK_X`                    | 0     | NE ↔ SW          | `0x01`    |
| `TRACK_Y`                    | 1     | SE ↔ NW          | `0x02`    |
| `TRACK_UPPER` (north corner) | 2     | NE ↔ NW          | `0x04`    |
| `TRACK_LOWER` (south corner) | 3     | SE ↔ SW          | `0x08`    |
| `TRACK_LEFT` (west corner)   | 4     | SW ↔ NW          | `0x10`    |
| `TRACK_RIGHT` (east corner)  | 5     | NE ↔ SE          | `0x20`    |

`INVALID_TRACK = 0xFF`. Named TrackBits combinations (`track_type.h`): `TRACK_BIT_CROSS = X|Y`,
`TRACK_BIT_HORZ = UPPER|LOWER`, `TRACK_BIT_VERT = LEFT|RIGHT`, `TRACK_BIT_3WAY_NE = X|UPPER|RIGHT`,
`TRACK_BIT_3WAY_SE = Y|LOWER|RIGHT`, `TRACK_BIT_3WAY_SW = X|LOWER|LEFT`, `TRACK_BIT_3WAY_NW = Y|UPPER|LEFT`,
`TRACK_BIT_ALL = 0x3F`, `TRACK_BIT_MASK = 0x3F`, `TRACK_BIT_WORMHOLE = 0x40` (tunnels/bridges),
`TRACK_BIT_DEPOT = 0x80` (used for `Train::track` while inside a depot).
The edge column comes from `_track_exitdir_to_trackdir` / `_trackdir_to_exitdir` (table below).

`DiagDirection` (`direction_type.h`): `DIAGDIR_NE=0, SE=1, SW=2, NW=3`, `INVALID_DIAGDIR=0xFF`.
Neighbour offsets `(dx, dy)` (`map.cpp:_tileoffs_by_diagdir`): NE `(-1,0)`, SE `(0,+1)`, SW `(+1,0)`, NW `(0,-1)`.
`Direction`: `N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7`. `Axis`: `AXIS_X=0`, `AXIS_Y=1`.

`Trackdir` = track + travel direction. Values 0–5 run one way and 8–13 the other way; 6, 7, 14, 15 are
road-vehicle reversing states and are not valid for rail (`track_func.h:IsValidTrackdir` masks
with `TRACKDIR_BIT_MASK = 0x3F3F`). The exit edge comes from `_trackdir_to_exitdir`. The entry edge
is the other edge of the same track.

| Trackdir           | value | enters through | exits through (`TrackdirToExitdir`) |
| ------------------ | ----- | -------------- | ----------------------------------- |
| `TRACKDIR_X_NE`    | 0     | SW             | NE                                  |
| `TRACKDIR_Y_SE`    | 1     | NW             | SE                                  |
| `TRACKDIR_UPPER_E` | 2     | NW             | NE                                  |
| `TRACKDIR_LOWER_E` | 3     | SW             | SE                                  |
| `TRACKDIR_LEFT_S`  | 4     | NW             | SW                                  |
| `TRACKDIR_RIGHT_S` | 5     | NE             | SE                                  |
| `TRACKDIR_X_SW`    | 8     | NE             | SW                                  |
| `TRACKDIR_Y_NW`    | 9     | SE             | NW                                  |
| `TRACKDIR_UPPER_W` | 10    | NE             | NW                                  |
| `TRACKDIR_LOWER_W` | 11    | SE             | SW                                  |
| `TRACKDIR_LEFT_N`  | 12    | SW             | NW                                  |
| `TRACKDIR_RIGHT_N` | 13    | SE             | NE                                  |

`TrackdirBits` (uint16): bit `n` = trackdir `n`. `TrackStatus` (uint32) = trackdir bits in the
low 16 bits and red-signal trackdir bits in the high 16 (`track_func.h:CombineTrackStatus`).

### Rail tile storage (`rail_map.h`, tile type `MP_RAILWAY`)

| Field                   | Bits                                                  | Meaning                                                           |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| owner                   | `m1` bits 0–4                                         | `tile_map.h:SetTileOwner`                                         |
| rail tile type          | `m5` bits 6–7                                         | `RailTileType::Normal = 0`, `Signals = 1`, `Depot = 3` (2 unused) |
| track bits (plain rail) | `m5` bits 0–5                                         | `TrackBits`                                                       |
| depot exit direction    | `m5` bits 0–1                                         | `DiagDirection` (depot only)                                      |
| depot reservation       | `m5` bit 4                                            | PBS reservation (depot only)                                      |
| rail type               | `m8` bits 0–5                                         | `RailType` (0..63)                                                |
| ground type             | `m4` bits 0–3                                         | `RailGroundType`                                                  |
| signal states           | `m4` bits 4–7                                         | signals only                                                      |
| present signals         | `m3` bits 4–7                                         | signals only                                                      |
| signal type / variant   | `m2` bits 0–2, 4–6 / bits 3, 7                        | signals only                                                      |
| track reservation       | `m2` bits 8–10 (track+1), bit 11 (opposite track too) | PBS only                                                          |
| depot index             | `m2` (whole)                                          | `DepotID` (depot only)                                            |

`RailGroundType`: `Barren=0, Grass=1, FenceNW=2, FenceSE=3, FenceSENW=4, FenceNE=5, FenceSW=6,
FenceNESW=7, FenceVert1=8, FenceVert2=9, FenceHoriz1=10, FenceHoriz2=11, SnowOrDesert=12,
HalfTileWater=13, HalfTileSnow=14`.

`rail_map.h:MakeRailNormal(t, owner, bits, railtype)` sets: tile type `MP_RAILWAY`, owner,
`m2=m3=m4=0` (so ground = Barren), `m5 = Normal<<6 | bits`, `m6` bits 2–7 = 0, `m7=0`, `m8 = railtype`.
`rail_map.h:MakeRailDepot(t, owner, depot_id, dir, railtype)` does the same with `m2 = depot_id`,
`m5 = Depot<<6 | dir`.

### Company state

`company_base.h:CompanyInfrastructure.rail[RAILTYPE_END]` (uint32) counts track pieces per rail type.
`Company::avail_railtypes` is the set of rail types the company may build.

### Rail types (`rail_type.h`, `table/railtypes.h`)

`RAILTYPE_RAIL=0, ELECTRIC=1, MONO=2, MAGLEV=3`, `RAILTYPE_END=64`, `INVALID_RAILTYPE=0xFF`.

| Type     | cost_multiplier | maintenance_multiplier | powered / compatible                | intro date                           |
| -------- | --------------- | ---------------------- | ----------------------------------- | ------------------------------------ |
| RAIL     | 8               | 8                      | {RAIL, ELECTRIC} / {RAIL, ELECTRIC} | `INVALID_DATE` (not date-introduced) |
| ELECTRIC | 12              | 12                     | (see file)                          | `INVALID_DATE`                       |
| MONO     | 16              | 16                     |                                     | `INVALID_DATE`                       |
| MAGLEV   | 24              | 24                     |                                     | `INVALID_DATE`                       |

All four have `max speed = 0` (no rail speed limit) and acceleration model `Normal` for RAIL.

## 4. Rules and formulas

### 4.1 Track geometry helpers (`track_func.h`, `direction_func.h`)

```
TrackToTrackBits(t)        = 1 << t
TrackToTrackdir(t)         = t                      // the 0..5 direction
ReverseTrackdir(td)        = td ^ 8
TrackdirToTrack(td)        = td & 7
TrackBitsToTrackdirBits(b) = b * 0x101              // both directions
TrackdirBitsToTrackBits(b) = (b | b >> 8) & 0x3F
TrackToOppositeTrack(t)    = t ^ 1                  // X<->Y, UPPER<->LOWER, LEFT<->RIGHT
DiagDirToDiagTrack(d)      = d & 1                  // NE,SW -> X ; SE,NW -> Y
ReverseDiagDir(d)          = d ^ 2
DiagDirToAxis(d)           = d & 1
DirToDiagDir(dir)          = dir >> 1
IsDiagonalTrack(t)         = t == X || t == Y
TracksOverlap(bits)        = popcount(bits) >= 2 && bits != HORZ && bits != VERT
```

`table/track_data.h`:

- `_exitdir_reaches_trackdirs[d]` — trackdirs on the next tile that a train leaving in direction
  `d` can take: NE → `{X_NE, LOWER_E, LEFT_N}`; SE → `{Y_SE, LEFT_S, UPPER_E}`;
  SW → `{X_SW, UPPER_W, RIGHT_S}`; NW → `{Y_NW, RIGHT_N, LOWER_W}`. This includes 90° turns. Those
  are filtered elsewhere with `_track_crosses_trackdirs`, according to `pf.forbid_90_deg` (see trains.md).
- `_next_trackdir[td]` (straight-on continuation on the next tile): `X_NE→X_NE, Y_SE→Y_SE,
UPPER_E→LOWER_E, LOWER_E→UPPER_E, LEFT_S→RIGHT_S, RIGHT_S→LEFT_S`, and the same for the
  8–13 set (`UPPER_W↔LOWER_W`, `LEFT_N↔RIGHT_N`).
- `_track_crosses_tracks[t]` (tracks at 90° to `t`): X→Y, Y→X, UPPER/LOWER→VERT, LEFT/RIGHT→HORZ.
- `_track_exitdir_to_trackdir[track][exitdir]` / `_track_enterdir_to_trackdir[track][enterdir]`.
  "enterdir" is the **direction of travel** when entering, not the edge entered through. Example:
  `[UPPER][SE] = UPPER_E` (moving SE means entering through the NW edge).
- `_dir_to_diag_trackdir[d]` = `X_NE, Y_SE, X_SW, Y_NW` for NE, SE, SW, NW.

`track_func.h:VehicleExitDir(direction, track)`:

```
diagdir = direction >> 1
if direction is not diagonal (bit0 == 0) and track != {RIGHT, LOWER, LEFT, UPPER}[diagdir]:
    diagdir = (diagdir + 3) % 4          // 90° left
```

### 4.2 Track combinations on one tile (`rail_cmd.cpp:CheckTrackCombination`)

```
if not IsPlainRail(tile): error STR_ERROR_IMPOSSIBLE_TRACK_COMBINATION
if (current | to_build) == current: error STR_ERROR_ALREADY_BUILT
else OK            // "Normally, we may overlap and any combination is valid"
```

On flat ground **all 63 non-empty combinations are legal**. The only remaining restrictions:

- slopes (`CheckRailSlope`/`GetRailFoundation`, below);
- a tile with signals may not get an extra piece that makes `TracksOverlap` true unless
  `auto_remove_signals` is set (`CmdBuildSingleRail`, `STR_ERROR_MUST_REMOVE_SIGNALS_FIRST`);
- a train on an interacting track (`vehicle.cpp:EnsureNoTrainOnTrackBits`): error if
  `train.track == bits || TracksOverlap(train.track | bits)`. So a train on UPPER blocks LEFT,
  RIGHT and UPPER, but not LOWER.

Building never looks at neighbouring tiles: a piece may lead into nothing.

### 4.3 Slope check (`rail_cmd.cpp:CheckRailSlope`)

```
if GetFloodingBehaviour(tile) != FLOOD_NONE and not steep
   and (~_valid_tracks_on_leveled_foundation[tileh] & (rail_bits|existing)) != 0:
    error STR_ERROR_CAN_T_BUILD_ON_WATER
f_new = GetRailFoundation(tileh, rail_bits | existing)
if f_new == INVALID or (f_new != NONE and !build_on_slopes): error STR_ERROR_LAND_SLOPED_IN_WRONG_DIRECTION
cost = (f_new != GetRailFoundation(tileh, existing)) ? _price[PR_BUILD_FOUNDATION] : 0
```

On `SLOPE_FLAT` (0): `_valid_tracks_without_foundation[0] = TRACK_BIT_ALL`, so the foundation is
`FOUNDATION_NONE` and the cost is 0. But `_valid_tracks_on_leveled_foundation[0] = TRACK_BIT_NONE`, so
**any flat tile with FLOOD_ACTIVE (sea water) refuses rail** with "can't build on water".
`water_cmd.cpp:GetFloodingBehaviour`: sea water / sea station / sea industry → `FLOOD_ACTIVE`;
canal, river, clear land, trees not on shore → `FLOOD_NONE`.

### 4.4 `CmdBuildSingleRail(flags, tile, railtype, track, auto_remove_signals)` (`rail_cmd.cpp`)

Command flags: `CommandFlag::Auto, CommandFlag::NoWater` (`rail_cmd.h`). They become
`DoCommandFlag::Auto|NoWater` and are passed on to the nested `CMD_LANDSCAPE_CLEAR`.

```
if !ValParamRailType(railtype) or track >= TRACK_END: CMD_ERROR
    // ValParamRailType: railtype < 64 && company.avail_railtypes has it (rail.cpp)
cost = 0 (EXPENSES_CONSTRUCTION)
switch tile type:
  MP_RAILWAY:
    CheckTileOwnership                    // other owner -> error
    if !IsPlainRail(tile): return LANDSCAPE_CLEAR(tile)   // depot -> its error message
    if !IsCompatibleRail(GetRailType(tile), railtype): STR_ERROR_IMPOSSIBLE_TRACK_COMBINATION
    CheckTrackCombination; EnsureNoTrainOnTrack; cost += CheckRailSlope(tileh, bit, existing)
    [signals + overlap handling, see 4.2]
    if tile railtype != railtype and !HasPowerOnRail(railtype, tilerail):
        if HasPowerOnRail(tilerail, railtype): cost += CMD_CONVERT_RAIL(tile)  else CMD_ERROR
    exec: ground = Barren; bits |= trackbit; update infrastructure (4.7)
  MP_ROAD: level crossing (skipped in Stage 1)
  default (clear, trees, water, houses, industries, stations…):
    water_ground = tile is MP_WATER and slope has one corner raised     // never on a flat map
    cost += CheckRailSlope(tileh, trackbit, NONE)
    cost += CMD_LANDSCAPE_CLEAR(tile)     // with Auto|NoWater
    if water_ground: cost += -_price[PR_CLEAR_WATER] + _price[PR_CLEAR_ROUGH]
    exec: MakeRailNormal(tile, company, trackbit, railtype); infrastructure.rail[railtype] += 1
cost += RailBuildCost(railtype)
```

What `CMD_LANDSCAPE_CLEAR` (`landscape.cpp:CmdLandscapeClear`) does for each source tile with these flags:

- **Clear land** (`clear_cmd.cpp:ClearTile_Clear`): cost `_price[{GRASS, ROUGH, ROCKS, FIELDS, ROUGH, ROUGH}[ground]]`,
  except free when `ground == CLEAR_GRASS && density == 0`. Generated grass has density 3
  (`landscape.cpp:DoClearSquare` uses `_generating_world ? 3 : 0`), so it costs `PR_CLEAR_GRASS`.
- **Trees** (`tree_cmd.cpp:ClearTile_Trees`): cost `count * _price[PR_CLEAR_TREES]` with
  `count = GB(m5,6,2)+1` (1..4), times 4 for rainforest/cactus types. Side effect: the town closest
  within `dist_local_authority` gets `ChangeTownRating(RATING_TREE_DOWN_STEP = -35, min RATING_MINIMUM)`.
- **Water, flat**: refused earlier by `CheckRailSlope` (sea). For canal or river, `ClearTile_Water`
  returns `STR_ERROR_CAN_T_BUILD_ON_WATER` because of `NoWater`.
- **House** (`town_cmd.cpp:ClearTile_Town`): with `Auto` → `STR_ERROR_BUILDING_MUST_BE_DEMOLISHED`.
  Industry tiles are refused too (`industry_cmd.cpp:ClearTile_Industry` with `Auto`).
- **Own rail/depot** (`ClearTile_Track` with `Auto`): `STR_ERROR_MUST_REMOVE_RAILROAD_TRACK` or
  `STR_ERROR_BUILDING_MUST_BE_DEMOLISHED`; other owner → `STR_ERROR_AREA_IS_OWNED_BY_ANOTHER`.
- The company clear limit (`clear_limit`) is **not** applied when `Auto` is set (`CmdLandscapeClear`: `c = nullptr`).

### 4.5 `CmdRemoveSingleRail(flags, tile, track)` (`rail_cmd.cpp`)

Command flags: `Auto`.

```
if track invalid: CMD_ERROR
MP_RAILWAY:
  if !IsPlainRail: STR_ERROR_THERE_IS_NO_RAILROAD_TRACK         // depots are not "rail"
  CheckTileOwnership (skipped when _current_company == OWNER_WATER)
  EnsureNoTrainOnTrack(tile, track)
  if (bits & trackbit) == 0: STR_ERROR_THERE_IS_NO_RAILROAD_TRACK
  cost = RailClearCost(railtype)  (+ signal removal cost if any)
  exec: update infrastructure (4.7); bits ^= trackbit
        if bits == 0: DoClearSquare(tile)   -> clear grass, density 0 (or shore if HalfTileWater)
        else SetTrackBits; keep only reservations on remaining bits
MP_ROAD: level crossing (skipped)
other: STR_ERROR_THERE_IS_NO_RAILROAD_TRACK
```

### 4.6 Drag building: `CmdBuildRailroadTrack(flags, end_tile, start_tile, railtype, track, auto_remove_signals, fail_on_obstacle)`

Both build and remove go through `rail_cmd.cpp:CmdRailTrackHelper`. Command flags: `Auto, NoWater`.
`_trackdelta[trackdir]` (tile step after each piece), indexed 0..15:
`0:(-1,0) 1:(0,1) 2:(-1,0) 3:(0,1) 4:(1,0) 5:(0,1) 6:(0,0) 7:(0,0) 8:(1,0) 9:(0,-1) 10:(0,-1) 11:(1,0) 12:(0,-1) 13:(-1,0) 14:(0,0) 15:(0,0)`.

`ValidateAutoDrag(&trackdir, start, end)`:

```
dx = ex - x; dy = ey - y
trd = _trackdelta[td]; if !diagonal(td): trd += _trackdelta[td ^ 1]
while (trd.x <= 0 && dx > 0) || (trd.x >= 0 && dx < 0) || (trd.y <= 0 && dy > 0) || (trd.y >= 0 && dy < 0):
    if bit 3 of td is clear: set bit 3 (reverse), trd = -trd
    else: CMD_ERROR
if !diagonal(td):
    trd = _trackdelta[td]
    if |dx| != |dy| and |dx| + |trd.y| != |dy| + |trd.x|: CMD_ERROR
```

`CmdRailTrackHelper` loop:

```
td = TrackToTrackdir(track); ValidateAutoDrag(&td, start, end)
had_success = false; last_error = CMD_ERROR; total = 0
loop:
  ret = BUILD_SINGLE_RAIL(tile, railtype, TrackdirToTrack(td), auto_remove_signals)   // or REMOVE
  if building and !fail_on_obstacle and last_error.msg == ALREADY_BUILT: had_success = true
  if ret failed:
     last_error = ret
     if building and msg != ALREADY_BUILT:
        if fail_on_obstacle: return last_error
        if had_success: break                  // stop at the first obstacle after built track
     if removing and msg == STR_ERROR_OWNED_BY: break
  else: had_success = true; total += ret.cost
  if tile == end: break
  tile += _trackdelta[td]
  if !diagonal(td): td ^= 1                    // UPPER<->LOWER, LEFT<->RIGHT staircase
return had_success ? total : last_error
```

Obstacles at the start of a drag are skipped. The drag stops at the first obstacle after something
was built or found already built.

### 4.7 Infrastructure counting (`CmdBuildSingleRail`, `CmdRemoveSingleRail`)

```
pieces(bits) = popcount(bits); if TracksOverlap(bits): pieces = pieces * pieces
on change: rail[rt] -= pieces(old_bits); rail[rt] += pieces(new_bits)
new plain-rail tile: rail[rt] += 1 ;  depot: rail[rt] += 1 (build) / -= 1 (remove)
level crossing: LEVELCROSSING_TRACKBIT_FACTOR = 2 (economy_type.h)
```

Example: X+Y cross = 4, UPPER+LOWER = 2, 3-way = 9.

### 4.8 `CmdBuildTrainDepot(flags, tile, railtype, dir)` (`rail_cmd.cpp`)

Command flags: `Auto, NoWater`.

```
if !ValParamRailType(railtype) or dir > 3: CMD_ERROR
if tileh != FLAT:
   if !build_on_slopes or !CanBuildDepotByTileh(dir, tileh): STR_ERROR_FLAT_LAND_REQUIRED
   cost += _price[PR_BUILD_FOUNDATION]
if IsRailDepotTile(tile) and railtype == tile railtype:      // rotate existing depot
   CheckTileOwnership; if dir == current dir: return cost 0
   EnsureNoVehicleOnGround; rotate = true
else:
   cost += LANDSCAPE_CLEAR(tile)   // same per-tile rules as 4.4; existing rail -> error (Auto)
   if IsBridgeAbove: STR_ERROR_MUST_DEMOLISH_BRIDGE_FIRST
   if no free Depot pool slot: CMD_ERROR
exec: rotate ? SetRailDepotExitDirection(dir)
             : new Depot(tile); MakeRailDepot(tile, company, id, dir, railtype); MakeDefaultName; rail[rt] += 1
cost += _price[PR_BUILD_DEPOT_TRAIN] + RailBuildCost(railtype)
```

A depot's track is `DiagDirToDiagTrack(dir)` and it only connects on side `dir`
(`GetTileTrackStatus_Track`: for a depot, returns no track if `side != INVALID_DIAGDIR && side != dir`).
Removal (`RemoveTrainDepot`, through `ClearTile_Track` without `Auto`, e.g. the bulldozer):
ownership check, `EnsureNoVehicleOnGround`, `rail[rt] -= 1`, `DoClearSquare`, cost `_price[PR_CLEAR_DEPOT_TRAIN]`.

### 4.9 Costs (`rail.h`)

```
RailBuildCost(rt)       = (_price[PR_BUILD_RAIL] * cost_multiplier(rt)) >> 3      // RAIL: x8>>3 = x1
RailClearCost(rt)       = max(_price[PR_CLEAR_RAIL], -RailBuildCost(rt) * 3 / 4)  // negative = refund
RailMaintenanceCost(rt, num, total) =
    (_price[PR_INFRASTRUCTURE_RAIL] * maintenance_multiplier(rt) * num * (1 + IntSqrt(total))) >> 11
```

Base prices (`table/pricebase.h`, `start_price`): `PR_BUILD_RAIL 100`, `PR_CLEAR_RAIL -70`,
`PR_BUILD_DEPOT_TRAIN 600`, `PR_CLEAR_DEPOT_TRAIN 80`, `PR_BUILD_FOUNDATION 250`, `PR_CLEAR_GRASS 20`,
`PR_CLEAR_ROUGH 40`, `PR_CLEAR_TREES 20`, `PR_CLEAR_WATER 10000`, `PR_INFRASTRUCTURE_RAIL 10` (category
RUNNING). All others listed are CONSTRUCTION.
`economy.cpp:RecomputePrices`: `price = start * {6, 8, 9}[difficulty] * inflation_prices >> 19` (no NewGRF
multiplier), with `inflation_prices = 1<<16` at start (`economy.cpp:936`). With the defaults
(`construction_cost = 0`, `vehicle_costs = 0` → ×6), that is ×0.75 rounded down (arithmetic shift):

| price             | `_price` at start |     | price               | `_price` at start |
| ----------------- | ----------------- | --- | ------------------- | ----------------- |
| BUILD_RAIL        | 75                |     | CLEAR_GRASS         | 15                |
| CLEAR_RAIL        | −53               |     | CLEAR_ROUGH         | 30                |
| BUILD_DEPOT_TRAIN | 450               |     | CLEAR_TREES         | 15                |
| CLEAR_DEPOT_TRAIN | 60                |     | CLEAR_WATER         | 7500              |
| BUILD_FOUNDATION  | 187               |     | INFRASTRUCTURE_RAIL | 7                 |

So with the defaults, RAIL costs 75 per piece on bare land, 75 + 15 on generated grass,
75 + 15×trees on a tree tile, and refunds 53 when removed (`max(-53, -56)`). A depot on grass costs
450 + 75 + 15. economy.md is the authority on `_price`.

Infrastructure maintenance (`economy.cpp:CompaniesGenStatistics`, run every economy month) only
when `economy.infrastructure_maintenance` is true. It is **false by default**, so no maintenance is
charged in a default game.

### 4.10 Rail ground growth (`rail_cmd.cpp:TileLoop_Track`, temperate)

On each tile loop: `new_ground = Grass`. If the tile is plain rail and `old_ground != Barren`, add a
fence on every edge that has no track bit from `{3WAY_NE, 3WAY_SE, 3WAY_SW, 3WAY_NW}[d]` and whose
neighbour is a house, industry, road, non-"owned land" object, tunnel/bridge, an invalid tile, or not owned by the same
owner. Cosmetic only.

## 5. Defaults

| Setting                                 | Default                               | File                                                           |
| --------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `construction.build_on_slopes`          | true                                  | `world_settings.ini`                                           |
| `construction.crossing_with_competitor` | true                                  | `world_settings.ini`                                           |
| `construction.freeform_edges`           | true                                  | `world_settings.ini`                                           |
| `difficulty.construction_cost`          | 0 (low → ×6/8)                        | `difficulty_settings.ini`                                      |
| `difficulty.vehicle_costs`              | 0 (affects `PR_INFRASTRUCTURE_RAIL`)  | `difficulty_settings.ini`                                      |
| `economy.infrastructure_maintenance`    | false                                 | `economy_settings.ini`                                         |
| `economy.inflation`                     | false                                 | `economy_settings.ini`                                         |
| `economy.dist_local_authority`          | 20                                    | `economy_settings.ini` (tree removal rating)                   |
| `pf.forbid_90_deg`                      | true                                  | `pathfinding_settings.ini` (affects train paths, not building) |
| `gui.default_rail_type`                 | 0 = "first available"                 | `gui_settings.ini` (`rail_gui.cpp:1946`)                       |
| `game_creation.starting_year`           | 1950 (`CalendarTime::DEF_START_YEAR`) | `world_settings.ini`                                           |

Rail type available at start: `Company::avail_railtypes = GetCompanyRailTypes(company)`
(`company_cmd.cpp:621`). That is the union of the `railtypes` of every non-wagon train engine available to
the company in this climate (or introduced at least `DAYS_IN_YEAR` ago), plus date-introduced rail types
(`rail.cpp:GetCompanyRailTypes`, `AddDateIntroducedRailTypes`). No original rail type is date-introduced
(`INVALID_DATE`). With "first available", the GUI picks `RAILTYPE_RAIL` when it is in the set.

## 6. Stage 1 needs

- `Track`, `TrackBits`, `Trackdir`, `TrackdirBits`, `DiagDirection`, `Direction`, `Axis` with the exact numeric values,
  the helper formulas in 4.1, and the tables `_trackdir_to_exitdir`, `_track_exitdir_to_trackdir`,
  `_track_enterdir_to_trackdir`, `_exitdir_reaches_trackdirs`, `_track_crosses_tracks`,
  `_track_crosses_trackdirs`, `_next_trackdir`, `_tileoffs_by_diagdir`, `_trackdelta`.
- Rail tile model: track bits (6), rail type, owner, ground (Barren/Grass enough), depot (dir + depot id).
  Keeping the m5/m8 bit layout is optional; equivalent typed fields are fine.
- `CmdBuildSingleRail` / `CmdRemoveSingleRail` for clear, tree and own-rail tiles; drag (`CmdRailTrackHelper` with
  `ValidateAutoDrag`); `CmdBuildTrainDepot` on flat ground (with rotation); depot removal.
- Refusals: water, houses, industries, stations, other owner, already built, a train on an interacting track,
  rail on a depot tile.
- Costs: `RailBuildCost`, `RailClearCost`, the clear costs for grass/trees, `PR_BUILD_DEPOT_TRAIN`,
  `PR_CLEAR_DEPOT_TRAIN`. Infrastructure counters (kept for later maintenance and statistics, even with maintenance off).
- Only `RAILTYPE_RAIL` (multiplier 8).

## 7. Skipped

- Slopes and foundations (`GetRailFoundation`, `_valid_tracks_*` beyond flat, `CanBuildDepotByTileh`, half-tile water,
  `FloodHalftile`): Stage 1 map is flat. Hook: `CheckRailSlope` returns 0 cost on flat.
- Signals (`m2`–`m4` signal bits, `CmdBuildSingleSignal`, auto-removal of signals) and PBS reservations.
- Level crossings (`MP_ROAD` branches): no roads in Stage 1.
- Rail conversion (`CmdConvertRail`) and other rail types: only RAIL in Stage 1.
- Bridges/tunnels (`TRACK_BIT_WORMHOLE`, `IsBridgeAbove`), snow/desert ground, fences (cosmetic).
- Town rating change on tree removal: needs the town rating system (towns-industries.md). It is a hook only.
- NewGRF rail types (`AllocateRailType`, labels, `_railtypes_hidden_mask`).
- Infrastructure maintenance: off by default.

## 8. Open questions

1. `CmdRailTrackHelper` sets `had_success = true` from the **previous** iteration's `last_error`
   being `STR_ERROR_ALREADY_BUILT`. Is it intended that a tile that is "already built" only counts
   as success one step later? It changes where a drag stops when the first tiles are already built
   and the next one is an obstacle. Port it literally unless told otherwise?
2. Rotating an existing depot (`CmdBuildTrainDepot`, `rotate_existing_depot`) still charges
   `PR_BUILD_DEPOT_TRAIN + RailBuildCost` (450 + 75 with defaults). This looks deliberate in the code, but check it in game.
3. Which temperate engines are available in 1950, and so whether `avail_railtypes` contains only
   `RAILTYPE_RAIL` at start? This depends on `table/engines.h` and engine preview/introduction rules. Leave to trains.md.
4. `_price` values in 4.9 are derived by hand from `RecomputePrices`. economy.md must confirm them,
   especially the rounding of negative `PR_CLEAR_RAIL` (−52.5 → −53 with an arithmetic shift).
5. The ground type of a freshly built rail tile is `Barren` until the next `TileLoop_Track`. The
   timing of the tile loop is in map.md / time.md. Does Stage 1 need the barren→grass transition, or only the rendering?
