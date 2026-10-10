# Roads: road tiles, level crossings, town road helpers, road tile loop

## 1. Purpose

`MP_ROAD` is the tile type for roads, level crossings and road depots. In Stage 1 the player
cannot build or remove roads and there are no road vehicles. Roads exist because towns grow
along them (`GrowTown*`), and they matter to the player in one place: the player's rail may
cross a town road, which turns the tile into a **level crossing**. The tile loop also changes
the roadside decoration (grass, pavement, trees, street lights) by distance to the town centre.
Only the default road type (`ROADTYPE_ROAD`, no tram) is used.

## 2. Source files

| File                                                            | Key items                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/road_type.h`                                               | `RoadType`, `INVALID_ROADTYPE`, `RoadBits`, `DisallowedRoadDirections`                                                                                                                                                                                          |
| `src/road_map.h`                                                | `RoadTileType`, `Roadside`, all road bit accessors, `MakeRoadNormal`, `MakeRoadCrossing`, `MakeRoadDepot`                                                                                                                                                       |
| `src/road_map.cpp`                                              | `MayHaveRoad`, `GetAnyRoadBits`                                                                                                                                                                                                                                 |
| `src/road_func.h`                                               | `DiagDirToRoadBits`, `MirrorRoadBits`, `ComplementRoadBits`, `IsStraightRoad`, `AxisToRoadBits`; declarations of `UpdateLevelCrossing`                                                                                                                          |
| `src/road.h`                                                    | `RoadBuildCost`, `RoadClearCost`, `RoadNoLevelCrossing`, `RoadTypeInfo`                                                                                                                                                                                         |
| `src/table/roadtypes.h`                                         | `_original_roadtypes[]`: cost multiplier 8, flags `TownBuild`                                                                                                                                                                                                   |
| `src/road.cpp`                                                  | `CleanUpRoadBits`, `IsPossibleCrossing`, `HasRoadTypeAvail`                                                                                                                                                                                                     |
| `src/road_cmd.cpp`                                              | `CmdBuildRoad` (crossing, clear and write branches), `RemoveRoad`, `CheckAllowRemoveRoad`, `ClearTile_Road`, `TileLoop_Road`, `GetTileTrackStatus_Road`, `_town_road_types[]`                                                                                   |
| `src/rail_cmd.cpp`                                              | `CmdBuildSingleRail` (`MP_ROAD` branch), `CmdRemoveSingleRail` (`MP_ROAD` branch), `ClearTile_Track`                                                                                                                                                            |
| `src/train_cmd.cpp`                                             | `UpdateLevelCrossing`, `CheckLevelCrossing`, `TrainApproachingCrossingTile`, `UpdateAdjacentLevelCrossingTilesOnLevelCrossingRemoval`                                                                                                                           |
| `src/town_cmd.cpp`                                              | `GetTownRoadBits`, `GetTownRoadType`, `IsNeighbourRoadTile`, `IsRoadAllowedHere`, `GetTownRoadGridElement`, `GrowTownWithRoad`, `GrowTownInTile`, `CanFollowRoad`, `GrowTownAtRoad`, `GrowTown`, `TownCanGrowRoad`, `ClosestTownFromTile`, `GetTownRadiusGroup` |
| `src/town_map.h`                                                | `GetTownIndex`, `SetTownIndex` (`m2` of road and house tiles)                                                                                                                                                                                                   |
| `src/table/settings/economy_settings.ini`, `world_settings.ini` | defaults of `allow_town_roads`, `allow_town_level_crossings`, `town_layout`, `mod_road_rebuild`, `crossing_with_competitor`                                                                                                                                     |
| `src/table/pricebase.h`                                         | `PR_BUILD_ROAD`, `PR_CLEAR_ROAD`                                                                                                                                                                                                                                |
| `docs/landscape.html`                                           | Road tile layout; agrees with the code below (checked field by field)                                                                                                                                                                                           |

## 3. State

Storage fields are the ones in `map.md` section 3. For `MP_ROAD`:

| Field | Bits  | Normal road                                      | Level crossing                                     | Depot (not used in Stage 1) |
| ----- | ----- | ------------------------------------------------ | -------------------------------------------------- | --------------------------- |
| `m1`  | 4..0  | **road owner** (`GetTileOwner`)                  | **rail owner** (`GetTileOwner`)                    | depot owner                 |
| `m2`  | 15..0 | town index (`GetTownIndex`)                      | town index                                         | depot index                 |
| `m3`  | 3..0  | tram road bits                                   | 0                                                  | 0                           |
| `m3`  | 7..4  | tram owner (`OWNER_NONE` stored as `OWNER_TOWN`) | same                                               | same                        |
| `m4`  | 5..0  | road type (`ROADTYPE_ROAD` = 0, none = 63)       | road type                                          | 63                          |
| `m5`  | 3..0  | road bits (`RoadBits`)                           | bit 0 = road axis (0 = X, 1 = Y); bits 3..1 unused | bits 1..0 exit direction    |
| `m5`  | 5..4  | disallowed directions (`DRD_*`)                  | bit 4 = PBS reservation, bit 5 = barred            | 0                           |
| `m5`  | 7..6  | `RoadTileType` = `Normal` (0)                    | `Crossing` (1)                                     | `Depot` (2)                 |
| `m6`  | 5..3  | `Roadside`                                       | `Roadside`                                         | 0                           |
| `m7`  | 3..0  | road works counter                               | 0                                                  | 0                           |
| `m7`  | 4..0  | 0                                                | **road owner** (`GetRoadOwner(RTT_ROAD)`)          | depot owner                 |
| `m7`  | 5     | snow/desert flag (never set in temperate)        | same                                               | same                        |
| `m8`  | 5..0  | 0                                                | **rail type** (`RAILTYPE_RAIL` = 0)                | 0                           |
| `m8`  | 11..6 | tram type (none = 63)                            | tram type (none = 63)                              | 63                          |

All accessors are in `road_map.h`: `GetRoadTileType` = `GB(m5, 6, 2)`, `GetRoadBits` =
`GB(m5, 0, 4)` (tram: `GB(m3, 0, 4)`), `GetRoadTypeRoad` = `GB(m4, 0, 6)`, `GetRoadTypeTram` =
`GB(m8, 6, 6)`, `GetCrossingRoadAxis` = `GB(m5, 0, 1)`, `HasCrossingReservation` = bit 4 of `m5`,
`IsCrossingBarred` = bit 5 of `m5`, `GetRoadside` = `GB(m6, 3, 3)`, `IsOnSnowOrDesert` = bit 5 of `m7`.
Bits 2..0 of `m5` are read as an axis only in bit 0 (`road_map.h:GetCrossingRoadAxis`).

Owner of a road is read from a different field depending on the tile kind
(`road_map.h:GetRoadOwner`): `GB(IsNormalRoadTile(t) ? m1 : m7, 0, 5)`. On a crossing `m1` is the
rail owner, so **the owner of the town road under a crossing is in `m7`**. A road is town-owned
when `GetRoadOwner(RTT_ROAD) == OWNER_TOWN` (0x0F) (`road_map.h:HasTownOwnedRoad`).

Constants:

| Name                  | Value                                      | Where                      |
| --------------------- | ------------------------------------------ | -------------------------- |
| `ROADTYPE_ROAD`       | 0                                          | `road_type.h:RoadType`     |
| `ROADTYPE_TRAM`       | 1                                          | `road_type.h:RoadType`     |
| `INVALID_ROADTYPE`    | 63 (also `ROADTYPE_END`)                   | `road_type.h:RoadType`     |
| `AXIS_X` / `AXIS_Y`   | 0 / 1                                      | `direction_type.h`         |
| `TRACK_X` / `TRACK_Y` | 0 / 1 (`AxisToTrack` is a cast)            | `track_func.h:AxisToTrack` |
| `OWNER_TOWN`          | 0x0F                                       | see `map.md`               |
| `RoadTileType`        | Normal 0, Crossing 1, Depot 2              | `road_map.h`               |
| `DRD_*`               | NONE 0, SOUTHBOUND 1, NORTHBOUND 2, BOTH 3 | `road_type.h`              |

### 3.1 `RoadBits` and directions (`road_type.h:RoadBits`)

| Name        | Value | Meaning                                                 |
| ----------- | ----- | ------------------------------------------------------- |
| `ROAD_NONE` | 0     | no road                                                 |
| `ROAD_NW`   | 1     | half-tile road piece from the centre to the **NW** edge |
| `ROAD_SW`   | 2     | to the SW edge                                          |
| `ROAD_SE`   | 4     | to the SE edge                                          |
| `ROAD_NE`   | 8     | to the NE edge                                          |
| `ROAD_X`    | 10    | `ROAD_SW \| ROAD_NE`, straight road along the X axis    |
| `ROAD_Y`    | 5     | `ROAD_NW \| ROAD_SE`, straight road along the Y axis    |
| `ROAD_N`    | 9     | `ROAD_NE \| ROAD_NW`, curve touching the N corner       |
| `ROAD_E`    | 12    | `ROAD_NE \| ROAD_SE`                                    |
| `ROAD_S`    | 6     | `ROAD_SE \| ROAD_SW`                                    |
| `ROAD_W`    | 3     | `ROAD_NW \| ROAD_SW`                                    |
| `ROAD_ALL`  | 15    | four-way junction                                       |
| `ROAD_END`  | 16    | out of range; valid = `r < ROAD_END`                    |

A bit means "a road piece runs from the tile centre to that edge", so the bit also means "this
tile connects to the neighbour in that direction". Neighbour offsets (`map.md` 4.2):
NE = (-1, 0), SE = (0, +1), SW = (+1, 0), NW = (0, -1).

Helpers (`road_func.h`):

```
DiagDirToRoadBits(d)  = ROAD_NW << (3 ^ d)      // NE(0)->8, SE(1)->4, SW(2)->2, NW(3)->1
AxisToRoadBits(a)     = a == AXIS_X ? ROAD_X : ROAD_Y
ComplementRoadBits(r) = ROAD_ALL ^ r
MirrorRoadBits(r)     = (GB(r,0,2) << 2) | GB(r,2,2)      // NW<->SE, SW<->NE
IsStraightRoad(r)     = r == ROAD_X || r == ROAD_Y
```

### 3.2 Roadside (`road_map.h:Roadside`)

`Barren 0`, `Grass 1`, `Paved 2`, `StreetLights 3`, (4 unused), `Trees 5`, `GrassRoadWorks 6`,
`PavedRoadWorks 7`. Stored in `m6` bits 5..3. `HasRoadWorks` = `roadside >= GrassRoadWorks`.

### 3.3 Make functions (`road_map.h`)

`MakeRoadNormal(t, bits, road_rt, tram_rt, town, road_owner, tram_owner)`; every field it writes:

```
SetTileType(t, MP_ROAD)                      // type bits 7..4 of the type byte; bridge/zone bits kept
SetTileOwner(t, road_owner)                  // m1 bits 4..0 only; m1 bits 7..5 kept
m2 = town
m3 = (tram_rt != INVALID ? bits : 0)         // then bits 7..4 overwritten below
m5 = (road_rt != INVALID ? bits : 0) | (Normal << 6)     // DRD bits 5..4 = 0
m6 bits 7..2 = 0                             // roadside = Barren, m6 bits 1..0 kept
m7 = 0
m8 = 0
SetRoadTypes: m4 bits 5..0 = road_rt ; m8 bits 11..6 = tram_rt     // m4 bits 7..6 NOT written
SetRoadOwner(t, RTT_TRAM, tram_owner)        // m3 bits 7..4 = (tram_owner == OWNER_NONE ? OWNER_TOWN : tram_owner)
```

For a town road (`road_rt` 0, `tram_rt` 63, `bits` B, both owners `OWNER_TOWN`):
`m1 owner = 0x0F`, `m2 = town`, `m3 = 0xF0`, `m4 low 6 bits = 0`, `m5 = B`, `m6 bits 7..2 = 0`,
`m7 = 0`, `m8 = 63 << 6 = 0xFC0`.

`MakeRoadCrossing(t, road, tram, rail, roaddir, rat, road_rt, tram_rt, town)`:

```
SetTileType(t, MP_ROAD)
SetTileOwner(t, rail)                        // m1 = RAIL owner
m2 = town
m3 = 0
m4 = INVALID_ROADTYPE (63)
m5 = (Crossing << 6) | roaddir               // reservation (bit 4) and barred (bit 5) = 0
m6 bits 7..2 = 0                             // roadside = Barren
m7 = road.base()                             // ROAD owner, bit 5 (snow) cleared
m8 = (INVALID_ROADTYPE << 6) | rat           // rail type in bits 5..0
SetRoadTypes: m4 bits 5..0 = road_rt ; m8 bits 11..6 = tram_rt
SetRoadOwner(t, RTT_TRAM, tram)              // m3 bits 7..4
```

Crossing over a town road (`road = tram = OWNER_TOWN`, `rail` = company C, `rat` = R): `m1 = C`,
`m2 = town`, `m3 = 0xF0`, `m4 = 0`, `m5 = 0x40 | roaddir` (+ later barred/reservation),
`m6` roadside Barren, `m7 = 0x0F`, `m8 = 0xFC0 | R`.

`MakeRoadDepot` is listed in section 7 (skipped).

`GetAnyRoadBits(tile, RTT_ROAD, straight_tunnel_bridge_entrance)` (`road_map.cpp`): returns
`ROAD_NONE` if the tile cannot have a road or has no road type; for `MP_ROAD` Normal = `GetRoadBits`,
Crossing = `GetCrossingRoadBits` (`ROAD_X` if road axis X, else `ROAD_Y`), Depot = the exit
direction bit. A crossing therefore reads as a **straight road** to every town helper.

## 4. Rules and formulas

### 4.1 Level crossing, rail built over a road (`rail_cmd.cpp:CmdBuildSingleRail`, `case MP_ROAD`)

The player's rail tool runs with `Auto | NoWater` (see `track.md`). On an `MP_ROAD` tile:

```
if !HasBit(VALID_LEVEL_CROSSING_SLOPES, tileh): error LAND_SLOPED_IN_WRONG_DIRECTION
      // flat is allowed (VALID_LEVEL_CROSSING_SLOPES includes SLOPE_FLAT, slope_type.h)
