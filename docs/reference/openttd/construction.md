# Construction: demolition, drag tools, placement GUI and money checks

## 1. Purpose

How the player's construction actions are turned into commands and what the commands charge or refuse:
the bulldozer (`CmdLandscapeClear`, `CmdClearArea`) for every Stage 1 tile type, the mouse/drag
semantics of the rail, station and depot tools, and the common pipeline (pause check, test run, money
check, error window). The commands for rail, stations and depots are described in track.md (4.4 to
4.9) and stations-cargo.md (4.1); this note adds only what sits around them. It is the source for
Stage 1.3 (Construction). Prices are the `_price[]` values of economy.md 4.2.

## 2. Source files

All paths are under `reference/OpenTTD/src`.

| File                                                                          | What it holds                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `landscape.cpp`                                                               | `CmdLandscapeClear` (one tile), `CmdClearArea` (rectangle), `DoClearSquare` (leaves grass)                                           |
| `clear_cmd.cpp`                                                               | `ClearTile_Clear` (grass, rough, rocks, fields)                                                                                      |
| `tree_cmd.cpp`                                                                | `ClearTile_Trees`                                                                                                                    |
| `water_cmd.cpp`                                                               | `ClearTile_Water`, `GetFloodingBehaviour`, `DoFloodTile`, `TileLoop_Water`                                                           |
| `rail_cmd.cpp`                                                                | `ClearTile_Track`, `RemoveTrainDepot`                                                                                                |
| `station_cmd.cpp`                                                             | `ClearTile_Station`, `RemoveRailStation`, `RemoveFromRailBaseStation`, `CmdRemoveFromRailStation`                                    |
| `road_cmd.cpp`                                                                | `ClearTile_Road`, `RemoveRoad`, `CheckAllowRemoveRoad`                                                                               |
| `town_cmd.cpp`, `newgrf_house.cpp`                                            | `ClearTile_Town`, `ClearTownHouse`, `HouseSpec::GetRemovalCost`, `ChangeTownRating`, `CheckforTownRating`, `CanDeleteHouse`          |
| `industry_cmd.cpp`, `void_cmd.cpp`                                            | `ClearTile_Industry`, `ClearTile_Void`                                                                                               |
| `command.cpp`, `command_func.h`                                               | pause check (`IsCommandAllowedWhilePaused`, `InternalPostBefore`), test/exec pipeline (`CommandHelper::Execute`, `InternalExecute*`) |
| `company_cmd.cpp`                                                             | `CheckCompanyHasMoney`, `GetAvailableMoney`, `UpdateLandscapingLimit`, `CheckOwnership`                                              |
| `tilearea.cpp`, `tilearea_type.h`                                             | `OrthogonalTileArea`, `OrthogonalTileIterator`, `DiagonalTileArea`, `DiagonalTileIterator`                                           |
| `terraform_gui.cpp`                                                           | `PlaceProc_DemolishArea`, `GUIPlaceProcDragXY` (posts `CMD_CLEAR_AREA`)                                                              |
| `rail_gui.cpp`                                                                | rail toolbar (`OnPlaceObject`, `HandleAutodirPlacement`, `DoRailroadTrack`), station and depot pickers, `CcRailDepot`                |
| `viewport.cpp`, `table/autorail.h`, `tilehighlight_type.h`, `viewport_type.h` | drag machinery: `VpStartPlaceSizing`, `VpSelectTilesWithMethod`, `CalcRaildirsDrawstyle`, `Check2x1AutoRail`, `_autorail_piece`      |
| `station_gui.cpp`                                                             | distant-join window (`StationJoinerNeeded`, `FindStationsNearby`)                                                                    |
| `error_gui.cpp`, `lang/english.txt`                                           | error window layout, `STR_ERROR_*` texts                                                                                             |
| `table/settings/*.ini`                                                        | defaults (section 5)                                                                                                                 |

## 3. State

Constants: `TILE_SIZE = 16`, `TILE_UNIT_MASK = 15` (world units inside a tile; a world point
`(x, y)` is in tile `(x >> 4, y >> 4)`, `viewport.cpp:TileVirtXY`).

Drag state (`tilehighlight_type.h:TileHighlightData _thd`), only the fields the port needs:

| Field                | Meaning                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selstart`           | world point where the drag began. `VpStartPlaceSizing` sets it to the tile origin `(TileX*16, TileY*16)`; it adds +8,+8 only for `VPM_X_OR_Y`, `VPM_FIX_X`, `VPM_FIX_Y` (not used by Stage 1 tools) |
| `selend`             | current end point of the drag (world units). For rail tools it is rewritten by `CalcRaildirsDrawstyle` so that it lies on the chosen line                                                           |
| `drawstyle`          | what the last drag update chose: `HT_RAIL` (single tile) or `HT_LINE` (several tiles), low 3 bits = direction                                                                                       |
| `_tile_fract_coords` | `(x & 15, y & 15)` of the cursor at the moment of the press, set once by `viewport.cpp:PlaceObject`; not updated during the drag                                                                    |

`HT_DIR_*` values equal the `Track` enum (track.md section 3): `HT_DIR_X=0` (TRACK_X), `HT_DIR_Y=1`,
`HT_DIR_HU=2` (UPPER), `HT_DIR_HL=3` (LOWER), `HT_DIR_VL=4` (LEFT), `HT_DIR_VR=5` (RIGHT)
(`tilehighlight_type.h`). `HandleAutodirPlacement` uses `drawstyle & HT_DIR_MASK (7)` directly as the `Track`.

Company: `clear_limit` (uint32, tiles x 65536). At company start `clear_limit = clear_frame_burst << 16`
(`company_cmd.cpp:Company::Company`); every game tick `UpdateLandscapingLimit` adds `clear_per_64k_frames`
capped at `clear_frame_burst << 16` (`openttd.cpp:StateGameLoop`, and in the paused branch of the game loop).

`DoCommandFlag`s that matter here: `Execute`, `Auto`, `NoWater`, `ForceClearTile`, `NoTest` (a command
flag, see 4.7). Command flags per command (`*_cmd.h`):

| Command                                                                                                | Flags             | `CommandType`           |
| ------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------- |
| `CMD_LANDSCAPE_CLEAR`                                                                                  | `Deity`           | `LandscapeConstruction` |
| `CMD_CLEAR_AREA`                                                                                       | `NoTest`          | `LandscapeConstruction` |
| `CMD_BUILD_SINGLE_RAIL`, `CMD_BUILD_RAILROAD_TRACK`, `CMD_BUILD_TRAIN_DEPOT`, `CMD_BUILD_RAIL_STATION` | `Auto`, `NoWater` | `LandscapeConstruction` |
| `CMD_REMOVE_SINGLE_RAIL`, `CMD_REMOVE_RAILROAD_TRACK`                                                  | `Auto`            | `LandscapeConstruction` |
| `CMD_REMOVE_FROM_RAIL_STATION`                                                                         | none              | `LandscapeConstruction` |
| `CMD_INCREASE_LOAN`, `CMD_DECREASE_LOAN`                                                               | none              | `MoneyManagement`       |

Posted `CMD_LANDSCAPE_CLEAR` / `CMD_CLEAR_AREA` therefore run **without** `Auto` and without `NoWater`:
that is the bulldozer. The build commands pass `Auto|NoWater` to their nested `CMD_LANDSCAPE_CLEAR`
(track.md 4.4): they only clear what needs no demolition.

## 4. Rules and formulas

### 4.1 `CmdLandscapeClear(flags, tile)` (`landscape.cpp`)

```
cost = CommandCost(EXPENSES_CONSTRUCTION)
if ForceClearTile and tile is water-class land that is not plain water/coast (a house, rail or station
   standing on water): add _price[PR_CLEAR_CANAL or PR_CLEAR_WATER]                 // not reachable in Stage 1
