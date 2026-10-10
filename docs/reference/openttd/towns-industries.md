# Towns and industries

Source: OpenTTD 15.3, `reference/OpenTTD/src`. All paths below are relative to that directory.

## 1. Purpose

Towns are groups of house tiles around a centre tile. Each finished house tile makes passengers
(and mail) on its periodic tile-loop visit and hands them to nearby stations. House tiles also
report which cargo they accept. Industries are groups of industry tiles. A primary industry (coal
mine) adds cargo to an internal `waiting` buffer every 256 ticks, and its tiles move that buffer
to nearby stations on their tile-loop visits. A secondary or "black hole" industry (power
station) accepts cargo through its tiles and consumes it. This note covers what produces cargo
and how acceptance is reported per tile. Station catchment, the 8/8 acceptance threshold, ratings
and payment are covered in [stations-cargo.md](stations-cargo.md) and [economy.md](economy.md).

## 2. Source files

| File                                                                                                        | Key items                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `town.h`                                                                                                    | `Town` struct, `TownCache`, `SuppliedHistory::PctTransported`, `TownTicksToGameTicks`                                                     |
| `town_map.h`                                                                                                | Per-tile house storage: `GetHouseType`, `IsHouseCompleted`, `IncHouseConstructionTick`, `MakeHouseTile`                                   |
| `house.h`                                                                                                   | `HouseSpec`, `BuildingFlag`, `HouseZone`, `TOWN_HOUSE_COMPLETED`                                                                          |
| `table/town_land.h`                                                                                         | `_original_house_specs[110]` (macro `MS`): the original house types                                                                       |
| `town_cmd.cpp:TileLoop_Town`                                                                                | Per house tile visit: finish construction or generate passengers/mail                                                                     |
| `town_cmd.cpp:TownGenerateCargoOriginal` / `TownGenerateCargoBinomial`                                      | The two passenger/mail formulas                                                                                                           |
| `town_cmd.cpp:TownGenerateCargo`                                                                            | Recession halving, cargo scale, `MoveGoodsToStation`, town stats                                                                          |
| `town_cmd.cpp:AddAcceptedCargoOfHouse` / `AddAcceptedCargo_Town`                                            | Per-tile acceptance of a house                                                                                                            |
| `town_cmd.cpp:GenerateTowns` / `CreateRandomTown` / `DoCreateTown`                                          | Town placement and initial build at world generation                                                                                      |
| `town_cmd.cpp:TownCanBePlacedHere`                                                                          | Placement rules for a town centre                                                                                                         |
| `town_cmd.cpp:GrowTown` / `GrowTownAtRoad` / `GrowTownInTile` / `TryBuildTownHouse` / `BuildTownHouse`      | Road-following house and road building (used by the initial build)                                                                        |
| `town_cmd.cpp:UpdateTownRadius` / `GetTownRadiusGroup`                                                      | Town zones that decide which house types fit where                                                                                        |
| `town_cmd.cpp:UpdateTownMaxPass`                                                                            | Initial "last month" passenger/mail estimate                                                                                              |
| `town_cmd.cpp:_economy_towns_monthly`                                                                       | Monthly history rotation, growth/rating updates                                                                                           |
| `industry.h`                                                                                                | `Industry` struct, `ProducedCargo`, `AcceptedCargo`, `PRODLEVEL_*`                                                                        |
| `industrytype.h`                                                                                            | `IndustrySpec`, `IndustryTileSpec`, `IndustryBehaviour`                                                                                   |
| `table/build_industry.h`                                                                                    | `_tile_table_coal_mine*`, `_tile_table_power_station*`, `_origin_industry_specs` (macro `MI`), `_origin_industry_tile_specs` (macro `MT`) |
| `industry_cmd.cpp:OnTick_Industry` / `ProduceIndustryGoods` / `ProduceIndustryGoodsHelper`                  | Production every 256 ticks                                                                                                                |
| `industry_cmd.cpp:TileLoop_Industry` / `TransportIndustryGoods`                                             | Moves `waiting` cargo to stations                                                                                                         |
| `industry_cmd.cpp:AddAcceptedCargo_Industry`                                                                | Per-tile acceptance of an industry tile                                                                                                   |
| `industry_cmd.cpp:GenerateIndustries` / `PlaceIndustry` / `CreateNewIndustryHelper` / `DoCreateNewIndustry` | Placement at world generation                                                                                                             |
| `industry_cmd.cpp:ChangeIndustryProduction` / `_economy_industries_daily` / `_economy_industries_monthly`   | Production changes and closure (skipped in Stage 1)                                                                                       |
| `economy.cpp:DeliverGoodsToIndustry` / `TriggerIndustryProduction`                                          | What happens to coal delivered to the power station                                                                                       |
| `station_cmd.cpp:MoveGoodsToStation` / `CanMoveGoodsToStation` / `UpdateStationWaiting`                     | Shared entry point that puts generated cargo into stations                                                                                |
| `landscape.cpp:RunTileLoop`                                                                                 | Visits every tile once per `TILE_UPDATE_FREQUENCY` = 256 ticks                                                                            |
| `genworld.cpp:_GenerateWorld`                                                                               | Order: towns, industries, objects, trees, then 0x500 tile-loop runs                                                                       |

## 3. State

### Town (`town.h:Town`)

