# Town building at world generation

Companion to [towns-industries.md](towns-industries.md) (its §4.8 is the summary; this note is
the full algorithm). Road tile bit layouts and the road-building commands live in `roads.md`;
here road helpers are called by name. Source: OpenTTD 15.3, `reference/OpenTTD/src`.

## 1. Purpose

At world generation OpenTTD creates N towns. Each town is found on a flat clear tile, given a
name, then "grown" `4 * x` times with the same `GrowTown` routine used for in-game growth: the
growth walks the town's roads, builds road pieces and drops houses next to them. After the loop
the town is kept only if its completed houses give population > 0. Stage 1 runs this once and
never grows towns during play.

Conventions used below. Tile = (x, y); `TileXY(x, y) = y * MapSizeX + x`. DiagDirection (`map.cpp:
_tileoffs_by_diagdir`): NE = 0 offset (-1, 0); SE = 1 offset (0, +1); SW = 2 offset (+1, 0);
NW = 3 offset (0, -1). `reverse(d) = d ^ 2`; `right(d) = (d + 1) & 3`; `left(d) = (d + 3) & 3`.
`bit(d)` is the road bit with the same name as `d` (`road_func.h:DiagDirToRoadBits`: NW 1, SW 2,
SE 4, NE 8). `ROAD_X = SW|NE`, `ROAD_Y = NW|SE`, `ROAD_N = NE|NW`, `ROAD_E = NE|SE`,
`ROAD_S = SE|SW`, `ROAD_W = NW|SW` (`road_type.h`). 8-direction offsets (`map.cpp:
_tileoffs_by_dir`): N (-1,-1), NE (-1,0), E (-1,+1), SE (0,+1), S (+1,+1), SW (+1,0), W (+1,-1),
NW (0,-1).

## 2. Source files

| File (under `src/`)                                                                       | Content used here                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `genworld.cpp`                                                                            | `_GenerateWorld`: order of `GenerateTowns`, industries, tile loop                                                                                                                                                                                                                                                                       |
| `town_cmd.cpp`                                                                            | `GenerateTowns`, `CreateRandomTown`, `DoCreateTown`, `TownCanBePlacedHere`, `GrowTown`, `GrowTownAtRoad`, `GrowTownInTile`, `IsRoadAllowedHere`, `IsNeighbourRoadTile`, `CanFollowRoad`, `GenRandomRoadBits`, `TryBuildTownHouse`, `BuildTownHouse`, `MakeTownHouse`, `UpdateTownRadius`, `GetTownRadiusGroup`, `Town::UpdateVirtCoord` |
| `town.h`, `town_type.h`                                                                   | `Town`, `TownFlag`, `TownLayout`, `TownSize`, `TownExpandMode`, `CUSTOM_TOWN_NUMBER_DIFFICULTY = 4`                                                                                                                                                                                                                                     |
| `house.h`, `table/town_land.h`                                                            | `HouseSpec`, `BuildingFlag`, `HouseZone`, `_original_house_specs` (macro `MS`)                                                                                                                                                                                                                                                          |
| `town_map.h`                                                                              | `MakeHouseTile`, `IncHouseConstructionTick`                                                                                                                                                                                                                                                                                             |
| `townname.cpp`, `townname_func.h`, `townname_type.h`, `table/townname.h`                  | name generation, uniqueness, English (Original) tables                                                                                                                                                                                                                                                                                  |
| `core/random_func.hpp/.cpp`                                                               | `Randomizer::Next`, `RandomRange`, `Chance16`                                                                                                                                                                                                                                                                                           |
| `map_func.h`, `map.cpp`, `tile_map.h`, `tilearea_type.h`, `tilearea.cpp`, `water_map.cpp` | `RandomTile`, `ScaleBySize`, `ScaleByLandProportion`, `DistanceFromEdge`, `SpiralTileSequence`, `GetClosestWaterDistance`, `IsValidTile`                                                                                                                                                                                                |
| `road.cpp`                                                                                | `CleanUpRoadBits` (called by `GrowTownInTile`; owned by roads.md)                                                                                                                                                                                                                                                                       |
| `table/settings/{difficulty,economy,world}_settings.ini`                                  | defaults (§5)                                                                                                                                                                                                                                                                                                                           |

`newgrf_house.cpp` is not on the vanilla path: `TryBuildTownHouse` only calls it when
`hs->callback_mask` has `AllowConstruction`, which no original house sets (`MS` passes
`HouseCallbackMasks{}`).

The brief mentions `_house_more_flags`. It does not exist in 15.3. The equivalent is
`HouseSpec::extra_flags` (`house.h:HouseExtraFlag`); `MS` sets it to `{}` for all 110 originals, so
no original house is "historical" or "protected".

## 3. State

New in this note (the Town and house-tile layouts are in towns-industries.md §3).

Fields of `Town` written at creation (`town_cmd.cpp:DoCreateTown`): `xy`, `cache.num_houses`,
`cache.population`, `cache.squared_town_zone_radius[5]`, `time_until_rebuild = 10`, `flags` (cleared;
`HasChurch`, `HasStadium` set when those houses are built), `grow_counter = index % 70`
(`Ticks::TOWN_GROWTH_TICKS`), `growth_rate = TownTicksToGameTicks(250)` (then overwritten by
`UpdateTownGrowthRate`), `ratings[c] = RATING_INITIAL = 500`, `layout`, `larger_town`,
`townnameparts` (the 32-bit name seed), `townnametype`/`townnamegrfid` (built-in generator 0),
`fund_buildings_months = 0`.

Per-town working state of the generator: the set of names already used (`TownNames`, a set of
strings), `current_number` (towns created so far), `city_random_offset`.

Tile types the growth reads: void, water (incl. coast), clear (with ground type), trees (with
ground type), house, industry, road, plus rail/station/bridge/tunnel/object (not in Stage 1).

## 4. Rules and formulas

Notation: `R(n)` = `RandomRange(n)` = `(uint64(Random()) * n) >> 32` (`random_func.hpp:RandomRange`,
`ScaleToLimit`). `C(a,b)` = `Chance16(a,b)` = `(((uint16)Random() * b + b/2) >> 16) < a`
(`Chance16I`), i.e. it uses only the low 16 bits. Every `R` and `C` consumes exactly one `Random()`.
`Random()` = `_random.Next()`:
`s = state[0]; t = state[1]; state[0] = s + rotr32(t ^ 0x1234567F, 7) + 1; return state[1] = rotr32(s, 3) - 1`;
`SetSeed(seed)` sets both words to `seed` (`core/random_func.cpp:Randomizer::Next, SetSeed`).
`genworld.cpp:_GenerateWorld` seeds it with `generation_seed` before landscape generation.

