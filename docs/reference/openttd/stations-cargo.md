# Stations and cargo

Source: OpenTTD 15.3, `reference/OpenTTD/src`. All paths below are relative to that `src/`.

## 1. Purpose

A station is a set of station tiles owned by one company. Every tile within the catchment radius
of a station tile belongs to the station's catchment area. Houses and industries in that area
decide which cargo the station accepts (sum of acceptance ≥ 8/8). Towns and industries hand the
cargo they produce to nearby stations, split by station rating. Waiting cargo is stored as
`CargoPacket`s. Vehicles stopped at a station unload cargo, which is delivered and paid for, and
load cargo step by step. Every 185 ticks the station rating for each cargo moves towards a target
that depends on service quality. A low rating makes waiting cargo disappear.

## 2. Source files

| File                                                 | Key functions / items                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `station_base.h`                                     | `GoodsEntry` (per-cargo state, `State` flags), `Station`, `INITIAL_STATION_RATING`, `ForAllStationsAroundTiles`                                                                                                                                                                                                                                                                                                                            |
| `base_station_base.h`                                | `BaseStation` (xy, name, town, owner, facilities, train_station, rect), `StationRect`                                                                                                                                                                                                                                                                                                                                                      |
| `station_type.h`                                     | `CA_*` catchment radii, `MAX_CATCHMENT`, `StationType`                                                                                                                                                                                                                                                                                                                                                                                     |
| `station.cpp`                                        | `GetTileCatchmentRadius`, `Station::GetCatchmentRadius`, `Station::RecomputeCatchment`, `Station::AddIndustryToDeliver`, `Station::GetPlatformLength`, `StationRect::BeforeAddTile/BeforeAddRect`                                                                                                                                                                                                                                          |
| `station_cmd.cpp`                                    | `CmdBuildRailStation`, `CalculateRailStationCost`, `CheckFlatLandRailStation`, `FindJoiningBaseStation`, `GetStationAround`, `BuildStationPart`, `CanExpandRailStation`, `GenerateStationName`, `UpdateStationAcceptance`, `UpdateStationRating`, `TruncateCargo`, `StationHandleSmallTick/BigTick`, `OnTick_Station`, `MoveGoodsToStation`, `CanMoveGoodsToStation`, `UpdateStationWaiting`, `RailStationTileLayout::Iterator::operator*` |
| `cargopacket.h/.cpp`                                 | `CargoPacket` (fields, `GetDistance`, `Split/Merge/Reduce`), `VehicleCargoList` (`Stage`, `ChooseAction`, `Unload`, `AgeCargo`, `Append`), `StationCargoList` (`Append`, `Load`, `Reserve`, `Truncate`)                                                                                                                                                                                                                                    |
| `cargoaction.cpp`                                    | Per-packet actions: `CargoLoad`, `CargoReservation`, `CargoReturn`, `CargoTransfer`, `CargoDelivery`, `CargoRemoval`                                                                                                                                                                                                                                                                                                                       |
| `economy.cpp`                                        | `PrepareUnload`, `GetLoadAmount`, `ReserveConsist`, `UpdateLoadUnloadTicks`, `LoadUnloadVehicle`, `LoadUnloadStation`, `DeliverGoods`, `DeliverGoodsToIndustry`, `CargoPayment::PayFinalDelivery/PayTransfer/~CargoPayment`                                                                                                                                                                                                                |
| `vehicle.cpp`                                        | `CallVehicleTicks` (calls `LoadUnloadStation` and cargo aging), `Vehicle::BeginLoading` (calls `PrepareUnload`), `Vehicle::LeaveStation`                                                                                                                                                                                                                                                                                                   |
| `table/cargo_const.h`, `cargotype.h`, `cargo_type.h` | `CargoSpec`, default cargo table, climate slots                                                                                                                                                                                                                                                                                                                                                                                            |
| `timer/timer_game_tick.h`                            | `STATION_RATING_TICKS`, `STATION_ACCEPTANCE_TICKS`, `CARGO_AGING_TICKS`                                                                                                                                                                                                                                                                                                                                                                    |

## 3. State

### Constants

| Name                                                    | Value                              | Where                           |
| ------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| `INITIAL_STATION_RATING`                                | 175                                | `station_base.h`                |
| `MAX_STATION_RATING`                                    | 255                                | `station_base.h`                |
| `CA_NONE / CA_BUS / CA_TRUCK / CA_TRAIN / CA_DOCK`      | 0 / 3 / 3 / 4 / 5                  | `station_type.h`                |
| `CA_UNMODIFIED` (all types when modified_catchment off) | 4                                  | `station_type.h`                |
| `MAX_CATCHMENT` (airports)                              | 10                                 | `station_type.h`                |
| `STATION_RATING_TICKS`                                  | 185                                | `timer/timer_game_tick.h`       |
| `STATION_ACCEPTANCE_TICKS`                              | 250                                | `timer/timer_game_tick.h`       |
| `STATION_LINKGRAPH_TICKS`                               | 504 (cargodist only)               | `timer/timer_game_tick.h`       |
| `CARGO_AGING_TICKS`                                     | 185 (= 2.5 days at `DAY_TICKS` 74) | `timer/timer_game_tick.h`       |
| `CargoPacket::MAX_COUNT`                                | 65535                              | `cargopacket.h`                 |
| `TILE_SIZE`, `VEHICLE_LENGTH`                           | 16, 8                              | `tile_type.h`, `vehicle_type.h` |

### BaseStation (`base_station_base.h`)