| Field                                                                                    | Type                                           | Meaning                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `xy`                                                                                     | TileIndex                                      | Town centre tile                                                                                                         |
| `cache.num_houses`                                                                       | uint32                                         | Number of houses (a multi-tile house counts once, `BuildTownHouse`)                                                      |
| `cache.population`                                                                       | uint32                                         | Sum of `HouseSpec.population` of **completed** houses                                                                    |
| `cache.squared_town_zone_radius[5]`                                                      | uint32                                         | Squared radius per zone (Edge, Outskirt, OuterSuburb, InnerSuburb, Centre)                                               |
| `cache.building_counts`                                                                  | vectors of uint16                              | Houses per type/class (only matters for overflow check)                                                                  |
| `supplied[]`                                                                             | vector of `{cargo, history[HISTORY_RECORDS]}`  | Per produced cargo: `production`, `transported` (uint32) per month. `history[0]` = THIS_MONTH, `history[1]` = LAST_MONTH |
| `received[NUM_TAE]`                                                                      | `TransportedCargoStat<uint16>`                 | Delivered cargo by town effect (used by growth, later stage)                                                             |
| `goal[NUM_TAE]`                                                                          | uint32                                         | Cargo needed to grow (0 in temperate)                                                                                    |
| `stations_near`                                                                          | set of Station (not saved)                     | Stations whose catchment covers any house of the town                                                                    |
| `flags`                                                                                  | IsGrowing, HasChurch, HasStadium, CustomGrowth | `HasChurch`/`HasStadium` limit those houses to one per town                                                              |
| `time_until_rebuild`                                                                     | uint16                                         | Countdown for replacing houses (only if growing)                                                                         |
| `grow_counter`, `growth_rate`                                                            | uint16                                         | Growth timing (later stage)                                                                                              |
| `fund_buildings_months`, `road_build_months`                                             | uint8                                          | Town actions (later stage)                                                                                               |
| `larger_town`                                                                            | bool                                           | "City" flag; bigger initial size, faster growth                                                                          |
| `layout`                                                                                 | TownLayout                                     | Road layout used by the town                                                                                             |
| `ratings[]`, `have_ratings`, `exclusivity`, `exclusive_counter`, `unwanted[]`, `statues` | various                                        | Town authority (later stage)                                                                                             |
| `townnameparts` etc.                                                                     |                                                | Generated name                                                                                                           |

`SuppliedHistory::PctTransported() = clamp_u8(transported * 256 / production)`, 0 if production = 0
(`town.h:Town::SuppliedHistory::PctTransported`). 256 means 100 %.

### House tile (`town_map.h`, `MakeHouseTile`)

| Bits              | Meaning                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| m2                | Town index                                                                                           |
| m8 bits 11-0      | House type (HouseID); m8 bits 15-12 are 0                                                            |
| m3 bit 7          | Completed flag                                                                                       |
| m5 bits 0-2 / 3-4 | While building: construction tick (0-7) / stage (0-2). After completion m5 is the house age in years |
| m1                | Random bits                                                                                          |

A multi-tile house uses consecutive HouseIDs: north tile = base ID, then (0,1), (1,0), (1,1) in that
order get `++type` (`town_cmd.cpp:MakeTownHouse`).

### HouseSpec (`house.h:HouseSpec`), fields that matter

`min_year`, `max_year` (calendar years); `population` (uint8, 0 on the non-north tiles of a
multi-tile house); `mail_generation` (uint8, per tile); `cargo_acceptance[3]` (eighths) for
`accepts_cargo_label` = {PASS, MAIL, GOODS} in temperate; `building_flags` (size, IsChurch,
IsStadium, IsAnimated); `building_availability` (zones + climate bits); `probability` = 16 for every
original house (macro `MS` in `table/town_land.h`); `minimum_life` = 0 and `processing_time` = 0
for originals.

### Industry (`industry.h:Industry`)

| Field                                                                                                                                        | Type                                                                     | Meaning                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `location`                                                                                                                                   | TileArea                                                                 | Bounding box: north tile + w × h                                                                                              |
| `type`                                                                                                                                       | IndustryType                                                             | 0 = coal mine, 1 = power station (`_origin_industry_specs` order)                                                             |
| `town`                                                                                                                                       | Town*                                                                    | Closest town at creation                                                                                                      |
| `produced[]`                                                                                                                                 | `{cargo, waiting: uint16, rate: uint8, history[]}`                       | `waiting` = produced, not yet moved; `rate` = units added per production cycle; history `production`/`transported` are uint16 |
| `accepted[]`                                                                                                                                 | `{cargo, waiting: uint16, accumulated_waiting, last_accepted, history*}` | Delivered cargo not yet processed                                                                                             |
| `prod_level`                                                                                                                                 | uint8                                                                    | `PRODLEVEL_DEFAULT` = 0x10 at creation (original economy scales rate by it)                                                   |
| `counter`                                                                                                                                    | uint16                                                                   | Decremented every tick; production when `counter % 256 == 0`                                                                  |
| `last_prod_year`                                                                                                                             | economy year                                                             | Last year with production (closure rule)                                                                                      |
| `stations_near`                                                                                                                              | set of Station (not saved)                                               | Stations whose catchment covers an industry tile                                                                              |
| `random_colour`, `random`, `selected_layout`, `founder`, `construction_date`, `construction_type`, `exclusive_supplier/consumer`, `ctlflags` |                                                                          | Mostly display, NewGRF or game script                                                                                         |

`ProducedHistory::PctTransported() = clamp_u8(transported * 256 / production)`
(`industry.h:Industry::ProducedHistory::PctTransported`).

## 4. Rules and formulas

### 4.1 Tile-loop timing

`landscape.cpp:RunTileLoop` runs every tick and visits `2^(LogX+LogY-8)` tiles in a Galois LFSR
order, so each tile is visited once every `TILE_UPDATE_FREQUENCY = 1 << 8 = 256` ticks
(tile 0 is handled separately when `counter % 256 == 0`). House and industry tile procs are
`TileLoop_Town` and `TileLoop_Industry`.

### 4.2 House construction (`town_cmd.cpp:TileLoop_Town`, `AdvanceSingleHouseConstruction`)