if !crossing_with_competitor && _current_company != OWNER_DEITY:
      CheckTileOwnership(tile)     // GetTileOwner = m1: OWNER_TOWN != company -> STR_ERROR_OWNED_BY
EnsureNoVehicleOnGround(tile)      // vehicle with z_pos <= tile max z -> error
if IsNormalRoad(tile):
    if HasRoadWorks(tile):                        error ROAD_WORKS_IN_PROGRESS
    if GetDisallowedRoadDirections(tile) != NONE: error CROSSING_ON_ONEWAY_ROAD
    if RailNoLevelCrossings(railtype):            error CROSSING_DISALLOWED_RAIL
    road_rt = GetRoadTypeRoad(tile); tram_rt = GetRoadTypeTram(tile)
    if road_rt != 63 && RoadNoLevelCrossing(road_rt): error CROSSING_DISALLOWED_ROAD   // same for tram
    road = GetRoadBits(tile, RTT_ROAD); tram = GetRoadBits(tile, RTT_TRAM)
    if (track == TRACK_X && ((road|tram) & ROAD_X) == 0) ||
       (track == TRACK_Y && ((road|tram) & ROAD_Y) == 0):
        // the road has NO piece along the rail axis
        road_owner = GetRoadOwner(tile, RTT_ROAD); tram_owner = GetRoadOwner(tile, RTT_TRAM)
        num_new_road_pieces = (road != ROAD_NONE) ? 2 - CountBits(road) : 0
        cost += num_new_road_pieces * RoadBuildCost(road_rt)
        exec: MakeRoadCrossing(tile, road_owner, tram_owner, _current_company,
                               track == TRACK_X ? AXIS_Y : AXIS_X, railtype, road_rt, tram_rt,
                               GetTownIndex(tile))
              UpdateLevelCrossing(tile, false)
              rail[railtype] += LEVELCROSSING_TRACKBIT_FACTOR (2)        // infrastructure count
        break