- `xy: TileIndex`: sign / base tile. Set to the first facility's tile in `Station::AddFacility`.
- `delete_ctr: uint8`: for a station in use it counts ticks 0..184 for the rating update. For a station not in use it counts big ticks until deletion (see 4.10).
- `name: string` (custom name), `string_id: StringID` (generated name, see 4.2).
- `town: Town*`: the closest town to the first built area (`ClosestTownFromTile(tile, UINT_MAX)`).
- `owner`, `facilities` (bitset: Train, TruckStop, BusStop, Airport, Dock, Waypoint), `build_date`, `random_bits`.
- `train_station: TileArea`: bounding box of the rail part (tile, w, h).
- `rect: StationRect`: bounding box of all station tiles (left, top, right, bottom, inclusive), not saved. It is empty when `left == 0 || left > right || top > bottom`.

### Station (`station_base.h`)

- `goods: GoodsEntry[NUM_CARGO]` (one entry per cargo type).
- `catchment_tiles: BitmapTileArea` (not saved): the set of covered tiles.
- `industries_near: set<{distance, Industry*}>`: industries in the catchment that accept some cargo, ordered by distance. Used for delivery.
- `always_accepted: CargoTypes`: cargo accepted by houses, or by industry tiles whose industry does not itself accept that cargo.
- `loading_vehicles: list<Vehicle*>`: vehicles in `OT_LOADING`, in arrival order.
- `time_since_load`, `time_since_unload: uint8` (start at 255, saturating, +1 per rating update). `last_vehicle_type` (starts `VEH_INVALID`).
- `industry: Industry*`: only for neutral (oil rig) stations, not used in Stage 1.

### GoodsEntry (`station_base.h`)

| Field                              | Type               | Init                               | Meaning                                                                                                                                    |
| ---------------------------------- | ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `status`                           | bitset of `State`  | {}                                 | `Acceptance`(0), `Rating`(1), `EverAccepted`(2), `LastMonth`(3), `CurrentMonth`(4), `AcceptedBigtick`(5)                                   |
| `time_since_pickup`                | uint8              | 255                                | rating intervals (185 ticks) since a vehicle last _tried_ to load, saturates at 255                                                        |
| `rating`                           | uint8              | 175                                | 0..255, shown as a percentage in the GUI                                                                                                   |
| `last_speed`                       | uint8              | 0                                  | max speed of the last vehicle that tried to load. For trains this is `vcache.cached_max_speed` (km-ish/h), clamped to 255. 0 means "never" |
| `last_age`                         | uint8              | 255                                | age in calendar years of the last loading vehicle, clamped                                                                                 |
| `max_waiting_cargo`                | uint               | 0                                  | feedback value for the rating (see 4.7)                                                                                                    |
| `amount_fract`                     | uint8              | 0                                  | fractional cargo (1/256 units) carried over between arrivals                                                                               |
| `data.cargo`                       | `StationCargoList` | created lazily (`GetOrCreateData`) | waiting packets                                                                                                                            |
| `node`, `link_graph`, `data.flows` |                    |                                    | cargodist only                                                                                                                             |

`HasRating()` is `status.Test(Rating)`. `HasVehicleEverTriedLoading()` is `last_speed != 0`.

### CargoPacket (`cargopacket.h`)

| Field                | Type                                        | Meaning                                                                                                          |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `count`              | uint16                                      | units in the packet (≥ 1)                                                                                        |
| `periods_in_transit` | uint16                                      | cargo aging periods (one per `cargo_age_period` ticks, default 185) spent in vehicles, saturates at 65535        |
| `feeder_share`       | Money                                       | transfer credits already paid                                                                                    |
| `source_xy`          | TileIndex                                   | `INVALID_TILE` at creation. Set to the **loading vehicle part's tile** at the first pickup (`UpdateLoadingTile`) |
| `travelled`          | {int16 x, int16 y}                          | +tile x/y on load, −tile x/y on unload. The accumulated vehicle travel vector                                    |
| `source`             | {id, SourceType Industry/Town/Headquarters} | for subsidies and to skip the source industry on delivery                                                        |
| `first_station`      | StationID                                   | station where the packet was created                                                                             |
| `next_hop`           | StationID                                   | cargodist / transfer next hop. Invalid in Stage 1                                                                |

`GetDistance(cur) = min(|travelled.x − X(cur)| + |travelled.y − Y(cur)|, Manhattan(source_xy, cur))` (`cargopacket.h:CargoPacket::GetDistance`). This is the distance used for payment.

### Cargo lists

- `StationCargoList` (`cargopacket.h`): `MultiMap<StationID next_hop, CargoPacket*>`. `count` holds the available (unreserved) units and `reserved_count` the units reserved for a loading vehicle. `AvailableCount() = count`, `TotalCount() = count + reserved_count`. Without cargodist every packet sits under the key `StationID::Invalid()`.
- `VehicleCargoList`: a `std::list<CargoPacket*>` with `action_counts[TRANSFER, DELIVER, KEEP, LOAD]` that always sum to `count`. `StoredCount() = count − LOAD`, `UnloadCount() = TRANSFER + DELIVER`, `RemainingCount() = KEEP + LOAD`. It also caches `feeder_share` and `cargo_periods_in_transit` (Σ periods × count).
- Merging (`AreMergable`, both lists): two packets merge when `source_xy`, `periods_in_transit`, `first_station` and `source` are equal and the summed count is ≤ 65535 (`cargopacket.cpp:CargoList::TryMerge`).

## 4. Rules and formulas

### 4.1 Building a rail station (`station_cmd.cpp:CmdBuildRailStation`)