```
TileLoop_Town(tile):
  if !IsHouseCompleted(tile): AdvanceHouseConstruction(tile); return   // every tile of the house
  ...generate cargo (4.3)...
  if house is 1-tile-origin && town.IsGrowing && house age >= minimum_life
     && --town.time_until_rebuild == 0: replace house          // never in Stage 1 (no growth)

AdvanceSingleHouseConstruction(tile):
  m5 bits 0..4 += 1            // town_map.h:IncHouseConstructionTick, 3-bit tick + 2-bit stage
  if stage == TOWN_HOUSE_COMPLETED (3): set completed flag
  if tick != 0: return
  if completed: town.population += spec.population; house age = 0
```

A house built from stage 0, tick 0 needs 24 visits (24 × 256 ticks) to complete.

### 4.3 Passenger and mail generation (`town_cmd.cpp:TileLoop_Town`)

Only completed houses generate. For original houses (no NewGRF callback), per visit:

```
stations = StationFinder(1x1 area of this tile)       // filtered by catchment, see stations-cargo.md
switch economy.town_cargogen_mode:
  TCGM_ORIGINAL (0):
    TownGenerateCargoOriginal(t, PASSENGERS, spec.population, stations)
    TownGenerateCargoOriginal(t, MAIL,       spec.mail_generation, stations)
  TCGM_BITCOUNT (1, default):
    if bits 8..9 of TimerGameTick::counter == bits 0..1 of tile index:   // 1 visit in 4
      TownGenerateCargoBinomial(t, PASSENGERS, spec.population, stations)
      TownGenerateCargoBinomial(t, MAIL,       spec.mail_generation, stations)
```

`town_cmd.cpp:TownGenerateCargoOriginal` (quadratic in `rate`):

```
r = Random()                                   // one 32-bit draw per cargo
b = r & 0xFF
if b < rate:
  amt = (b * multiplier / TOWN_PRODUCTION_DIVISOR) / 8 + 1
  TownGenerateCargo(t, cargo, amt, stations, affected_by_recession = true)
```

`town_cmd.cpp:TownGenerateCargoBinomial` (linear in `rate`):

```
r = Random()
genmax  = (rate + 7) / 8
genmask = genmax >= 32 ? 0xFFFFFFFF : (1 << genmax) - 1
amt = popcount(r & genmask) * multiplier / TOWN_PRODUCTION_DIVISOR
TownGenerateCargo(t, cargo, amt, stations, true)
```

Constants: `TOWN_PRODUCTION_DIVISOR = 256` (`cargotype.h`). `town_production_multiplier` defaults
to `TOWN_PRODUCTION_DIVISOR` for every default cargo (`table/cargo_const.h`, macro `MK`), so
`multiplier / DIVISOR = 1` for passengers and mail. Passengers get `TPE_PASSENGERS` and mail gets
`TPE_MAIL` by label (`newgrf.cpp`, around line 940). The same byte `b` is both the chance test and
the amount, so with original mode `amt` is `floor(b/8) + 1` where `b` is uniform in `[0, rate)`.

`town_cmd.cpp:TownGenerateCargo`:

```
if amount == 0: return
if affected_by_recession && EconomyIsInRecession(): amount = (amount + 1) >> 1
amount = ScaleByCargoScale(amount, town = true)            // economy_func.h
if amount == 0: return
s = t.GetOrCreateCargoSupplied(cargo)
s.history[THIS_MONTH].production  += amount
s.history[THIS_MONTH].transported += MoveGoodsToStation(cargo, amount, {t, Town}, stations)
```

`economy_func.h:ScaleByCargoScale(num, town)`: if `town_cargo_scale == 100` return `num`; else
`scaled = num * pct / 100`, and if `scaled == 0` return 1 with chance `1 / ScaleByInverseCargoScale(1)`.
`economy_func.h:EconomyIsInRecession` = `_economy.fluct <= 0`. With the default "steady economy"
(`difficulty.economy = false`) a recession never starts (`economy.cpp:HandleEconomyFluctuations`).

Worked example, derived arithmetic (not in source), for a "town houses" tile (population 30):

- Original: chance `30/256` per visit; `amt` for `b` = 0..29 is 1,2,3,4 with counts 8,8,8,6, mean
  2.4. Expected 0.28 passengers per 256 ticks.
- Bitcount: `genmax = (30+7)/8 = 4`, mean `popcount` = 2, once per 4 visits. Expected 0.5 passengers
  per 256 ticks.

These are amounts offered to stations. `MoveGoodsToStation` then keeps only a rating-dependent
share (section 4.5).

### 4.4 Town statistics (`town_cmd.cpp:_economy_towns_monthly`, `UpdateTownMaxPass`)

- Every economy month: rotate `supplied[].history` (THIS_MONTH becomes LAST_MONTH),
  `received[].NewMonth()`, `UpdateTownGrowth`, `UpdateTownRating`, decrement action counters.
- At creation `UpdateTownMaxPass` sets `history[LAST_MONTH].production` to
  `ScaleByCargoScale(population >> 3)` for passengers and `population >> 4` for mail, so the town
  window shows a value before the first month ends.
- Every economy year: house age (m5) of every completed house += 1 (`_economy_towns_yearly`).

### 4.5 Moving generated cargo to stations (`station_cmd.cpp:MoveGoodsToStation`)

Shared by towns and industries. Summary only; details belong to stations-cargo.md.

```
MoveGoodsToStation(cargo, amount, source, stations, exclusivity = INVALID_OWNER):
  keep stations where CanMoveGoodsToStation(st, cargo):
     not under another company's exclusive rights; goods[cargo].rating != 0;
     if order.selectgoods (default true): a vehicle has already tried to load this cargo here;
     passengers: not a truck-stop-only station; others: not a bus-stop-only station
  none -> return 0 (cargo is lost)
  one  -> UpdateStationWaiting(st, cargo, amount * (rating + 1), source)
  many -> amount *= best_rating + 1, split by company best rating then by station rating,
          remainder to best-rated stations; UpdateStationWaiting for each
UpdateStationWaiting: amount += ge.amount_fract; amount_fract = amount & 0xFF; amount >>= 8;
                      if amount > 0: append a CargoPacket; return amount
```