c = (Auto or Bankrupt) ? null : company
if c != null and (c.clear_limit >> 16) < 1: error STR_ERROR_CLEARING_LIMIT_REACHED
cost += _tile_type_procs[tiletype].clear_tile_proc(tile, flags)                      // 4.2 to 4.6
if Execute and c != null: c.clear_limit -= 1 << 16                                   // even if the tile cost 0
return cost
```

`command.cpp:CommandHelper::Do` first refuses `tile >= Map::Size()` or `MP_VOID` (unless the command has
`AllTiles`) with a bare `CMD_ERROR` (no message). So `ClearTile_Void` (`STR_ERROR_OFF_EDGE_OF_MAP`) is
never reached by the bulldozer.

### 4.2 Per tile type: what the bulldozer (no `Auto`) does

Prices are `_price[]` at default settings (economy.md 4.2; Low construction cost, no inflation). `DoClearSquare`
turns the tile into `MakeClear(CLEAR_GRASS, density 0)` outside world generation (`landscape.cpp:DoClearSquare`).
Grass with density 0 costs nothing to clear, and clearing anything the player created leaves such grass.

| Tile (temperate)   | Function                                                                                     | Cost (start, £)                                                                          | Refusals / notes                                                                                                                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grass density 0    | `clear_cmd.cpp:ClearTile_Clear`                                                              | 0                                                                                        | none, no owner check                                                                                                                                                                                                                                                      |
| Grass density 1..3 | same                                                                                         | `PR_CLEAR_GRASS` 15                                                                      | generated grass has density 3 (`_generating_world ? 3 : 0`)                                                                                                                                                                                                               |
| Rough              | same                                                                                         | `PR_CLEAR_ROUGH` 30                                                                      |                                                                                                                                                                                                                                                                           |
| Rocks              | same                                                                                         | `PR_CLEAR_ROCKS` 150                                                                     |                                                                                                                                                                                                                                                                           |
| Fields             | same                                                                                         | `PR_CLEAR_FIELDS` 375                                                                    | `clear_price_table = {GRASS, ROUGH, ROCKS, FIELDS, ROUGH, ROUGH}[ground]`; snow/desert not in temperate                                                                                                                                                                   |
| Trees              | `tree_cmd.cpp:ClearTile_Trees`                                                               | `count * PR_CLEAR_TREES` = 15, 30, 45 or 60 (`count = GetTreeCount` = 1..4)              | rating hook: see 4.8. Rainforest/cactus x4 not in temperate                                                                                                                                                                                                               |
| Sea (plain water)  | `water_cmd.cpp:ClearTile_Water`, `WaterTileType::Clear`                                      | `PR_CLEAR_WATER` 7,500 (`PR_CLEAR_CANAL` for a canal)                                    | allowed without `NoWater`. Owner is `OWNER_WATER`, so no owner check. `EnsureNoVehicleOnGround` (ship). Edge test only if `!freeform_edges`. See open question 1                                                                                                          |
| Coast (shore)      | `ClearTile_Water`, `WaterTileType::Coast`                                                    | one corner raised: `PR_CLEAR_WATER` 7,500, otherwise `PR_CLEAR_ROUGH` 30                 | `EnsureNoVehicleOnGround` only                                                                                                                                                                                                                                            |
| Own rail track     | `rail_cmd.cpp:ClearTile_Track`                                                               | `-53` per track bit (`RailClearCost`, a refund): single piece -53, X+Y -106              | removes each bit with `CMD_REMOVE_SINGLE_RAIL` (owner check inside, `EnsureNoTrainOnTrack`); tile becomes grass density 0. A bit that fails aborts with its error                                                                                                         |
| Own depot          | `rail_cmd.cpp:RemoveTrainDepot`                                                              | `PR_CLEAR_DEPOT_TRAIN` 60 (the depot's rail piece is not refunded)                       | `CheckTileOwnership`, `EnsureNoVehicleOnGround` (a train inside blocks it); deletes the `Depot` object                                                                                                                                                                    |
| Rail station tile  | `station_cmd.cpp:ClearTile_Station` -> `RemoveRailStation(st, flags, PR_CLEAR_STATION_RAIL)` | `PR_CLEAR_STATION_RAIL` 37 per platform tile, **for the whole station**; no rail refund  | removes **every** rail tile of the station (`st->train_station` area), not only the clicked one. `CheckOwnership(st->owner)`, `EnsureNoVehicleOnGround` per tile. Station deleted when empty (`DeleteStationIfEmpty`)                                                     |
| Town road piece(s) | `road_cmd.cpp:ClearTile_Road` -> `RemoveRoad(tile, flags, bits, RTT_ROAD, town_check=true)`  | `CountBits(pieces) * PR_CLEAR_ROAD` = 30 per piece (straight 60, junction 90, 4-way 120) | `CheckAllowRemoveRoad` (rating, 4.8). `EnsureNoVehicleOnGround`. "Road works in progress" if `HasRoadWorks`                                                                                                                                                               |
| Level crossing     | `ClearTile_Road`, `RoadTileType::Crossing`                                                   | `2 * PR_CLEAR_ROAD` = 60 for the road; **the rail removal is free**                      | road removed first (same town check), then on `Execute` `CMD_LANDSCAPE_CLEAR` runs again to remove the rail; that second call's cost (the -53 refund) is discarded (`ClearTile_Road` ignores its return value). Both parts vanish. Rail owner checked in that second call |
| House              | `town_cmd.cpp:ClearTile_Town`                                                                | `(PR_CLEAR_HOUSE * removal_cost) >> 8` = `(1200 * rc) >> 8` (table 4.2.1)                | rating gate (4.8). `CanDeleteHouse` is true for human companies. A multi-tile house is removed whole (`ClearTownHouse`), see 4.2.2                                                                                                                                        |
| Industry           | `industry_cmd.cpp:ClearTile_Industry`                                                        | not reachable                                                                            | a company cannot demolish an industry (only editor, magic bulldozer cheat, or the sea). Returns `CommandCost(INVALID_STRING_ID)`: failure with **no** detail text                                                                                                         |
| Void edge          | -                                                                                            | -                                                                                        | bare `CMD_ERROR` (4.1)                                                                                                                                                                                                                                                    |

Owner checks in short: clear/trees/houses/industries have none; sea has none; rail, depot and station use
`CheckTileOwnership` / `CheckOwnership(owner)` -> `STR_ERROR_OWNED_BY` (company or town name as parameter,
`company_cmd.cpp:CheckOwnership`); town roads go through `CheckAllowRemoveRoad`.

#### 4.2.1 House removal cost and rating step per house type (temperate)

`HouseSpec` fields `removal_cost` (rc, 8 bit) and `remove_rating_decrease` (rr) from
`table/town_land.h:_original_house_specs` (macro `MS`, 5th and 8th argument). Cost at start prices =
`(1200 * rc) >> 8`. Ids are the table indices (decimal). `min_year` (not the removal) decides if a house is
generated in 1950 (town-building.md).

| id  | rc  | rr  | cost £ |     | id    | rc  | rr  | cost £ |     | id    | rc  | rr  | cost £ |
| --- | --- | --- | -----: | --- | ----- | --- | --- | -----: | --- | ----- | --- | --- | -----: |
| 0   | 150 | 140 |    703 |     | 13    | 130 | 110 |    609 |     | 26    | 71  | 75  |    332 |
| 1   | 140 | 130 |    656 |     | 14    | 110 | 100 |    515 |     | 27    | 135 | 100 |    632 |
| 2   | 100 | 90  |    468 |     | 15    | 105 | 100 |    492 |     | 28    | 145 | 170 |    679 |
| 3   | 90  | 230 |    421 |     | 16    | 107 | 100 |    501 |     | 29    | 132 | 135 |    618 |
| 4,5 | 160 | 160 |    750 |     | 17    | 200 | 150 |    937 |     | 30    | 155 | 180 |    726 |
| 6   | 80  | 80  |    375 |     | 18    | 145 | 110 |    679 |     | 31    | 220 | 230 |  1,031 |
| 7,8 | 180 | 150 |    843 |     | 19    | 155 | 110 |    726 |     | 32-35 | 250 | 300 |  1,171 |
| 9   | 65  | 40  |    304 |     | 20-23 | 250 | 300 |  1,171 |     | 36    | 170 | 250 |    796 |
| 10  | 65  | 40  |    304 |     | 24    | 70  | 75  |    328 |     | 39    | 210 | 230 |    984 |
| 11  | 60  | 75  |    281 |     | 25    | 75  | 75  |    351 |     | 40-43 | 250 | 300 |  1,171 |
| 12  | 60  | 75  |    281 |     |       |     |     |        |     |       |     |     |        |

Ids 5, 8, 21-23, 33-35, 41-43 are the extra tiles of 1x2 and 2x2 houses and carry the same numbers as their head
tile (id 4/5 are listed together because both entries hold the same values). Ids 37, 38 are sub-arctic and
44 and above are not temperate (40-43, the shopping mall, is temperate but from 1983). Values were extracted from the table by script, not read line by line; verify
against `town_land.h` while porting.

#### 4.2.2 Multi-tile houses and station tiles in an area drag

`ClearTile_Town` charges the clicked tile's `rc`, then `ClearTownHouse` clears the whole building (north
part first, `GetHouseNorthPart`, then 2/4 tiles via `DoClearTownHouseHelper`), removes `population` from
the town, decrements `num_houses`, resets `HasChurch`/`HasStadium`, and drops stations from
`stations_near` when the catchment loses the town (`RemoveNearbyStations`). In `CmdClearArea` each tile is
re-tested against the current state (4.3), so the second tile of a house is already grass and costs 0 in the
execute phase. The test phase (before the executes) still sums every tile, so the preview cost of a drag
over multi-tile houses is higher than what is charged (the source comments this at `landscape_cmd.h`).
The same applies to a station: the first station tile clears all of it.

### 4.3 `CmdClearArea(flags, tile, start_tile, diagonal)` (`landscape.cpp`)

Posted by the demolish tool with `tile = end_tile`, `start_tile = start_tile`, `diagonal = _ctrl_pressed`
(`terraform_gui.cpp:GUIPlaceProcDragXY`). The command has `CommandFlag::NoTest`, so the framework does
**not** run `CheckCompanyHasMoney` on the test result (4.7); the command checks money itself.

```
if start_tile >= Map::Size(): CMD_ERROR
money      = GetAvailableMoneyForCommand()          // company money; INT64_MAX with infinite_money
cost       = 0 (EXPENSES_CONSTRUCTION); last_error = CMD_ERROR; had_success = false
c          = (Auto or Bankrupt) ? null : company
limit      = c == null ? INT32_MAX : (c.clear_limit >> 16)
if tile != start_tile: flags.Set(ForceClearTile)    // an area, not a single click
for t in TileIterator::Create(tile, start_tile, diagonal):          // order: 4.4
    ret = CMD_LANDSCAPE_CLEAR(flags without Execute, t)             // test against the CURRENT map
    if ret failed:
        last_error = ret                                            // keeps the LAST failure
        if c != null and (c.clear_limit >> 16) < 1: break           // limit exhausted
        continue                                                    // skip this tile, go on
    had_success = true
    if Execute:
        money -= ret.cost
        if ret.cost > 0 and money < 0: return { cost, ret.cost }    // stop; 2nd value = extra cash needed
        CMD_LANDSCAPE_CLEAR(flags, t)                               // really clear it
        explosion effect at the two corner tiles (only if not paused): display only
    else:
        if ret.cost != 0 and --limit <= 0: break                    // test phase: cap at 4096 priced tiles
    cost += ret.cost