```
params: tile_org (north corner), rt, axis, numtracks, plat_len, spec_class, spec_index, station_to_join, adjacent
CheckIfAuthorityAllowsNewStation(tile_org)        // town_cmd.cpp: skipped if town_council_tolerance == 3 (permissive);
                                                  // else closest town within dist_local_authority (20) must have rating > RATING_VERYPOOR (-200)
if plat_len == 0 or numtracks == 0 -> CMD_ERROR
(w, h) = axis == X ? (plat_len, numtracks) : (numtracks, plat_len)
both corners must be valid tiles
reuse = station_to_join != NEW_STATION; distant_join = reuse && station_to_join valid
if distant_join and !distant_join_stations -> CMD_ERROR
if w > station_spread or h > station_spread -> CMD_ERROR        // default spread 12
cost = CalculateRailStationCost(area)            // also clears land, see below
st = FindJoiningStation(est, station_to_join, adjacent, area)
BuildStationPart(&st, reuse, area, STATIONNAMING_RAIL)
if st already has a rail part: CanExpandRailStation -> union bbox of train_station and area
    must have w,h <= station_spread else STR_ERROR_STATION_TOO_SPREAD_OUT
execute: st.train_station = area; st.AddFacility(Train, area.tile); st.rect.BeforeAddRect(ADD_TRY)
         each tile: MakeRailStation(tile, owner, st.index, axis, gfx, rt); random bits = Random() & 0xF
         company infrastructure: rail[rt]++ , station++ per tile
         st.AfterStationTileSetChange(adding=true) -> RecomputeCatchment(); UpdateStationAcceptance(st, false)
```

- Per-tile validation (`CheckFlatLandRailStation` → `CheckBuildableTile`): no bridge above, no vehicle on the ground, no steep slope, all tiles at the same height (`allowed_z`). A sloped tile costs an extra `PR_BUILD_FOUNDATION`. On an existing station tile, it must be a rail station tile, and all such tiles must belong to one station (else `STR_ERROR_ADJOINS_MORE_THAN_ONE_EXISTING`). Plain rail can be overbuilt only when it has no signals, is a single track aligned with the axis, and has a compatible railtype. That track is removed with `CMD_REMOVE_SINGLE_RAIL`. Any other tile is cleared with `CMD_LANDSCAPE_CLEAR`, and its clearing cost is added.
- Cost (`CalculateRailStationCost`). Only tiles that are new or rotated get the costs below:
  ```
  tracknum = 0; length_price_ready = true
  for tile in area (row-major):
      if tracknum == numtracks: length_price_ready = true; tracknum = 0 else tracknum++
      if new/rotated tile:
          cost += clear_cost + _price[PR_BUILD_STATION_RAIL] + RailBuildCost(rt)
          if length_price_ready: cost += _price[PR_BUILD_STATION_RAIL_LENGTH]; length_price_ready = false
  RailBuildCost(rt) = (_price[PR_BUILD_RAIL] * railtype.cost_multiplier) >> 3      // rail.h
  ```
  Base prices (`table/pricebase.h`, before the economy scaling in economy.md): `PR_BUILD_STATION_RAIL` 200, `PR_BUILD_STATION_RAIL_LENGTH` 180, `PR_BUILD_RAIL` 100, `PR_BUILD_FOUNDATION` 250, `PR_CLEAR_STATION_RAIL` 50 (removal, per tile, `RemoveFromRailBaseStation`), `PR_BUILD_DEPOT_TRAIN` 600.
- Joining (`FindJoiningBaseStation` + `GetStationAround`):
  - Building over an existing station `est`: with `adjacent` set and `est != station_to_join`, return an error. Otherwise extend `est`.
  - No station under the area: when `adjacent` is false, scan the area expanded by 1 tile. Exactly one own station found → join it. Two or more different own stations → `STR_ERROR_ADJOINS_MORE_THAN_ONE_EXISTING`. When `adjacent` is true, skip the scan.
  - If no station was found and `station_to_join` is valid, join that station (distant join).
- New station (`BuildStationPart`): with `reuse`, first try `GetClosestDeletedStation`: an own station not in use whose xy is within Manhattan distance < 8 (ties go to the lower ID). Otherwise create a new `Station(area.tile)` with `town = ClosestTownFromTile(tile, UINT_MAX)` and `string_id = GenerateStationName(...)`, and add the company to `town.have_ratings`. When joining, `rect.BeforeAddRect(ADD_TEST)` runs a spread check against `station_spread`.
- `StationRect::BeforeAddTile`: if the new point lies outside the rect, take the union. If its width or height is > `station_spread` (and mode is not FORCE), return `STR_ERROR_STATION_TOO_SPREAD_OUT`.
- Default tile graphics without a NewGRF spec (`RailStationTileLayout::Iterator::operator*`). Position p runs 0..numtracks·plat_len−1 platform by platform. The final gfx is this value + axis:
  - plat_len == 1: 2 if p == (numtracks−1)/2, else 0.
  - Otherwise, when numtracks is odd and p < plat_len: 2 if p == (plat_len−1)/2, else 0.
  - Otherwise, when plat_len > 4 and p % plat_len is 0 or plat_len−1: 0.
  - Otherwise: ((p / plat_len) % 2 == numtracks % 2) ? 4 : 6.
- Platform length (`station.cpp:Station::GetPlatformLength`): count contiguous tiles along the tile's axis that are compatible (`IsCompatibleTrainStationTile`: rail station tile, not blocked, compatible railtype, same axis, same station index).

### 4.2 Station naming (`station_cmd.cpp:GenerateStationName`)

Names are per town. A suffix already used by another station of the same town is unavailable. The checks run in this order:

1. An industry with a station name within a spiral of radius 7. The default industries have `station_name = STR_UNDEFINED`, so they are skipped (`table/build_industry.h` MI macro).
2. Mines: if available and `CountMapSquareAround(tile, CMSAMine) ≥ 2`, use "{Town} Mines". `CountMapSquareAround` scans the 7×7 square dx,dy ∈ [−3,3]. `CMSAMine` matches tiles of an extractive industry that produces a non-liquid, non-passenger, non-mail cargo, so a coal mine counts.
3. If `DistanceMax(tile, town.xy) < 8`: "{Town}" if available, else "{Town} Central".
4. Lakeside: `DistanceFromEdge < 20` and at least 5 water tiles in the 7×7. Woods: at least 8 tree tiles or at least 2 forest tiles. Valley/Heights: tile z lower/higher than the town tile z. Stage 1 maps have sea and trees, so Lakeside and Woods apply; Valley/Heights apply only to a station on a cleared height-0 tile.
5. Direction from the town: x < town.x rules out South and West, otherwise North and East. y < town.y rules out South and East, otherwise North and West.
6. Fallbacks in this order: North, South, East, West, Transfer, Halt, Exchange, Annexe, Sidings, Branch, Upper, Lower. Last resort: `STR_SV_STNAME_FALLBACK` "{Town} Station #{NUM}".

String formats: `lang/english.txt` `STR_SV_STNAME*`. "Upper {STRING1}" and "Lower {STRING1}" are prefixes.

### 4.3 Catchment (`station.cpp`)

```
GetTileCatchmentRadius(tile):                    // modified_catchment = true (default)
    Rail -> CA_TRAIN (4); Bus/Truck -> 3; Dock -> 5; Airport -> spec.catchment; Oilrig -> 4; waypoint/buoy -> 0
    // modified_catchment = false: every non-waypoint type -> CA_UNMODIFIED (4)
Station::GetCatchmentRadius(): max radius over the station's facilities (0 if none)
Station::RecomputeCatchment():
    industries_near.clear(); remove this station from every town/industry stations_near
    if rect empty: catchment_tiles = {} ; return
    catchment_tiles = {}
    for each own station tile in rect: add TileArea(tile,1,1).Expand(r) clamped to map   // union of squares
    for each tile in catchment_tiles:
        house tile    -> town(tile).stations_near.insert(this)
        industry tile -> industry.stations_near.insert(this); AddIndustryToDeliver(ind, tile)
AddIndustryToDeliver: distance = DistanceMax(st.xy, tile); keep min distance per industry;
                      insert only if ind.IsCargoAccepted() (accepts any cargo)
```

- The catchment is a union of per-tile squares, not a single rectangle. For a rail-only station both give the same shape.
- `RecomputeCatchment` is called when tiles are added (`AfterStationTileSetChange(true)`) or removed (`CmdRemoveFromRailStation`, `AfterStationTileSetChange(false)`), and for all stations after loading (`RecomputeCatchmentForAll`).

### 4.4 Acceptance (`station_cmd.cpp:UpdateStationAcceptance`)

```
acceptance[c] = Σ over catchment_tiles of AddAcceptedCargo(tile)   // in 1/8 units; also fills always_accepted
for each cargo c:
    amt = acceptance[c]
    if passengers and no facility in {Train, Bus, Airport, Dock}: amt = 0
    if non-passengers and no facility in {Train, Truck, Airport, Dock}: amt = 0
    goods[c].status.Acceptance = (amt >= 8)
if mask changed and show_msg and owner == local company: news "now accepts / no longer accepts"
```

- Houses (`town_cmd.cpp:AddAcceptedCargoOfHouse`) add `hs->cargo_acceptance[i]` for their up to 3 accepted cargoes, and **always** set the `always_accepted` bit.
- Industry tiles (`industry_cmd.cpp:AddAcceptedCargo_Industry`) add the tile spec's acceptance. They set the `always_accepted` bit only if the industry itself does not accept that cargo. In `table/build_industry.h`, power station tile 1 accepts 8/8 COAL and 1/8 PASS. Coal mine tile 3 accepts 1/8 PASS. All other tiles of these two industries accept nothing.
- When it runs: every 250 ticks per station, when `(TimerGameTick::counter + st.index) % 250 == 0` (`OnTick_Station` → `StationHandleBigTick`, with show_msg = true). Also right after building tiles (show_msg = false) and after loading a game.
- Big tick also: resets the `AcceptedBigtick` flag of every goods entry.

### 4.5 Cargo arrival at stations (`station_cmd.cpp:MoveGoodsToStation`)

Callers (towns-industries.md): `industry_cmd.cpp:TransportIndustryGoods` passes `i->stations_near`, i.e. stations whose catchment covers _any_ industry tile, and `exclusivity = i->exclusive_consumer`. `town_cmd.cpp` passes `StationFinder(house tile)`, i.e. the town's `stations_near` filtered to stations whose catchment contains that house tile.