### 4.1 Call order (`genworld.cpp:_GenerateWorld`)

`SetSeed` -> `StartupEconomy` -> `CheckTownRoadTypes` (a town-buildable road type must exist at
the start date) -> `GenerateLandscape` -> `GenerateClearTile`, `Map::CountLandTiles` ->
`GenerateTowns(economy.town_layout)` -> `GenerateIndustries` -> `GenerateObjects` ->
`GenerateTrees` -> ... -> `_generating_world = false` -> `RunTileLoop` x 0x500. Towns are
therefore built before industries and trees, on a map of only clear tiles and water, and
`_generating_world` is true during all of §4.2-4.9 (it only affects the house construction state,
§4.11, and removes terraforming in `IsRoadAllowedHere`).

### 4.2 `town_cmd.cpp:GenerateTowns(layout, number = nullopt)`

```
if number given:                         total = number                      // editor "random towns" only
elif difficulty.number_towns == 4:       total = GetDefaultTownsForMapSize() // = game_creation.custom_town_number
else: total = ScaleByLandProportion(GetDefaultTownsForMapSize() + (Random() & 7))   // 1 draw
total = Clamp(total, 1, 64000)                       // TownPool::MAX_SIZE
town_names = { names of towns already on the map }   // empty at world generation
city_random_offset = larger_towns == 0 ? 0 : Random() % larger_towns             // 1 draw (only if != 0)
current_number = 0
do (total times, "continue" jumps to the --total test):
    city = larger_towns != 0 && ((city_random_offset + current_number) % larger_towns) == 0
    if !GenerateTownName(_random, &parts, &town_names): continue     // name failed: iteration lost
    if CreateRandomTown(20, parts, TSZ_RANDOM, city, layout) != null: current_number++
RebuildTownKdtree()                                  // rebalance only
if current_number != 0: return true
// last resort, nothing was created:
if GenerateTownName(_random, &parts) && CreateRandomTown(10000, parts, TSZ_RANDOM, larger_towns != 0, layout): return true
error "could not create town" (world generation aborts)
```

- `GetDefaultTownsForMapSize`: custom -> `custom_town_number`; else
  `Map::ScaleBySize({5, 11, 23, 46}[number_towns])`.
- `map_func.h:Map::ScaleBySize(n) = CeilDiv(n << (LogX + LogY - 12), 16)`; 256x256 gives `n`,
  128x128 gives `ceil(n / 4)`.
- `map_func.h:Map::ScaleByLandProportion(n) = n * initial_land_count / map_size` (64-bit), with
  `initial_land_count = min(size, land + land / 12)` (`map.cpp:Map::CountLandTiles`; land = tiles
  that are not water tiles, void included).
- City flag uses `current_number` (successes so far), not the loop index. A failed creation
  keeps the same `current_number`, so the next iteration has the same city flag.
- `GenerateTownName` runs before `CreateRandomTown`; the chosen name is inserted into
  `town_names` even if `CreateRandomTown` then fails (see §4.12), so a name is "burnt".
- `larger_towns` default 4 means one city in four; city size is in §4.5.

### 4.3 `town_cmd.cpp:CreateRandomTown(attempts, parts, size, city, layout)`

```
do (attempts times; "continue" goes to the --attempts test):
    tile = AlignTileToGrid(RandomTile(), layout)         // RandomTile = Random() & tile_mask (1 draw)
         // AlignTileToGrid: TL_2X2_GRID: (x - x%3, y - y%3); TL_3X3_GRID: (x & ~3, y & ~3); else unchanged
    if tile type is MP_WATER:                            // sea, coast, rivers, canals
        tile = FindNearestGoodCoastalTownSpot(tile, layout); if INVALID_TILE: continue
    elif TownCanBePlacedHere(tile, check_surrounding = true) fails: continue
    t = new Town(tile)                                   // pool index = lowest free index
    DoCreateTown(t, tile, parts, size, city, layout, manual = false)
    if t.cache.population > 0: return t
    CMD_DELETE_TOWN(t)                                   // see below
return null
```

If a town ends with no population it is deleted (`CmdDeleteTown`): every tile whose
`GetTownIndex` is this town and that is a town-owned road or a house is cleared by
`CMD_LANDSCAPE_CLEAR` (the map is scanned twice, bridges first), then the town leaves the
kd-tree and is freed. Random numbers it consumed stay consumed, and the failed attempt uses up
one of the 20 attempts. There is no minimum house count: population > 0 needs at least one
**completed** house with `population > 0` (parks, statues and houses still under construction add
nothing, §4.11). A surviving town may therefore have just a few houses.

`FindNearestGoodCoastalTownSpot(tile, layout)` (only when the random tile is water):

```
for coast in SpiralTileSequence(tile, 40):               // diameter 40, order in §4.13
    if tile type of coast != MP_CLEAR: continue
    furthest = INVALID_TILE; max_dist = 0
    for test in SpiralTileSequence(coast, 10):
        if test not MP_CLEAR or not flat or not IsTileAlignedToGrid(test, layout): continue
        if TownCanBePlacedHere(test, true) fails: continue
        dist = GetClosestWaterDistance(test, true)
        if dist > max_dist: furthest = test; max_dist = dist     // first maximum wins
    return furthest                                       // returns after the FIRST clear tile found
return INVALID_TILE
```

`water_map.cpp:GetClosestWaterDistance(tile, true)`: 0 if the tile itself has water ground
(`HasTileWaterGround`); otherwise the smallest Manhattan distance to a tile with water ground,
searching diamond rings `dist = 1 .. 0x7F - 1` and skipping tiles outside `[1, MaxX) x [1, MaxY)`
(freeform edges); `0x7F` if none. It uses no random numbers. It prefers a site far from the sea.

### 4.4 `town_cmd.cpp:TownCanBePlacedHere(tile, check_surrounding)`