return { had_success ? cost : last_error, 0 }
```

Consequences:

- **Money**: the test phase (what the framework sees first) is never rejected for money. In the execute
  phase the company pays tile by tile: the running balance `money` is reduced by each tile's cost
  (negative costs, such as the rail refund, add to it) and the loop stops at the first positive-cost tile
  that would push it below 0 (spending exactly all the money is allowed). What was cleared before stays
  cleared and is charged. `CommandHelperBase::InternalExecuteProcessResult`: if `extra_cash != 0` and the
  accumulated cost is exactly 0 (nothing paid) the result is the error
  `STR_ERROR_NOT_ENOUGH_CASH_REQUIRES_CURRENCY` with the parameter `extra_cash` = the cost of the one tile
  that could not be paid (not the total); otherwise it is a normal success with the partial cost and the
  "requires" message is dropped. So money is checked only against the running total, never up front.
- **Errors**: tile failures are swallowed. If at least one tile succeeded the command succeeds silently,
  however many tiles failed. If every tile failed the command fails with the message of the **last** failing
  tile, under the header `STR_ERROR_CAN_T_CLEAR_THIS_AREA`. A failing industry tile gives an empty detail
  line (4.2). A single click on a house, industry or ownership problem shows that tile's message.
- **Limit**: `clear_limit` starts at 4096 tiles and regains 64 tiles per tick (`clear_per_64k_frames =
64 << 16`). Each executed clear uses one (even a free one); at 0 the next tile fails with
  `STR_ERROR_CLEARING_LIMIT_REACHED` and the loop breaks. A drag over a 64x64 area is the practical maximum.
- Ownership problems, trains in the way, ratings and tile-type refusals are all "tile failed, skip".

### 4.4 Tile order of the iterators (`tilearea.cpp`, `tilearea_type.h`)

Orthogonal (`diagonal == false`): `OrthogonalTileArea(tile, start_tile)` takes the min/max corners;
`w = maxX - minX + 1`, `h = maxY - minY + 1`; it starts at `(minX, minY)` and walks **X fastest**, then Y
(`tile++`, then `tile += TileDiffXY(1 - w, 1)`).

Diagonal (`diagonal == true`, Ctrl): rotated coordinates `a = (y + x)`, `b = (y - x)` of `start_tile`
(= `tile` argument, the first corner) to `end` (= `start_tile` argument):

```
a = (Ey + Ex) - (Sy + Sx);  b = (Ey - Ex) - (Sy - Sx)          // S = first corner (tile), E = second corner (start_tile)
a += a > 0 ? 1 : -1;  b += b > 0 ? 1 : -1                      // one-past-the-end
a_cur = b_cur = 0;  first tile = S
next():                                                         // DiagonalTileIterator::operator++
  repeat:
    if |a_max| == 1:  a_cur = 0; b_cur = (b_max > 0) ? min(b_cur + 2, b_max) : max(b_cur - 2, b_max)
    else:
      a_cur += (a_max > 0) ? 2 : -2
      if (a_max > 0 ? a_cur >= a_max : a_cur <= a_max):         // end of a column
          a_cur = (|a_cur| % 2) ? 0 : (a_max > 0 ? 1 : -1)
          b_cur += (b_max > 0) ? 1 : -1
    x = Sx + (a_cur - b_cur) / 2;  y = Sy + (b_cur + a_cur) / 2  // exact: a_cur and b_cur have equal parity
    tile = (x or y outside the map) ? skip : TileXY(x, y)
  until tile valid or b_cur == b_max
  if b_cur == b_max: end