```
CanMoveGoodsToStation(st, c):
    false if st.owner != NONE and town.exclusive_counter > 0 and town.exclusivity != st.owner
    false if goods[c].rating == 0
    false if selectgoods (default true) and goods[c].last_speed == 0     // no vehicle ever tried to load c here
    false if passengers and facilities == {TruckStop} only; false if non-passengers and facilities == {BusStop} only
MoveGoodsToStation(c, amount, source, stations, exclusivity):
    candidates = stations filtered by (exclusivity == INVALID or st.owner == exclusivity) and CanMoveGoodsToStation
    if none: return 0
    if exactly one: return UpdateStationWaiting(st, c, amount * (rating + 1), source)
    company_best[o] = max rating among o's stations; company_sum[o] = Σ ratings of o's stations
    best_sum = Σ_o company_best[o]; best_rating = max rating
    amount *= best_rating + 1
    for each st: share = amount * company_best[o] * st.rating / best_sum / company_sum[o]   // integer, left to right
    leftover = amount - Σ share   // goes +1 each to the highest-rated stations (stable sort, descending)
    return Σ UpdateStationWaiting(st, c, share, source)
UpdateStationWaiting(st, c, amount /*×256 units*/, source):
    amount += ge.amount_fract; ge.amount_fract = amount & 0xFF; amount >>= 8
    if amount == 0: return 0
    ge.cargo.Append(new CargoPacket(first_station = st, count = amount, source), next = ge.GetVia(st) /*Invalid w/o cargodist*/)
    if !ge.HasRating(): ge.status.Rating = true
    return amount
```

So one station with rating r gets about `amount × (r+1)/256`. The rest is lost. The fraction carries over per station and cargo.

**Flag sequence:** `last_speed` is set when a vehicle tries to load (4.8). Only after that can cargo arrive (`selectgoods`). The first arrival sets `State::Rating`. Without that flag the rating is not updated (4.7).

### 4.6 Cargo aging (`vehicle.cpp:CallVehicleTicks`, `cargopacket.cpp:VehicleCargoList::AgeCargo`)

```
every tick, for every vehicle part v (train/road/ship/aircraft), if v.vcache.cached_cargo_age_period != 0:
    v.cargo_age_counter = min(v.cargo_age_counter, period)
    if --v.cargo_age_counter == 0: v.cargo.AgeCargo(); v.cargo_age_counter = period
AgeCargo: every packet with periods_in_transit < 65535 gets +1
```

- `period` = the engine's `cargo_age_period`, by default `CARGO_AGING_TICKS` = 185 for all original engines (`table/engines.h` MT/MM/MW/MR/MS/MA macros, `engine.cpp`). It can be overridden through NewGRF properties (`train_cmd.cpp`). `cargo_age_counter` starts at 1 (`vehicle.cpp:Vehicle::Vehicle`).
- Cargo waiting at a station does not age. Only cargo inside vehicles ages. No check skips aging while loading or stopped.

### 4.7 Station rating (`station_cmd.cpp:UpdateStationRating`)

It runs for each station in use when its `delete_ctr` wraps around 185 (`StationHandleSmallTick`), so once every 185 ticks with a per-station phase.

```
time_since_load = sat_inc(time_since_load); time_since_unload = sat_inc(...)        // saturate at 255
for each cargo cs:
  ge = goods[cs]
  if !ge.HasRating(): if ge.rating < 175: ge.rating++ ; continue
  ge.time_since_pickup = sat_inc(ge.time_since_pickup)
  if ge.time_since_pickup == 255 and selectgoods:
      ge.status.Rating = false; ge.last_speed = 0; TruncateCargo(all); continue
  waiting   = ge.AvailableCount()
  num_dests = number of distinct next-hop keys in ge.cargo (1 if any cargo w/o cargodist, 0 if none)
  waiting_avg = waiting / (num_dests + 1)
  rating = 0
  // (cheat "station_rating": rating = 255 and skip; NewGRF CBID_CARGO_STATION_RATING_CALC may replace the block below)
  b = ge.last_speed - 85; if b >= 0: rating += b >> 2                 // speed: 0..42
  waittime = ge.time_since_pickup (>> 2 if last_vehicle_type == ship)
  if waittime <= 21: +25 ; if <= 12: +25 ; if <= 6: +45 ; if <= 3: +35  // 0..130
  rating -= 90
  m = ge.max_waiting_cargo
  if m <= 1500: +55 ; if <= 1000: +35 ; if <= 600: +10 ; if <= 300: +20 ; if <= 100: +10   // 0..130
  if owner is a company and town.statues has owner: +26
  age = ge.last_age; if age < 3: +10 ; if < 2: +10 ; if < 1: +13         // 0..33
  ge.rating = rating = clamp_u8(old + clamp(rating - old, -2, 2))         // moves at most 2 per update
  if rating <= 64 and waiting_avg >= 100:
      dec = Random() & 0x1F; if waiting_avg < 200: dec &= 7
      waiting -= (dec + 1) * num_dests; changed = true
  if rating <= 127 and waiting != 0:
      r = Random(); if rating <= (r & 0x7F):
          waiting = max(waiting - ((r >> 8 & 3) + 1) * num_dests, 0); changed = true
  if waiting > 4096 (1<<12):
      waiting -= (waiting - 4096) / 64 (1<<6); waiting = min(waiting, 32768 (1<<15)); changed = true
  if changed and waiting < ge.AvailableCount():
      ge.max_waiting_cargo = 0; TruncateCargo(cs, ge, ge.AvailableCount() - waiting)
  else:
      ge.max_waiting_cargo = waiting_avg
```

- The target is reached by steps of at most ±2 every 185 ticks. Example: a new 64 km/h train (speed bonus 0), picked up within 3 intervals, max_waiting ≤ 100, age 0: 0 + 130 − 90 + 130 + 33 = 203.
- `TruncateCargo` (`StationCargoList::Truncate`) removes cargo spread randomly over the packets (`RandomRange`). The removed amount per source station feeds `source.max_waiting_cargo`, which only matters for transfers.
- `ModifyStationRatingAround` (crashes, town actions) changes ratings directly. Not used in Stage 1.

### 4.8 Arrival, unload staging (`vehicle.cpp:BeginLoading` → `economy.cpp:PrepareUnload`)