```
if DistanceFromEdge(tile) < 12:                       fail         // min(x, y, MaxX-1-x, MaxY-1-y)
if IsCloseToTown(tile, 20):                           fail         // nearest town xy has Manhattan distance < 20
if tile not (MP_CLEAR or MP_TREES) or not flat:       fail
if check_surrounding:
    h = GetTileZ(tile); counter = 0
    for t in SpiralTileSequence(tile, 5):             // 5x5 square, 25 tiles, centre included
        if counter == 12: break                       // VALID_TILE_GOAL = 25/2
        MP_CLEAR: skip if ground == CLEAR_ROUGH ; MP_TREES: skip if tree ground == TREE_GROUND_ROUGH
        any other tile type (incl. water, house, road, void): skip
        if GetTileMaxZ(t) <= h + 1 && GetTileZ(t) >= h - 1: counter++
    if counter < 12: fail
```

`IsCloseToTown` uses the town kd-tree whose metric is Manhattan (`core/kdtree.hpp:
ManhattanDistance`), so it equals "minimum Manhattan distance to any town centre < 20". Because the
break is at 12, the result equals "at least 12 of the 25 tiles qualify"; the visiting order does not
change it. Sea tiles never qualify, so sites within 2 tiles of water need 12 dry flat tiles.

### 4.5 `town_cmd.cpp:DoCreateTown(t, tile, parts, size, city, layout, manual)`

```
t.xy = tile; t.num_houses = 0; t.time_until_rebuild = 10; t.population = 0; t.flags = {}
t.grow_counter = t.index % 70; t.growth_rate = TownTicksToGameTicks(250)
t.ratings[*] = 500; t.townnameparts = parts; t.fund_buildings_months = 0
t.layout = layout, or for TL_RANDOM: TileHash(x, y) % 4   (town.cpp:InitializeLayout; no random draw)
t.larger_town = city
x = size * 16 + 3                         // TSZ_SMALL 3, MEDIUM 19, LARGE 35 (not used at world generation)
if size == TSZ_RANDOM: x = (Random() & 0xF) + 8        // 8 .. 23   (1 draw, the first draw of the town)
if city and (!manual or editor): x *= economy.initial_city_size       // default 2 -> 16 .. 46
t.num_houses += x                         // the "pretend bigger" fudge
UpdateTownRadius(t)
i = x * 4
do: GrowTown(t, {Buildings, Roads}) while --i != 0       // return value ignored
t.UpdateVirtCoord()
t.num_houses -= x                         // = number of houses actually built
UpdateTownRadius(t); UpdateTownGrowthRate(t); UpdateTownMaxPass(t)
```

- `TileHash(x, y)` (`tile_map.h`) = `((x >> 4) ^ (x >> 6) ^ (y >> 4)) - (y >> 6)` in `uint`, so
  `% 4` of an unsigned wrapped value. `TL_RANDOM` is selectable (setting range 0..4) but the
  default is `TL_ORIGINAL`.
- `GrowTown` is called `4x` times whether or not earlier calls built anything. 32..92 calls for a
  town, 64..184 for a city (default).
- While building, `cache.num_houses = x + houses_built_so_far`. This inflated value drives both the
  walk length (§4.7) and the zone radii (§4.10), so early houses see a town "of final size".
- `UpdateTownMaxPass` only writes the LAST_MONTH `production` of passengers (`population >> 3`)
  and mail (`population >> 4`) (towns-industries.md §4.4); `UpdateTownGrowthRate` is growth
  only (§7).

### 4.6 `town_cmd.cpp:GrowTown(t, modes)`

```
_town_coord_mod = [(-1,0),(1,1),(1,-1),(-1,-1),(-1,0),(0,2),(2,0),(0,-2),(-1,-1),(-2,2),(2,2),(2,-2),(0,0)]  // (dx, dy), 13 entries
tile = t.xy
for each entry (dx, dy):                               // check first, then step
    if GetTownRoadBits(tile) != NONE: return GrowTownAtRoad(t, tile, modes)
    tile += (dx, dy)
// no road in any probed tile; the visited tiles (relative to t.xy) are, in order:
//  (0,0) (-1,0) (0,1) (1,0) (0,-1) (-1,-1) (-1,1) (1,1) (1,-1) (0,-2) (-2,0) (0,2) (2,0)
if Roads allowed:
    tile = t.xy
    for each entry:                                    // same 13 tiles, same order
        if tile is not a house and is flat:
            if CMD_LANDSCAPE_CLEAR(Auto, NoWater) on tile succeeds:
                CMD_BUILD_ROAD(Execute, Auto) at tile with GenRandomRoadBits() as town t     // 1 draw
                return true
        tile += (dx, dy)
return false
```

`GetTownRoadBits(tile)` = road bits of the tile (`GetAnyRoadBits(tile, RTT_ROAD, true)`), none for
depots and bay road stops. `GenRandomRoadBits`: `r = Random(); a = r & 3; b = (r >> 8) & 3;
if a == b: b ^= 2; bits = (1 << a) | (1 << b)` over the order [NW, SW, SE, NE]. Result: 50 % a
straight piece (X or Y), 50 % a curve (N/E/S/W, 1/8 each). `_current_company` is `OWNER_TOWN` for
the whole call (`Backup<CompanyID>`), so roads are town-owned and carry `t.index`.

So the **first** call of a new town puts a random 2-bit road on the centre tile `t.xy` (it passed
`TownCanBePlacedHere`, so it is a clear/trees flat tile). Every later call enters
`GrowTownAtRoad` at the centre (or the first probed tile that has road).

### 4.7 `town_cmd.cpp:GrowTownAtRoad(t, tile, modes)`

```
target_dir = DIAGDIR_END (4)                           // "no previous direction"
iterations = 10 + t.num_houses * 4 / 9                 // TL_ORIGINAL, integer division; num_houses includes the +x fudge
do:                                                    // runs iterations + 1 passes
    cur_rb = GetTownRoadBits(tile)
    switch GrowTownInTile(&tile, cur_rb, target_dir, t, modes):
        Succeed:       return true
        SearchStopped: iterations = 0                   // one more step below is still taken, then the loop ends
        Continue:      pass
    if target_dir is a real direction: cur_rb &= ~bit(reverse(target_dir))      // cannot walk back
    if cur_rb == NONE: return false
    if tile is tunnel/bridge: target_dir = reverse(tunnel/bridge direction)     // not Stage 1
    else:
        do:
            if cur_rb == NONE: return false
            do target_dir = R(4) while !(cur_rb & bit(target_dir))              // rejection sampling, 1 draw per try
            cur_rb &= ~bit(target_dir)
        while !CanFollowRoad(tile, target_dir, modes)
    tile += offset(target_dir)
    if tile is a non-depot road tile owned by OWNER_TOWN and Town::GetByTile(tile) != t: return false
while --iterations >= 0
return false
```