if IsLevelCrossing(tile) && GetCrossingRailBits(tile) == trackbit: error ALREADY_BUILT
fallthrough to the default branch (see 4.2)
...
cost += RailBuildCost(railtype)      // end of the function, added for the crossing as well
```

Consequences:

- **Allowed road shapes** for `TRACK_X`: road bits that are a non-empty subset of `ROAD_Y` (`ROAD_NW`,
  `ROAD_SE` or `ROAD_Y`). For `TRACK_Y`: subset of `ROAD_X`. A half piece (one bit) is allowed and is
  completed by the tile becoming a crossing: the crossing always has both halves
  (`GetCrossingRoadBits`), and the missing half is charged (`2 - CountBits(road)`).
- **Not allowed to cross**: any road with a piece along the rail axis: T-junctions, curves,
  crossroads, and a straight road parallel to the rail. These fall to the default branch (4.2).
- The new crossing's **road owner stays `OWNER_TOWN`** (in `m7`), **tile owner = the building company**
  (`m1`), town index kept (`m2`), rail type = the new track's, roadside reset to Barren.
- The crossing check on ownership (`crossing_with_competitor`) defaults to **true**, so the
  `CheckTileOwnership` line is skipped and a company may cross a town road
  (`world_settings.ini`, `def = true`). With it false, the owner test fails for town roads
  (`company_cmd.cpp:CheckOwnership`: owner `OWNER_TOWN` is never the current company).
- Cost for a straight town road: `RailBuildCost(railtype)` only (no road pieces added). For a
  one-piece road: `RailBuildCost + RoadBuildCost(ROADTYPE_ROAD)`. No clearing cost, no foundation cost.
- `CmdBuildSingleRail` on an existing crossing with a **different** rail axis than its own goes to
  the default branch, so it also fails there (the clear fails with `Auto`, see 4.2).
- A second track in the same axis: `IsLevelCrossing && GetCrossingRailBits == trackbit` returns
  `ALREADY_BUILT`.
- Crossings are always a single straight track: there is no way to put two rail tracks on one
  crossing tile.

### 4.2 Rail over a road that cannot become a crossing (default branch)

Reached when the road has a piece along the rail axis, or when the tile is a crossing/depot. The code
runs `CheckRailSlope` then `CMD_LANDSCAPE_CLEAR(flags, tile)` with `Auto | NoWater`
(`road_cmd.cpp:ClearTile_Road`):

```
Normal road: b = GetAllRoadBits(tile)
    if (HasExactlyOneBit(b) && tram == NONE) || !Auto:     // one road piece only: remove it
        RemoveRoad(tile, flags, GetRoadBits(RTT_ROAD), RTT_ROAD, town_check = true)
            -> CheckAllowRemoveRoad: town-owned road + a company: CheckforTownRating(RoadRemove);
               then may refuse (STR_ERROR_LOCAL_AUTHORITY_REFUSES_TO_ALLOW_THIS) or lowers the rating
               by RATING_ROAD_DOWN_STEP_EDGE (-18) / _INNER (-50), floor RATING_ROAD_MINIMUM (-100)
            cost = CountBits(pieces) * RoadClearCost(road_rt)
    else: error STR_ERROR_MUST_REMOVE_ROAD_FIRST         // 2+ pieces: no auto-demolish