```
station.loading_vehicles.push_back(front); front.LoadingFinished = false; front.load_unload_ticks = 1
front.cargo_payment = new CargoPayment(front)
if no orders or unload_type != NoUnload:
  for each part v with cargo_cap > 0 and cargo.TotalCount() > 0:
    v.cargo.Stage(accepted = ge.status.Acceptance, current = st, next_station = front.GetNextStoppingStation(), unload_type, ...)
    if v.cargo.UnloadCount() > 0: v.CargoUnloading = true
```

`VehicleCargoList::Stage` / `ChooseAction` without cargodist (no flows, so `cargo_next = Invalid`):

- `NoUnload` → KEEP.
- `Unload` order: if accepted and `first_station != here`, DELIVER; otherwise TRANSFER.
- `Transfer` order → TRANSFER. Credits are paid immediately via `PayTransfer` and added to `feeder_share`.
- Normal order → DELIVER if accepted and `first_station != here`, otherwise KEEP. Cargo not accepted here stays in the vehicle, and so does cargo loaded at this same station.

### 4.9 Loading / unloading step (`economy.cpp:LoadUnloadStation`, `LoadUnloadVehicle`)

Every tick, `CallVehicleTicks` calls `LoadUnloadStation(st)` for every station **before** the vehicles' `Tick()`.

```
LoadUnloadStation(st):
  for v in loading_vehicles (not stopped/crashed): if --v.load_unload_ticks == 0: last = v
  if none reached 0: return
  for v in loading_vehicles up to and including last: LoadUnloadVehicle(v)   // v with ticks != 0 only reserves
  TriggerIndustryProduction(i) for each industry that received cargo this call
LoadUnloadVehicle(front):
  if (improved_load && autorefit) ? cargo_payment == nullptr : order.IsFullLoadOrder():   // C++ precedence
      ReserveConsist: per part, st.cargo.Reserve(cap - RemainingCount)    // full-load reservation
  if front.load_unload_ticks != 0: return
  if train and front.tile is not a tile of this station: LoadingFinished = true; ticks = 1; return
  front.cur_speed = 0
  for each part v with cargo_cap > 0:
    ge = st.goods[v.cargo_type]
    if v.CargoUnloading and unload_type != NoUnload:
        amount = gradual_loading ? min(UnloadCount, GetLoadAmount(v)) : UnloadCount
        if !ge.Acceptance and DELIVER > 0:            // acceptance vanished since staging
            Unload/Transfer order: DELIVER -> TRANSFER
            else: return excess reserved cargo; DELIVER -> KEEP; anything_unloaded = true
        if TRANSFER > 0 and !ge.HasRating(): ge.time_since_pickup = 0; ge.Rating = true
        moved = v.cargo.Unload(amount, st.cargo, payment)  // TRANSFER first, then DELIVER (-> PayFinalDelivery)
        if moved > 0: anything_unloaded = true; ticks += moved; st.time_since_unload = 0
        if !(gradual_loading and UnloadCount > 0): v.CargoUnloading = false
        continue                                          // a part never loads in the same step it unloads
    if load_type == NoLoad or front.StopLoading: continue
    ge.last_speed = clamp_u8(train: front.vcache.cached_max_speed)
    ge.last_age   = clamp_u8(calendar_year - front.build_year)
    cap_left = cargo_cap - StoredCount
    if cap_left > 0:
        ge.time_since_pickup = 0
        if (LOAD reserved > 0 or ge.AvailableCount > 0) and exclusive rights allow:
            if gradual_loading: cap_left = min(cap_left, GetLoadAmount(v))
            loaded = st.cargo.Load(cap_left, v.cargo)   // reserved first, else take packets (split if needed)
            full_load_amount bit = (loaded == cap_left); reservation_left bit if LOAD remains
            if loaded > 0: anything_loaded = true; st.time_since_load = 0; st.last_vehicle_type = v.type; ticks += loaded
    cargo_full / cargo_not_full bit per cargo type from StoredCount >= cargo_cap
  if !anything_unloaded: delete payment          // books income now (see below)
  front.StopLoading = false
  if anything_loaded or anything_unloaded:
      if gradual_loading: ticks = {40, 20, 10, 20}[front.type]    // train 40, road 20, ship 10, aircraft 20
      if !anything_unloaded and full_load_amount == 0 and reservation_left == 0 and !IsFullLoadOrder
         and current_order_time >= max(timetabled_wait - lateness, 0): front.StopLoading = true
      UpdateLoadUnloadTicks(ticks)
  else:
      UpdateLoadUnloadTicks(20)
      finished = true
      if FullLoad (all):  finished = (cargo_not_full == 0)
      if FullLoadAny:     finished = !(cargo_not_full != 0 and (cargo_full & ~cargo_not_full) == 0)
      front.LoadingFinished = finished
UpdateLoadUnloadTicks(front, st, ticks):
  if train and station_length_loading_penalty:
      overhang = cached_total_length - platform_length(front.tile) * 16
      if overhang > 0: ticks <<= 1; ticks += overhang * ticks / 8
  front.load_unload_ticks = max(1, ticks)
```