`rating` is 0..255, so with one station roughly `rating/256` of the cargo arrives and the
fraction carries over in `amount_fract`.

### 4.6 House acceptance (`town_cmd.cpp:AddAcceptedCargoOfHouse`)

For original houses (no callbacks):

```
for i in 0..2: if accepts_cargo[i] valid and cargo_acceptance[i] > 0:
    acceptance[accepts_cargo[i]] += cargo_acceptance[i]     // eighths
    set always_accepted bit for that cargo
```

Every tile of a multi-tile house uses its own spec row. Those rows have the same acceptance as the
north tile (see table 4.7).

### 4.7 Temperate house types (`table/town_land.h:_original_house_specs`)

All 31 temperate rows (plus the extra tiles of multi-tile houses). Acceptance is in eighths for
passengers / mail / goods. Zones: C = centre, IS = inner suburb, OS = outer suburb, O = outskirt,
E = edge. **Bold** = can be built at the default start year 1950 (`min_year <= 1950 <= max_year`).

| ID             | Name                   | Years     | Pop          | Mail   | Acc P/M/G | Size / flags         | Zones        |
| -------------- | ---------------------- | --------- | ------------ | ------ | --------- | -------------------- | ------------ |
| 00             | Tall office block      | 1963–     | 187          | 70     | 8/3/4     | 1x1                  | C            |
| 01             | Office block           | 1957–     | 85           | 55     | 8/3/4     | 1x1                  | C, IS        |
| 02             | Small block of flats   | 1968–     | 40           | 20     | 8/3/1     | 1x1                  | IS, OS, O    |
| **03**         | Church                 | 0–        | 5            | 2      | 2/0/0     | 1x1, IsChurch        | IS, OS, O, E |
| 04             | Large office block     | 1975–     | 220          | 85     | 10/4/6    | 1x1, animated        | C            |
| **06**         | Town houses            | 0–        | 30           | 12     | 4/1/0     | 1x1                  | IS, OS, O, E |
| 07, 08         | Hotel                  | 1959–     | 140, 0       | 22, 22 | 6/1/2     | 1x2                  | C, OS        |
| **09**         | Statue                 | 1945–     | 0            | 0      | 2/0/0     | 1x1                  | C, IS        |
| **0A**         | Fountain               | 1945–     | 0            | 0      | 2/0/0     | 1x1                  | C            |
| **0B**         | Park                   | 0–        | 0            | 0      | 2/0/0     | 1x1                  | OS           |
| **0C**         | Park                   | 1935–     | 0            | 0      | 2/0/0     | 1x1                  | IS           |
| 0D             | Office block           | 1951–     | 150          | 65     | 8/2/4     | 1x1                  | C, IS        |
| **0E, 0F, 10** | Shops and offices      | 1930–1960 | 95           | 48     | 6/2/3     | 1x1 (three variants) | C, IS, OS    |
| 11             | Modern office building | 1977–     | 130          | 50     | 10/3/6    | 1x1                  | C            |
| 12             | Warehouse              | 1983–     | 6            | 10     | 6/3/8     | 1x1                  | C            |
| 13             | Office block           | 1985–     | 110          | 55     | 6/2/6     | 1x1                  | C            |
| **14–17**      | Stadium                | 0–        | 65, 0, 0, 0  | 5 each | 4/0/0     | 2x2, IsStadium       | IS, OS, O, E |
| **18**         | Old houses             | 0–1951    | 15           | 6      | 3/1/0     | 1x1                  | O, E         |
| **19**         | Cottages               | 0–1952    | 12           | 7      | 3/1/0     | 1x1                  | E            |
| **1A**         | Houses                 | 1931–     | 13           | 8      | 3/1/0     | 1x1                  | IS, OS, O, E |
| **1B**         | Flats                  | 1935–     | 100          | 35     | 7/2/2     | 1x1                  | C, IS, OS    |
| 1C             | Tall office block      | 1963–     | 170          | 50     | 8/3/3     | 1x1                  | C, IS, OS    |
| **1D**         | Shops and offices      | 0–1955    | 100          | 40     | 6/2/3     | 1x1                  | C, IS, OS    |
| 1E             | Shops and offices      | 1973–     | 180          | 64     | 8/3/3     | 1x1                  | C, OS        |
| **1F**         | Theatre                | 0–        | 35           | 23     | 8/2/2     | 1x1                  | C, IS        |
| 20–23          | Stadium                | 1958–     | 65, 0, 0, 0  | 5 each | 4/0/0     | 2x2, IsStadium       | IS, OS, O, E |
| 24             | Offices                | 2000–     | 140          | 65     | 8/3/2     | 1x1                  | C, IS        |
| **27**         | Cinema                 | 1945–     | 35           | 23     | 8/2/2     | 1x1                  | C, IS, OS    |
| 28–2B          | Shopping mall          | 1983–     | 180, 0, 0, 0 | 5 each | 8/2/3     | 2x2                  | C, IS, OS, O |

"–" with no end year means `CalendarTime::MAX_YEAR`. ID 05 is the sub-arctic copy of 04 and is not
temperate.

### 4.8 Town placement and initial build at world generation

Order (`genworld.cpp:_GenerateWorld`): `GenerateClearTile`, `Map::CountLandTiles`,
`GenerateTowns(economy.town_layout)`, `GenerateIndustries`, `GenerateObjects`, `GenerateTrees`,
then `RunTileLoop` 0x500 = 1280 times (each tile visited 5 times) with `_generating_world` false.

`town_cmd.cpp:GenerateTowns`:

```
if difficulty.number_towns == 4 (custom): total = custom_town_number
else total = ScaleByLandProportion(GetDefaultTownsForMapSize() + (Random() & 7))
total = clamp(total, 1, TownPool::MAX_SIZE)
city_random_offset = larger_towns == 0 ? 0 : Random() % larger_towns
repeat total times (current_number counts successes):
  city = larger_towns != 0 && (city_random_offset + current_number) % larger_towns == 0
  generate a unique name, else skip this iteration
  CreateRandomTown(attempts = 20, name, TSZ_RANDOM, city, layout)
if no town was created: one more CreateRandomTown(10000, ...); if that fails, error
```

