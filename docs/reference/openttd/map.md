# Map: size, tile index, tile types, tile storage, tile loop

## 1. Purpose

The map is a rectangular grid of `SizeX × SizeY` tiles, each side a power of two. Every tile
has a type (clear, rail, road, house, trees, station, water, void, industry, tunnel/bridge,
object) and a fixed set of small integer fields (`type`, `height`, `m1`..`m8`) whose meaning
depends on the type. A "tile loop" visits every tile once every 256 ticks in a pseudo-random
order and calls the type's periodic handler (grass growth, tree growth, flooding, house
cargo generation, ...).

## 2. Source files

| File                                   | Key items                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/map_type.h`                       | `MIN/MAX_MAP_SIZE_BITS`, `MIN/MAX_MAP_SIZE`, `TileIndexDiff`, `TileIndexDiffC`                                              |
| `src/map_func.h`                       | `Tile` (storage), `Map` (size, `ScaleBySize`), `TileXY`, `TileX`, `TileY`, `TileDiffXY`, `TileVirtXY`, offsets by direction |
| `src/map.cpp`                          | `Map::Allocate`, `Map::CountLandTiles`, `TileAddWrap`, offset tables, `Distance*`                                           |
| `src/tile_type.h`                      | `TileType` enum, `TILE_SIZE`, `TILE_HEIGHT`, `MAX_TILE_HEIGHT`, `TileIndex`, `INVALID_TILE`                                 |
| `src/tile_map.h/.cpp`                  | `GetTileType`/`SetTileType`, `IsInnerTile`, owner in m1, tropic zone, `GetTileSlopeZ`                                       |
| `src/tile_cmd.h`                       | `TileTypeProcs` (per-type callback table)                                                                                   |
| `src/landscape.cpp`                    | `_tile_type_procs[]`, `RunTileLoop`, `InitializeLandscape`, `CallLandscapeTick`                                             |
| `src/clear_map.h`, `src/clear_cmd.cpp` | Clear-tile bit layout, `MakeClear`; `TileLoop_Clear`, `GenerateClearTile`                                                   |
| `src/tree_map.h`, `src/tree_cmd.cpp`   | Tree-tile bit layout, `MakeTree`; `TileLoop_Trees`, `OnTick_Trees`, `GenerateTrees`, `PlaceTree`                            |
| `src/water_map.h`, `src/water_cmd.cpp` | Water bit layout, `MakeSea`/`MakeShore`/...; `TileLoop_Water`, `GetFloodingBehaviour`, `ConvertGroundTilesIntoWaterTiles`   |
| `src/void_map.h`, `src/void_cmd.cpp`   | `MakeVoid`; `TileLoop_Void` (floods neighbours)                                                                             |
| `src/heightmap.cpp`                    | `FlatEmptyWorld`                                                                                                            |
| `src/genworld.cpp`                     | north-border void tiles, flat world, water conversion order                                                                 |
| `docs/landscape.html`                  | Bit-by-bit layout of every tile type (reference doc, older than the code in places)                                         |

## 3. State

```
Map::log_x, log_y          uint   2^log_x == size_x
Map::size_x, size_y        uint   tiles per axis
Map::size                  uint   size_x * size_y
Map::tile_mask             uint   size - 1
Map::initial_land_count    uint   land tiles at generation (+1/12, capped at size)
_cur_tileloop_tile         TileIndex  LFSR state of the tile loop (never 0; init 1)
_trees_tick_ctr            uint8_t    counter for random tree planting
```

Per tile (`map_func.h:Tile`), stored as two parallel arrays of `size` entries:

| Array          | Field          | Type       | Usual meaning                                                                          |
| -------------- | -------------- | ---------- | -------------------------------------------------------------------------------------- |
| `TileBase`     | `type`         | `uint8_t`  | bits 7..4 `TileType`; bits 3..2 bridge above (0 none, 1 X, 2 Y); bits 1..0 tropic zone |
| `TileBase`     | `height`       | `uint8_t`  | Height of the **north corner**, 0..`MAX_TILE_HEIGHT` (255)                             |
| `TileBase`     | `m1`           | `uint8_t`  | bits 4..0 owner; bits 6..5 water class; bit 7 docking tile                             |
| `TileBase`     | `m2`           | `uint16_t` | Index into towns/industries/stations/depots                                            |
| `TileBase`     | `m3`,`m4`,`m5` | `uint8_t`  | Type specific                                                                          |
| `TileExtended` | `m6`           | `uint8_t`  | Type specific                                                                          |
| `TileExtended` | `m7`           | `uint8_t`  | Animation frame (houses, objects, industries, stations); NewGRF                        |
| `TileExtended` | `m8`           | `uint16_t` | bits 5..0 rail type on rail-bearing tiles; bits 11..6 tram type                        |

12 bytes per tile; 256×256 = 786 432 bytes. Owner values (`company_type.h`): companies
0x00..0x0E, `OWNER_TOWN` 0x0F, `OWNER_NONE` 0x10, `OWNER_WATER` 0x11, `OWNER_DEITY` 0x12.
`GetTileOwner` asserts the tile is not `MP_HOUSE`/`MP_INDUSTRY` (they reuse m1).

## 4. Rules and formulas

### 4.1 Sizes and constants

| Constant                    | Value                                       | Where           |
| --------------------------- | ------------------------------------------- | --------------- |
| `MIN_MAP_SIZE_BITS`         | 6 → `MIN_MAP_SIZE` 64                       | `map_type.h`    |
| `MAX_MAP_SIZE_BITS`         | 12 → `MAX_MAP_SIZE` 4096                    | `map_type.h`    |
| `TILE_SIZE`                 | 16 world units per tile                     | `tile_type.h`   |
| `TILE_UNIT_MASK`            | 15                                          | `tile_type.h`   |
| `TILE_PIXELS`               | 32                                          | `tile_type.h`   |
| `TILE_HEIGHT`               | 8 (world units and pixels per height level) | `tile_type.h`   |
| `MAX_TILE_HEIGHT`           | 255                                         | `tile_type.h`   |
| `INVALID_TILE`              | 0xFFFFFFFF                                  | `tile_type.h`   |
| `TILE_UPDATE_FREQUENCY_LOG` | 8 → `TILE_UPDATE_FREQUENCY` 256 ticks       | `landscape.cpp` |

`Map::Allocate(sx, sy)` fatally errors unless `64 <= sx,sy <= 4096` and both are powers of two
(`map.cpp:Map::Allocate`). Axes are independent (e.g. 256×64 is legal).

### 4.2 Tile index math (`map_func.h`)

```
TileXY(x, y)        = (y << LogX) + x
TileX(t)            = t & MaxX            // MaxX = SizeX - 1
TileY(t)            = t >> LogX
TileDiffXY(dx, dy)  = dy * SizeX + dx     // signed int32 TileIndexDiff
TileVirtXY(vx, vy)  = ((vy >> 4) << LogX) + (vx >> 4)    // world coords → tile
TileAdd(t, diff)    = t + diff            // no wrap check in release builds
AddTileIndexDiffCWrap(t, {dx,dy}): x=TileX+dx, y=TileY+dy; INVALID_TILE if x>=SizeX or y>=SizeY
TileAddWrap(t, dx, dy) (map.cpp): INVALID_TILE if x>=MaxX or y>=MaxY, or (x==0||y==0) with freeform_edges
Map::WrapToMap(t)   = t & tile_mask;  RandomTile() = Random() & tile_mask
Map::ScaleBySize(n) = ceil((n << (LogX+LogY-12)) / 16)   // = n * size / 65536, rounded up
Map::ScaleBySize1D(n) = ceil(((n << LogX) + (n << LogY)) / 512)
```

Offsets (`map.cpp`), as (dx, dy):

| DiagDirection | NE (0)  | SE (1) | SW (2) | NW (3)  |
| ------------- | ------- | ------ | ------ | ------- |
| offset        | (-1, 0) | (0, 1) | (1, 0) | (0, -1) |

| Direction | N (0)    | NE (1)  | E (2)   | SE (3) | S (4)  | SW (5) | W (6)   | NW (7)  |
| --------- | -------- | ------- | ------- | ------ | ------ | ------ | ------- | ------- |
| offset    | (-1, -1) | (-1, 0) | (-1, 1) | (0, 1) | (1, 1) | (1, 0) | (1, -1) | (0, -1) |

Axis X = (1, 0), Axis Y = (0, 1). So +x points south-west, +y points south-east; tile (0,0)
is the north corner of the map.

Distances (`map.cpp`): Manhattan `dx+dy`; Square `dx²+dy²`; Max `max(dx,dy)`;
MaxPlusManhattan `dx>dy ? 2dx+dy : 2dy+dx`; `DistanceFromEdge` = min distance to any side.

### 4.3 Tile types (`tile_type.h:TileType`) and their per-type use

| Value | Enum              | Stage 1 | Stores (brief; full layout in `docs/landscape.html`)                                                                                                                |
| ----- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `MP_CLEAR`        | yes     | ground kind + density + growth counter in m5; fences m3/m4/m6; fields m2/m3                                                                                         |
| 1     | `MP_RAILWAY`      | yes     | m5 bits 7..6 `RailTileType` (0 normal, 1 signals, 3 depot); track bits m5 5..0; depot dir m5 1..0, depot index m2; ground m4 3..0; rail type m8 5..0 (see track.md) |
| 2     | `MP_ROAD`         | no      | road bits, owner per road type, town index m2                                                                                                                       |
| 3     | `MP_HOUSE`        | yes     | town index m2, house type m8 11..0, construction state m3/m5 (see towns-industries.md)                                                                              |
| 4     | `MP_TREES`        | yes     | see 4.6                                                                                                                                                             |
| 5     | `MP_STATION`      | yes     | station index m2, station type m6 6..3, graphics/axis m5, rail type m8 (see stations-cargo.md)                                                                      |
| 6     | `MP_WATER`        | yes     | see 4.7                                                                                                                                                             |
| 7     | `MP_VOID`         | yes     | nothing (all fields 0, height 0 from `MakeVoid`)                                                                                                                    |
| 8     | `MP_INDUSTRY`     | yes     | industry index m2, gfx m5 (+m6 bit 2), construction stage m1 (see towns-industries.md)                                                                              |
| 9     | `MP_TUNNELBRIDGE` | no      | tunnel/bridge heads                                                                                                                                                 |
| 10    | `MP_OBJECT`       | no      | transmitters, lighthouses, owned land, company HQ                                                                                                                   |

`GetTileType(t) = type >> 4`; `SetTileType` asserts `IsInnerTile(t) == (type != MP_VOID)`
(`tile_map.h`). `IsInnerTile`: `x < MaxX && y < MaxY && ((x > 0 && y > 0) || !freeform_edges)`.
So the last row and column are always void; with `freeform_edges` row 0 and column 0 too.
`IsValidTile(t) = t < size && type != MP_VOID`.

Each type has a `TileTypeProcs` record (`tile_cmd.h`): draw, get_slope_z, clear, accepted
cargo, tile description, track status, click, animate, **tile_loop**, change owner, produced
cargo, vehicle_enter_tile, foundation, terraform, check_build_above. `_tile_type_procs[16]`
(`landscape.cpp`) maps `TileType` to these.

### 4.4 Height and slope (`tile_map.cpp:GetTileSlopeZ`)

`height` is only the **north** corner. Corners: N = h(x,y), W = h(x+1,y), E = h(x,y+1),
S = h(x+1,y+1) (clamped to map). Slope and base Z come from `GetTileSlopeGivenHeight` on those
four values. A tile is flat iff all four equal. Pixel Z = height × `TILE_HEIGHT` (8).

### 4.5 Clear tiles (`clear_map.h`, `clear_cmd.cpp`)

- m5 bits 1..0 density (0..3), bits 4..2 `ClearGround` (`GRASS 0, ROUGH 1, ROCKS 2, FIELDS 3,
SNOW 4 (not stored), DESERT 5`), bits 7..5 update counter. m3 bit 4 snow; m3 bits 3..0 field
  type; m2 field's industry. Fences: NE m3 7..5, SE m4 4..2, SW m4 7..5, NW m6 4..2.
- `MakeClear(t, g, density)`: type CLEAR, owner `OWNER_NONE`, m2=m3=m4=m6=m7=m8=0,
  m5 = `g << 2 | density`.
- `TileLoop_Clear` (temperate, not snow):
  ```
  GRASS: if density == 3: return
         if counter < 7: counter++; return
         counter = 0; density++
  FIELDS: fence update; counter as above; then field_type = field_type < 8 ? +1 : 0
          (if industry gone and field_type >= 7 → MakeClear(GRASS, 2))
  others: nothing
  ```
  i.e. bare grass gains one density step every 8 tile-loop visits (8 × 256 = 2048 ticks).
- `GenerateClearTile`: rough tiles `ScaleBySize(GB(Random(),0,10) + 0x400)` attempts;
  rock patches `ScaleBySize(GB(Random(),0,7) + 0x80)`, each patch `GB(r,16,4) + 5` steps of a
  random walk.
- `InitializeLandscape` (`landscape.cpp`): inner tiles → `MakeClear(GRASS, 3)`, height 0;
  last row/column → `MakeVoid`.

### 4.6 Tree tiles (`tree_map.h`, `tree_cmd.cpp`)

- m3 = `TreeType` (temperate 0x00..0x0B, `TREE_COUNT_TEMPERATE` = 12); m5 bits 7..6 = count−1
  (1..4 trees), bits 2..0 growth (`Growing1..3 = 0..2`, `Grown 3`, `Dying1..2 = 4..5`,
  `Dead 6`); m2 bits 8..6 ground (`GRASS 0, ROUGH 1, SNOW_DESERT 2, SHORE 3, ROUGH_SNOW 4`),
  bits 5..4 ground density; m1 water class (Sea if shore, else Invalid), owner `OWNER_NONE`.
- `TileLoop_Trees`:
  ```
  cycle = 11*TileX + 9*TileY + (TimerGameTick::counter >> 8)
  if (cycle & 7) == 7 and ground == GRASS and density < 3: density++
  if extra_tree_placement == NO_GROWTH_NO_SPREAD: return
  if cycle % 16 != 15: return                       // TREE_UPDATE_FREQUENCY = 16
  switch growth:
    Grown: r = GB(Random(),0,3)
      0: growth++ (start dying)
      1: if count < 4 and can spread: count++, growth = Growing1; else fall through
      2: if can spread: neighbour = tile + TileOffsByDir(Random() % 8);
         if plantable and not freshly-cleared grass (density != 3): plant 1 tree, Growing1
      else: return
    Dead: if !can spread: growth = Growing1
          elif count > 1: count--, growth = Grown
          else: revert to MakeClear(GRASS, density) / ROUGH / shore
    default: growth++
  ```
- `OnTick_Trees` (every tick, `ETP_SPREAD_ALL`): skip unless
  `ScaleBySize(16) >= 16 || (counter & (16/ScaleBySize(16) - 1)) == 0`; then
  `_trees_tick_ctr -= ScaleBySize(1)` (uint8); on underflow plant one tree on a random
  plantable tile (`PlantRandomTree`).
- Generation `GenerateTrees` with `TP_IMPROVED`: `num_groups = ScaleBySize(GB(Random(),0,5) + 25)`
  groves (`PlaceTreeGroups`, radius 16, 1000 attempts each), then `PlaceTreesRandomly` ×2
  (each `ScaleBySize(DEFAULT_TREE_STEPS = 1000)` random tiles, plus `GetTileZ*2` extra trees
  nearby — zero on height-0 tiles). `PlaceTree(tile, r)`: type `GB(r,24,8)*12/256`,
  count `GB(r,22,2)`, growth `min(GB(r,16,3), 6)`, ground re-randomised to `GB(r,28,1)` (grass
  or rough) density 3.
- `CanPlantTreesOnTile`: clear tile not fields/rocks (desert optional), or coast water tile.

### 4.7 Water tiles (`water_map.h`, `water_cmd.cpp`)

- m5 bits 7..4 `WaterTileType` (`Clear 0, Coast 1, Lock 2, Depot 3`); m1 bits 6..5
  `WaterClass` (`Sea 0, Canal 1, River 2, Invalid 3`); m3 bit 0 non-flooding flag; m4 random
  bits (canal/river); m2 depot index.
- `MakeSea(t)` = `MakeWater(t, OWNER_WATER, Sea, 0)`; `MakeShore(t)`: type WATER, owner WATER,
  class Sea, water type Coast.
- `ConvertGroundTilesIntoWaterTiles` (`water_cmd.cpp`): every `MP_CLEAR` tile with base
  z == 0 becomes sea if flat, shore if one corner raised (or bordering flat/void per
  `_flood_from_dirs`). **Land must be at height ≥ 1.**
- `TileLoop_Water` / flooding: `FLOOD_ACTIVE` for sea, single-corner coast and `MP_VOID`
  (`TileLoop_Void` calls `TileLoop_Water`). Active tiles try all 8 neighbours; a neighbour is
  flooded only if its foundation z == 0 and its slope admits water from that side. A water
  tile whose valid neighbours are all water (or buoys/docks) sets its non-flooding bit and is
  skipped afterwards; any land neighbour, even at z > 0, keeps it active.

### 4.8 Tile loop (`landscape.cpp:RunTileLoop`)

```
feedbacks = [0xD8F, 0x1296, 0x2496, 0x4357, 0x8679, 0x1030E, 0x206CD, 0x403FE,
             0x807B8, 0x1004B2, 0x2006A8, 0x4004B2, 0x800B87]
