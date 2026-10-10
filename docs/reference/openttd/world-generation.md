# World generation: new-game order, water, clear tiles, trees, rivers

## 1. Purpose

When a new game starts, `GenerateWorld` builds the map in a fixed order: terrain heights, sea
and coast, rivers, rough/rocky ground, towns, industries, objects, trees, then 1280 passes of
the tile loop so grass, trees and shores settle. Almost everything is driven by one
pseudo-random stream (`_random`) seeded with `generation_seed`, so the same seed and settings
give the same map.

This note records that order and how the **sea/land mask** is produced (TerraGenesis, the
original generator, water borders, conversion of height-0 tiles to sea and shore). It serves
Stage 1 spec D4: tiles keep OpenTTD heights, but a Stage 1 map has only two levels (sea at 0,
land at 1) and coast tiles are slopes. Towns and industries are in `towns-industries.md`; tile
storage, the tile loop and the basic clear/tree/water rules are in `map.md`. Both are not
repeated here.

## 2. Source files

All under `reference/OpenTTD/src/`.

| File                                                           | Key functions                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `genworld.cpp`                                                 | `GenerateWorld` (setup, `map_height_limit`, seed), `_GenerateWorld` (the order below)                                 |
| `genworld.h`                                                   | `LG_ORIGINAL = 0`, `LG_TERRAGENESIS = 1`, `MAP_HEIGHT_LIMIT_*`, `CUSTOM_*` constants                                  |
| `misc.cpp`                                                     | `InitializeGame` (`_cur_tileloop_tile = 1`, `TimerGameTick::counter = 0`, calls `InitializeLandscape`)                |
| `landscape.cpp`                                                | `InitializeLandscape`, `GenerateLandscape`, `GenerateTerrain` (original), `CreateRivers`, `FindSpring`, `RunTileLoop` |
| `tgp.cpp`                                                      | `GenerateTerrainPerlin` and the `HeightMap*` steps (TerraGenesis)                                                     |
| `heightmap.cpp`                                                | `FlatEmptyWorld` (scenario editor only), `FixSlopes`                                                                  |
| `water_cmd.cpp`                                                | `ConvertGroundTilesIntoWaterTiles`, `_flood_from_dirs`, `TileLoop_Water`, `DoFloodTile`, `DoDryUp`                    |
| `water_map.h`                                                  | `MakeSea`, `MakeShore`                                                                                                |
| `tile_map.cpp`                                                 | `GetTileSlopeZ`, `GetTileSlopeGivenHeight`, `GetTileZ`, `GetTileMaxZ`                                                 |
| `void_map.h`, `tile_map.h`                                     | `MakeVoid` (height 0), `IsInnerTile`                                                                                  |
| `clear_cmd.cpp`                                                | `GenerateClearTile`                                                                                                   |
| `tree_cmd.cpp`                                                 | `GenerateTrees`, `PlaceTreeGroups`, `PlaceTreesRandomly`, `PlaceTreeAtSameHeight`, `CanPlantTreesOnTile`              |
| `map.cpp`                                                      | `Map::CountLandTiles`                                                                                                 |
| `core/random_func.cpp/.hpp`                                    | `Randomizer::Next`, `SetSeed`, `RandomRange`, `ScaleToLimit`                                                          |
| `table/settings/world_settings.ini`, `difficulty_settings.ini` | defaults (section 5)                                                                                                  |

## 3. State

Per tile (see `map.md` section 3): `type`, `height`, `m1..m8`. Generation-only state:

```
_random.state[0..1]           uint32 x2   the Random() stream; SetSeed(s): both = s
                                          Next(): s=st0; t=st1;
                                                  st0 = s + rotr(t ^ 0x1234567F, 7) + 1;
                                                  st1 = rotr(s, 3) - 1;  return st1
                                          (core/random_func.cpp:Randomizer::Next)
RandomRange(limit)            = (uint64(Random()) * limit) >> 32      (ScaleToLimit)
RandomTile()                  = Random() & tile_mask                  (map_func.h)
_cur_tileloop_tile            TileIndex   LFSR state, 1 at InitializeGame
TimerGameTick::counter        0 at InitializeGame; +1 after each generation tile-loop pass
Map::initial_land_count       uint        see 4.1 step 6
game_creation.generation_seed uint32      GENERATE_NEW_SEED -> InteractiveRandom() (GenerateWorld)
construction.map_height_limit uint8       0 = auto, set in GenerateWorld (4.1 step 0)
TGP: _height_map              int16[(SizeX+1)*(SizeY+1)]  fixed point, 4 decimal bits: I2H(i) = i << 4
```

Height is the corner grid: tile `(x,y)` stores the height of its **N** corner; slope comes from
the four corners (`map.md` 4.4). So a sea/land mask is a mask on **vertices**, and a tile is
sea only if all four of its corners are 0.

## 4. Rules and formulas

### 4.1 Order of `_GenerateWorld` (new game, `GenWorldInfo::mode != GWM_EMPTY`)

`genworld.cpp:GenerateWorld` first calls `InitializeGame` (allocates the map; `InitializeLandscape`
makes inner tiles `MakeClear(GRASS, 3)` at height 0, last column and row `MakeVoid`; tile loop
state and tick counter reset). Then:

```
0. GenerateWorld:   if map_height_limit == 0:
                        estimated = GetEstimationTGPMapHeight()   (TGP; = H2I(TGPGetMaxHeight()))
                        map_height_limit = max(30, min(255, estimated + 15))
                           // MAP_HEIGHT_LIMIT_AUTO_MINIMUM = 30, _AUTO_CEILING_ROOM = 15,
                           // MAX_MAP_HEIGHT_LIMIT = 255.   Default map: estimated 8 -> 30.
                    if generation_seed == GENERATE_NEW_SEED: seed = InteractiveRandom()
   _GenerateWorld:
1. _random.SetSeed(generation_seed)
2. StartupEconomy()          consumes ONE Random(): economy.fluct = GB(Random(),0,8) + 168
                             (economy.cpp:StartupEconomy), then prices.
3. CheckTownRoadTypes()      aborts if no town road type; no Random().
4. GenerateLandscape(mode)   -> 4.2 (heights, FixSlopes, ConvertGround, snow/desert line, CreateRivers)
   if it returned true (always for GWM_NEWGAME):
5. GenerateClearTile()       -> 4.6
6. Map::CountLandTiles()     initial_land_count = #tiles that are not open water (`IsWaterTile`: water type Clear), so coast and void count as land
                             initial_land_count += initial_land_count / 12;  min(.., Map::size)
7. GenerateTowns(town_layout)         (towns-industries.md 4.8) abort on failure
8. GenerateIndustries()               (towns-industries.md 4.13)
9. GenerateObjects()                  transmitters, lighthouses, HQ-type generate_amount objects
10. GenerateTrees()                   -> 4.7
11. StartupCompanies()  (aborts a timer only), StartupEngines() (one Random() as engine seed,
    then StartupOneEngine per engine - not read), StartupDisasters() (ResetDisasterDelay - not read)
12. _generating_world = false;  Game::StartNew()  (GameScript, none by default)
13. for i in 0 .. 0x500-1 (1280 passes):  RunTileLoop();  TimerGameTick::counter++
    (each pass visits Size/256 tiles, so each tile 5 times; the tile-0 rule fires when
     counter % 256 == 0, i.e. at passes 0, 256, 512, 768, 1024)
14. if Game::GetInstance() != nullptr: run GameScript up to 2500 GameLoop() calls
15. callback, ShowNewGRFError ...
```

If `GenerateLandscape` returns false (heightmap load failed) or mode is `GWM_EMPTY`: step 5-10 are
skipped; north void row/column if `freeform_edges`; `FlatEmptyWorld(se_flat_world_height)`;
`ConvertGroundTilesIntoWaterTiles`; `CountLandTiles` (`genworld.cpp:_GenerateWorld`). That is the
scenario-editor path, not the new game.

`GenerateWorld` uses `Random()` only in steps 2, 4-5, 7-11 above; every call is the shared
`_random` stream. Nothing reseeds it after step 1. `ScriptObject::InitializeRandomizers()` and
`InteractiveRandom()` use other generators and do not disturb it.

### 4.2 `landscape.cpp:GenerateLandscape` (mode `GWM_NEWGAME`)

```
if land_generator == LG_TERRAGENESIS (default):  GenerateTerrainPerlin()          -> 4.3
else (LG_ORIGINAL): freeform_edges ? MakeVoid(row 0, column 0);  generate by landscape  -> 4.5
FixSlopes()                  heightmap.cpp: forces neighbour height diff <= 1 (top/left scan, then
                             bottom/right scan). Where it lowers a tile it calls
                             RandomRange(map_height_limit) <= current_height -> MakeClear(ROCKS,3).
                             With only heights 0/1 it never changes anything and consumes no Random().
ConvertGroundTilesIntoWaterTiles()                                                -> 4.4
switch landscape: Arctic: CalculateSnowLine();  Tropic: CreateDesertOrRainForest(...)
                  Temperate/Toyland: nothing
CreateRivers()                                                                    -> 4.8
return true
```

### 4.3 TerraGenesis (`tgp.cpp:GenerateTerrainPerlin`)

Only what decides the water/land mask. Default: temperate, `terrain_type = 1` (Flat),
`quantity_sea_lakes = 0` (Very low), `tgen_smoothness = 1` (Smooth), `variety = 0`,
`water_borders = Random`, `freeform_edges = true`, 256x256.

```
AllocHeightMap():            (SizeX+1) x (SizeY+1) int16, dim_x = SizeX + 1
HeightMapGenerate()          raw noise                                   (4.3.1)
HeightMapNormalize()         water level, coasts, smoothing              (4.3.2)
if freeform_edges: MakeVoid(row 0 and column 0)    // BEFORE heights are written, see below
for y in 0..SizeY-1, x in 0..SizeX-1:                  // includes the last column/row (void tiles)
    TgenSetTileHeight(TileXY(x,y), Clamp(H2I(h(x,y)), 0, max_height))
        // SetTileHeight always; MakeClear(GRASS,3) only if IsInnerTile(tile)
        // IsInnerTile: x < MaxX && y < MaxY && ((x > 0 && y > 0) || !freeform_edges)
```

Consequences of the last loop: void tiles on the first/last row/column keep the **heightmap
height** (not 0), because `MakeVoid` ran earlier. Inner tiles use the vertices of the last
column/row (x = MaxX, y = MaxY) as their W/E/S corners, so those void-tile heights shape the
south-east/south-west coast. Vertices of row 0 / column 0 are never a corner of an inner tile.

**TGP constants** (`tgp.cpp`):

```
HEIGHT_DECIMAL_BITS = 4          I2H(i) = i << 4        H2I(h) = h >> 4
AMPLITUDE_DECIMAL_BITS = 10      A2H(a) = a >> 6
MAX_TGP_FREQUENCIES = 10
WATER_PERCENT_FACTOR = 1024
_water_percent[4] = {70, 170, 270, 420}     // indexed by difficulty.quantity_sea_lakes 0..3
max_height[terrain_type][min(LogX,LogY) - 6]:           64  128  256  512 1024 2048 4096
    0 Very flat                                           3    3    3    3    4    5    7
    1 Flat                                                5    7    8    9   14   19   31
    2 Hilly                                               8    9   10   15   23   37   61
    3 Mountainous                                        10   11   17   19   49   63   73
    4 Alpinist                                           12   19   25   31   67   75   87
    // clamped to map_height_limit if != 0; terrain_type 5 (custom): I2H(custom_terrain_type + 1) - 1
amplitudes[smoothness][freq index] (x1024 fixed point):
    0 very smooth {16000,  5600,  1968,   688,   240,    16,    16}
    1 smooth      {24000, 12800,  6400,  2700,  1024,   128,    16}
    2 rough       {32000, 19200, 12800,  8000,  3200,   256,    64}
    3 very rough  {48000, 24000, 19200, 16000,  8000,   512,   320}
extrapolation_factors = {3.3, 2.8, 2.3, 1.8}   (by smoothness, for frequencies before the table)
```