- `GetDefaultTownsForMapSize` = `Map::ScaleBySize({5, 11, 23, 46}[number_towns])`.
- `map_func.h:ScaleBySize(n)` = `ceil((n << (LogX + LogY - 12)) / 16)` (n is defined for 256×256).
- `map_func.h:ScaleByLandProportion(n)` = `n * initial_land_count / map_size`, with
  `initial_land_count = min(size, land + land/12)` (`map.cpp:Map::CountLandTiles`).

`town_cmd.cpp:CreateRandomTown(attempts, ...)`:

```
repeat attempts times:
  tile = AlignTileToGrid(RandomTile(), layout)      // only moves the tile for 2x2/3x3 grid layouts
  if tile is water: tile = FindNearestGoodCoastalTownSpot(tile, layout); skip if none
  else if TownCanBePlacedHere(tile, check_surrounding = true) fails: continue
  t = new Town(tile); DoCreateTown(t, ...)
  if t.population > 0: return t
  delete t
return null
```

`town_cmd.cpp:TownCanBePlacedHere`:

- `DistanceFromEdge(tile) >= 12`;
- Manhattan distance to the nearest existing town `>= 20` (`IsCloseToTown(tile, 20)`);
- tile is clear or trees, and flat;
- with `check_surrounding`: in the 5×5 spiral around the tile at least `VALID_TILE_GOAL = 25/2 = 12`
  tiles are clear (not rough) or trees (not rough ground) and within ±1 height of the centre.

`town_cmd.cpp:DoCreateTown`:

```
t.xy = tile; num_houses = 0; population = 0; time_until_rebuild = 10
grow_counter = t.index % TOWN_GROWTH_TICKS (70); growth_rate = TownTicksToGameTicks(250)
ratings[all] = RATING_INITIAL; other authority fields cleared
t.layout = layout (TL_RANDOM -> TileHash(x, y) % 4); t.larger_town = city
x = size * 16 + 3; if size == TSZ_RANDOM: x = (Random() & 0xF) + 8        // 8..23
if city (and not placed manually): x *= economy.initial_city_size
num_houses += x; UpdateTownRadius(t)                 // pretend bigger, so outer zones exist
repeat x * 4 times: GrowTown(t, {Buildings, Roads})
num_houses -= x; UpdateTownRadius; UpdateTownGrowthRate; UpdateTownMaxPass
```

`town_cmd.cpp:GrowTown`: walks the 13 offsets of `_town_coord_mod` from `xy`. At the first tile with
road it calls `GrowTownAtRoad`. If none has road, it builds one random 2-bit road piece
(`GenRandomRoadBits`) on the first flat, non-house, clearable tile on that walk. So **the first call
builds a road at the centre, and every house is placed next to a town road.**

`GrowTownAtRoad` / `GrowTownInTile` (summary): random walk along the town's road for
`10 + num_houses * 4/9` steps (TL_ORIGINAL; `*2/9` better roads; `*1/9` grids). On a tile with road it
picks a random direction. If that side has no road, it tries a house there (`TryBuildTownHouse`),
always for TL_ORIGINAL when a road is not allowed there, otherwise with chance 6/10. Otherwise it
extends the road (`GrowTownWithRoad`, or bridges/tunnels on slopes/water). Road extension is
blocked next to existing roads by `IsRoadAllowedHere`. `LevelTownLand` (terraform) does nothing on
a flat map.

`town_cmd.cpp:TryBuildTownHouse(t, tile)`:

```
zone = GetTownRadiusGroup(t, tile) + climate bit (ClimateTemperate)
candidates = houses with building_availability containing BOTH bits, enabled, not overridden
repeat while candidates: pick one weighted by probability (all 16), remove it
  skip if year outside [min_year, max_year]; skip church/stadium if town already has one
  skip if NotSloped and tile not flat; 2x1/1x2/2x2 need free same-height neighbours
  BuildTownHouse(...); return true
```

`town_cmd.cpp:GetTownRadiusGroup`: `d = DistanceSquare(tile, xy)`. The result is the highest zone
`i` with `d < squared_town_zone_radius[i]`, else Edge. With `fund_buildings_months != 0` and
`d <= 25` it is Centre.

`town_cmd.cpp:UpdateTownRadius`: if `num_houses < 23*4 = 92` use the row `num_houses / 4` of the
23-row `_town_squared_town_zone_radius_data` table (row 0 = {4,0,0,0,0} … row 22 = {121,81,0,49,36}).
Otherwise, with `mass = num_houses / 8`: Edge `mass*15-40`, Outskirt `mass*9-15`, OuterSuburb 0,
InnerSuburb `mass*5-5`, Centre `mass*3+5`.

`town_cmd.cpp:BuildTownHouse` during world generation:

```
num_houses++
stage = TOWN_HOUSE_COMPLETED (3)
if _generating_world && !historical && Chance16(1, 7): stage = Random bits 0..1   // may still be 3
if stage == 3: population += spec.population
else counter = Random bits 2..3
MakeTownHouse(...) (clears the tiles, writes all tiles of the house)
```

### 4.9 Coal mine and power station specs (`table/build_industry.h`)