Crossing:  Auto -> error MUST_REMOVE_ROAD_FIRST
```

So with `Auto`, the player's rail can replace only a **single-piece road stub** (and that touches
town rating); every other road shape blocks it. The thresholds `needed_rating[]` and
`town_council_tolerance` are in `town_cmd.cpp:CheckforTownRating` (not needed while ratings are
skipped, see 7 and 8).

### 4.3 Removing the rail of a crossing (`rail_cmd.cpp:CmdRemoveSingleRail`, `case MP_ROAD`)

```
if !IsLevelCrossing(tile) || GetCrossingRailBits(tile) != trackbit: error THERE_IS_NO_RAILROAD_TRACK
if _current_company != OWNER_WATER: CheckTileOwnership(tile)       // m1 = rail owner
if !Bankrupt: EnsureNoVehicleOnGround(tile)
cost += RailClearCost(GetRailType(tile))                           // negative = refund (track.md 4.9)
exec:
    UpdateAdjacentLevelCrossingTilesOnLevelCrossingRemoval(tile, road axis)
    free the train reservation on that track, if any
    rail[railtype] -= LEVELCROSSING_TRACKBIT_FACTOR (2)
    MakeRoadNormal(tile, GetCrossingRoadBits(tile), GetRoadTypeRoad(tile), GetRoadTypeTram(tile),
                   GetTownIndex(tile), GetRoadOwner(tile, RTT_ROAD), GetRoadOwner(tile, RTT_TRAM))
```

Result: a normal straight road (`ROAD_X` or `ROAD_Y`), tile owner (`m1`) = the old road owner
(`OWNER_TOWN`), town index kept, roadside **Barren** (the tile loop repaves it), no one-way
bits, `m7 = 0`, rail type forgotten. Rail owner and rail type are lost.
`UpdateAdjacentLevelCrossingTilesOnLevelCrossingRemoval` unbars adjacent crossing tiles on the same
road axis that no train is using.

`ClearTile_Road` on a crossing without `Auto` (bulldozer) removes the road with `RemoveRoad`
(which turns the tile into plain rail with `MakeRailNormal`, keeping tracks and reservation) and then
calls `CMD_LANDSCAPE_CLEAR` again on the tile, so the rail goes too. This is the only way the road
survives or dies by player action besides 4.1 to 4.3 (open question 5).

### 4.4 Level crossing, road built over rail (`road_cmd.cpp:CmdBuildRoad`, `case MP_RAILWAY`)

This is how **town growth** creates a crossing over the player's rail
(`GrowTownWithRoad` -> `CMD_BUILD_ROAD`, company `OWNER_TOWN`):

```
if IsSteepSlope(tileh) or tileh not in VALID_LEVEL_CROSSING_SLOPES: error
if !crossing_with_competitor && company != OWNER_TOWN && company != OWNER_DEITY: CheckTileOwnership(tile)
      // towns are exempt from the ownership check
if GetRailTileType(tile) != RailTileType::Normal:   goto do_clear   // depot, or tile with signals
if RoadNoLevelCrossing(rt):                         error CROSSING_DISALLOWED_ROAD
if RailNoLevelCrossings(GetRailType(tile)):         error CROSSING_DISALLOWED_RAIL
switch GetTrackBits(tile):
    TRACK_BIT_X: if (pieces & ROAD_X) goto do_clear;  roaddir = AXIS_Y
    TRACK_BIT_Y: if (pieces & ROAD_Y) goto do_clear;  roaddir = AXIS_X
    default: goto do_clear                           // any other bit combination, e.g. a junction
EnsureNoVehicleOnGround(tile)
exec: reserved = HasBit(GetRailReservationTrackBits(tile), railtrack)
      MakeRoadCrossing(tile, company, company, GetTileOwner(tile), roaddir, GetRailType(tile),
                       rt, INVALID_ROADTYPE, town_id)
      SetCrossingReservation(tile, reserved)
      UpdateLevelCrossing(tile, false)