#### 4.3.1 `HeightMapGenerate` (raw value noise, not true Perlin)

```
start = max(10 - min(LogX, LogY), 0)                 // 256x256: 2
for frequency in start .. 9:
    amp = GetAmplitude(frequency)
          index = frequency - 10 + 7
          amp = amplitudes[smooth][max(0, index)];  if index >= 0 return amp
          // else extrapolate: amp = (int)(factor * amp) and height_range <<= 1 per missing step
          //   (height_range starts at I2H(16) = 256), then
          //   return Clamp((TGPGetMaxHeight() - height_range) / height_range, 0, 1) * amp
    if amp == 0: continue                           // too low a map for this octave
    step = 1 << (10 - frequency - 1)
    if first non-zero octave:
        for y in 0..SizeY step `step`, x in 0..SizeX step `step`:  h(x,y) = RandomHeight(amp)
        continue
    // odd x, even y: h(x+step,y) = (h(x,y) + h(x+2*step,y)) / 2        (int16 division)
    // odd y, all x: h(x,y+step) = (h(x,y) + h(x,y+2*step)) / 2
    // then for every grid point: h(x,y) += RandomHeight(amp)
RandomHeight(r_max) = A2H(RandomRange(2*r_max + 1) - r_max)
```

Derived for the default (256x256, Flat, Smooth), arithmetic not run: frequency 2 has
`index = -1`, extrapolated amp `(int)(2.8*24000) = 67200`, `height_range = 512`, factor
`Clamp((128 - 512)/512, 0, 1) = Clamp(0, 0, 1) = 0` (C++ integer division truncates), so amp 0
and the octave is skipped. Octaves used: frequency 3..9 with steps 64, 32, 16, 8, 4, 2, 1 and
amplitudes 24000, 12800, 6400, 2700, 1024, 128, 16 (i.e. +/-375 .. +/-0.25 in 1/16 level units
for the first/last octave). Raw heights are signed and can be negative; each octave consumes
one `Random()` per grid point it visits.

#### 4.3.2 `HeightMapNormalize` (sea level, edges, smoothing)

```
water_percent = quantity_sea_lakes != 4 ? _water_percent[quantity_sea_lakes]
                                        : custom_sea_level * 1024 / 100      // custom 1..90 %
h_max_new = TGPGetMaxHeight()                    // default: I2H(8) = 128
roughness = 7 + 3 * tgen_smoothness              // default 10  (units of 1/16 level)

HeightMapAdjustWaterLevel(water_percent, h_max_new):
    (h_min, h_max) = min and max over the whole (SizeX+1)x(SizeY+1) array
    desired = water_percent * SizeX * SizeY / 1024        // default: 70*65536/1024 = 4480 vertices
    h_water_level = h_min; water_tiles = 0
    while h_water_level < h_max:
        water_tiles += histogram[h_water_level]
        if water_tiles >= desired: break
        h_water_level++
    for every vertex:
        h = (int)h_max_new * (h - h_water_level) / (h_max - h_water_level) + I2H(1)   // int division
        if h < 0: h = I2H(0);   if h >= h_max_new: h = h_max_new - 1
    // => final level (h >> 4) is 0 only where h < 16, i.e. raw h below the water level.
    // Vertices at the water level or slightly below (division truncates toward 0) become level 1.

water_borders = freeform_edges ? game_creation.water_borders : BORDERFLAGS_ALL
if water_borders == BorderFlag::Random:  water_borders = GB(Random(), 0, 4)       // ONE Random() here
        // bit 0 NorthEast, bit 1 SouthEast, bit 2 SouthWest, bit 3 NorthWest (BorderFlag enum order)
HeightMapCoastLines(water_borders)          // 4.3.3
HeightMapSmoothSlopes(roughness)
HeightMapSmoothCoasts(water_borders)        // 4.3.4
HeightMapSmoothSlopes(roughness)
HeightMapSineTransform(I2H(1), h_max_new)
if variety > 0: HeightMapCurves(variety)    // default 0: skipped
```

`HeightMapSmoothSlopes(dh_max)`: scan 1 (y ascending, x ascending, including row/column
`size`): `h(x,y) = min(h(x,y), min(h(x-1,y), h(x,y-1)) + dh_max)` (neighbour index clamped to the
tile itself at x=0 / y=0). Scan 2 (descending): same with `h(x+1,y)`, `h(x,y+1)` (clamped at
`size`). `dh_max = roughness = 10 < 16`, so a vertex is capped at `neighbour + 10`; a land vertex
right beside a vertex with `h = 0` (the carved border) is capped at 10 and drops to level 0. So the second smoothing pass can move the coast inland; the mask must
be taken **after** it.

`HeightMapSineTransform` leaves every `h < I2H(1)` untouched and maps `[16, h_max_new]` onto
itself (`fheight` 0 -> 16 ... clamp `h >= h_max -> h_max - 1`), so it only reshapes land; it
cannot turn a level-0 vertex into land or vice versa. `HeightMapCurves` (variety > 0) also skips
`h < I2H(1)` and re-adds `I2H(1)` to everything else. Neither changes the mask.