`CanFollowRoad(tile, dir, modes)` with Roads allowed: `target = tile + offset(dir)`; false if not
`IsValidTile` (off map or void) or `HasTileWaterGround(target)`; then by type: road tile -> true iff
it has road bits (`GetTownRoadBits != NONE`); station -> drive-through road stop only; tunnel/bridge
-> road; house, industry, object -> false; any other type (clear, trees, rail...) -> true. So the walk
can step onto empty clear/trees tiles; `GrowTownInTile` then decides whether to build there.

### 4.8 `town_cmd.cpp:GrowTownInTile(&tile, cur_rb, target_dir, t, modes)` for TL_ORIGINAL

Returns `Succeed` (something was built), `SearchStopped` (end the walk) or `Continue`. Three
branches, chosen in this order.

**Branch A: `cur_rb == NONE`** (the walk stepped onto a tile without road).

```
if Roads not allowed: SearchStopped                                 // not at world generation
if !construction.build_on_slopes (default true) || C(1,6): LevelTownLand(tile)   // draw happens: build_on_slopes is true; LevelTownLand does nothing on a flat tile
if !IsRoadAllowedHere(t, tile, target_dir): SearchStopped
source_dir = reverse(target_dir)
if C(1,4):                                                          // 25 %: turn or re-roll
    do target_dir = R(4) while target_dir == source_dir             // may equal the old direction
if !IsRoadAllowedHere(t, tile + offset(target_dir), target_dir):    // the road could not continue
    if target_dir != reverse(source_dir): SearchStopped             // a curve: stop
    // straight: allowed only if a house touches either side of this tile
    if tile+offset(right(target_dir)) and tile+offset(left(target_dir)) are both not MP_HOUSE: SearchStopped
rcmd = bit(target_dir) | bit(source_dir)
-> common ending (below)
```

**Branch B: `cur_rb != NONE`, `target_dir < 4`, and `cur_rb` has no `bit(reverse(target_dir))`**
(the walk arrived at a road tile that is not connected back to where it came from).

```
if !TownCanGrowRoad(tile): Continue                  // always true in Stage 1 (one road type)
if Roads not allowed: SearchStopped
rcmd = bit(reverse(target_dir))                      // add the missing connection; no random draw
-> common ending
```

**Branch C: otherwise** (this is also the branch of the very first pass, `target_dir == 4`, and of a
tile reached by a connected road). It builds a house beside the road, or extends the road.

```
target_dir = R(4); target_rb = bit(target_dir)                                       // draw
if cur_rb & target_rb:                                // the road already goes that way
    if (cur_rb & ROAD_X) != target_rb: Continue        // only X-axis picks (NE, SW) with exactly that X bit go on
    // cur_rb must be a 2-bit curve; the house goes on the outer diagonal tile:
    ROAD_N -> house_tile = tile + (+1,+1)  [DIR_S];  ROAD_S -> tile + (-1,-1) [DIR_N]
    ROAD_E -> house_tile = tile + (+1,-1)  [DIR_W];  ROAD_W -> tile + (-1,+1) [DIR_E]
    any other cur_rb: Continue
    target_dir = 4                                     // marks the corner case (no road extension possible)
else:
    house_tile = tile + offset(target_dir)
if HasTileWaterGround(house_tile) or !IsValidTile(house_tile): Continue
result = Continue
if target_dir != 4 and Roads allowed:
    rcmd = target_rb
    allow_house = !IsRoadAllowedHere(t, house_tile, target_dir) || C(6,10)           // draw only if the road IS allowed; 60 % house
else:
    allow_house = true                                 // corner case, or Buildings-only mode
allow_house &= RoadTypesAllowHouseHere(house_tile)    // true in Stage 1 (no road type has NoHouses; only the tram type does)
if allow_house:
    if house_tile is not MP_HOUSE:
        if C(1,6): LevelTownLand(house_tile)           // draw; no effect on flat land
        if TryBuildTownHouse(t, house_tile, modes): result = Succeed
    return result                                      // house path never extends the road
if !TownCanGrowRoad(tile): return result
-> common ending                                       // 40 %: extend the road with rcmd = target_rb
```

Each pass over a road tile picks one random side: a tile with a road on that side gives `Continue`; an empty side gets a
house with 60 % (if the road may extend there) or always (if it may not), otherwise the road grows a
stub toward it. Corner houses have the same chance as a side house (`ROAD_X` argument above).

**Common ending** (all three branches that did not return):

```
if HasTileWaterGround(tile): SearchStopped
rcmd = CleanUpRoadBits(tile, rcmd)       // roads.md: drops bits that point at a non-connective neighbour
                                         //   (house, industry, void, real water; clear/trees are connective)
if rcmd == NONE: SearchStopped
if GrowTownWithBridge(t, tile, target_dir): Succeed      // flat tile + sea ahead: always false, no draws; not Stage 1
if GrowTownWithTunnel(t, tile, target_dir): Succeed      // needs a slope: false on flat land
if GrowTownWithRoad(t, tile, rcmd): Succeed              // CMD_BUILD_ROAD(Execute, Auto, NoWater) at tile, rcmd bits, town road type, town t
SearchStopped
```

`GrowTownWithRoad` is a thin wrapper over the road-building command; what that command accepts or
rejects is in roads.md. The walk never builds a bit pointing at a house, industry or map edge
(`CleanUpRoadBits`), so roads on a Stage 1 map end in stubs next to buildings.

### 4.9 Road permission helpers

`town_cmd.cpp:IsRoadAllowedHere(t, tile, dir)`:

```
if DistanceFromEdge(tile) == 0: false
if bridge above tile along dir's axis: false                     // not Stage 1
if GetTownRoadBits(tile) == NONE:
    // the tile must be able to take a road or be clearable:
    if CMD_BUILD_ROAD(Auto, NoWater, tile, (dir is NW/SE) ? ROAD_Y : ROAD_X, town type) fails
       and CMD_LANDSCAPE_CLEAR(Auto, NoWater, tile) fails: false
slope = build_on_slopes ? foundation slope : tile slope
ret = !IsNeighbourRoadTile(tile, dir, layout == TL_ORIGINAL ? 1 : 2)
if slope == FLAT: return ret                                       // flat: no random draw in this function
(sloped tile: C(1,8), maybe terraform, C(1,3): not Stage 1)
```

Checked types of `CMD_LANDSCAPE_CLEAR(Auto, NoWater)`: clear and trees succeed; house fails
(`ClearTile_Town`: must be demolished); industry fails (`ClearTile_Industry`); water fails (`NoWater`);
a road tile with two or more road bits fails, and one with exactly one bit is
clearable only if `RemoveRoad` agrees (`road_cmd.cpp:ClearTile_Road`, `Auto`; open question 2). The user is `OWNER_TOWN`, so no rating or company checks.
Tile types outside the Stage 1 set are not analysed here.

`town_cmd.cpp:IsNeighbourRoadTile(tile, dir, m)` (parallel-road test; `m = 1` for TL_ORIGINAL):

```
fwd = offset(dir); R = offset(right(dir)); L = offset(left(dir)); back = -fwd
for pos in 4 .. 4*(m+1) - 1:
    k = pos >> 2
    cur = ((pos & 1) ? R : L) * k
    if pos & 2: cur += back
    bit_needed = (pos & 2) ? bit(dir) : bit(reverse(dir))
    if IsValidTile(tile + cur) && (GetTownRoadBits(tile + cur) & bit_needed): return true
return false
```

For `m = 1` this checks four tiles: the left and right neighbours of `tile` for a road bit pointing
back along the axis, and the left and right neighbours of the previous tile for a road bit pointing
forward. In other words, a new road piece may not be built beside an existing parallel road that
touches it. `m = 2` (TL_BETTER_ROADS) adds the same four tiles one step further out (offsets x2).

### 4.10 `town_cmd.cpp:GetTownRadiusGroup`, `UpdateTownRadius`

```
GetTownRadiusGroup(t, tile): d = DistanceSquare(tile, t.xy)       // dx*dx + dy*dy
    if t.fund_buildings_months != 0 && d <= 25: return Centre     // never at world generation
    zone = Edge
    for i in 0..4 (Edge, Outskirt, OuterSuburb, InnerSuburb, Centre):
        if d < t.squared_town_zone_radius[i]: zone = i             // the highest i that fits wins
    return zone
```

`UpdateTownRadius(t)` (called at the start of `DoCreateTown`, after the `+= x`, and in every
`BuildTownHouse`, then after `-= x`): rows `num_houses / 4` of the 23-row table when
`num_houses < 92`, otherwise `mass = num_houses / 8`: Edge `mass*15-40`, Outskirt `mass*9-15`,
OuterSuburb `0`, InnerSuburb `mass*5-5`, Centre `mass*3+5`. The table is in towns-industries.md
§4.8. A radius `0` never matches, since `d < 0` is false.

### 4.11 House building

`town_cmd.cpp:TryBuildTownHouse(t, tile, modes)`:

```
if !TownLayoutAllowsHouseHere(t, tile, modes): false     // Buildings mode needed; grids forbid grid lines; TL_ORIGINAL: true
if !CanBuildHouseHere(tile, noslope = false): false      // see below
slope = tile slope; maxz = GetTileMaxZ(tile)
zones = { GetTownRadiusGroup(t, tile), ClimateTemperate }             // two bits
cand = [ spec for spec in specs (ID order 0..109) if spec.building_availability contains ALL bits of zones
         && spec.enabled && spec.grf_prop.override_id == INVALID && class/id counter != 65535 ]
weights = spec.probability (= 16 for every original); probability_max = sum
while probability_max > 0:
    tile = base_tile
    r = R(probability_max)                                 // 1 draw per candidate tried
    pick first i with cumulative weight > r
    house = cand[i].id; probability_max -= cand[i].weight
    cand[i] = cand.last; cand.pop_back()                   // swap-remove: the order changes
    hs = spec(house)
    if !generating_world && !editor && hs historical: continue        // never true here
    if year < hs.min_year || year > hs.max_year: continue              // checked AFTER the pick
    oneof = hs is church -> HasChurch ; hs is stadium -> HasStadium
    if t.flags has oneof: continue
    noslope = hs has NotSloped; if noslope && slope != FLAT: continue  // no original house sets NotSloped
    if 2x2: CheckTownBuild2x2House(&tile, ...) else continue if false
    elif 2x1: CheckTownBuild2House(&tile, ..., DIAGDIR_SW, ...) else continue
    elif 1x2: CheckTownBuild2House(&tile, ..., DIAGDIR_SE, ...) else continue
    random_bits = Random()                                              // 1 draw
    (AllowConstruction callback: never for originals)
    t.flags |= oneof
    BuildTownHouse(t, tile, hs, house, random_bits, house_completed = false, protected = false)
    return true
return false
```

Consequences. The year, church/stadium and placement tests happen after the weighted pick, so
unavailable houses stay in the weights (`probability_max` is `16 * N` for the full zone list, see
the table below) and are drawn then discarded: the result is "first house of a random permutation
that passes all checks". Each failed candidate costs one draw.

`CanBuildHouseHere(tile, noslope)`: slope is flat (or not steep and, for `noslope`, flat);
`RoadTypesAllowHouseHere(tile)` (check the 8 neighbours for road types with `NoHouses`; true when
there is no road around or at least one neighbour road type allows houses; always true with the
single road type); no bridge above; `CMD_LANDSCAPE_CLEAR(Auto, NoWater)` succeeds (clear, trees, or a
single-bit road stub, see §4.9).

Multi-tile placement (`Size2x1` = two tiles along +x; `Size1x2` = two tiles along +y; `Size2x2`):

- `CheckTownBuild2House(&tile, ..., second)`: try `tile2 = tile + offset(second)` (SW for 2x1,
  SE for 1x2), needing `TownLayoutAllowsHouseHere(tile2)` and `CheckBuildHouseSameZ(tile2, maxz)`;
  else try `tile2 = tile + offset(reverse(second))`, and then the house's northern tile becomes `tile2`.