cost = 2 * RoadBuildCost(rt)
```

`do_clear` calls `CMD_LANDSCAPE_CLEAR` with the town's flags `Execute | Auto | NoWater`; for rail it
fails (`ClearTile_Track`, `Auto`: owner is not `OWNER_TOWN` -> `AREA_IS_OWNED_BY_ANOTHER`).
So a town road can cross the player's rail **only if** the rail tile is plain (`RailTileType::Normal`),
has exactly one straight track (`TRACK_BIT_X` or `TRACK_BIT_Y`), and the piece the town builds has no
bit along the rail axis. The crossing keeps the rail owner and the rail's reservation bit.
The crossing's road owner is `OWNER_TOWN`; its town index is the building town.

### 4.5 Town growth reaches an existing crossing

Helpers see a crossing as a straight road (`GetTownRoadBits` -> `GetAnyRoadBits(tile, RTT_ROAD, true)`
-> `GetCrossingRoadBits`). The consequences, traced through `town_cmd.cpp:GrowTownAtRoad` /
`GrowTownInTile` / `CanFollowRoad`:

1. The random walk **can enter** a crossing: `CanFollowRoad` returns true for any `MP_ROAD` tile with
   `GetTownRoadBits != ROAD_NONE`. It can walk across it along the road axis.
2. `GrowTownAtRoad` aborts the walk if the tile's road is `OWNER_TOWN` and `Town::GetByTile(tile) != t`
   (road of another town); a crossing reads its owner from `m7` and town from `m2`.
3. On the crossing tile `GrowTownInTile` takes the "road already there" branch. The random side is
   either on the crossing's axis (curve/corner test: `(cur_rb & ROAD_X) != target_rb` -> `Continue`,
   nothing happens) or perpendicular. For a perpendicular side it may place a **house** on the
   neighbouring tile, as on any straight road (`allow_house` rules in 4.9).
4. If no house is built, the town tries to add the perpendicular piece to the crossing:
   `GrowTownWithRoad` -> `CmdBuildRoad` on a `Crossing`: `pieces & ComplementRoadBits(other_bits)`
   non-zero -> `do_clear` -> `ClearTile_Road(Crossing, Auto)` -> `MUST_REMOVE_ROAD_FIRST`: **fails**.
   If the piece is along the axis: `HasTileRoadType` -> `ALREADY_BUILT` -> fails. The town never
   changes a crossing (no junction on a crossing, no demolition).
   (Before that, `CleanUpRoadBits` first removes planned bits whose neighbour is not connective.)
5. `IsRoadAllowedHere` / `IsNeighbourRoadTile` treat a crossing as a road tile: it blocks parallel
   roads next to it like any other straight road (4.8).
6. `RoadTypesAllowHouseHere`: houses next to a crossing are allowed (road type has no `NoHouses` flag).
7. The tile loop (4.11) still repaints a crossing's roadside; nothing else changes.

### 4.6 `GetTownRoadBits` and `GetTownRoadType` (`town_cmd.cpp`)

```
GetTownRoadBits(tile):
    if IsRoadDepotTile(tile) || IsBayRoadStopTile(tile): return ROAD_NONE
    return GetAnyRoadBits(tile, RTT_ROAD, true)      // normal: bits; crossing: ROAD_X/ROAD_Y; others: NONE (Stage 1)

GetTownRoadType():                                   // iterate road types
    best = ROADTYPE_ROAD; skip types without flag TownBuild, or not yet introduced;
    prefer higher max_speed (0 counts as 50)
```

`_original_roadtypes[ROADTYPE_ROAD]` (`table/roadtypes.h`): flags `{TownBuild}`, cost multiplier 8,
maintenance multiplier 16, max speed 0, introduction date `CalendarTime::MIN_DATE`, powered
`{ROADTYPE_ROAD}`. The tram type does not have `TownBuild`. With only `ROADTYPE_ROAD` the result is
always `ROADTYPE_ROAD` (0).

### 4.7 `CleanUpRoadBits(tile, org_rb)` (`road.cpp`)

Removes from a planned `RoadBits` every piece whose neighbour cannot connect. For each direction `dir`
in NE, SE, SW, NW, where `org_rb` has `DiagDirToRoadBits(dir)`:

```
mirrored = MirrorRoadBits(DiagDirToRoadBits(dir))        // the neighbour's bit facing this tile
neighbour = tile + TileOffsByDiagDir(dir)
connective = false
if IsValidTile(neighbour):
  switch GetTileType(neighbour):
    MP_CLEAR, MP_TREES:               true
    MP_TUNNELBRIDGE, MP_STATION, MP_ROAD:
        if IsNormalRoadTile(neighbour): true
        else: (GetAnyRoadBits(neighbour, RTT_ROAD) | GetAnyRoadBits(neighbour, RTT_TRAM)) & mirrored != 0
              // crossing: connective only if the crossing's road axis is `dir`'s axis
    MP_RAILWAY:  IsPossibleCrossing(neighbour, DiagDirToAxis(dir))
    MP_WATER:    !IsWater(neighbour)       // coast / shore is connective, open sea is not
    default (MP_HOUSE, MP_INDUSTRY, MP_VOID, MP_OBJECT): false
if !connective: org_rb ^= DiagDirToRoadBits(dir)
return org_rb
```

`IsPossibleCrossing(tile, ax)` (`road.cpp`): `MP_RAILWAY` && `RailTileType::Normal` &&
`GetTrackBits == (ax == AXIS_X ? TRACK_BIT_Y : TRACK_BIT_X)` && flat foundation. I.e. the road may point
at a rail tile only when the road direction is perpendicular to its single track. An invalid tile
(map border) gives `ROAD_NONE` for the whole result (`!IsValidTile(tile)` at the top).

### 4.8 `IsRoadAllowedHere` and `IsNeighbourRoadTile` (`town_cmd.cpp`)

```
IsRoadAllowedHere(t, tile, dir):
    if DistanceFromEdge(tile) == 0: return false        // tile on the map border row/column
    if IsBridgeAbove(tile) && bridge axis == DiagDirToAxis(dir): return false     // not in Stage 1
    if GetTownRoadBits(tile) == ROAD_NONE:
        // test only (no Execute): can a road be built here, else can the land be cleared?
        rt = GetTownRoadType()
        if CMD_BUILD_ROAD({Auto, NoWater}, tile, (dir is NW or SE) ? ROAD_Y : ROAD_X, rt, DRD_NONE, t->index) fails
           && CMD_LANDSCAPE_CLEAR({Auto, NoWater}, tile) fails:  return false
    cur_slope = build_on_slopes ? foundation slope : tile slope
    ret = !IsNeighbourRoadTile(tile, dir, t->layout == TL_ORIGINAL ? 1 : 2)
    if cur_slope == SLOPE_FLAT: return ret             // all of Stage 1
    ... slope branch: Chance16(1,8), terraform Chance16(1,10), Chance16(1,3)  (skipped, flat map)
```

Build-road test on a rail tile: only a perpendicular crossing passes (4.4); otherwise the clear test
also fails (`ClearTile_Track` with `Auto`), so `IsRoadAllowedHere` is false on player rail except where
a crossing could be made. Open sea (`ClearTile_Water`, `Clear`, `NoWater` -> `CAN'T_BUILD_ON_WATER`)
fails both tests; a coast tile can be cleared.

```
IsNeighbourRoadTile(tile, dir, dist_multi):          // "is there a parallel road beside the new road?"
    if !IsValidTile(tile): return false
    tid_lt = { offset(dir turned 90 right), offset(dir turned 90 left), offset(reverse(dir)) }
    dist_multi = (dist_multi + 1) * 4
    for pos in 4 .. dist_multi-1:
        cur = tid_lt[(pos & 1) ? 0 : 1] * (pos / 4)    // pos/4 tiles to the right or the left
        if pos & 2: cur += tid_lt[2]                   // or one tile backwards
        if IsValidTile(tile + cur) &&
           GetTownRoadBits(tile + cur) & DiagDirToRoadBits((pos & 2) ? dir : ReverseDiagDir(dir)): return true
    return false
```