- `GetLoadAmount(v)` (`economy.cpp`) returns `e.info.load_amount`. Original engines use 5 for trains and road vehicles, 10 for ships and 20 for aircraft (`table/engines.h` macros, 5th field). It is ¼ (rounded up) for the mail part of an aircraft. NewGRF callbacks are only used when `gradual_loading` is set. The result is scaled by the cargo multiplier only with `NoDefaultCargoMultiplier`, and is at least 1.
- With gradual loading, each step moves up to `load_amount` units **per wagon**, then waits 40 ticks for a train (×penalty if the train is longer than the platform). Without a full-load order, a step with no unloading and `full_load_amount == 0` sets `StopLoading`. Each cargo's bit is set or cleared by the _last_ wagon of that cargo that attempted a load in the step (`loaded == cap_left`). The next step then loads nothing, takes the "nothing moved" branch and sets `LoadingFinished`. A step that moves nothing also sets `LoadingFinished`, unless a full-load order is still unsatisfied. The order and vehicle code (orders.md, trains.md) then leave the station via `Vehicle::LeaveStation`. That deletes `cargo_payment`, returns reserved cargo (`CancelReservation`) and removes the vehicle from `loading_vehicles`.
- Loading picks packets from the `next_station` keys (iterated in reverse list order), then from `Invalid` (`StationCargoList::ShiftCargo`). Every packet that moves gets `UpdateLoadingTile(v.GetCargoTile())`. For a train part this is the wagon's own tile, so `source_xy` is the wagon's tile at the first pickup.

### 4.10 Delivery and payment (`economy.cpp`)

```
CargoDelivery (per packet part, count n): payment.PayFinalDelivery(c, cp, n, tile)
PayFinalDelivery: profit = DeliverGoods(n, c, current_station, cp.GetDistance(tile), cp.periods_in_transit, company, cp.source)
                  route_profit += profit; visual_profit += profit - cp.GetFeederShare(n)
DeliverGoods:
  accepted_ind = DeliverGoodsToIndustry(st, c, n, source industry or Invalid)
      // for i in st.industries_near (by distance): skip source industry, skip if i doesn't accept c,
      //   temporarily refuses, or exclusive_supplier set to another owner;
      //   take = min(n, 0xFFFF - accepted.waiting); accepted.waiting += take; n -= take
  accepted_total = (c in st.always_accepted) ? n : accepted_ind
  if accepted_total > 0: ge.status |= {EverAccepted, CurrentMonth, AcceptedBigtick}
  company.cur_economy.delivered_cargo[c] += accepted_total; town.received[cs.town_acceptance_effect] += accepted_total
  profit = GetTransportedGoodsIncome(accepted_total, distance, periods, c)     // economy.md
  subsidy multiplier if subsidised (subsidies skipped in Stage 1)
~CargoPayment (when payment is deleted): company money += route_profit (vehicle revenue expense type);
  front.profit_this_year += (visual_profit + visual_transfer) << 8; income text effect
PayTransfer: profit = (GetTransportedGoodsIncome(n, dist, periods, c) - feeder_share(n)) * feeder_payment_share(75) / 100
```

- Cargo that is delivered but not accepted (for example the industry refuses it and no house accepts it) still leaves the vehicle, and earns nothing.
- `TriggerIndustryProduction` (end of `LoadUnloadStation`) converts the accepted waiting cargo using `input_cargo_multiplier`. A power station produces nothing (towns-industries.md).
- Monthly (`_economy_stations_monthly`): `LastMonth = CurrentMonth`, then `CurrentMonth = false`.
- Station deletion (`StationHandleBigTick`): a station not in use has `++delete_ctr` on each big tick. At ≥ 8 it is deleted. `delete_ctr` is reset to 0 when the last facility goes (`DeleteStationIfEmpty`).

### 4.11 Cargo types for Stage 1 (`table/cargo_const.h:_default_cargo`, temperate slots from `_default_climate_cargo`)

| Slot (CargoType) | Label    | bitnum | weight (1/16 t) | multiplier | initial_payment | transit_periods [0], [1] | freight | town effect      | classes          |
| ---------------- | -------- | ------ | --------------- | ---------- | --------------- | ------------------------ | ------- | ---------------- | ---------------- |
| 0                | `'PASS'` | 0      | 1               | 0x400      | 3185            | 0, 24                    | no      | `TAE_PASSENGERS` | Passengers       |
| 1                | `'COAL'` | 1      | 16              | 0x100      | 5916            | 7, 255                   | yes     | `TAE_NONE`       | Bulk, NonPotable |
| 2 (skipped)      | `'MAIL'` | 2      | 4               | 0x200      | 4550            | 20, 90                   | no      | `TAE_MAIL`       | Mail             |

`initial_payment` is the rate before inflation. The transit_periods (old "days1/days2") feed `GetTransportedGoodsIncome` (economy.md). `town_production_multiplier` = 256 (`TOWN_PRODUCTION_DIVISOR`). `town_production_effect` is `INVALID_TPE` in the table and is resolved at load (towns-industries.md).

## 5. Defaults (new game)

| Setting                                         | Default            | Source                    | Effect here                                                                                     |
| ----------------------------------------------- | ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `station.modified_catchment`                    | true               | `game_settings.ini`       | rail radius = `CA_TRAIN` 4                                                                      |
| `station.station_spread`                        | 12 (min 4, max 64) | `game_settings.ini`       | max station bbox width/height                                                                   |
| `station.distant_join_stations`                 | true               | `game_settings.ini`       | allows `station_to_join`                                                                        |
| `station.serve_neutral_industries`              | true               | `game_settings.ini`       | oil rigs only                                                                                   |
| `order.selectgoods`                             | true               | `game_settings.ini`       | cargo only arrives after a vehicle tried to load; pickup-less cargo is dropped at 255 intervals |
| `order.gradual_loading`                         | true               | `game_settings.ini`       | load_amount slices + 40-tick waits for trains                                                   |
| `order.improved_load`                           | true               | `game_settings.ini`       | only affects autorefit reservation (4.9)                                                        |
| `order.station_length_loading_penalty`          | true               | `game_settings.ini`       | slower loading if the train overhangs the platform                                              |
| `economy.feeder_payment_share`                  | 75                 | `economy_settings.ini`    | transfer credit %                                                                               |
| `construction.build_on_slopes`                  | true               | `world_settings.ini`      | irrelevant on a flat map                                                                        |
| `difficulty.town_council_tolerance`             | 0                  | `difficulty_settings.ini` | rating check in `CheckIfAuthorityAllowsNewStation` is active                                    |
| `economy.dist_local_authority`                  | 20                 | `economy_settings.ini`    | radius of that check                                                                            |
| `linkgraph.distribution_pax / _mail / _default` | `DT_MANUAL`        | `linkgraph_settings.ini`  | no cargodist, every packet next hop = Invalid                                                   |
| `cheats.station_rating`                         | off                | `cheat_type.h`            | —                                                                                               |