#### 4.3.3 `HeightMapCoastLines` (water borders)

`smallest_size = min(game_creation.map_x, map_y)` is the **log2** value (default 8), not tiles,
so `smallest_size * smallest_size / 64` = 1 on a default map (integer division). `margin = 4`.
`n(a, b, p, prime) = perlin_coast_noise_2D(a, b, p, prime)`.

```
for y in 0..SizeY:
  if NorthEast:   // x near 0
     max_x = |(n(SizeY - y, y, 0.9, 53) + 0.25) * 5 + (n(y, y, 0.35, 179) + 1) * 12|
     max_x = max(S + max_x, S + 4 - max_x)            // S = smallest_size^2 / 64
     if smallest_size < 8 && max_x > 5: max_x /= 1.5
     for x = 0; x < max_x; x++:  h(x, y) = 0
  if SouthWest:   // x near SizeX
     max_x = |(n(SizeY - y, y, 0.85, 101) + 0.3) * 6 + (n(y, y, 0.45, 67) + 0.75) * 8|   (same S, /1.5 rule)
     for x = SizeX; x > SizeX - 1 - max_x; x--:  h(x, y) = 0
for x in 0..SizeX:
  if NorthWest:   // y near 0
     max_y = |(n(x, SizeY/2, 0.9, 167) + 0.4) * 5 + (n(x, SizeY/3, 0.4, 211) + 0.7) * 9|
     for y = 0; y < max_y; y++:  h(x, y) = 0
  if SouthEast:   // y near SizeY
     max_y = |(n(x, SizeY/3, 0.85, 71) + 0.25) * 6 + (n(x, SizeY/3, 0.35, 193) + 0.75) * 12|
     for y = SizeY; y > SizeY - 1 - max_y; y--:  h(x, y) = 0
  // both NW and SE: max_y = max(S + max_y, S + 4 - max_y), /1.5 rule for smallest_size < 8
```

Noise (no `Random()`, uses `generation_seed` directly):

```
perlin_coast_noise_2D(x, y, p, prime) = sum i=0..5 of
        interpolated_noise(x * 2^i / 64, y * 2^i / 64, prime) * p^i
interpolated_noise: bilinear (linear_interpolate) of int_noise at (floor(x), floor(y)) .. +1
int_noise(x, y, prime):  n = x + y * prime + generation_seed          // type long
                         n = (n << 13) ^ n
                         return 1.0 - (double)((n * (n*n*15731 + 789221) + 1376312589) & 0x7fffffff)
                                          / 1073741824.0
```

(`tgp.cpp:perlin_coast_noise_2D`, `interpolated_noise`, `int_noise`.) `long` is 64-bit on Linux and
32-bit on Windows, so the result differs by platform when it overflows (see section 8).

#### 4.3.4 `HeightMapSmoothCoasts`

For each water border, for every position along that edge, walk inward from the edge
(`HeightMapSmoothCoastInDirection`):

```
max_coast_dist_from_edge = 35;  max_coast_smooth_depth = 35;  h_prev = I2H(1)
find coast: from the edge, step while ed < 35 and neither h(x,y) >= I2H(1) nor a side
            neighbour (x +/- dir_y, y +/- dir_x) has h > 0
then for depth = 0 .. 35 (moving on, within the map):  h = min(h, h_prev + (4 + depth));  h_prev = h
```

Start points: NW `(x, 0)` dir `(0, 1)`; SE `(x, SizeY-1)` dir `(0, -1)` for `x < SizeX`;
NE `(0, y)` dir `(1, 0)`; SW `(SizeX-1, y)` dir `(-1, 0)` for `y < SizeY`. It only lowers heights,
so a steep inland rise next to a border becomes a gentle slope - more tiles end below level 1
only through the later `SmoothSlopes`.

### 4.4 Sea, shore and coast (`water_cmd.cpp:ConvertGroundTilesIntoWaterTiles`)

Runs after the terrain (and again at the end of `CreateRivers`). Tile corners:
N = h(x,y), W = h(x+1,y), E = h(x,y+1), S = h(x+1,y+1), clamped to the map
(`tile_map.cpp:GetTileSlopeZ`). `SLOPE_W = 1, S = 2, E = 4, N = 8`; a corner bit is set when that
corner is higher than the minimum corner. `z` = minimum corner.

```
for every tile in index order:
    (slope, z) = GetTileSlopeZ(tile)
    if tile is MP_CLEAR and z == 0:
        slope == FLAT:                       MakeSea(tile)
        slope in {N, E, S, W} (one raised):  MakeShore(tile)
        otherwise:                           // 2 or 3 raised corners (steep ignored)
            for dir in _flood_from_dirs[slope]:
                dest = TileAddByDir(tile, dir)
                if slope(dest) is FLAT or one-corner-raised, or dest is MP_VOID:
                    MakeShore(tile); break
            // no hit: stays MP_CLEAR (a sloped land tile with z == 0)
```

`_flood_from_dirs[slope]`, indexed by the slope value (`water_cmd.cpp`). Direction offsets
(`map.cpp:_tileoffs_by_dir`, (dx,dy)): N(-1,-1) NE(-1,0) E(-1,1) SE(0,1) S(1,1) SW(1,0) W(1,-1)
NW(0,-1).

```
 0 flat      {NW, SW, SE, NE}      8  N        {SW, SE}
 1 W         {NE, SE}              9  N+W      {SE}
 2 S         {NW, NE}             10  N+S      {}   (never shore)
 3 W+S       {NE}                 11  N+W+S    {E, NE, SE}
 4 E         {NW, SW}             12  N+E      {SW}
 5 E+W       {}   (never shore)   13  N+E+W    {S, SW, SE}
 6 S+E       {NW}                 14  N+E+S    {W, SW, NW}
 7 W+S+E     {N, NW, NE}
```