`dist_multi` is 1 for `TL_ORIGINAL` (checks pos 4..7: four tiles at 1 to the sides, with and without
the step back) and 2 for every other layout (pos 4..11, up to 2 tiles to the sides). `ChangeDiagDir`
adds `DIAGDIRDIFF_90RIGHT` = 1, `DIAGDIRDIFF_90LEFT` = 3 modulo 4 to the direction value.

### 4.9 Road growth steps (`town_cmd.cpp:GrowTownInTile`, summary for roads)

Only the road side; houses are in `towns-industries.md`. `modes` = `{Buildings}` plus `Roads` when
`economy.allow_town_roads` is true (checked in `TownTickHandler`; `DoCreateTown` always passes both).

```
Case A, cur_rb == ROAD_NONE (growth reached a tile without road):
    if !Roads: SearchStopped
    if !allow_town_level_crossings && IsTileType(tile, MP_RAILWAY): SearchStopped
    if !build_on_slopes || Chance16(1,6): LevelTownLand(tile)       // no-op on flat
    TL_2X2_GRID / TL_3X3_GRID: rcmd = GetTownRoadGridElement(t, tile, target_dir); NONE -> SearchStopped
    TL_ORIGINAL / TL_BETTER_ROADS:
        if !IsRoadAllowedHere(t, tile, target_dir): SearchStopped
        source_dir = reverse(target_dir)
        if Chance16(1,4): re-draw target_dir with RandomDiagDir() until != source_dir
        if !IsRoadAllowedHere(t, tile + offset(target_dir), target_dir):
            if target_dir != reverse(source_dir): SearchStopped            // a curve is refused
            if neither side tile (target_dir turned 90 right/left) is MP_HOUSE: SearchStopped
        rcmd = DiagDirToRoadBits(target_dir) | DiagDirToRoadBits(source_dir)
Case B, cur_rb != NONE, target_dir valid and cur_rb lacks the bit facing back (partial road):
    if !TownCanGrowRoad(tile): Continue          // MP_ROAD whose type is not TownBuild/town road type
    if !Roads: SearchStopped
    grids: rcmd = GetTownRoadGridElement(...);  original/better: rcmd = DiagDirToRoadBits(reverse(target_dir))
Case C, otherwise (tile has road, random side): see town code; may build a house, may set rcmd = target_rb
    (original/better: allow_house = !IsRoadAllowedHere(house_tile, target_dir) || Chance16(6,10))
Then, if no house was chosen:
    if HasTileWaterGround(tile): SearchStopped
    rcmd = CleanUpRoadBits(tile, rcmd); NONE -> SearchStopped
    GrowTownWithBridge / GrowTownWithTunnel (skipped), then GrowTownWithRoad(t, tile, rcmd)
GrowTownWithRoad(t, tile, rcmd) = CMD_BUILD_ROAD({Execute, Auto, NoWater}, tile, rcmd, GetTownRoadType(),
                                                 DRD_NONE, t->index).Succeeded()
```

`GrowTownAtRoad` iterations: `TL_BETTER_ROADS` `10 + num_houses * 2 / 9`; `TL_2X2_GRID`/`TL_3X3_GRID`
`10 + num_houses * 1 / 9`; others (`TL_ORIGINAL`, and `TL_RANDOM` resolved at founding) `10 + num_houses * 4 / 9`.
`GrowTown` first looks for a road tile among the 13 offsets of `_town_coord_mod` starting at `t->xy`
(`towns-industries.md` 4.x); otherwise `GenRandomRoadBits` makes a two-piece block: with
`r = Random()`, `a = GB(r,0,2)`, `b = GB(r,8,2)`, `if a == b: b ^= 2`,
`bits = (ROAD_NW << a) + (ROAD_NW << b)`. `GetTownRoadGridElement` for flat tiles
(`town_cmd.cpp`): `TL_2X2_GRID`: `ROAD_Y` if `(dx % 3) == 0`, plus `ROAD_X` if `(dy % 3) == 0`;
`TL_3X3_GRID` the same with `% 4`, where `(dx, dy) = tile - t->xy`; a junction (`ROAD_ALL`) on flat
ground returns `ROAD_ALL`; otherwise the aligned bits (`ROAD_NONE` if neither).

### 4.10 What `CmdBuildRoad` writes when a town adds road (`road_cmd.cpp:CmdBuildRoad`)

Town company: `company = OWNER_TOWN`, `town_id = t->index` (checked: `company == OWNER_TOWN` needs a valid
town id).

```
tile type Normal road (no road works): existing = GetRoadBits;  (existing & pieces) == pieces -> ALREADY_BUILT
tile type Crossing: see 4.5
clear / trees / etc. (default branch): CMD_LANDSCAPE_CLEAR(flags, tile) (fails on houses etc. with Auto)
cost = CountBits(pieces) * RoadBuildCost(rt)          // town pays nothing
exec on MP_ROAD:  if existing == ROAD_NONE || Crossing: SetRoadType, SetRoadOwner(OWNER_TOWN), SetTownIndex(town_id)
                  if not Crossing: SetRoadBits(existing | pieces)
exec otherwise:   MakeRoadNormal(tile, pieces, rt, INVALID_ROADTYPE, town_id, OWNER_TOWN, OWNER_TOWN)
                  then SetDisallowedRoadDirections(tile, IsStraightRoad(existing|pieces) ? old ^ DRD_NONE : DRD_NONE)
```

So the town index of a tile is set when the **first** road piece is built and kept when pieces are added.
Roadside of a new road tile = Barren (set by `MakeRoadNormal`); adding pieces to an existing road tile
keeps its roadside.

### 4.11 Road tile loop (`road_cmd.cpp:TileLoop_Road`)

Runs for every `MP_ROAD` tile once per 256 ticks (`map.md` tile loop). In temperate, flat, no road works:

```
landscape == Temperate: no snow/desert handling
if IsRoadDepot(tile): return
t = ClosestTownFromTile(tile, UINT_MAX)       // road owned by a town: town in m2 (Town::GetByTile);
                                              // else m2, or the nearest town by Manhattan distance
if !HasRoadWorks(tile):
    grp = HouseZone::TownEdge (0)
    if t != nullptr: grp = GetTownRadiusGroup(t, tile)       // 0 Edge .. 4 Centre, towns-industries.md
    [road works start: only if t->road_build_months != 0 && ..., see below]
    new_rs = _town_road_types[grp]            // {target, pre-type}
    cur_rs = GetRoadside(tile)
    if cur_rs == new_rs[0]: return
    if cur_rs == new_rs[1]: cur_rs = new_rs[0]
    elif cur_rs == Barren:  cur_rs = new_rs[1]
    else:                   cur_rs = Barren
    SetRoadside(tile, cur_rs)
```

`_town_road_types[][2]` (`road_cmd.cpp`), index `grp`:

| `grp` (zone)        | target `[0]`   | pre-type `[1]` |
| ------------------- | -------------- | -------------- |
| 0 `TownEdge`        | `Grass`        | `Grass`        |
| 1 `TownOutskirt`    | `Paved`        | `Paved`        |
| 2 `TownOuterSuburb` | `Paved`        | `Paved`        |
| 3 `TownInnerSuburb` | `Trees`        | `Trees`        |
| 4 `TownCentre`      | `StreetLights` | `Paved`        |

(Toyland uses `_town_road_types_2`; not used.) Examples: a new Barren road in the centre becomes
`Paved` on its first visit and `StreetLights` on the second; in an inner suburb `Barren` -> `Trees`
in one visit; a road that sits in the wrong decoration for its zone (e.g. `Grass` in the outskirts
after the town grew) first goes to `Barren`, then to the target. `GetTownRadiusGroup`: `dist =
DistanceSquare(tile, t->xy)`; `Centre` when `t->fund_buildings_months != 0 && dist <= 25`; otherwise
the highest zone `i` with `dist < squared_town_zone_radius[i]`, else `Edge` (radii in
`towns-industries.md`, `UpdateTownRadius`).

The tile loop uses **no random numbers** while `road_build_months == 0`: the `Chance16(1, 40)` that
starts road works is the last operand of an `&&` chain, evaluated only when `t->road_build_months != 0`
(set to 6 only by the "road rebuild" town action, `town_cmd.cpp:TownActionRoadRebuild`; decremented
monthly at `town_cmd.cpp` line 4120). The branch with an active road works counter
(`IncreaseRoadWorksCounter` / `TerminateRoadWorks`, `mod_road_rebuild` clean-up) is therefore never
reached in Stage 1.

The loop treats a crossing like a normal road tile (same roadside table). Roadside has no effect on
gameplay: it selects the ground graphics and street lights/trees only.

### 4.12 Crossing barred state (`train_cmd.cpp`) and track status

A crossing is barred when `HasCrossingReservation(tile) || TrainOnCrossing(tile) ||
TrainApproachingCrossing(tile)` (`train_cmd.cpp:CheckLevelCrossing`). A train approaches when its front
engine is on a tile adjacent along the **rail** axis and its exit direction points at the crossing
(`TrainApproachingCrossingTile`). `UpdateLevelCrossing(tile)` evaluates this for the crossing and all
adjacent crossing tiles on the same road axis (a multi-tile crossing bars as a group) and sets `m5`
bit 5. It is called when a train enters or leaves a tile and when the crossing is built or removed.
`road_cmd.cpp:GetTileTrackStatus_Road`: for `TRANSPORT_RAIL` a crossing returns
`TrackBitsToTrackdirBits(GetCrossingRailBits)`; for the rail pathfinder it is an ordinary rail tile
with that one track. Barring does not slow or stop trains; it only affects road traffic.

### 4.13 Costs (`road.h`, `table/pricebase.h`)

```
RoadBuildCost(rt) = (_price[PR_BUILD_ROAD] * cost_multiplier(rt)) >> 3        // ROAD: x8 >> 3 = x1
RoadClearCost(rt) = _price[PR_CLEAR_ROAD]                                      // flat fee for the road type
RoadMaintenanceCost(rt, num, total) =
    (_price[PR_INFRASTRUCTURE_ROAD] * maintenance_multiplier(rt) * num * (1 + IntSqrt(total))) >> 12
```

Base prices: `PR_BUILD_ROAD 95`, `PR_CLEAR_ROAD 40`, `PR_INFRASTRUCTURE_ROAD 10` (running). With the
default scaling used in `track.md` (`start * 6 * 65536 >> 19`, truncating): `_price[PR_BUILD_ROAD]` =
71, `_price[PR_CLEAR_ROAD]` = 30, `_price[PR_INFRASTRUCTURE_ROAD]` = 7. `economy.md` is the authority
for `_price`. `LEVELCROSSING_TRACKBIT_FACTOR = 2` (`economy_type.h`) counts a crossing as 2 rail pieces
in infrastructure.

Player-relevant totals: a rail piece over a straight town road costs 75 (no road charge); over a
one-piece stub, 75 + 71. Removing the track of a crossing refunds 53 like any rail
(`RailClearCost`).

## 5. Defaults

| Setting                                 | Default           | File                   | Meaning here                                                                                                   |
| --------------------------------------- | ----------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `economy.allow_town_roads`              | true              | `economy_settings.ini` | town growth may build roads (`TownExpandMode::Roads`)                                                          |
| `economy.allow_town_level_crossings`    | true              | `economy_settings.ini` | growth may cross rail (`GrowTownInTile` case A, `CanRoadContinueIntoNextTile`)                                 |
| `economy.town_layout`                   | `TL_ORIGINAL` (0) | `economy_settings.ini` | `TL_BEGIN`..`NUM_TLS-1`; `TL_ORIGINAL` 0, `TL_BETTER_ROADS` 1, `TL_2X2_GRID` 2, `TL_3X3_GRID` 3, `TL_RANDOM` 4 |
| `economy.mod_road_rebuild`              | true              | `economy_settings.ini` | road works clean-up (not reached, 4.11)                                                                        |
| `construction.crossing_with_competitor` | true              | `world_settings.ini`   | a company may build a crossing over another owner's road                                                       |
| `construction.build_on_slopes`          | true              | `world_settings.ini`   | irrelevant on a flat map                                                                                       |
| `construction.extra_dynamite`           | true              | `world_settings.ini`   | only in `CheckAllowRemoveRoad` (4.2)                                                                           |