## 6. Stage 1 needs

- `Station` and `GoodsEntry` with the fields from section 3, for PASS and COAL only. Station tile on the map: type Rail, station index, axis, gfx, railtype (see map.md).
- `CmdBuildRailStation` for new stations and for extending an adjacent own station: validation, costs, spread limit 12, naming (4.2; every rule is reachable on a Stage 1 map). Removal at `PR_CLEAR_STATION_RAIL` per tile if Stage 1 allows demolishing.
- Catchment radius 4 per tile. `stations_near` on towns and industries. `industries_near`. Acceptance every 250 ticks and after building, with the ≥ 8 threshold and `always_accepted`.
- `MoveGoodsToStation` with the rating-weighted split and `amount_fract`, gated by `last_speed != 0`.
- `CargoPacket`, `StationCargoList` (single `Invalid` key), `VehicleCargoList` with KEEP/DELIVER/LOAD designations, merging, splitting, `GetDistance`, aging every 185 ticks.
- `PrepareUnload`/`Stage` (normal order), `LoadUnloadStation`/`LoadUnloadVehicle` with gradual loading, the full-load and full-load-any rules, reservations for full load, the platform-length penalty, and `CargoPayment` booking.
- `UpdateStationRating` exactly as in 4.7, without statues, the cheat or NewGRF, and with `TruncateCargo`.

## 7. Skipped (and why)

- **Cargodist / link graph** (`flows`, `FlowStat`, `GetVia`, `IncreaseStats`, `DeleteStaleLinks`, `LinkRefresher`, `RerouteCargo`). The defaults are `DT_MANUAL`. Hooks: `UpdateStationWaiting` (`GetVia`, `UpdateSupply`), `Stage` (flows), `UpdateStationAcceptance` (`SetDemand`), `OnTick_Station` (504-tick link cleanup).
- **Transfers / feeder share**: the data structure is kept (field `feeder_share`, TRANSFER action), but no Unload/Transfer order types in Stage 1 (orders.md).
- **Road stops, docks, airports, oil rigs/neutral stations, waypoints, buoys**: not in scope. Their catchment radii are listed above for later.
- **NewGRF**: station specs and layouts, `CBID_STATION_*`, `CBID_CARGO_STATION_RATING_CALC`, load amount callbacks, animation and randomisation triggers, `TriggerWatchedCargoCallbacks`.
- **Statues, exclusive transport rights, bribes, subsidies, crashes (`ModifyStationRatingAround`)**: town actions and disasters are not in Stage 1. The +26 statue bonus and exclusivity checks become no-ops.
- **Autorefit / refit at station** (`HandleStationRefit`, `consist_capleft`), timetables (`timetabled_wait`, `lateness_counter` are 0), PBS reservations (no signals), bridges above stations.
- **Mail, recession halving, cargo scale**: belong to towns-industries.md.
- GUI-only parts: news on acceptance change, loading indicators, `GetProductionAroundTiles` (build preview).

## 8. Open questions

1. In `CalculateRailStationCost`, `PR_BUILD_STATION_RAIL_LENGTH` is added on the first new tile and then whenever the `tracknum` counter wraps, i.e. once per `numtracks + 1` tiles in row-major order. That is not "once per platform". Should the port reproduce this counter exactly (the cost then depends on numtracks/plat_len and orientation in a non-obvious way), or is a simpler rule acceptable?
2. In `LoadUnloadVehicle`, `improved_load && use_autorefit ? … : IsFullLoadOrder()` parses as `(improved_load && use_autorefit) ? … : …`. Without autorefit, cargo is therefore reserved for every full-load order whether or not `improved_load` is set. The function comment says reservation needs improved_load. Port the code's behaviour (my reading) or the comment's intent?
3. `UpdateStationRating`, `TruncateCargo`, `StationCargoList::Truncate`, the station random bits and the waiting-cargo reduction all draw from the shared game `Random()`. Does the project require bit-exact RNG call order matching OpenTTD (needed for replaying original behaviour), or only statistically equivalent results?
4. Stage 1 UI scope: should building support the `adjacent` (Ctrl) flag and distant join (`station_to_join`), or only "join the single adjacent own station, else create a new one"? Both are default-enabled in the source.
5. Pool limits (`CargoPacket::CanAllocateItem`, ~16 M packets; `Station::CanAllocateItem`) silently drop cargo or refuse stations when full. Should the port model these limits or ignore them?
6. `last_speed` for trains is `front->vcache.cached_max_speed` in "km-ish/h". trains.md must confirm how `cached_max_speed` is computed for a consist (min of engine and wagon limits), because the rating speed bonus `(last_speed − 85) >> 2` depends on it.