Reading for a **two-level** map (corners are 0 or 1; the only slopes are those 15 shapes, never
steep): a tile with all four corners 0 is sea; a tile with any corner 0 and any corner 1 has
`z == 0` and becomes shore (one raised corner), shore or sloped land (two or three raised
corners, depending on the neighbour test), or stays land (opposite corners raised, slopes 5 and
10). A tile with all four corners 1 has `z == 1` and is untouched land. Note the neighbour test
in the default branch looks only at the neighbour's **slope** (flat/one corner raised), not at
whether the neighbour is water.

`MakeShore(t)`: type `MP_WATER`, owner `OWNER_WATER`, class Sea, `WaterTileType::Coast`, all of
m2..m5 and m7 cleared (`water_map.h`). `MakeSea` = `MakeWater(t, OWNER_WATER, Sea, 0)`.

Afterwards the tile loop keeps adjusting shores (`water_cmd.cpp:TileLoop_Water`,
`GetFloodingBehaviour`): `MP_WATER` coast with one raised corner and sea are `FLOOD_ACTIVE`;
a coast tile with **more than one** raised corner is `FLOOD_DRYUP`: if none of its
`_flood_from_dirs[slope]` neighbours is active (`FLOOD_ACTIVE`/`PASSIVE`; `MP_VOID` counts as
active) it is turned back into `MakeClear(GRASS, 3)` (`DoDryUp`). An active water tile floods a
non-water neighbour whose foundation `z == 0` when `_flood_from_dirs[neighbour slope]` contains
the reverse direction: a flat one becomes sea, a sloped one becomes shore (`DoFloodTile`).
`map.md` section 6 says the water tile loop has "no effect while all land is at z >= 1"; that
holds for flat land only. On the Stage 1 map the coast tiles have `z == 0`, so the water loop
**does** run (see section 8, question 3).

### 4.5 Original generator (`landscape.cpp:GenerateLandscape`, `GenerateTerrain`)

Used when `land_generator == LG_ORIGINAL`; shown for comparison. Needs the 37 map-generator
template sprites `SPR_MAPGEN_BEGIN .. SPR_MAPGEN_END` (4845..4882, `table/sprites.h`) which are
read from the base graphics set (`GetSprite(.., SpriteType::MapGen)`); their pixel data is **not**
in the source tree.

```
Temperate / Toyland (the `default:` case):
    r = Random()
    n = ScaleBySize(GB(r, 0, 7) + (3 - quantity_sea_lakes) * 256 + 100)     // quantity 0: 868..995 on 256x256
    repeat n times:  GenerateTerrain(Clamp(terrain_type, 0, 3), 0)
Arctic:  r = Random(); ScaleBySize(GB(r,0,7) + 950) x GenerateTerrain(2, 0);
         flag = GB(r,7,2) | 4;  ScaleBySize(GB(r,9,7) + 450) x GenerateTerrain(4, flag)
Tropic:  r = Random(); ScaleBySize(GB(r,0,7)+170) x GenerateTerrain(0,0);  flag = GB(r,7,2)|4;
         ScaleBySize(GB(r,9,8)+1700) x GenerateTerrain(0, flag);  flag ^= 2;
         ScaleBySize(GB(r,17,7)+410) x GenerateTerrain(3, flag)

GenerateTerrain(type, flag):
    r = Random()
    template index = (((r >> 24) * _genterrain_tbl_1[type]) >> 8) + _genterrain_tbl_2[type]
                     // tbl_1 = {10, 22, 33, 37, 4},  tbl_2 = {0, 0, 0, 0, 33}
    x = r & MaxX;  y = (r >> LogX) & MaxY
    edge_distance = 1 + (freeform_edges ? 1 : 0);  if x <= edge_distance || y <= edge_distance: return
    direction = GB(r, 22, 2);  w,h = template size (swapped for NE-SW axis directions)
    if flag & 4: skip templates by position (xw = x*SizeY, yw = y*SizeX, bias = (SizeX+SizeY)*16;
                 case flag&3: 0: xw+yw > Size - bias; 1: yw < xw + bias;
                              2: xw+yw < Size + bias; 3: xw < yw + bias  -> return)
    if x + w >= MaxX or y + h >= MaxY: return
    overlay the template in `direction`: h(tile) = max(h(tile), GB(pixel, 0, 4))   // only raises
```

No sea level is chosen: tiles never touched stay at height 0 and become sea in `ConvertGround...`
(more templates = less sea). The sea/lake setting only changes the **count** of templates
(`(3 - quantity_sea_lakes) * 256`); water borders and `custom_sea_level` are ignored (the GUI
disables the border buttons for `LG_ORIGINAL`, `genworld_gui.cpp`). `FixSlopes` follows, and it can
consume `Random()` (rock chance) here, because template overlap makes steps of 2.

### 4.6 `clear_cmd.cpp:GenerateClearTile` (beyond `map.md` 4.5)

```
i  = ScaleBySize(GB(Random(), 0, 10) + 0x400)       // 1024..2047 on 256x256   (Random #1)
gi = ScaleBySize(GB(Random(), 0,  7) + 0x80)        // 128..255                (Random #2)
repeat i:   tile = RandomTile()                     // one Random() each
            if tile is MP_CLEAR and ground != DESERT:  SetClearGroundDensity(tile, ROUGH, 3)
repeat gi:  r = Random();  tile = RandomTileSeed(r) // same r for tile and patch length
            if tile is MP_CLEAR and not DESERT:
                j = GB(r, 16, 4) + 5                // 5..20
                loop:  SetClearGroundDensity(tile, ROCKS, 3)
                       do { if --j == 0: stop patch
                            tile_new = tile + TileOffsByDiagDir(GB(Random(), 0, 2)) }
                       while tile_new is not MP_CLEAR or is DESERT
                       tile = tile_new
```