|                                          | Coal mine (type 0)                  | Power station (type 1)                  |
| ---------------------------------------- | ----------------------------------- | --------------------------------------- |
| Layouts                                  | `_tile_table_coal_mine` (4 layouts) | `_tile_table_power_station` (3 layouts) |
| `cost_multiplier`                        | 210                                 | 240                                     |
| `prospecting_chance`                     | 0xB3333333                          | 0xFFFFFFFF                              |
| appear in game / at creation (temperate) | 2 / 8                               | 2 / 5                                   |
| `conflicting`                            | IT_POWER_STATION                    | IT_COAL_MINE                            |
| `check_proc`                             | CHECK_NOTHING                       | CHECK_NOTHING                           |
| produced cargo, `production_rate`        | COAL, 15                            | none                                    |
| `minimal_cargo`                          | 5                                   | 5                                       |
| accepted cargo                           | none                                | COAL (input multiplier 256, no output)  |
| life type                                | Extractive                          | `INDUSTRYLIFE_BLACK_HOLE`               |
| behaviour                                | CanSubsidence                       | none                                    |
| climates                                 | Temperate, Arctic                   | Temperate, Arctic                       |

Construction cost (`industry_cmd.cpp:IndustrySpec::GetConstructionCost`):
`(_price[PR_BUILD_INDUSTRY or PR_BUILD_INDUSTRY_RAW] * cost_multiplier) >> 8`. The raw price is
used only when `raw_industry_construction == 1` and the industry is raw. Base prices are 1,000,000
and 8,000,000 (`table/pricebase.h`); see economy.md for price scaling.

Layouts (offset `(x, y)` → gfx). Gfx 3 = coal mine tile accepting passengers; gfx 8 =
`GFX_POWERPLANT_CHIMNEY`, the only power-station tile accepting coal.

| Layout      | Box w×h | Tiles                                                                 |
| ----------- | ------- | --------------------------------------------------------------------- |
| Coal mine 0 | 3×3     | (1,1)0 (1,2)2 (0,0)5 (1,0)6 (2,0)3 (2,2)3                             |
| Coal mine 1 | 3×3     | (1,1)0 (1,2)2 (2,0)0 (2,1)2 (1,0)3 (0,0)3 (0,1)4 (0,2)4 (2,2)4        |
| Coal mine 2 | 2×3     | (0,0)0 (0,1)2 (0,2)5 (1,0)3 (1,1)3 (1,2)6                             |
| Coal mine 3 | 3×4     | (0,1)0 (0,2)2 (0,3)4 (1,0)5 (1,1)0 (1,2)2 (1,3)3 (2,0)6 (2,1)4 (2,2)3 |
| Power st. 0 | 4×2     | (0,0)7 (0,1)9 (1,0)7 (1,1)8 (2,0)7 (2,1)8 (3,0)10 (3,1)10             |
| Power st. 1 | 3×3     | (0,1)7 (0,2)7 (1,0)8 (1,1)8 (1,2)7 (2,0)9 (2,1)10 (2,2)9              |
| Power st. 2 | 3×2     | (0,0)7 (0,1)7 (1,0)9 (1,1)8 (2,0)10 (2,1)9                            |

Industry tile acceptance (`_origin_industry_tile_specs`, macro `MT`): gfx 3 = passengers 1/8;
gfx 8 = passengers 1/8 + coal 8/8; gfx 0, 1, 2, 4, 5, 6, 7, 9, 10 accept nothing. All refuse
`SLOPE_STEEP`. Gfx 1 is the animated coal-mine tower. Gfx 10 (`GFX_POWERPLANT_SPARKS`) only
animates.

### 4.10 Industry production (`industry_cmd.cpp:OnTick_Industry`, `ProduceIndustryGoods`)

```
every tick, for each industry i:
  i.counter -= 1                                     // uint16, wraps
  if i.counter % INDUSTRY_PRODUCE_TICKS == 0:        // INDUSTRY_PRODUCE_TICKS = 256
     for p in i.produced: p.waiting = min(65535, p.waiting + ScaleByCargoScale(p.rate, town=false))
     (PlantFields / CutTrees behaviours and NewGRF triggers: not used by coal mine)
  every DAY_TICKS (offset by index): accepted[].accumulated_waiting += waiting
```

`i.counter` starts at `Random bits 4..15` (0..4095) (`DoCreateNewIndustry`), so industries produce
at different ticks. `Ticks::INDUSTRY_PRODUCE_TICKS = 256` is in `timer/timer_game_tick.h`.
Production happens even when the tiles are not complete.

Initial `rate` (`industry_cmd.cpp:DoCreateNewIndustry`): `rate = spec.production_rate` (coal mine
15). If the spec does not use the original economy (`IndustrySpec::UsesOriginalEconomy`: false
when `economy.type != ET_ORIGINAL` and there are no production callbacks, which is the default
case), it is randomised:
`rate = clamp_u8(((RandomRange(256) + 128) * rate) >> 8)`. For the coal mine that is 7..22.
`prod_level = PRODLEVEL_DEFAULT (0x10)`. During world generation `history[LAST_MONTH].production
+= ScaleByCargoScale(rate * 8)` gives a first estimate.

### 4.11 Moving industry cargo to stations (`industry_cmd.cpp:TileLoop_Industry`, `TransportIndustryGoods`)

```
TileLoop_Industry(tile):
  if !IsIndustryCompleted(tile): MakeIndustryTileBigger(tile); return
  if TransportIndustryGoods(tile) and the tile has anim_production: switch gfx (animation)
  ...tile animations (coal mine tower, power plant sparks)...

TransportIndustryGoods(tile):            // called by EVERY completed tile of the industry
  for p in i.produced:
    cw = min(p.waiting, 255)
    if cw > spec.minimal_cargo (5):
      p.waiting -= cw
      if EconomyIsInRecession(): cw = (cw + 1) / 2
      p.history[THIS_MONTH].production  += cw
      am = MoveGoodsToStation(p.cargo, cw, {i, Industry}, i.stations_near, i.exclusive_consumer)
      p.history[THIS_MONTH].transported += am
```

The industry's "production" statistic counts cargo taken out of `waiting` here, not what
`ProduceIndustryGoods` adds. Cargo taken out with no station nearby is lost. A coal mine has 6–10
tiles, so `waiting` is checked several times per 256 ticks.