```

The drag selection in the GUI is `VPM_X_AND_Y` (`terraform_gui.cpp:PlaceProc_DemolishArea`): `selstart` = tile
origin of the press tile, `selend` = cursor at release; area = `TileVirtXY(selstart)` .. `TileVirtXY(selend)`.
Releasing outside the map (`pt.x == -1`) does nothing (`rail_gui.cpp:OnPlaceMouseUp`, `if (pt.x != -1)`).

### 4.5 Rail drag in the GUI (autorail tool, `rail_gui.cpp`, `viewport.cpp`)

Tool: `WID_RAT_AUTORAIL` -> `HT_RAIL`; on press `OnPlaceObject` calls
`VpStartPlaceSizing(tile, VPM_RAILDIRS, DDSP_PLACE_RAIL)`; each mouse move calls
`VpSelectTilesWithMethod` -> `CalcRaildirsDrawstyle(x, y, method)`; on release `OnPlaceMouseUp` ->
`HandleAutodirPlacement`:

```
HandleAutodirPlacement():                                   // rail_gui.cpp
  track = drawstyle & HT_DIR_MASK                           // 0..5 = X, Y, UPPER, LOWER, LEFT, RIGHT
  if drawstyle & HT_RAIL:                                   // "one tile case"
      GenericPlaceRail(TileVirtXY(selend), track)           // CMD_BUILD_SINGLE_RAIL (or REMOVE if remove mode)
  else:
      DoRailroadTrack(track)   // CMD_BUILD_RAILROAD_TRACK(end = TileVirtXY(selend), start = TileVirtXY(selstart),
                               //   railtype, track, auto_remove_signals = false, fail_on_obstacle = false)
                               // remove mode: CMD_REMOVE_RAILROAD_TRACK(end, start, track)
```

The commands and their `ValidateAutoDrag` are in track.md 4.5 to 4.6. Error header on failure:
`STR_ERROR_CAN_T_BUILD_RAILROAD_TRACK` / `STR_ERROR_CAN_T_REMOVE_RAILROAD_TRACK`. Remove mode is the toolbar
toggle `WID_RAT_REMOVE`; Ctrl toggles it while a track tool is active (`RailToolbar_CtrlChanged`).

**Single-tile piece from the sub-tile position** (`viewport.cpp:GetAutorailHT`, `table/autorail.h:_autorail_piece`):
`piece = _autorail_piece[fx][fy]` with `fx = x & 15`, `fy = y & 15` of the point. `fx` grows toward the SW
edge of the tile, `fy` toward the SE edge (x is the tile X axis, so the NE edge is `fx = 0`, NW edge `fy = 0`).
Letters: `X` TRACK_X, `Y` TRACK_Y, `U` UPPER (north corner), `D` LOWER (south corner), `L` LEFT (west corner),
`R` RIGHT (east corner). Row = `fx`, column = `fy`:

```
fx= 0..5    UUUUUUXXXXRRRRRR
fx= 6       YYYYYYXXXYYYYYYY
fx= 7       YYYYYYYXYYYYYYYY
fx= 8       YYYYYYYYXYYYYYYY
fx= 9       YYYYYYYXXXYYYYYY
fx=10..15   LLLLLLXXXXDDDDDD
```

Rule of thumb: the four 6x6 corner squares give the corner track nearest to that corner, the 4-wide strips
between corners give the straight track through that edge, the middle 4x4 is the Y/X mix shown. Port the
table literally.

**Multi-tile drag** (`CalcRaildirsDrawstyle`, `method == VPM_RAILDIRS`, i.e. `method & ~(VPM_RAILDIRS) == 0`).
Inputs, all world units: `S = selstart` (tile origin of the press tile), `P = (pfx, pfy)` the press
sub-tile position (`_tile_fract_coords`), cursor `(x, y)` (= `selend` before adjustment).

```
dx = S.x - (x & ~15);  dy = S.y - (y & ~15)               // tile-aligned deltas; dx > 0: cursor tile is NE of start (smaller X)
w = |dx| + 16;  h = |dy| + 16
if tile(S) == tile(x, y):                      b = HT_RAIL | _autorail_piece[x&15][y&15]       // cursor's sub-tile at release, not the press
elif h == 16:                                  // same row of tiles (dy == 0): X direction
     if dx ==  16: b = HT_LINE | Check2x1AutoRail(3)
     elif dx == -16: b = HT_LINE | Check2x1AutoRail(2)
     else b = HT_LINE | HT_DIR_X;                 y = S.y
elif w == 16:                                  // same column (dx == 0): Y direction
     if dy ==  16: b = HT_LINE | Check2x1AutoRail(1)
     elif dy == -16: b = HT_LINE | Check2x1AutoRail(0)
     else b = HT_LINE | HT_DIR_Y;                 x = S.x
elif w > 2h:  b = HT_LINE | HT_DIR_X;  y = S.y
elif h > 2w:  b = HT_LINE | HT_DIR_Y;  x = S.x
else:                                          // diagonal-ish: horizontal / vertical half-tile track
     d = w - h
     if x > S.x:
        if y > S.y:  d == 0: (x&15) > (y&15) ? VL : VR ;  d > 0: x = S.x + h, VL ;  d < 0: y = S.y + w, VR      // "south"
        else:        d == 0: (x&15)+(y&15) >= 16 ? HL : HU ;  d > 0: x = S.x + h, HL ;  d < 0: y = S.y - w, HU   // "west"
     else:
        if y > S.y:  d == 0: (x&15)+(y&15) >= 16 ? HL : HU ;  d > 0: x = S.x - h, HU ;  d < 0: y = S.y + w, HL   // "east"
        else:        d == 0: (x&15) > (y&15) ? VL : VR ;  d > 0: x = S.x - h, VR ;  d < 0: y = S.y - w, VL      // "north"
     b = HT_LINE | that style