Applies to every `MP_CLEAR` tile, including sloped land with `z == 0`. Water/shore tiles are
`MP_WATER` and never roughened. The inner `do/while` retries (consuming `Random()`) until it
finds a clear neighbour or `j` hits 0, so the number of Random calls is data dependent.
On a Stage 1 map nothing is `CLEAR_DESERT`, so the desert test never fires.

### 4.7 `tree_cmd.cpp:GenerateTrees` with `tree_placer = TP_IMPROVED` (beyond `map.md` 4.6)

```
i = 2 (temperate/tropic/toyland) | 4 (arctic)          // TP_ORIGINAL: 6 | 15
total = ScaleBySize(1000) [+ ScaleBySize(15000) tropic]  (only for the progress bar)
num_groups = landscape != Toyland ? ScaleBySize(GB(Random(),0,5) + 25) : 0     // 25..56
PlaceTreeGroups(num_groups) if num_groups != 0
repeat i:  PlaceTreesRandomly()
```

`PlaceTreeGroups` (`GROVE_SEGMENTS = 16`, `GROVE_RADIUS = 16`, `DEFAULT_TREE_STEPS = 1000`):

```
center = RandomTile()
CreateRandomStarShapedPolygon(16, grove)   // 4 Random() calls, in order: phases of harmonics
        // {radius/2, 1}, {radius/4, 2}, {radius/8, 3}, {radius/16, 4}; phase = Random()/PHASE_DIVISOR
        // PHASE_DIVISOR = (float)(INT32_MAX / M_PI * 2); CreateStarShapedPolygon not read
repeat 1000:  r = Random();  x = GB(r,0,5) - 16;  y = GB(r,8,5) - 16
              cur = TileAddWrap(center, x, y);  skip if invalid / !CanPlantTreesOnTile(cur, true)
                                                / (x,y) not inside the polygon
              PlaceTree(cur, r)
```

`PlaceTreesRandomly` (per call, `ScaleBySize(1000)` iterations; `_game_mode != GM_EDITOR`):

```
r = Random();  tile = RandomTileSeed(r)
if CanPlantTreesOnTile(tile, true):
    PlaceTree(tile, r)
    // TP_IMPROVED only:
    ht = GetTileZ(tile);   j = ht * 2
    if arctic && ht > snow line: j *= 3
    if map_height_limit > 15: j = j * 15 / map_height_limit        // MAP_HEIGHT_LIMIT_ORIGINAL = 15
    repeat j:  PlaceTreeAtSameHeight(tile, ht)
PlaceTreeAtSameHeight(tile, height):   up to 1000 tries:
    r = Random();  x = GB(r,0,5) - 16;  y = GB(r,8,5) - 16
    skip if |x| + |y| > 16, !CanPlantTreesOnTile(cur, true), or |GetTileZ(cur) - height| > 2
    PlaceTree(cur, r);  stop at the first success
```