Construction (`MakeIndustryTileBigger`): each visit `counter + 1`; at 4 the counter resets and the
stage goes up; stage `INDUSTRY_COMPLETED = 3` marks the tile complete. World generation creates tiles
with counter 3 and stage 2 (`DoCreateNewIndustry`), so they complete on their first tile-loop
visit.

### 4.12 Industry acceptance (`industry_cmd.cpp:AddAcceptedCargo_Industry`)

```
for i over tile spec slots: cargo = accepts_cargo[i]; a = acceptance[i] (signed eighths)
  if cargo valid and a > 0:
    acceptance[cargo] += a
    if the industry itself does not accept cargo: set always_accepted bit
```

A power-station chimney (gfx 8) adds coal 8 and passengers 1. Coal delivered is handled by
`economy.cpp:DeliverGoodsToIndustry`: `accepted.waiting += amount` (max 0xFFFF),
`history[THIS_MONTH].accepted += amount`, `last_accepted = today`. Then
`TriggerIndustryProduction` converts `waiting × input_cargo_multiplier / 256` into produced cargo.
The power station has no produced cargo, so `waiting` is just set to 0.

### 4.13 Industry placement at world generation (`industry_cmd.cpp:GenerateIndustries`)

```
if industry_density == ID_FUND_ONLY: return
per type: chance = appear_creation[landscape] * 16, then Map::ScaleBySize (ScaleBySize1D for
          refinery/oil rig); force_one = chance > 0 and no NoBuildMapCreation behaviour
total = p.total * GetNumberOfIndustries() / (land_total + water_total)
land: total = ScaleByLandProportion(total) unless custom; total = max(total, num_forced)
first place one of every forced type (PlaceInitialIndustry(type, try_hard = true)),
then the rest by weighted random type (try_hard = false)
GetNumberOfIndustries = ScaleBySize({0, 0, 10, 25, 55, 80, custom}[industry_density])
```

`PlaceIndustry`: up to 10000 (try_hard) or 2000 random tiles, calling
`CreateNewIndustry(RandomTile(), type)`, which picks a random layout and calls
`CreateNewIndustryHelper`. That runs, in order:

1. `CheckIfFarEnoughFromConflictingIndustry`: no `conflicting` industry whose north tile is within
   `DistanceMax <= 14`. **The coal mine and the power station conflict with each other.**
2. `FindTownForIndustry`: `town = ClosestTownFromTile`. If `multiple_industry_per_town` is false
   (default), fail when that town already has an industry of this type.
3. `CheckIfIndustryIsAllowed`: town-size or near-town rules (not used by these two types).
4. `CheckIfIndustryTilesAreFree`: every layout tile is valid and on the map, has no vehicle and no
   bridge above, is not water (for land industries), and can be cleared with `Auto` (no houses).
5. `check_proc` (CHECK_NOTHING), then slope check (`IsSlopeRefused`; flat tiles always pass).
   `CheckIfCanLevelIndustryPlatform` applies only with TerraGenesis; on a flat map it changes
   nothing.

Then `DoCreateNewIndustry` clears the tiles and writes them. `stations_near` is filled later
(`PopulateStationsNearby` is not called while `_generating_world`).

### 4.14 Production changes (skipped in Stage 1)

`_economy_industries_monthly`: `UpdateIndustryStatistics` (history rotation, `last_prod_year`),
delete if `prod_level == PRODLEVEL_CLOSURE`, else `ChangeIndustryProduction(i, monthly = true)`.
`_economy_industries_daily`: a scaled number of daily changes. Each one is either a new industry
(3–9 % chance) or `ChangeIndustryProduction(random industry, false)`. The original economy uses the
monthly path (×2 or ÷2 `prod_level`, chances 1/3 with a 60 % transported threshold). The smooth
economy (default) uses the daily path: a 1/22 chance of ±3–23 %, direction set by `PctTransported >
153` (60 %), with closure when the rate reaches 1. A black-hole industry (power station) never
changes.

## 5. Defaults

| Setting                                  | Default                               | Source                                            | Effect here                                                   |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| `game_creation.landscape`                | 0 (temperate)                         | `world_settings.ini`                              | Temperate houses and industries                               |
| `game_creation.starting_year`            | 1950 (`DEF_START_YEAR`)               | `world_settings.ini`, `timer/timer_game_common.h` | Which house types exist (table 4.7, bold)                     |
| `game_creation.map_x`, `map_y`           | 8, 8 (256×256)                        | `world_settings.ini`                              | `ScaleBySize` factor 1                                        |
| `difficulty.number_towns`                | 2 (normal → 23)                       | `difficulty_settings.ini`                         | 23 + (0..7) towns on 256²                                     |
| `game_creation.custom_town_number`       | 1                                     | `world_settings.ini`                              | Only if number_towns = 4                                      |
| `economy.town_layout`                    | `TL_ORIGINAL`                         | `economy_settings.ini`                            | Road pattern of the initial build                             |
| `economy.larger_towns`                   | 4 (1 in 4 towns is a city)            | `economy_settings.ini`                            | City flag                                                     |
| `economy.initial_city_size`              | 2                                     | `economy_settings.ini`                            | City initial size ×2                                          |
| `economy.town_cargogen_mode`             | `TCGM_BITCOUNT` (1)                   | `economy_settings.ini`                            | Linear (binomial) formula                                     |
| `economy.town_cargo_scale`               | 100 (`DEF_CARGO_SCALE`, range 15–300) | `economy_settings.ini`, `economy_type.h`          | No scaling                                                    |
| `economy.industry_cargo_scale`           | 100                                   | `economy_settings.ini`                            | No scaling                                                    |
| `economy.type`                           | `ET_SMOOTH` (1)                       | `economy_settings.ini`                            | Randomised initial rate, daily changes                        |
| `difficulty.economy` (recessions)        | false                                 | `difficulty_settings.ini`                         | Never halves production                                       |
| `difficulty.industry_density`            | `ID_NORMAL` (4 → 55 on 256²)          | `difficulty_settings.ini`                         | Industry count                                                |
| `economy.multiple_industry_per_town`     | false                                 | `economy_settings.ini`                            | One industry of a type per closest town                       |
| `economy.allow_town_roads`               | true                                  | `economy_settings.ini`                            | Town house rebuilding may build roads                         |
| `economy.town_growth_rate`               | 2 (normal)                            | `economy_settings.ini`                            | Later stage                                                   |
| `economy.fund_buildings`                 | true                                  | `economy_settings.ini`                            | Later stage                                                   |
| `construction.raw_industry_construction` | 0 (not allowed)                       | `world_settings.ini`                              | Players cannot fund coal mines                                |
| `game_creation.land_generator`           | 1 (TerraGenesis)                      | `world_settings.ini`                              | Platform levelling check (no effect on flat map)              |
| `order.selectgoods`                      | true                                  | `game_settings.ini`                               | Cargo reaches a station only after a vehicle tried to load it |
| `station.serve_neutral_industries`       | true                                  | `game_settings.ini`                               | Oil rigs only                                                 |