`TL_RANDOM`: `Town::InitializeLayout` sets `layout = TileHash(TileX(xy), TileY(xy)) % (NUM_TLS - 1)` with
`TileHash(x, y) = ((x >> 4) ^ (x >> 6) ^ (y >> 4)) - (y >> 6)` (`tile_map.h`), i.e. one of the first four.
The layout is stored on the town, not re-read from the setting (`town_cmd.cpp:DoCreateTown`).

## 6. Stage 1 needs

Port:

1. The `MP_ROAD` tile fields for Normal and Crossing (or typed equivalents, as `track.md` allows):
   road bits, road owner, tile owner, town index, road type, roadside, crossing axis, barred flag,
   reservation flag, rail type of the crossing. `RoadTileType` values 0 and 1; keep value 2 reserved.
2. `RoadBits` constants and `DiagDirToRoadBits`, `MirrorRoadBits`, `ComplementRoadBits`,
   `IsStraightRoad`, `AxisToRoadBits`, `GetAnyRoadBits` (Normal and Crossing only),
   `GetTownRoadBits`.
3. `MakeRoadNormal` and `MakeRoadCrossing` with the field values in 3.3 (town-owned roads only).
4. The town side: `CmdBuildRoad` as used by `GrowTownWithRoad`, `IsRoadAllowedHere`,
   `IsNeighbourRoadTile`, `CleanUpRoadBits` + `IsPossibleCrossing`, `CanFollowRoad`,
   `GrowTownAtRoad`, `GrowTownInTile`, `GrowTown`, `GenRandomRoadBits`, `GetTownRoadGridElement`,
   `TownCanGrowRoad` (always true), the `allow_town_roads`, `allow_town_level_crossings`, layout
   settings. This is the road part of the initial town build (`towns-industries.md`) and in-game growth.
5. Crossing creation by the player: the `MP_ROAD` branch of `CmdBuildSingleRail` (4.1), including the
   error cases and the cost; crossing creation by a town (4.4); removal (4.3); `UpdateLevelCrossing`
   and the barred rule (4.12). The rail command's `Auto` clear of a single-piece road stub (4.2) if
   stubs can occur next to the player's rail.
6. `GetTileTrackStatus_Road` for rail: a crossing exposes its one rail track to trains.
7. `TileLoop_Road` roadside logic (4.11) and `_town_road_types[]` if the roadside is drawn or
   stored; no random numbers are needed.
8. Costs `RoadBuildCost`, `RoadClearCost` as 71 and 30 at start prices (4.13) through the `_price`
   table.

## 7. Skipped

- Tram roads, `ROADTYPE_TRAM`, one-way roads (`DRD_*`, `CmdBuildRoad` `toggle_drd`), road works
  (`StartRoadWorks`, `TerminateRoadWorks`, `road_build_months`), road depots (`MakeRoadDepot`,
  `RoadTileType::Depot`), road stops, bridges, tunnels (`GrowTownWithBridge`, `GrowTownWithTunnel`,
  `CanRoadContinueIntoNextTile`), conversion (`CmdConvertRoad`), long road commands.
- Slopes and foundations: `CheckRoadSlope`, `_invalid_tileh_slopes_road`, `GetRoadFoundation`,
  `LevelTownLand`, `TerraformTownTile`, the slope branch of `IsRoadAllowedHere`, `TerraformTile_Road`.
- Snow/desert handling in `TileLoop_Road` (arctic, tropic); Toyland roadside table.
- NewGRF road types, `RoadTypeInfo` GUI and string tables, catenary, road sprites and drawing.
- Road vehicle behaviour: `VehicleEnter_Road`, vehicle collisions on crossings.
- Company infrastructure counts for roads (`UpdateCompanyRoadInfrastructure`,
  `RoadMaintenanceCost`): only matters with `infrastructure_maintenance`, default off.
- Town rating changes from removing town roads (`CheckAllowRemoveRoad`, `ChangeTownRating`) while town
  ratings are out of scope; `ChangeTileOwner_Road` (company bankruptcy); YAPF notifications.

## 8. Open questions

1. **Town rating when a player rail replaces a single-piece road stub (4.2).** The source lowers the
   rating by 18 or 50 and may refuse depending on `town_council_tolerance`. If Stage 1 has no ratings,
   do we allow the replacement for free or refuse it? Refusing would be a deliberate difference.
2. **Does the Stage 1 town grow in-game (`TownTickHandler`)?** Crossings made by towns (4.4) and the
   behaviour in 4.5 only happen if towns keep growing after the player builds rail. At map generation
   there is no player rail, so only 4.1 exists. The decision belongs to the towns note.
3. **Open sea and coast on a flat map.** `IsRoadAllowedHere`/`CleanUpRoadBits` use tile type water
   (`IsWater`, coast `MP_WATER` tiles are connective, sea is not). With heights 0/1 and no shore tiles
   (cross-cutting question 5 in the README), which tiles count as coast for roads is not decided here.
4. **PBS reservation bit on crossings (`m5` bit 4).** `CheckLevelCrossing` uses it; whether Stage 1
   trains reserve track depends on `trains.md`. Without reservations the bit is always 0 and the bar
   rule reduces to "train on or approaching".
5. **Bulldozing a crossing (4.3, last paragraph).** `ClearTile_Road` on a crossing without `Auto` removes
   road and rail. Whether the Stage 1 bulldozer can target road tiles, and what it does to a town road
   or a crossing, is not covered by the source in a way that fits "player cannot remove roads".
6. **`m4` bits 7..6 on normal road.** `MakeRoadNormal` does not write them (it only does
   `SB(m4, 0, 6, rt)`), so they keep whatever the tile held before. Harmless if the tile was just
   cleared (`MakeClear` zeroes `m4`) and unused anywhere read; not reproduced unless the port uses the
   raw `m4` byte.
7. **`m6` bits 1..0 on road tiles.** `MakeRoadNormal` and `MakeRoadCrossing` clear only bits 7..2. No
   `MP_ROAD` code reads bits 1..0; `docs/landscape.html` does not mention them. Not used.