feedback = feedbacks[LogX + LogY - 12]
count = 1 << (LogX + LogY - 8)                 // tiles per tick = size / 256
tile = _cur_tileloop_tile                      // never 0
if TimerGameTick::counter % 256 == 0:          // counter already incremented this tick
    tile_loop_proc(tile 0); count--
repeat count times:
    _tile_type_procs[GetTileType(tile)].tile_loop_proc(tile)
    tile = (tile >> 1) ^ (-(tile & 1) & feedback)     // Galois LFSR, 32-bit
_cur_tileloop_tile = tile
```

The LFSR has period `size − 1` over tiles 1..size−1, so every tile (including void) is
visited exactly once per 256 ticks. Tiles per tick: 64² → 16, 256² → 256, 1024² → 4096,
4096² → 65 536. Initial state 1 (`misc.cpp:InitializeGame`). Runs after the date/timer update
and before vehicle ticks (see time.md §4.3). House tiles generate passengers here
(`town_cmd.cpp:TileLoop_Town`).

## 5. Defaults

| Setting                              | Default                   | Range / note                           | ini                     |
| ------------------------------------ | ------------------------- | -------------------------------------- | ----------------------- |
| `game_creation.map_x` / `map_y`      | 8 / 8 (256×256)           | 6..12 (bits); not in save              | world_settings.ini      |
| `construction.freeform_edges`        | true                      | north row/column are void too          | world_settings.ini      |
| `game_creation.landscape`            | 0 (temperate)             |                                        | world_settings.ini      |
| `game_creation.land_generator`       | 1 (TerraGenesis)          | 0 original                             | world_settings.ini      |
| `game_creation.se_flat_world_height` | 1                         | 0..15; height used by `FlatEmptyWorld` | world_settings.ini      |
| `game_creation.tree_placer`          | 2 (`TP_IMPROVED`)         | 0 none, 1 original                     | world_settings.ini      |
| `construction.extra_tree_placement`  | 2 (`ETP_SPREAD_ALL`)      | 0..3                                   | world_settings.ini      |
| `game_creation.water_borders`        | 16 (`BorderFlag::Random`) | bits NE,SE,SW,NW,Random                | world_settings.ini      |
| `game_creation.water_border_presets` | 0 (`BFP_RANDOM`)          |                                        | world_settings.ini      |
| `difficulty.quantity_sea_lakes`      | 0                         |                                        | difficulty_settings.ini |
| `difficulty.terrain_type`            | 1                         |                                        | difficulty_settings.ini |
| `construction.map_height_limit`      | 0 (auto)                  |                                        | world_settings.ini      |

## 6. Stage 1 needs

- `Map` with power-of-two sizes 64..4096 (default 256×256), `TileXY`/`TileX`/`TileY`/
  `TileDiffXY`/`TileVirtXY`, direction offset tables, Manhattan/Max distances, `ScaleBySize`.
- Per-tile fields `type, height, m1..m8` with the same bit layouts, so later notes
  (track, stations, houses, industries) can be ported field for field.
- Tile types used: CLEAR, RAILWAY, HOUSE, TREES, STATION, WATER, VOID, INDUSTRY. Void border
  on the last row/column and (freeform edges) the first row/column.
- `RunTileLoop` with the LFSR order and tile-0 rule; tile loop procs for clear (grass
  growth), trees (growth/spread/death), water (no effect while all land is at z >= 1), void,
  house (passengers), industry, station, rail (ground/fences).
- Generation: flat land at height 1, sea at height 0, `MakeClear(GRASS,3)`, rough/rocks,
  trees per §4.6.

## 7. Skipped

- Terrain generators (original/TerraGenesis), heightmaps, slopes, foundations, terraforming —
  no height in Stage 1 (but slope is derived from corner heights, see §8).
- Snow/desert/tropic zones (other climates), fields/farms, fences.
- Roads, tunnels/bridges (bridge bits in `type`), objects, locks, canals, rivers, ship depots,
  docking tiles, water regions (`AllocateWaterRegions`, ship pathfinding).
- NewGRF: m7 animation, ambient sound callback (`AmbientSoundEffect` only runs with a NewGRF
  flag; when it runs it consumes `Random()` via `Chance16R`).

## 8. Open questions

- "Flat map with water": in OpenTTD a tile's slope comes from its neighbours' heights, and
  land at height 0 turns into sea. Sea (h=0) next to land (h=1) therefore makes the bordering
  land tiles sloped (coast). How should Stage 1 represent coastlines without slopes — keep
  OpenTTD heights and allow only those coast slopes, or store a flat "water" type with no
  height?
- Does Stage 1 use freeform edges (default true: void north row/column) or the
  original layout (only south-east/south-west void)?
- Tree spreading consumes `Random()` in the tile loop and in `OnTick_Trees`. Is bit-exact
  determinism with OpenTTD's RNG a Stage 1 goal (it decides whether the LFSR order and call
  order must match exactly)?
- `docs/landscape.html` partly predates 15.3 (its intro lists only "m1..m7", while the code
  has m8). Treat the headers (`*_map.h`) as authoritative wherever the two differ?
- Which tree types/sprites appear when `GetTreeCount` and growth vary is decided in drawing
  code not read here (`tree_cmd.cpp:DrawTile_Trees`); out of scope for this note.