- `CheckTownBuild2x2House(&tile, ...)`: try the 2x2 block whose northern tile is, in order,
  `tile`, `tile+(0,-1)`, `tile+(-1,-1)`, `tile+(-1,0)`; each needs `TownLayoutAllows2x2HouseHere`
  and `CheckFree2x2Area` (the four tiles `t, t+(0,1), t+(1,1), t+(1,0)` all pass
  `CheckBuildHouseSameZ(.., maxz)`). The first block that passes sets `tile`.
- `CheckBuildHouseSameZ(tile, z)`: `CanBuildHouseHere(tile, noslope)` and `GetTileMaxZ(tile) == z`.

`MakeTownHouse(tile, t, counter, stage, type, bits, protected)` writes every tile:
`ClearMakeHouseTile(tile, ..., type)`, then for `Size1x2`/`Size2x2` `tile+(0,1)` with `++type`, for
`Size2x1`/`Size2x2` `tile+(1,0)` with `++type`, for `Size2x2` `tile+(1,1)` with `++type` (so a
2x2 uses IDs base+0 north, +1 (0,1), +2 (1,0), +3 (1,1)). Each tile is cleared by
`CMD_LANDSCAPE_CLEAR(Execute, Auto, NoWater)` and replaced with a house tile (towns-industries.md §3).
It also adds nearby stations to `stations_near` (none at generation).

`town_cmd.cpp:BuildTownHouse(t, tile, hs, house, bits, house_completed, protected)`:

```
t.num_houses++                                           // once per building, however many tiles
counter = 0; stage = 0
if generating_world || editor || house_completed:        // true at world generation
    cr = Random()                                        // draw 1
    stage = 3                                            // TOWN_HOUSE_COMPLETED
    if generating_world && !hs historical && C(1,7):     // draw 2; "historical" is false for all originals
        stage = cr & 3                                   // 0..3 (3 = completed anyway)
    if stage == 3: ChangePopulation(t, hs.population)    // only the north tile's population is counted
    else:          counter = (cr >> 2) & 3
MakeTownHouse(...); UpdateTownRadius(t); UpdateTownGrowthRate(t)
```

**Construction state at generation.** About 6/7 of houses are complete immediately. With
probability `1/7` (exactly `9362/65536`) the house instead gets `stage = cr & 3`: 3 in a quarter of
those cases (complete), otherwise stage 0..2 with `counter` 0..3, so about `3/28 = 10.7 %` of houses
start under construction (`m5 = stage << 3 | counter`, `town_map.h:MakeHouseTile`) and add no
population yet. Progress needs `24 - (stage*8 + counter)` tile-loop visits
(`IncHouseConstructionTick`, 5-bit counter; towns-industries.md §4.2). The generation tile loop
(`RunTileLoop` x 0x500) visits each tile 5 times, so only stage 2 / counter 3 houses finish before
the game starts; the others finish during play. Houses outside generation (growth) start at stage 0.

**Houses available in temperate, 1950** (`table/town_land.h:_original_house_specs`, parsed from the
source; all `probability = 16`; IDs in hex; E edge, O outskirt, OS outer suburb, IS inner suburb,
C centre). Full candidate counts include houses not yet available in 1950 (they take part in the
weights and the draws):

| Zone | Candidates in the zone (N, any year) | `probability_max` = 16 N | Valid in 1950 (count)                                   |
| ---- | ------------------------------------ | ------------------------ | ------------------------------------------------------- |
| E    | 7                                    | 112                      | 03 church, 06, 14 stadium, 18, 19, 1A (6)               |
| O    | 8                                    | 128                      | 03, 06, 14, 18, 1A (5)                                  |
| OS   | 17                                   | 272                      | 03, 06, 0B, 0E, 0F, 10, 14, 1A, 1B, 1D, 27 (11)         |
| IS   | 20                                   | 320                      | 03, 06, 09, 0C, 0E, 0F, 10, 14, 1A, 1B, 1D, 1F, 27 (13) |
| C    | 21                                   | 336                      | 09, 0A, 0E, 0F, 10, 1B, 1D, 1F, 27 (9)                  |

Rules visible in this list: no 2x1 or 1x2 house exists in 1950 (the hotel 07 starts 1959); the only
multi-tile house is the 2x2 stadium 14 (IDs 14..17, `IsStadium | Size2x2`); at most one church
(03, `IsChurch`) and one stadium per town (`TownFlag::HasChurch`, `HasStadium`; the flag is set as soon
as the house is built, also when it starts under construction). Years: 18 ends 1951, 19 ends 1952,
0E/0F/10 are 1930..1960, 1D ends 1955, so 1950 is inside all of them. Stadium 20 (1958), hotels,
offices and malls are out of year.

### 4.12 Names: English (Original), `townname.cpp`

Default `game_creation.town_name = 0` selects generator 0, `MakeEnglishOriginalTownName`
(`TownNameParams(0)`: `type = SPECSTR_TOWNNAME_START + 0`, `grfid = 0`;
`_town_name_generators[0]`). The name is not stored; the 32-bit seed `townnameparts` is, and the string
is rebuilt on demand (`GetTownName`).

Seed generation (`townname.cpp:GenerateTownName(randomizer, &parts, town_names)`), uniqueness
(`VerifyTownName`):

```
for i = 1000 down to 1:
    r = _random.Next()                    // = Random(); 1 draw per try
    name = GetTownName(par, r)
    if Utf8Length(name) >= 32: continue    // MAX_LENGTH_TOWN_NAME_CHARS; never triggers for this generator (longest is 30)
    if town_names != null:
        if name in town_names: continue
        town_names.insert(name)            // inserted immediately, even if the town is never created
    else:                                  // last-resort path
        compare with every existing town (custom name if set, else generated name): continue on a match
    parts = r; return true
return false                               // GenerateTowns then skips this iteration
```

Uniqueness is on the **string**, not the seed (different seeds can give the same name).

Name from seed (`townname.cpp:MakeEnglishOriginalTownName`, helpers `SeedChance`, `SeedChanceBias`):