`GetTileZ` is the **minimum** corner (`tile_map.cpp:GetTileZ`). So on a 0/1 map a tree on land at
`z = 1` plants `j = 1 * 2 * 15 / 30 = 1` extra tree with the default `map_height_limit = 30`
(derived: `2*15 = 30`, `30/30 = 1`); a tree on a `z = 0` tile (sloped land) plants none.
`CanPlantTreesOnTile(tile, allow_desert)`: `MP_WATER` only if `IsCoast` and not single-corner-raised
(i.e. a shore with two or more raised corners); `MP_CLEAR` if no bridge above and not
FIELDS/ROCKS (desert allowed here). Trees on a shore tile become `TREE_GROUND_SHORE`.
`PlaceTree` and `PlantTreesOnTile` keep the ground type and density of a clear tile (density 3
for rough ground, otherwise the tile's density).

### 4.8 Rivers (`landscape.cpp:CreateRivers`)

```
amount = game_creation.amount_of_rivers;  if amount == 0: return          // default 2: runs
wells = ScaleBySize(4 << amount)                  // default 256x256: 16
num_short_rivers = wells - max(1, wells / 10)     // 15
long rivers:  for (; wells > num_short_rivers; wells--):                  // 1 iteration
                  up to 512 tries: for t in SpiralTileSequence(RandomTile(), 8):
                      if FindSpring(t): FlowRiver(t, t, min_river_length * 4); break
short rivers: for (; wells != 0; wells--):                                // 15 iterations
                  up to 128 tries: same, FlowRiver(t, t, min_river_length)
ConvertGroundTilesIntoWaterTiles()
for i in 0..255 (TILE_UPDATE_FREQUENCY): RunTileLoop()        // note: counter is NOT incremented
```

`FindSpring(tile)` requires: tile flat and not water; at least 4 of the 3x3 neighbourhood with
`GetTileMaxZ > reference_height`; and no tile within +/-16 with `GetTileMaxZ > reference_height + 2`.
On a map whose highest corner is 1, a flat land tile (reference 1) has no neighbour with max z
above 1, and every flat `z = 0` clear tile has already become sea. So **no spring is ever found**,
no river is built, but the loop still consumes `RandomTile()` per try (derived count for a
default map: 512 + 15 x 128 = 2432 `Random()` calls; `SpiralTileSequence` is geometry only,
`tilearea_type.h`, not read in detail), then re-runs `ConvertGround...` and 256 tile-loop passes
(derived: at `counter = 0`, each pass processes tile 0 and 255 LFSR tiles on a 256x256 map).

## 5. Defaults

| Setting                              | Default                   | Range / note                                               | ini                     |
| ------------------------------------ | ------------------------- | ---------------------------------------------------------- | ----------------------- |
| `game_creation.land_generator`       | 1 (`LG_TERRAGENESIS`)     | 0 original                                                 | world_settings.ini      |
| `game_creation.landscape`            | 0 (temperate)             | 0..3                                                       | world_settings.ini      |
| `game_creation.map_x` / `map_y`      | 8 / 8                     | bits; 256x256                                              | world_settings.ini      |
| `game_creation.generation_seed`      | `GENERATE_NEW_SEED`       | replaced by `InteractiveRandom()`                          | world_settings.ini      |
| `game_creation.tgen_smoothness`      | 1 (smooth)                | 0 very smooth .. 3 very rough                              | world_settings.ini      |
| `game_creation.variety`              | 0                         | 0..5; 0 skips `HeightMapCurves`                            | world_settings.ini      |
| `game_creation.water_borders`        | 16 (`BorderFlag::Random`) | bits NE=1, SE=2, SW=4, NW=8, Random=16                     | world_settings.ini      |
| `game_creation.water_border_presets` | 0 (`BFP_RANDOM`)          | GUI: 1 manual (`{}`), 2 infinite water (all, freeform off) | world_settings.ini      |
| `construction.freeform_edges`        | true                      | false: borders forced to all four                          | world_settings.ini      |
| `construction.map_height_limit`      | 0 (auto)                  | auto -> 30 on the default map (4.1 step 0)                 | world_settings.ini      |
| `game_creation.custom_sea_level`     | 1                         | 1..90 (percent); used if `quantity_sea_lakes = 4`          | world_settings.ini      |
| `game_creation.custom_terrain_type`  | 30 (`..AUTO_MINIMUM`)     | 1..255; used if `terrain_type = 5`                         | world_settings.ini      |
| `game_creation.amount_of_rivers`     | 2                         | 0..3                                                       | world_settings.ini      |
| `game_creation.min_river_length`     | 16                        | 2..255                                                     | world_settings.ini      |
| `game_creation.river_route_random`   | 5                         | 1..255 (used by `FlowRiver`, not read)                     | world_settings.ini      |
| `game_creation.se_flat_world_height` | 1                         | 0..15 (scenario editor)                                    | world_settings.ini      |
| `game_creation.tree_placer`          | 2 (`TP_IMPROVED`)         | see `map.md` section 5                                     | world_settings.ini      |
| `difficulty.quantity_sea_lakes`      | 0 (very low)              | 0..4 (4 custom) -> 70/1024 = 6.8 % of vertices             | difficulty_settings.ini |
| `difficulty.terrain_type`            | 1 (Flat)                  | 0..5 (5 custom) -> max height 8 on 256x256                 | difficulty_settings.ini |

Water percentages by `quantity_sea_lakes`: 0 -> 70/1024 (6.8 %), 1 -> 170 (16.6 %),
2 -> 270 (26.4 %), 3 -> 420 (41.0 %) of the vertices counted before border carving.
`quantity_sea_lakes = 4` is `CUSTOM_SEA_LEVEL_NUMBER_DIFFICULTY`.

## 6. Stage 1 needs

| Step (4.1)                                    | Stage 1                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| 0 `map_height_limit` auto                     | needed as a constant (30) for tree counts only                                  |
| 1 `SetSeed`, 2 `StartupEconomy` Random        | seed needed; the one `Random()` call only if the RNG stream is to be reproduced |
| 4 landscape: height mask + `ConvertGround...` | **needed** (4.3, 4.4); heights only 0/1                                         |
| 4 `FixSlopes`, snow/desert lines              | skipped (no effect on 0/1 temperate)                                            |
| 4 `CreateRivers`                              | skipped as a feature (4.8, section 8)                                           |
| 5 `GenerateClearTile`                         | needed (4.6)                                                                    |
| 6 `CountLandTiles`                            | needed (feeds industry count)                                                   |
| 7 towns, 8 industries                         | needed, see `towns-industries.md`                                               |
| 9 `GenerateObjects`                           | skipped                                                                         |
| 10 `GenerateTrees`                            | needed (4.7)                                                                    |
| 11 engines / disasters                        | skipped (engine seed `Random()` only matters for RNG fidelity)                  |
| 13 1280 tile-loop passes                      | needed; includes the water loop on coast tiles (4.4)                            |

Also needed: `MakeSea`, `MakeShore`, `GetTileSlopeZ`, `_flood_from_dirs`, `TileLoop_Water` flood and
dry-up (needed once coasts have `z = 0`), and `MakeVoid` for the last row/column (and the first
if `freeform_edges`).

### 6.1 Options for a two-level map

All three give `height in {0, 1}` per vertex and then run 4.4 unchanged.

**Option A - run TerraGenesis up to the second `SmoothSlopes`, then threshold.**
Port `HeightMapGenerate`, `HeightMapAdjustWaterLevel`, the random border draw,
`HeightMapCoastLines` (+ `perlin_coast_noise_2D`), `HeightMapSmoothSlopes`,
`HeightMapSmoothCoasts`, second `HeightMapSmoothSlopes`; skip `HeightMapSineTransform` and
`HeightMapCurves` (4.3.2: they cannot move the mask). Vertex height = `(h >> 4) >= 1 ? 1 : 0`.
Preserves: sea percentage from `quantity_sea_lakes`, inland seas/lakes, random border water on
0-4 edges with noisy carved coastlines, the smoothing that pulls coasts inland, and - with an
exact `Randomizer` and the same `Random()` calls before it (step 2) - the **same land/water mask
as OpenTTD 15.3 for a given seed** (modulo double-precision `sin`/`pow` and `long` width, see
section 8). Lost: all relief; every land vertex is 1. Cost: about 250 lines of TS (value noise,
histogram, six passes over the (N+1)^2 array); no data tables except the three small ones above;
the `int_noise` 64-bit arithmetic needs `BigInt` or an equivalent.

**Option B - water borders only on a flat land map.**
Start from all vertices at 1 and run only `HeightMapCoastLines` and `HeightMapSmoothCoasts`
(with `h = 16` elsewhere and the same random border draw). Preserves: the border-water look and
`BorderFlag::Random`. Lost: lakes and inland sea, `quantity_sea_lakes`, the `SmoothSlopes` shaping;
the map is a land rectangle with 0-4 irregular coasts. Cost: about 80 lines, one `Random()` call.
A map with no water border selected (probability 1/16) has no water at all.

**Option C - original generator, thresholded.**
`GenerateTerrain` x ~870-995 template overlays, then `h > 0 -> 1`. Preserves the legacy
"blobs of land" look and the sea/lake count rule `(3 - quantity_sea_lakes) * 256 + 100`.
Lost: border water and `custom_sea_level`. Cost: needs the 37 template sprites (4845..4881 in the
base graphics, not in the source tree) extracted as data - blocking for a source-faithful port -
and gives a different mask from the default generator (`land_generator` default is TerraGenesis).

**Recommendation (not an OpenTTD rule): Option A.** It is the only one that reproduces what a
default new game does (TerraGenesis, random borders, very low sea level), it needs no external
data, and thresholding at `h >= 16` is exact for the sea/land classification because
sine transform and curves never touch the sea mask (4.3.2), and `FixSlopes`/steep slopes cannot
occur with two levels. Port the steps in 4.3 as pure functions of `(seed, mapBits, settings)`
returning a vertex mask, keep `Randomizer` exactly as in section 3 so the stream can be matched
later, and keep `quantity_sea_lakes`/`terrain_type` as parameters (terrain type only changes
`h_max_new`, `roughness`, and the amplitude extrapolation).

## 7. Skipped

- Heightmap loading (`GWM_HEIGHTMAP`), `FlatEmptyWorld` and scenario-editor generation.
- Hills: `HeightMapSineTransform`, `HeightMapCurves`, `terrain_type` levels above sea level,
  `custom_terrain_type`, and the original generator (needs sprite data).
- Arctic snow line (`CalculateSnowLine`), tropic desert/rainforest (`CreateDesertOrRainForest`,
  `CalculateCoverageLine`); other climates' tree counts.
- Rivers, lakes made by rivers, wetlands (`FlowRiver`, `RiverMakeWider`, `MakeLake`,
  `MakeWetlands`, `TryMakeRiverTerminus`, `CountConnectedSeaTiles` - not read).
- `GenerateObjects` (lighthouses need coast tiles; transmitters), GameScript startup.
- Generation progress windows, abort handling.
- NewGRF-dependent generation (object/industry availability).

## 8. Open questions

1. **RNG fidelity.** Option A reproduces OpenTTD's mask only if the port uses the exact
   `Randomizer` and all `Random()` calls that precede terrain generation (one in
   `StartupEconomy`). Is that a Stage 1 goal (cross-cutting question 1 in `README.md`)? If not,
   a seeded generator with the same distributions suffices and the 2432 river-search draws, the
   engine seed and the 256 river tile-loop passes can be dropped.
2. **Platform-dependent noise.** `int_noise` uses `long`: 64-bit on Linux/macOS, 32-bit on
   Windows, and signed overflow in `n * (n * n * 15731 + 789221) + 1376312589` is undefined in
   C++. Which behaviour should the port copy? Also `sin`, `pow` and `float`/`double` mixing in
   `HeightMapCurves` (not needed) and `perlin_coast_noise_2D` (needed) may differ in the last bit
   between libm and V8; the effect on the mask is not known.
3. **Water tile loop vs `ConvertGround...`.** `ConvertGroundTilesIntoWaterTiles` makes a
   two/three-raised-corner tile a shore when a neighbour **in a flood direction** is flat or
   one-corner-raised (slope test only, not water test), while `TileLoop_Water` dries such a shore
   (`FLOOD_DRYUP`) back to grass unless a neighbour in those directions is `FLOOD_ACTIVE`. Which
   shores survive the 1280 passes was not traced; it needs a golden test against a real 15.3
   map or a port-and-compare. Until then port `TileLoop_Water` as written. This also contradicts
   `map.md` section 6 ("no effect while all land is at z >= 1"), which should be corrected.
4. **Void tile heights.** In `GenerateTerrainPerlin` the void row/column keep heightmap heights
   (4.3). Should the port store them (needed for exact SE/SW coast corners) or force 0?
   `MakeVoid` itself sets height 0 (`void_map.h`).
5. **`map_height_limit` for Stage 1.** The tree-count scaling `j * 15 / map_height_limit` depends
   on it (30 by default, derived in 4.1 step 0). Is it a fixed constant 30 in Stage 1, or derived
   from the (unused) terrain type?
6. **Rivers.** Default `amount_of_rivers = 2` means OpenTTD runs `CreateRivers`; by 4.8 it finds no
   spring on a 0/1 map, so the only observable effects are RNG consumption, a second
   `ConvertGround...` pass and 256 tile-loop passes (grass/shore updates; `TimerGameTick::counter`
   does not advance, so tile 0 is processed in every pass). Recommendation: skip rivers entirely
   (no feature to build until Stage 2 adds relief, since springs need higher ground); replicate the
   RNG draws and 256 passes only if question 1 is answered "exact". `SpiralTileSequence`,
   `FlowRiver` and `river_route_random` were not read.
7. **Objects and engines.** `GenerateObjects` and `StartupEngines`/`StartupDisasters` consume
   `Random()` before the tile loop; their call counts were not read. Needed only for an exact
   stream (question 1). `CreateStarShapedPolygon` (tree groves) was not read either.
8. **Void and `initial_land_count`.** `Map::CountLandTiles` counts every non-`MP_WATER` tile as
   land, including void tiles. Industry counts depend on it (`towns-industries.md` 4.13). Confirm
   the port counts the void row/column as land (the code says so).