selend = (x, y);  next_drawstyle = b                                  // the end tile is TileVirtXY(x, y)
```

(`d >= 0` in the source for the non-zero case; the `d == 0` branch is tested first.) `VL/VR/HU/HL` are
`HT_DIR_VL/VR/HU/HL`. After adjustment the end point lies on the dragged line, so `ValidateAutoDrag`
(track.md 4.6) accepts it; for HU/HL/VL/VR the drag alternates the two halves tile by tile
(`td ^= 1`) and keeps a diagonal staircase.

`Check2x1AutoRail(mode)` (two adjacent tiles): `fxpy = pfx + pfy`, `fxmy = pfx - pfy` from the **press**
point; `sxpy = (x&15) + (y&15)`, `sxmy = (x&15) - (y&15)` from the **cursor** (`selend`):

```
mode 0 (dy == -16): fxpy >= 20 && sxpy <= 12 -> HL ; fxmy < -3 && sxmy >  3 -> VR ; else Y
mode 1 (dy ==  16): fxmy >  3 && sxmy < -3  -> VL ; fxpy <= 12 && sxpy >= 20 -> HU ; else Y
mode 2 (dx == -16): fxmy >  3 && sxmy < -3  -> VL ; fxpy >= 20 && sxpy <= 12 -> HL ; else X
mode 3 (dx ==  16): fxmy < -3 && sxmy >  3  -> VR ; fxpy <= 12 && sxpy >= 20 -> HU ; else X
```

Notes for a touch port:

- The result is a pure function of `(start tile, press sub-tile point, current cursor world point)`. A touch
  interface that supplies the same three values gets the same piece. Where the original has no hover
  (touch), the preview is just this function evaluated on the finger position.
- In the one-tile case the piece comes from the sub-tile position at release (cursor), not at press.
- The four fixed-direction tools (X, Y, "horizontal", "vertical"; `WID_RAT_BUILD_X/Y/EW/NS`) use
  `VPM_FIX_Y`, `VPM_FIX_X`, `VPM_FIX_HORIZONTAL`, `VPM_FIX_VERTICAL` ORed with `VPM_RAILDIRS`: the same pipeline
  with the direction forced (X: `y = S.y`; Y: `x = S.x`; horizontal/vertical choose HU/HL or VL/VR by the
  side of the line the cursor is on, `CalcRaildirsDrawstyle` first branch). They are conveniences; the
  autorail tool can produce every piece they can.
- Shift while clicking only estimates the cost (4.7); there is no Shift on touch.

### 4.6 Station and depot tools (`rail_gui.cpp`)

**Rail station** (`WID_RAT_BUILD_STATION`, picker window `BuildRailStationWindow`):

```
state: _station_gui.axis = AXIS_X (0)        // static zero-init; InitializeRailGui does not set it. Buttons X / Y in the picker
       gui.station_dragdrop = true           // "Drag N Drop" button lowered
       gui.station_numtracks = 1, gui.station_platlength = 5   // used only when station_dragdrop is false
PlaceRail_Station(tile):
  if remove mode:  VpStartPlaceSizing(tile, VPM_X_AND_Y_LIMITED, DDSP_REMOVE_STATION); VpSetPlaceSizingLimit(-1)
  elif station_dragdrop: VpStartPlaceSizing(tile, VPM_X_AND_Y_LIMITED, DDSP_BUILD_STATION)
                         VpSetPlaceSizingLimit(station_spread)               // 12
  else: build at once: numtracks = station_numtracks, platlength = station_platlength  (1 x 5), w,h swapped for axis
HandleStationPlacement(start, end):                        // on release, drag-and-drop
  ta = TileArea(start, end)                                // normalised rectangle, min corner = ta.tile
  numtracks = ta.w; platlength = ta.h; if axis == AXIS_X: swap(numtracks, platlength)
  CMD_BUILD_RAIL_STATION(ta.tile, railtype, axis, numtracks, platlength, STAT_CLASS_DFLT, 0, station_to_join, adjacent)
```

- Dragging: `VpSelectTilesWithMethod` for `VPM_X_AND_Y_LIMITED` clamps the end point to `limit = (sizelimit - 1) * 16`
  world units around the start in each axis, so the area is at most `station_spread` x `station_spread` (12 x 12).
  A plain click without moving builds a 1 x 1 station. The platform direction is **not** deduced from the drag
  shape; it is the picker's axis (default X, platform tiles along X). The dragged rectangle is exactly the
  station area: `w = ta.w`, `h = ta.h` in `CmdBuildRailStation` terms (`plat_len` runs along the axis).
- Errors: header `STR_ERROR_CAN_T_BUILD_RAILROAD_STATION`; detail from the command (stations-cargo.md 4.1).
- Joining: `adjacent = _ctrl_pressed`. Without Ctrl `station_to_join = NEW_STATION` and the command joins an
  adjacent own station by itself (exactly one) or fails with `STR_ERROR_ADJOINS_MORE_THAN_ONE_EXISTING`. With
  Ctrl: if `station.distant_join_stations` (default true) and a test build succeeds
  (`station_gui.cpp:StationJoinerNeeded`), the "Join station" window opens (`STR_JOIN_STATION_CAPTION`) listing
  `NEW_STATION` ("Build a separate station", `STR_JOIN_STATION_CREATE_SPLIT_STATION`) plus own stations within
  `station_spread` (`FindStationsNearby(distant_join = true)`: inside or next to the area, and within
  `station_spread - min(w, h)` tiles of it). The chosen entry is posted as `station_to_join` with
  `adjacent = true`; with Ctrl pressed and a failing test the command is posted directly so the error shows.
  A touch UI therefore needs an explicit "separate / join" choice in place of Ctrl.
- Catchment highlight (`gui.station_show_coverage`, default **false**): while the picker is open the white
  selection is enlarged by the catchment radius (`CA_TRAIN`, or `CA_UNMODIFIED` when `modified_catchment` is
  off) and nearby catchments are tinted. Display only.
- Persistent tool: `gui.persistent_buildingtools` is true, so after building the tool stays active
  (`CcStation`, `ResetObjectToPlace` only when false).
- Remove tool (toolbar "Remove" + station): `CMD_REMOVE_FROM_RAIL_STATION(end, start, keep_rail = !Ctrl)` over a
  dragged area; per tile `PR_CLEAR_STATION_RAIL` 37 (`RemoveFromRailBaseStation`); with `keep_rail` a plain rail
  piece is left on the tile (`MakeRailNormal`), otherwise the track goes with the platform. Header
  `STR_ERROR_CAN_T_REMOVE_PART_OF_STATION`; empty selection gives `STR_ERROR_THERE_IS_NO_STATION`. Not the same as
  the bulldozer, which removes the whole station (4.2).

**Train depot** (`WID_RAT_BUILD_DEPOT`, `BuildRailDepotWindow`):

```
_build_depot_direction = DIAGDIR_NW (3)            // InitializeRailGui; four buttons NE, SE, SW, NW choose it. No auto-orientation
on click: CMD_BUILD_TRAIN_DEPOT(tile, railtype, _build_depot_direction)     // header STR_ERROR_CAN_T_BUILD_TRAIN_DEPOT
CcRailDepot (on success only):                      // optional follow-up commands, each a separate command with its own cost
  T = tile + TileOffsByDiagDir(dir)                 // the tile in front of the depot's exit
  if T is MP_RAILWAY:                               // not a station, road, crossing
     E0 = edge of T that touches the depot = reverse(dir)
     for each of the three other edges E of T, in the order of _place_depot_extra_track[dir], [dir+4], [dir+8]:
        if T has a track touching E (and T is not a depot, and not a signal tile):
            CMD_BUILD_SINGLE_RAIL(T, railtype, track joining E0 and E)
     the straight one (E opposite E0) is skipped when the tile beyond T (T + offset(dir)) is a depot