## 6. Stage 1 needs

- House tile type with the fields in 3 (town index, type, completed flag, construction counter/stage).
- `HouseSpec` rows for temperate houses valid in 1950 (table 4.7), including the stadium's 4 tiles.
- `TileLoop_Town`: construction progress and passenger generation with `TCGM_BITCOUNT`. Keep
  `TCGM_ORIGINAL` as a switch if cheap. `TownGenerateCargo` with recession and cargo scale as
  identity at the defaults, `MoveGoodsToStation` from stations-cargo.md, and town `supplied`
  history with the monthly rotation.
- `AddAcceptedCargoOfHouse` / `AddAcceptedCargo_Industry` values for station acceptance.
- Town creation: `TownCanBePlacedHere` (edge 12, Manhattan 20, flat clear/trees), `DoCreateTown`
  size rule (8..23, cities ×2), `UpdateTownRadius`, `GetTownRadiusGroup`, `TryBuildTownHouse`,
  `BuildTownHouse`, `UpdateTownMaxPass`. On a flat map with no slopes: skip terraforming, bridges,
  tunnels, coastal search (unless the random tile is water), height checks.
- Industry: coal mine and power station specs and layouts, `ProduceIndustryGoods` every 256 ticks,
  `TransportIndustryGoods` per tile loop, tile construction stages, `stations_near`, produced
  history with the monthly rotation, and delivery to the power station (`waiting` reset).
- Industry placement: random tile + random layout, tiles free/clearable, not water, conflicting
  distance > 14 between the mine and the station, closest town recorded.

## 7. Skipped

- Town growth (`TownTickHandler`, `UpdateTownGrowth`, house replacement in `TileLoop_Town`): later
  stage. Hook: `IsGrowing` never gets set, so `TileLoop_Town` never replaces houses.
- Town ratings, authority actions (advertise, fund buildings, road rebuild, statue, exclusive
  rights, bribe), noise: later stage. "Fund buildings" only changes growth speed and makes
  `GetTownRadiusGroup` return Centre within distance² 25. Skipped.
- Town cargo goals, `received` statistics, food/water goals (other climates).
- Industry production changes, closure and new industries during the game (`ChangeIndustryProduction`,
  daily/monthly timers, `IndustryBuildData`): later stage.
- Other industry types, farms (fields), lumber mill, oil rig and neutral stations.
- NewGRF callbacks for houses and industries, animation triggers, sounds, smoke effects, subsidence.
- Terrain-height-dependent rules (slopes, snow line, `LevelTownLand`, TerraGenesis platform check).
- Town names (`GenerateTownName`) – see open questions.

## 8. Open questions

1. **Town roads.** The initial town build is road-driven. `GrowTown` builds a town road at the
   centre first, and houses are only placed next to town roads (`GrowTownInTile`). With roads not
   allowed and no existing road, `GrowTown` builds nothing and `CreateRandomTown` deletes the town.
   Stage 1 has no road tile type. Do we add a passive town-road tile (built and drawn, never used
   by vehicles), or replace the initial build with a road-less house-placement rule? If we
   replace it, which rule?
2. **Number of towns and industries.** The defaults give 23–30 towns and about 55 industries on
   256×256. Stage 1 says "a few towns" and exactly one coal mine and one power station. What count
   (or setting) should Stage 1 use, and do we keep `GetDefaultTownsForMapSize` with a custom value?
3. **Conflicting-industry rule.** Original placement forbids the coal mine and power station within
   `DistanceMax <= 14` of each other. Keep this rule in Stage 1, or place them by a scenario rule?
4. **Initial production rate.** With the default `ET_SMOOTH` the coal mine's rate is randomised to
   7..22 at creation. Since Stage 1 skips production changes, should we keep the smooth-economy
   randomisation, or use `ET_ORIGINAL` behaviour (fixed 15)?
5. **Mail.** Houses generate mail with the same formulas. With `selectgoods` on, mail never reaches
   a station unless a vehicle tried to load mail there. Should Stage 1 generate mail (town stats
   only), or leave it out?
6. **Random number generator.** Do we need OpenTTD's exact `Random()` sequence, and the order of
   draws in `TileLoop_Town`, `DoCreateTown` and `DoCreateNewIndustry`, for reproducible maps? Or is
   any seeded RNG fine?
7. **Town names.** Which name generator and default `town_name` style should Stage 1 use? (Not
   covered by this note.)
8. **Year filter.** Stage 1 fixes the start year at 1950 and towns do not grow. Should only the
   1950-valid house types (bold in 4.7) be ported, or the full temperate table for later stages?
9. **World-generation tile loop.** Original runs `RunTileLoop` 1280 times after generation, which
   advances house and industry construction. Should Stage 1 do the same, or create all houses and
   industry tiles already complete? The original leaves 1 in 7 houses unfinished.