```
SeedChance(shift, max, seed)      = (((seed >> shift) & 0xFFFF) * max) >> 16
SeedChanceBias(shift, max, seed, bias) = SeedChance(shift, max + bias, seed) - bias

i = SeedChanceBias(0, 4, seed, 50)            // SeedChance(0, 54) - 50     -> only 0..3 select an entry (4/54 chance, about 7.4 %)
if i >= 0: name  = T1[i]                       // optional prefix
name += T2[SeedChance( 4, 26, seed)]
name += T3[SeedChance( 7,  8, seed)]
name += T4[SeedChance(10,  7, seed)]
name += T5[SeedChance(13, 23, seed)]
i = SeedChanceBias(15, 9, seed, 60)           // SeedChance(15, 69) - 60    -> only 0..8 select an entry (9/69, about 13 %)
if i >= 0: name += T6[i]                       // optional suffix
ReplaceEnglishWords(name, start, original = true)
```

The slices overlap on purpose (bits 0-15, 4-19, 7-22, 10-25, 13-28, 15-30; bit 31 unused), so the
parts are correlated, and the result is a function of the seed only.

| Table (`table/townname.h`)        | Size | Entries                                                                                                                                           |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_name_original_english_1` prefix | 4    | `Great `, `Little `, `New `, `Fort ` (trailing space)                                                                                             |
| `_name_original_english_2`        | 26   | Wr, B, C, Ch, Br, D, Dr, F, Fr, Fl, G, Gr, H, L, M, N, P, Pr, Pl, R, S, S, Sl, T, Tr, W (`S` twice, so it is twice as likely)                     |
| `_name_original_english_3`        | 8    | ar, a, e, in, on, u, un, en                                                                                                                       |
| `_name_original_english_4`        | 7    | n, ning, ding, d, (empty), t, fing                                                                                                                |
| `_name_original_english_5`        | 23   | ville, ham, field, ton, town, bridge, bury, wood, ford, hall, ston, way, stone, borough, ley, head, bourne, pool, worth, hill, well, hattan, burg |
| `_name_original_english_6` suffix | 9    | `-on-sea`, ` Bay`, ` Market`, ` Cross`, ` Bridge`, ` Falls`, ` City`, ` Ridge`, ` Springs`                                                        |

`ReplaceEnglishWords(str, start, original = true)` (`townname.cpp`): each rule replaces only when
the **whole name starts** (at `start`) with the 4- or 2-letter pattern; applied in this order:
`Ce`->`Ke`, `Ci`->`Ki`, `Cunt`->`East`, `Slag`->`Pits`, `Slut`->`Edin`, `Drar`->`Quar`,
`Dreh`->`Bash`, `Frar`->`Shor`, `Grar`->`Aber`, `Brar`->`Over`, `Wrar`->`Inve`. (`Fart`->`Boot` is
skipped for the original generator.) The replacement does not apply after a prefix such as
`Great `. Example: parts `Wr`+`ar`+`n`+`ville` -> `Wrarnville` -> `Inve` + `nville` = `Invenville`.

### 4.13 `SpiralTileSequence(centre, diameter)` order

(`tilearea_type.h`, `tilearea.cpp:SpiralTileIterator`; traced by hand.) Odd diameter `D = 2R+1`:
the centre first, then square rings `r = 1..R`. Ring `r` starts at its west corner
`(cx + r, cy - r)` and goes NE (x decreasing) to `(cx - r, cy - r)`, SE (y increasing) to
`(cx - r, cy + r)`, SW (x increasing) to `(cx + r, cy + r)`, NW (y decreasing) back up to
`(cx + r, cy - r + 1)`; each corner is yielded once. Even diameter: the first block is the 2x2
`{cx, cx+1} x {cy, cy+1}` (start `(cx+1, cy)`, order `(cx+1,cy) (cx,cy) (cx,cy+1) (cx+1,cy+1)`), then
square rings around it with the same traversal, so the south/east side is one tile longer. Tiles with
`x >= SizeX` or `y >= SizeY` (including negative values that wrap) are skipped. The sequence
ends after `D / 2` rings.

### 4.14 Radius and sign basics (display)

- Zone radii and `GetTownRadiusGroup`: §4.10. They are only used by house selection here.
- Town sign (`town_cmd.cpp:Town::UpdateVirtCoord`): anchor `pt = RemapCoords2(x*16, y*16)`,
  i.e. `px = (y*16 - x*16) * 2`, `py = (y*16 + x*16 - z)`, where `z` is the slope pixel height of
  that point (flat land at level `h`: `z = h * 8`, `TILE_HEIGHT = 8`); the sign is placed at
  `(px, py - 24)` in `ZOOM_BASE` units (`landscape.h:RemapCoords`). The label is the generated
  name (cities use `STR_VIEWPORT_TOWN_CITY`).

## 5. Defaults

| Setting                              | Default              | Source                    | Effect here                                                               |
| ------------------------------------ | -------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `difficulty.number_towns`            | 2 (0..4; 4 = custom) | `difficulty_settings.ini` | 23 towns (+ `Random() & 7`) on 256x256, scaled by land                    |
| `game_creation.custom_town_number`   | 1 (1..5000)          | `world_settings.ini`      | Only if `number_towns = 4`                                                |
| `economy.town_layout`                | `TL_ORIGINAL` (0..4) | `economy_settings.ini`    | Road layout, §4.8                                                         |
| `economy.larger_towns`               | 4                    | `economy_settings.ini`    | One city in four (0 = none), range 0..255                                 |
| `economy.initial_city_size`          | 2 (1..10)            | `economy_settings.ini`    | City `x` multiplier                                                       |
| `economy.allow_town_roads`           | true                 | `economy_settings.ini`    | In-game house replacement only; world generation always passes both modes |
| `economy.allow_town_level_crossings` | true                 | `economy_settings.ini`    | Rail only (not Stage 1)                                                   |
| `construction.build_on_slopes`       | true                 | `world_settings.ini`      | Makes the `C(1,6)` level draws happen                                     |
| `construction.freeform_edges`        | true                 | `world_settings.ini`      | Void row/column at 0 and at the far edge                                  |
| `game_creation.town_name`            | 0 (English Original) | `world_settings.ini`      | Name generator, §4.12                                                     |
| `game_creation.landscape`            | 0 (temperate)        | `world_settings.ini`      | Climate bit `ClimateTemperate`                                            |
| `game_creation.starting_year`        | 1950                 | `world_settings.ini`      | House availability by year                                                |

Constants: edge distance 12, town spacing Manhattan 20, 5x5 site check needing 12 tiles
(`VALID_TILE_GOAL = 25/2`), 20 attempts per town (10000 for the last resort), 1000 name tries,
`x` 8..23, `4x` growth calls, walk `10 + n*4/9`, `C(1,4)`, `C(6,10)`, `C(1,6)`, `C(1,7)`, house
weight 16, `RATING_INITIAL` 500.

## 6. Stage 1 needs

- `GenerateTowns` as in §4.2 (count, city flag, name per town, 20 attempts, last-resort retry), with
  Stage 1's own town count in place of the default (towns-industries.md open question 2).
- `CreateRandomTown`, `TownCanBePlacedHere` (edge 12, Manhattan 20, flat clear/trees, 12-of-25 site
  check), deletion of a town with zero population (clearing its roads and houses).
- `DoCreateTown` size formula, the `num_houses += x` fudge, `UpdateTownRadius`, the `4x` loop,
  `UpdateTownMaxPass`.
- `GrowTown`, `GrowTownAtRoad`, `GrowTownInTile` (branches A/B/C and the common ending),
  `CanFollowRoad`, `IsRoadAllowedHere` (flat part), `IsNeighbourRoadTile`, `GenRandomRoadBits`,
  and, from roads.md, `GetTownRoadBits`, `CleanUpRoadBits`, the Auto/NoWater road-build probe and
  `GrowTownWithRoad`.
- `TryBuildTownHouse` with the flat-map parts of `CanBuildHouseHere`, 1x1 houses and the 2x2
  stadium (`CheckTownBuild2x2House`, `CheckFree2x2Area`); the 2x1/1x2 checks may wait for later
  stages (no such house in 1950). `BuildTownHouse`, `MakeTownHouse` (4 IDs for the 2x2),
  construction state at generation, church/stadium flags.
- The 1950 temperate house list per zone (§4.11) plus the out-of-year entries needed for the same
  weights if the draw sequence must match.
- English (Original) names (§4.12) with the string-uniqueness set.
- Optional: sign anchor (§4.14).

## 7. Skipped

- `TL_BETTER_ROADS` (walk `10 + n*2/9`; `IsNeighbourRoadTile` with `m = 2`; in branch C it first calls
  `GrowTownWithExtraHouse(t, house_tile + offset(target_dir))`, which counts the four edge
  neighbours that are house or void tiles and, at 3 or more, calls `TryBuildTownHouse` there, then
  continues like the original), `TL_2X2_GRID`/`TL_3X3_GRID` (walk `10 + n/9`, `GetTownRoadGridElement`,
  grid lines forbidden for houses, special 2x2 house placement) and `TL_RANDOM`.
- Slopes and terraforming: `LevelTownLand` (its draws are kept, §4.8), `TerraformTownTile`, the sloped
  part of `IsRoadAllowedHere`, foundations, `GrowTownWithBridge`/`GrowTownWithTunnel` and their
  helper `CanRoadContinueIntoNextTile`, bridge-above checks, `NotSloped` houses.
- Coastal siting on a sloped coast; `FindNearestGoodCoastalTownSpot` is needed only if a random tile is
  water (§4.3) and kept for that case.
- NewGRF houses and callbacks, `GrowTownWithExtraHouse` bookkeeping for grids, tram road types
  (`NoHouses`), level crossings, drive-through stops, depots, object tiles.
- In-game growth (`TownTickHandler`, `UpdateTownGrowth`, `CmdExpandTown`, house replacement),
  `UpdateTownGrowthRate` details, manual founding (`CmdFoundTown`), `LoadTownData`, town ratings,
  town actions, signs for non-English name generators and GRF town names.

## 8. Open questions

1. **Exact random sequence.** The ledger (`R`/`C` per step) is complete for TL_ORIGINAL on flat land,
   but the draws before towns (landscape, `ScaleByLandProportion` offset) depend on code outside this
   note. Matching OpenTTD map-for-map needs the whole generator; otherwise a seeded `Random()` with
   the same call order here only reproduces the distributions. Decision belongs to cross-cutting
   question 1 in README.md.
2. **Roads on single-bit stubs.** `CanBuildHouseHere` accepts a tile whose only road is one bit
   (`ClearTile_Road` with `Auto`, which calls `RemoveRoad`). Whether `RemoveRoad` succeeds for a
   town-owned stub as `OWNER_TOWN`, and what it does to the neighbouring tile's bits, is in
   `road_cmd.cpp:RemoveRoad`; I did not trace it. roads.md must settle it, or Stage 1 must decide
   that houses never replace road tiles.
3. **Probe semantics of `CMD_BUILD_ROAD(Auto, NoWater)` on non-clear tiles.** `IsRoadAllowedHere` and
   `GrowTown` rely on it only for clear, trees and road tiles in Stage 1; behaviour for other
   tile types is taken from the `ClearTile_*` callbacks above, not from `CmdBuildRoad`.
4. **Shore tiles on a flat map.** OpenTTD makes a land tile next to sea a coast `MP_WATER` tile
   when its corners are not all above sea level. Whether Stage 1 has such tiles decides (a) whether
   `IsTileType(tile, MP_WATER)` is true for the beach, (b) whether `GrowTownWithBridge` can fire
   (it can across sea from a sloped tile), (c) `HasTileWaterGround` in `CanFollowRoad` and
   `GrowTownInTile`. Linked to README cross-cutting question 5.
5. **Layout.** This note ports `TL_ORIGINAL` only. Confirm that Stage 1 fixes the layout instead of
   exposing `economy.town_layout`.
6. **Town count for Stage 1.** Still open (towns-industries.md question 2). `GenerateTowns` behaves
   the same with `custom_town_number`; the 20-attempt budget and the 20-tile spacing may make a
   large count impossible on a small map (a town is simply skipped).
7. **Spiral order for even diameters** (`SpiralTileSequence(coast, 40)` and `(coast, 10)`) was
   traced by hand from `SpiralTileIterator`; it matters only for coastal siting and for which of
   several equally distant sites wins. Verify with a test against the C++ if bit-exact coastal
   placement is wanted.
8. **Generated houses and `RunTileLoop`.** About 10.7 % of houses start unfinished and almost none
   finish in the 5 generation visits (§4.11). Whether Stage 1 keeps this or builds all houses
   complete is towns-industries.md question 9; with all-complete the `C(1,7)` draw and the
   `construction_random` draw can still be consumed to keep the sequence.