```

Extra-track table (`_place_depot_extra_dir` = edge probed; `_place_depot_extra_track` = piece added), index
`dir` = exit direction NE(0) SE(1) SW(2) NW(3). `DiagdirReachesTracks(d)` selects the tracks that touch the edge
opposite `d`, so "probe SE" means "T has a track touching its NW edge":

| depot exit `dir` | 1st: probe -> add     | 2nd (straight): probe -> add | 3rd: probe -> add     |
| ---------------- | --------------------- | ---------------------------- | --------------------- |
| NE               | SE (NW edge) -> LEFT  | SW (NE edge) -> X            | NW (SE edge) -> LOWER |
| SE               | SW (NE edge) -> UPPER | NW (SE edge) -> Y            | NE (SW edge) -> LEFT  |
| SW               | SE (NW edge) -> UPPER | NE (SW edge) -> X            | NW (SE edge) -> RIGHT |
| NW               | SW (NE edge) -> RIGHT | SE (NW edge) -> Y            | NE (SW edge) -> LOWER |

The depot itself already has a rail piece inside it (`DiagDirToDiagTrack(dir)`, track.md 4.8). The follow-ups
cost `RailBuildCost` (£75) each when they succeed; their errors are silent (no error header). Rotating an
existing depot works by building a depot with another `dir` on the same tile (track.md 4.8).

### 4.7 Command pipeline: pause, test, money (`command.cpp`, `command_func.h`)

GUI actions use `Command<...>::Post(err_header, callback, args)` -> `InternalPost`:

```
1. InternalPostBefore:
     estimate_only = Shift pressed and not network and not NoEst            // cost preview, nothing is executed
     if game paused and not IsCommandAllowedWhilePaused(cmd) and not estimate_only:
         show error: summary = err_header, detail = STR_ERROR_NOT_ALLOWED_WHILE_PAUSED ; stop (no test run)
2. Execute():
     test run with flags = command's flags, no Execute            -> res
     if res failed, or estimate_only: stop here (estimate shows ShowEstimatedCostOrIncome(res.cost); no money check)
     if not NoTest and not CheckCompanyHasMoney(res): stop with error STR_ERROR_NOT_ENOUGH_CASH_REQUIRES_CURRENCY
     exec run with Execute                                        -> res2
     assert test and exec cost equal (not for NoTest commands)
     if extra_cash != 0 and res2.cost == 0: error NOT_ENOUGH_CASH(extra_cash)          // CmdClearArea only
     SubtractMoneyFromCompany(res2)                               // money -= cost; negative cost pays the company
3. InternalPostResult: on failure show ErrorWindow(summary = err_header, detail = failure message); else a floating cost text
```

- **Where money is checked**: once, on the **test** result of the top-level command, against the whole cost
  (`company_cmd.cpp:CheckCompanyHasMoney`): `cost <= 0` always passes, `infinite_money` passes,
  `cost > company.money` fails (so spending exactly the money in cash is allowed). Nested commands (the
  `CMD_LANDSCAPE_CLEAR` inside a build, the singles inside a drag) are not checked on their own; the drag
  is all-or-nothing for money. The loan is never drawn automatically.
- **Error data**: `STR_ERROR_NOT_ENOUGH_CASH_REQUIRES_CURRENCY` = `"Not enough cash - requires {CURRENCY_LONG}"`
  (`lang/english.txt`) with the parameter `cost` (the **total** test cost, for example `£1,800`). The window shows
  the header (`Can't build railway track here...`) and this text below it. For `CmdClearArea` the parameter is
  the cost of the first unaffordable tile (4.3).
- **Pause**: `IsCommandAllowedWhilePaused` allows a command iff `lookup[commandType] <= command_pause_level`
  with `CommandPauseLevel { NoActions 0, NoConstruction 1, NoLandscaping 2, AllActions 3 }` and the table
  `LandscapeConstruction -> 3, VehicleConstruction -> 2, MoneyManagement -> 2, VehicleManagement/RouteManagement/
OtherManagement -> 1, CompanySetting/ServerSetting/Cheat -> 0`. Default `command_pause_level = 1`
  (`world_settings.ini`): while paused, **rail, depots, stations, bulldozing, vehicle purchase and the loan
  (`MoneyManagement`) are all refused** with "Not allowed while paused"; vehicle start/stop, orders and renaming
  stay allowed. Shift-estimates still work while paused.
- Test/exec fix-ups: `ClearTile_*` and `ChangeTownRating` run in "town rating test mode" during test runs, so
  rating changes of a command are only applied on execute (ratings accumulate inside one test run, which makes a
  multi-house drag fail when the total decrease would break the rule on the later houses).
- Error window: `ShowErrorMessage(summary, detail, extra)` (`error_gui.cpp`); it closes itself after
  `gui.errmsg_duration` seconds (default 5, 0 disables it) and a new error replaces the old one.

### 4.8 Town rating effects of demolition (hooks for Stage 2)

Stage 1 has no ratings (`Town::ratings[company]`, all start at `RATING_INITIAL = 500`, `town_cmd.cpp`), but
the rules below sit in the commands above and must be reachable later:

```
RATING_MINIMUM -1000, RATING_MAXIMUM 1000 (town_type.h)
difficulty.town_council_tolerance = 0 (Lenient), Permissive = 3 disables all checks
Tree cleared (ClearTile_Trees): t = ClosestTownFromTile(tile, dist_local_authority = 20)  // Manhattan < 20 from t->xy
     ChangeTownRating(t, RATING_TREE_DOWN_STEP -35, RATING_TREE_MINIMUM -1000)             // per tile, not per tree
House cleared (ClearTile_Town):
     rating = hs.remove_rating_decrease                                                      // table 4.2.1
     if rating > RATING_MAXIMUM: STR_ERROR_BUILDING_IS_PROTECTED
     if rating > t.ratings[company] and tolerance != Permissive: STR_ERROR_LOCAL_AUTHORITY_REFUSES_TO_ALLOW_THIS (town name param)
     ChangeTownRating(t, -rating, RATING_HOUSE_MINIMUM -1000)
Town road piece removed (CheckAllowRemoveRoad, owner == OWNER_TOWN, bulldozer or crossing clear):
     t = ClosestTownFromTile(tile, UINT_MAX)
     CheckforTownRating: needed = {Lenient 16, Neutral 64, Hostile 112, Permissive -1000}[tolerance] (RATING_ROAD_NEEDED_*)
                         if rating < needed: LOCAL_AUTHORITY_REFUSES_TO_ALLOW_THIS
     n = bits of the tile that connect to a neighbouring road tile
     if two or more bits in n and (n & remove) != 0: if !extra_dynamite -> refused ; else step = RATING_ROAD_DOWN_STEP_INNER -50
     else step = RATING_ROAD_DOWN_STEP_EDGE -18
     ChangeTownRating(t, step, RATING_ROAD_MINIMUM -100)
ChangeTownRating(t, add, max): ignored if NoModifyTownRating, no valid company, or magic bulldozer; add < 0: if rating > max: rating = max(rating + add, max)
```

`construction.extra_dynamite` is **true** by default (`world_settings.ini`), so bulldozing a road piece
that joins two neighbours costs -50 rating rather than being refused. At the start rating of 500 all temperate
houses can be demolished once (largest `rr` is 300); each removal lowers the rating by `rr`, and a refusal
starts once `rr > rating`. The player's own rail laid over a town road (level crossing, roads.md 4.1) does not
touch the rating; only removing road does.

## 5. Defaults

| Setting                                            | Default             | File / use                                                                                      |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `construction.command_pause_level`                 | 1 (no construction) | `world_settings.ini`; 4.7                                                                       |
| `construction.clear_frame_burst`                   | 4096                | `world_settings.ini`; initial and maximum `clear_limit` in tiles                                |
| `construction.clear_per_64k_frames`                | `64 << 16`          | `world_settings.ini`; tiles regained per tick = 64                                              |
| `construction.freeform_edges`                      | true                | `world_settings.ini`; edge row/column are sea, `STR_ERROR_TOO_CLOSE_TO_EDGE_OF_MAP` unreachable |
| `construction.build_on_slopes`                     | true                | `world_settings.ini`; irrelevant on a flat map (ruling R11)                                     |
| `construction.extra_dynamite`                      | true                | `world_settings.ini`; 4.8                                                                       |
| `difficulty.town_council_tolerance`                | 0 (Lenient)         | `difficulty_settings.ini`; 4.8                                                                  |
| `difficulty.construction_cost`                     | 0 (Low, x6/8)       | economy.md 4.2                                                                                  |
| `economy.dist_local_authority`                     | 20                  | `economy_settings.ini`; radius of the tree rating hook                                          |
| `station.station_spread`                           | 12 (min 4, max 64)  | `game_settings.ini`; drag limit and station bbox                                                |
| `station.distant_join_stations`                    | true                | `game_settings.ini`; Ctrl "Join station" window                                                 |
| `station.modified_catchment`                       | true                | `game_settings.ini`; rail catchment radius 4                                                    |
| `gui.station_dragdrop`                             | true                | `gui_settings.ini`                                                                              |
| `gui.station_numtracks` / `gui.station_platlength` | 1 / 5               | `gui_settings.ini`; only used when drag-and-drop is off (range 1..7)                            |
| `gui.station_show_coverage`                        | **false**           | `gui_settings.ini`; catchment highlight, display only                                           |
| `gui.persistent_buildingtools`                     | true                | `gui_settings.ini`; tool stays selected after a build                                           |
| `gui.auto_remove_signals`                          | false               | `gui_settings.ini`; no signals in Stage 1                                                       |
| `gui.errmsg_duration`                              | 5 seconds           | `gui_settings.ini`                                                                              |
| `gui.measure_tooltip`                              | true                | `gui_settings.ini`; length/area tooltip while dragging (display only)                           |
| `gui.default_rail_type`                            | 0 (first available) | `gui_settings.ini`; track.md section 5                                                          |
| Station picker axis (`_station_gui.axis`)          | `AXIS_X`            | `rail_gui.cpp` (zero-initialised static)                                                        |
| Depot picker direction (`_build_depot_direction`)  | `DIAGDIR_NW`        | `rail_gui.cpp:InitializeRailGui`                                                                |
| `difficulty.infinite_money`                        | false               | passes every money check when true                                                              |

Start-of-game amounts (cash £100,000, prices x0.75): see economy.md section 5.

### Error texts (`lang/english.txt`)

| Identifier                                                           | English text                                                 | Raised by (Stage 1 context)                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `STR_ERROR_NOT_ENOUGH_CASH_REQUIRES_CURRENCY`                        | Not enough cash - requires {CURRENCY_LONG}                   | `CheckCompanyHasMoney`, `CmdClearArea` (4.3, 4.7)                            |
| `STR_ERROR_NOT_ALLOWED_WHILE_PAUSED`                                 | Not allowed while paused                                     | `InternalPostBefore`                                                         |
| `STR_ERROR_ALREADY_BUILT`                                            | ... already built                                            | `CmdBuildSingleRail` (track exists), drags                                   |
| `STR_ERROR_CAN_T_BUILD_ON_WATER`                                     | ... can't build on water                                     | `ClearTile_Water` with `NoWater`; `CheckRailSlope` on sea                    |
| `STR_ERROR_BUILDING_MUST_BE_DEMOLISHED`                              | Building must be demolished first                            | `Auto` clear of a house, depot, lock                                         |
| `STR_ERROR_MUST_REMOVE_RAILROAD_TRACK`                               | Must remove railway track first                              | `ClearTile_Track` with `Auto` on plain rail                                  |
| `STR_ERROR_MUST_DEMOLISH_RAILROAD`                                   | Must demolish railway station first                          | `ClearTile_Station` with `Auto`                                              |
| `STR_ERROR_MUST_REMOVE_ROAD_FIRST`                                   | Must remove road first                                       | `ClearTile_Road` with `Auto` on 2+ pieces or a crossing                      |
| `STR_ERROR_GENERIC_OBJECT_IN_THE_WAY`                                | {STRING} in the way                                          | `ClearTile_Industry` with `Auto` (industry name)                             |
| `STR_ERROR_AREA_IS_OWNED_BY_ANOTHER`                                 | ... area is owned by another company                         | `ClearTile_Track` with `Auto`, owner differs                                 |
| `STR_ERROR_OWNED_BY`                                                 | ... owned by {STRING1}                                       | `CheckOwnership` (company or town name)                                      |
| `STR_ERROR_LOCAL_AUTHORITY_REFUSES_TO_ALLOW_THIS`                    | {TOWN} local authority refuses to allow this                 | rating gates (4.8)                                                           |
| `STR_ERROR_BUILDING_IS_PROTECTED`                                    | ... building is protected                                    | `ClearTile_Town` (NewGRF-only in practice)                                   |
| `STR_ERROR_TRAIN_IN_THE_WAY` (+1 road vehicle, +2 ship, +3 aircraft) | Train in the way (Road vehicle / Ship / Aircraft in the way) | `EnsureNoVehicleOnGround`                                                    |
| `STR_ERROR_CLEARING_LIMIT_REACHED`                                   | ... tile clearing limit reached                              | `CmdLandscapeClear`                                                          |
| `STR_ERROR_OFF_EDGE_OF_MAP`                                          | Off edge of map                                              | `ClearTile_Void` (not reachable, 4.1)                                        |
| `STR_ERROR_TOO_CLOSE_TO_EDGE_OF_MAP`                                 | Too close to edge of map                                     | `ClearTile_Water` only when `freeform_edges` is off; unreachable at defaults |
| `STR_ERROR_FLAT_LAND_REQUIRED`                                       | Flat land required                                           | depot on a slope (track.md 4.8)                                              |
| `STR_ERROR_THERE_IS_NO_RAILROAD_TRACK`                               | ... there is no railway track                                | `CmdRemoveSingleRail`                                                        |
| `STR_ERROR_THERE_IS_NO_STATION`                                      | ... there is no station here                                 | `CmdRemoveFromRailStation`                                                   |
| `STR_ERROR_IMPOSSIBLE_TRACK_COMBINATION`                             | Impossible track combination                                 | track.md 4.4                                                                 |
| `STR_ERROR_ADJOINS_MORE_THAN_ONE_EXISTING`                           | Adjoins more than one existing station/loading area          | `CmdBuildRailStation` (stations-cargo.md 4.1)                                |
| `STR_ERROR_STATION_TOO_SPREAD_OUT`                                   | ... station too spread out                                   | `CmdBuildRailStation`                                                        |
| `STR_ERROR_ROAD_WORKS_IN_PROGRESS`                                   | Road works in progress                                       | `RemoveRoad`                                                                 |

Headers (first line of the error window): `STR_ERROR_CAN_T_CLEAR_THIS_AREA` "Can't clear this area...",
`STR_ERROR_CAN_T_BUILD_RAILROAD_TRACK` "Can't build railway track here...", `STR_ERROR_CAN_T_REMOVE_RAILROAD_TRACK`
"Can't remove railway track from here...", `STR_ERROR_CAN_T_BUILD_RAILROAD_STATION` "Can't build railway
station here...", `STR_ERROR_CAN_T_REMOVE_PART_OF_STATION` "Can't remove part of station...",
`STR_ERROR_CAN_T_BUILD_TRAIN_DEPOT` "Can't build train depot here...",
loan: `STR_ERROR_CAN_T_BORROW_ANY_MORE_MONEY` "Can't borrow any more money...", `STR_ERROR_CAN_T_REPAY_LOAN`
"Can't repay loan...". Failures with `INVALID_STRING_ID` show the header only.

## 6. Stage 1 needs

1. A `clearTile(tile, mode)` family for clear/rough/rocks/fields, trees, own rail, own depot, own station
   (whole-station removal), town road piece and crossing, houses; refusals for industries (empty detail),
   `Auto` variants as in the track.md/stations-cargo.md build paths. Prices from economy.md at start values.
2. `CmdLandscapeClear` bookkeeping that matters: the clear limit (4096 burst, +64 per tick) or an explicit
   decision to drop it, and grass density 0 after clearing.
3. `CmdClearArea` with the orthogonal and diagonal iterators (4.4), the per-tile test then execute, the running
   money check, "skip failed tiles", last-error reporting.
4. The pipeline of 4.7: pause refusal (default level 1 blocks construction and loan), one test run, one money
   check on the total, exec, error window with header + detail, optional cost estimate.
5. The autorail piece/line logic of 4.5 as a pure function of (start tile, press sub-tile, cursor point), the
   `_autorail_piece` table, `Check2x1AutoRail`, then `CmdBuildRailroadTrack` / `CmdRemoveRailroadTrack`.
6. Station tool: axis default X, drag rectangle limited to 12, `adjacent` / join choice, depot tool with
   direction (default NW) and the `CcRailDepot` follow-up rails.
7. Display-only items worth keeping: catchment highlight (default off), cost popup after success, drag length
   tooltip.

## 7. Skipped

- Slopes, foundations, terraforming, `build_on_slopes` effects (Stage 1 is flat).
- Bridges, tunnels, canals, locks, docks, airports, road stops, waypoints, objects, signals (`HT_RECT` signal tools).
- `ForceClearTile` water branches, `Bankrupt`, `OWNER_WATER` flooding of player tiles (`DoFloodTile`), NewGRF
  callbacks (`CanDeleteHouse` denial, indestructible houses), cheats (`magic_bulldozer`, `money`).
- Competitor companies: ownership errors (`STR_ERROR_OWNED_BY` for companies), `CommandFlag::Server`, networking.
- Town rating bookkeeping itself (4.8 lists the hooks), the "Rebuild houses" behaviour of `TileLoop_Town`
  (towns do not grow in Stage 1, town-building.md).
- Tram, rail conversion (`CmdConvertRail`), waypoint tools, the four fixed-direction rail buttons if the single
  autorail tool is chosen.

## 8. Open questions

1. **Clearing the sea.** The command allows it (`ClearTile_Water`, no `NoWater`): £7,500 per sea tile, turning it
   into grass density 0. At height 0 next to active sea the tile is flooded again by `TileLoop_Water` /
   `DoFloodTile` (`z_dest > 0 -> continue` only spares land above sea level; a flooded tile is
   cleared as `OWNER_WATER`, which would also remove any player rail built there). Should Stage 1 refuse the
   action in the UI, or port the flooding? Depends on the flat-map height model (README cross-cutting question 5;
   map.md) and on whether Stage 1 has any coast tile (`WaterTileType::Coast`, 7,500 or 30).
2. **Ratings in Stage 1.** The house and road demolition gates read `Town::ratings[company]`. Without ratings,
   either treat the rating as constant 500 (all temperate houses demolishable once, roads removable) or keep a
   per-town value updated by the 4.8 rules (cheap, no UI). The source gives no third option; this is a scope
   decision for the plan.
3. **Station demolition granularity.** The bulldozer removes the whole station at £37 per tile with no rail
   refund (4.2). Is Stage 1 meant to offer the "Remove" station tool (`CmdRemoveFromRailStation`, per tile,
   `keep_rail`) as well? The source has both; the spec only mentions "demolishes".
4. **Touch press point.** The multi-tile autorail result depends on the sub-tile point of the press
   (`Check2x1AutoRail`) and of the release. The original has a continuous mouse; which finger point maps to
   "press" for a touch drag (touch-down point, or the point after a long press) is an input-design decision, not
   in the source.
5. **Preview vs charge on multi-tile houses/stations.** The test phase of `CmdClearArea` sums every tile while the
   execute phase charges the real (smaller) amount (4.2.2, `landscape_cmd.h` comment). Show the test sum as
   the estimate, or simulate the execute order? The original shows the test sum for a Shift-estimate.
6. **House table check.** 4.2.1 was produced by script from `table/town_land.h`; the ids 4/5 pair (identical
   values) and the extra tiles were inferred from equal field values, not from the `GetHouseNorthPart` mapping.
   Re-extract during implementation.
