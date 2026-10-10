# Stage 1.2 — World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate OpenTTD worlds — sea and coast, rough land and rocks, trees, towns with roads and houses, coal mines and power stations — from a new-game window, and explore them with a query tool and town and industry windows, on desktop and phone, deployed to a preview URL for the author's playtest.

**Architecture:** `src/sim/world/generate.ts` ports `genworld.cpp:_GenerateWorld` as a generator function (`generateGame`) that yields its progress, so `src/app/` runs it in short time slices instead of freezing the tab. Every OpenTTD subsystem it calls gets its own module with OpenTTD's tile bit layouts: TerraGenesis (`world/tgp.ts`), water (`map/water.ts`, `map/flood.ts`), trees (`map/tree-map.ts`, `world/trees.ts`), town roads and houses (`map/road-map.ts`, `map/house-map.ts`, `town/*`), industries (`map/industry-map.ts`, `industry/*`). `src/render/` draws the new ground sprites in the existing chunked tilemaps and adds one depth-sorted object layer (a Phaser `Blitter`) per chunk for trees, houses and industry tiles. `src/ui/` adds the new-game window, the query tool and the town and industry windows, fed by read-only query functions in `src/sim/query.ts`.

**Tech Stack:** unchanged from block 1.1 — TypeScript 7, Vite 8, Phaser 4.2, Preact 11, Vitest 5 (+ happy-dom, @testing-library/preact), Playwright 1.64, oxlint. No new dependencies.

**Spec:** [`stage-1-first-train.md`](stage-1-first-train.md) — §2 (D1, D4, D7), §3, §4 (map, themes), §5, §6 block 1.2, §7. Sources (formulas and constants): [`map.md`](../reference/openttd/map.md), [`world-generation.md`](../reference/openttd/world-generation.md), [`roads.md`](../reference/openttd/roads.md), [`town-building.md`](../reference/openttd/town-building.md), [`towns-industries.md`](../reference/openttd/towns-industries.md), cross-cutting questions in [`README.md`](../reference/openttd/README.md). The C++ is in `reference/OpenTTD/src` (read it with absolute paths; never `cd` into `reference/`).

## Global Constraints

Project rules (from block 1.1, still binding):

- Everything committed is in English; ported code cites `// Port of <file>:<function>` (OpenTTD 15.3).
- Host: project port **4317**, e2e base `/openttd-web/`, two Playwright projects (`chromium` desktop, `phone` Pixel 7 touch). Never stop processes by name pattern; stop them by PID.
- `src/sim/` imports nothing from Phaser, DOM, Node, `render/`, `ui/`, `app/`; no `Math.random`, `Date`, timers, `performance` (oxlint + `tsconfig.sim.json`). Test files under `src/sim/` follow the same rules, so timing tests live in `tests/perf/`.
- `ui/` never imports `app/`, `render/` or Phaser; `render/` never imports `app/` or `ui/` (lint-enforced). `ui/` may import types and query functions from `sim/`. `MapScene` takes a `GameState`.
- Integer arithmetic in `src/sim/` except where the C++ uses floating point (ruling R3); uint32 values are kept in `0..2^32-1` with `>>> 0`.
- Lint lessons from 1.1: Phaser through named imports (`import { Scene, GameObjects } from 'phaser'`), never default-import member access; no helper functions declared inside tests (unicorn/consistent-function-scoping) — put them at module scope; `toThrow(...)` always with a message or regex; no `.sort()` (use `toSorted`). TS 7 strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (`import type` for types; optional properties are omitted, never set to `undefined`).
- Workflow (spec §7): the controller creates each task's issue and `feat/…` branch; every task opens its PR **into `stage-1/block-1.2`**. Conventional commits, body explains why, `Refs #N` (the controller fills `N`), no co-authorship trailers.
- No new dependencies. Every user-facing string is an i18n key; `en.json` and `es.json` always have the same keys. Town names are proper nouns and are not translated.
- `INVALID_TILE` is `-1` in the port (OpenTTD's `0xFFFFFFFF`).

Controller rulings for this block (binding):

- **R1 (D1) Random numbers:** same generator and formulas; the `Random()` stream is not bit-identical with OpenTTD. Do **not** replicate draws that have no effect on a Stage 1 map: `StartupEconomy`'s draw, river attempts and their extra `ConvertGround…`/256 tile-loop passes, `StartupEngines`, `GenerateObjects`, the `Chance16(1, 6)` draws before `LevelTownLand` (a no-op under R11), and `CreateNewIndustry`'s `random_var8f` draw (NewGRF only). Keep every draw whose result is stored in OpenTTD state (map fields, town/industry fields) or decides an outcome. Rivers are skipped.
- **R2 Water:** `world-generation.md` Option A — TGP up to and including the second `HeightMapSmoothSlopes`, then vertex height `(h >> 4) >= 1 ? 1 : 0`, then `ConvertGroundTilesIntoWaterTiles` as in OpenTTD; water borders from `water_borders = BorderFlag::Random` with `GB(Random(), 0, 4)`. Void tiles keep the height-map height (as OpenTTD does). `map_height_limit` fixed at 30. Fix `map.md`'s claim that the water tile loop has no effect on a flat map (Task 3).
- **R3 Floating point:** TGP's floating-point steps (coast noise, star-shaped tree groves) are ported as in C++ (`Math.fround` where C++ uses `float`); generation is deterministic for a seed on one JS engine, not guaranteed across engines; `int_noise` uses 32-bit two's complement (`Math.imul`, `| 0`). Listed in `docs/game/differences.md` (multiplayer will ship the map instead of regenerating it).
- **R4 Towns:** layout fixed to `TL_ORIGINAL`; town count and industry density are OpenTTD's defaults (D7) and the new-game window can change them; houses are generated as in OpenTTD (some unfinished; `TileLoop_Town`'s construction advance completes them); no passenger generation (block 1.5); towns do **not** grow during play (the growth walk runs only inside `DoCreateTown`).
- **R5 Roads:** only `MP_ROAD` normal tiles (`RoadTileType::Normal`). Level crossings, player rail over town roads and bulldozing belong to block 1.3.
- **R6 Industries:** only coal mines and power stations; placement rules and layouts from `towns-industries.md` §4.9, §4.13.
- **R7 Rendering:** a depth-sorted object layer for trees, houses and industry tiles (top-to-bottom in the 3/4 view); ground sprites for water, coast (per slope), roads (by road bits), rough, rocks; all through new `SPRITE_IDS` and placeholder SVGs in the "blocks" theme. The default-theme coverage test keeps passing.
- **R8 UI:** new-game window (map size per axis 64..1024, number of towns, industry density, seed; "Generate" replaces the session's `GameState`), query tool (tile type and owner; house tiles open the town window, industry tiles the industry window), town window (name, population, houses), industry window (type name, location). en/es. Phone/desktop layouts of 1.1 (`Panel`). Generation runs in time slices with a "Generating world… N%" state; a test budgets 256×256 generation in Node; 1024×1024 stays possible.
- **R9 Tests:** exact values where the notes give them; property tests for generation; a golden replay hash for a fixed seed and size; e2e for the new-game window, the query tool and the windows on both projects.

Rulings this plan needed beyond R1–R9 (flagged to the controller):

- **R10 Industry counts:** `GenerateIndustries` uses the full temperate land probability table (10 types, total chance 55) so the number of coal mines and power stations matches a default OpenTTD game; a pick of a type that does not exist in Stage 1 consumes its draw and places nothing.
- **R11 No building on slopes (extends D4):** town roads and houses are only built on flat tiles (`IsRoadAllowedHere` returns false on a sloped tile without the slope branch's draws; `CanBuildHouseHere` needs a flat tile; `LevelTownLand` is a no-op); an industry needs every vertex of its platform area at the north tile's height (`CheckIfCanLevelIndustryPlatform` accepts only already-level sites, no terraforming). Only coast-side land at height 0 is affected. Listed in `differences.md`.
- **R12 Generation failure:** when no town can be placed (OpenTTD aborts with "could not create town"), the session keeps the current world and the new-game window shows the error.
- **R13 R9 property wording:** "every house is adjacent to a town road" is not an OpenTTD invariant (a later house may replace a one-piece road stub next to it), so it is tested at build time (each new house touches a road when built). "Every coast tile borders land" is tested as "every coast tile is at z = 0 with at least one raised corner" (a single raised vertex can be surrounded by four shores).
- **R14 Start parameters:** the page accepts `?seed=N&size=WxH&tile=X,Y` (seed, map size, initial camera tile) for e2e and for sharing a world; the app writes `data-world-hash` on `<html>` after each generation.
- Closest town ties (`ClosestTownFromTile`, a kd-tree in OpenTTD) are broken by the lowest town index (D1).

## Review Focus

1. **No town fits** (a 64×64 map that is mostly sea, or an unlucky seed): OpenTTD aborts generation; the player must keep the current world and see why, never a crash or an empty map. Pinned in Task 9 (`generateTowns` on an all-sea map throws `WorldGenerationError('error.noTownCreated')`) and Task 12 (session keeps the old state and exposes the error; the new-game window shows it).
2. **"Generate" pressed again while a world is generating:** only the latest request may finish; two worlds must never interleave or both be handed to the renderer. Pinned in Task 12 (session test with two requests).
3. **Junk in the seed field** (`abc`, `-1`, `4294967296`, empty): no `NaN` or out-of-range seed may reach the simulation; "Generate" is disabled instead. Pinned in Task 12 (`parseSeed` test and component test).
4. **A drag or pinch that ends over the map is not a tap:** after panning on a phone with the query tool on, no window may pop up. Pinned in Task 13 (`classifyPress` unit test and an e2e drag test).
5. **Non-square maps** (256×64, 64×128): TGP's `min(LogX, LogY)`, `ScaleBySize`, chunks and camera bounds must all hold. Pinned in Task 1 (offsets and `ScaleBySize` on 256×64), Task 2 (draw count on 128×64), Task 4 (invariants on 256×64 and 64×256) and Task 12 (e2e generates 64×128).

---

## File map

| Path                                                                                                                                                                                        | Responsibility                                                                | Task |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| `src/sim/map/geometry.ts`, `src/sim/map/slope.ts` (+ tests)                                                                                                                                 | Directions, offsets, distances, map scaling, spiral, slopes                   | 1    |
| `src/sim/world/settings.ts`, `src/sim/world/tgp.ts` (+ test), `docs/game/differences.md`                                                                                                    | Stage 1 world constants, TerraGenesis land mask                               | 2    |
| `src/sim/map/water.ts`, `src/sim/map/flood.ts`, `src/sim/map/tree-map.ts`, `src/sim/map/landscape.ts` (+ tests), `src/sim/game.ts`, `docs/reference/openttd/map.md`                         | Sea/shore tiles, conversion, water tile loop, tree tile layout, land clearing | 3    |
| `src/sim/world/generate.ts`, `src/sim/world/clear-gen.ts`, `src/sim/world/errors.ts` (+ test), `src/sim/game.ts`, `tests/perf/generation.test.ts`, `src/app/main.tsx`                       | Generation pipeline, rough/rocks, land count, settle passes, golden hash      | 4    |
| `src/sim/world/trees.ts` (+ test), `src/sim/game.ts`, `src/sim/world/generate.ts`                                                                                                           | Tree generation, tree tile loop, random planting                              | 5    |
| `src/sim/map/road-map.ts`, `src/sim/town/town.ts`, `src/sim/town/town-roads.ts` (+ tests), `src/sim/map/landscape.ts`, `src/sim/game.ts`                                                    | Town road tiles, town state and zones, road helpers, roadside loop            | 6    |
| `src/sim/map/house-map.ts`, `src/sim/town/house-specs.ts`, `src/sim/town/houses.ts` (+ tests), `src/sim/game.ts`                                                                            | House tiles, house table, house building, construction loop                   | 7    |
| `src/sim/town/growth.ts` (+ test)                                                                                                                                                           | Town growth walk (roads and houses)                                           | 8    |
| `src/sim/town/town-names.ts`, `src/sim/town/town-gen.ts` (+ tests), `src/sim/world/generate.ts`                                                                                             | English town names, town placement and creation                               | 9    |
| `src/sim/map/industry-map.ts`, `src/sim/industry/industry-specs.ts`, `src/sim/industry/industry-gen.ts` (+ tests), `src/sim/game.ts`, `src/sim/world/generate.ts`                           | Industry tiles, specs, placement, construction loop                           | 10   |
| `src/render/theme.ts`, `src/render/ground.ts`, `src/render/objects.ts`, `src/render/atlas.ts` (+ tests), `src/render/MapScene.ts`, `tools/blocks-theme.mjs`, `public/themes/blocks/**`      | Ground and object sprites, object layer, town labels                          | 11   |
| `src/app/generation.ts`, `src/app/start-params.ts`, `src/app/session.ts` (+ tests), `src/app/main.tsx`, `src/ui/NewGame.tsx` (+ test), `src/ui/*`, `tests/e2e/new-game.spec.ts`             | Background generation, new-game window                                        | 12   |
| `src/sim/query.ts` (+ test), `src/render/gesture.ts` (+ test), `src/ui/TileInfo.tsx`, `src/ui/TownWindow.tsx`, `src/ui/IndustryWindow.tsx` (+ test), `src/app/*`, `tests/e2e/query.spec.ts` | Query tool, tile/town/industry windows                                        | 13   |
| `docs/game/block-1.2.md`, `docs/game/differences.md`, `docs/plan/TRACKING.md`                                                                                                               | Playtest guide, block close                                                   | 14   |

Run every task's unit tests with `npx vitest run <path>`; before each commit run `npm test && npm run lint && npm run typecheck` (all green) and, for tasks touching `app/`, `ui/` or `render/`, `npm run test:e2e`.

---

### Task 1: Map geometry and slopes

**Files:**

- Create: `src/sim/map/geometry.ts`, `src/sim/map/slope.ts`, `src/sim/map/geometry.test.ts`, `src/sim/map/slope.test.ts`

**Interfaces:**

- Consumes (1.1): `MapState`, `createMap`, `tileXY`, `tileX`, `tileY`, `getTileType`, `TileType`, `makeVoid` from `map.ts`.
- Produces (`geometry.ts`): `DiagDir` (`NE 0, SE 1, SW 2, NW 3`) + type, `Dir` (`N 0, NE 1, E 2, SE 3, S 4, SW 5, W 6, NW 7`) + type, `DIAGDIR_OFFSETS: readonly (readonly [number, number])[]`, `DIR_OFFSETS`, `INVALID_TILE = -1`, `reverseDiagDir(d: DiagDir): DiagDir`, `diagDirRight(d): DiagDir`, `diagDirLeft(d): DiagDir`, `reverseDir(d: Dir): Dir`, `tileDiffXY(map, dx, dy): number`, `tileOffsByDiagDir(map, d: DiagDir): number`, `tileOffsByDir(map, d: Dir): number`, `tileAddXY(map, t, dx, dy): number`, `tileAddWrap(map, t, dx, dy): number`, `addTileIndexDiffCWrap(map, t, dx, dy): number`, `isValidTile(map, t): boolean`, `distanceManhattan(map, a, b)`, `distanceSquare(map, a, b)`, `distanceMax(map, a, b)`, `distanceFromEdge(map, t)`, `scaleBySize(map, n)`, `scaleBySize1D(map, n)`, `scaleByLandProportion(n, initialLandCount, mapSize)`, `randomTile(map, r): number`, `spiralTiles(map, centre, diameter): number[]`.
- Produces (`slope.ts`): `Slope` (`Flat 0, W 1, S 2, E 4, N 8, Steep 16`), `getTileSlopeZ(map, t): { slope: number; z: number }`, `getTileSlope(map, t): number`, `getTileZ(map, t): number`, `getTileMaxZ(map, t): number`, `isTileFlat(map, t): boolean`, `isSlopeWithOneCornerRaised(slope: number): boolean`.

- [ ] **Step 1: Write the failing tests**

`src/sim/map/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addTileIndexDiffCWrap,
  DiagDir,
  Dir,
  distanceFromEdge,
  distanceManhattan,
  distanceMax,
  distanceSquare,
  INVALID_TILE,
  isValidTile,
  randomTile,
  reverseDiagDir,
  scaleByLandProportion,
  scaleBySize,
  scaleBySize1D,
  spiralTiles,
  tileAddWrap,
  tileOffsByDiagDir,
  tileOffsByDir,
} from './geometry';
import { createMap, makeVoid, tileX, tileXY, tileY, type MapState } from './map';

const coords = (map: MapState, tiles: number[]): [number, number][] =>
  tiles.map((t) => [tileX(map, t), tileY(map, t)]);

describe('tile offsets (port of map.cpp offset tables)', () => {
  it('follows OpenTTD directions on a 256×64 map', () => {
    const map = createMap(8, 6);
    const diag = [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const;
    expect(diag.map((d) => tileOffsByDiagDir(map, d))).toEqual([-1, 256, 1, -256]);
    const dirs = [Dir.N, Dir.E, Dir.S, Dir.W] as const;
    expect(dirs.map((d) => tileOffsByDir(map, d))).toEqual([-257, 255, 257, -255]);
    expect(reverseDiagDir(DiagDir.NE)).toBe(DiagDir.SW);
  });

  it('wraps like TileAddWrap with freeform edges', () => {
    const map = createMap(6, 6);
    expect(tileAddWrap(map, tileXY(map, 1, 1), -1, 0)).toBe(INVALID_TILE);
    expect(tileAddWrap(map, tileXY(map, 62, 5), 1, 0)).toBe(INVALID_TILE);
    expect(tileAddWrap(map, tileXY(map, 10, 10), 3, -2)).toBe(tileXY(map, 13, 8));
  });

  it('wraps like AddTileIndexDiffCWrap', () => {
    const map = createMap(6, 6);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 0, 5), -1, 0)).toBe(INVALID_TILE);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 63, 5), 1, 0)).toBe(INVALID_TILE);
    expect(addTileIndexDiffCWrap(map, tileXY(map, 63, 5), 0, 1)).toBe(tileXY(map, 63, 6));
  });

  it('treats void and out-of-range tiles as invalid', () => {
    const map = createMap(6, 6);
    makeVoid(map, 0);
    const tiles = [0, tileXY(map, 5, 5), -1, map.size];
    expect(tiles.map((t) => isValidTile(map, t))).toEqual([false, true, false, false]);
  });
});

describe('distances (port of map.cpp)', () => {
  it('measures Manhattan, square, max and edge distance', () => {
    const map = createMap(6, 6);
    const a = tileXY(map, 10, 20);
    const b = tileXY(map, 13, 16);
    expect([
      distanceManhattan(map, a, b),
      distanceSquare(map, a, b),
      distanceMax(map, a, b),
    ]).toEqual([7, 25, 4]);
    expect(distanceFromEdge(map, tileXY(map, 10, 60))).toBe(3);
  });
});

describe('scaling by map size (port of map_func.h)', () => {
  it.each([
    [6, 6, 23, 2],
    [6, 6, 1, 1],
    [8, 8, 23, 23],
    [10, 10, 23, 368],
    [8, 6, 23, 6],
  ])('ScaleBySize on 2^%i×2^%i turns %i into %i', (logX, logY, n, expected) => {
    expect(scaleBySize(createMap(logX, logY), n)).toBe(expected);
  });

  it('scales by circumference and by the land proportion', () => {
    expect([6, 8, 10].map((log) => scaleBySize1D(createMap(log, log), 64))).toEqual([16, 64, 256]);
    expect(scaleByLandProportion(23, 3328, 4096)).toBe(18);
  });

  it('picks a random tile from the low bits (RandomTileSeed)', () => {
    const map = createMap(6, 6);
    expect([randomTile(map, 0xffffffff), randomTile(map, 536872454)]).toEqual([4095, 1542]);
  });
});

describe('SpiralTileSequence (port of tilearea.cpp:SpiralTileIterator)', () => {
  it('starts at the centre for odd diameters, then rings from the west corner', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, tileXY(map, 10, 10), 3))).toEqual([
      [10, 10],
      [11, 9],
      [10, 9],
      [9, 9],
      [9, 10],
      [9, 11],
      [10, 11],
      [11, 11],
      [11, 10],
    ]);
    expect(spiralTiles(map, tileXY(map, 10, 10), 5)).toHaveLength(25);
  });

  it('starts with the 2×2 block for even diameters', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, tileXY(map, 10, 10), 2))).toEqual([
      [11, 10],
      [10, 10],
      [10, 11],
      [11, 11],
    ]);
    expect(spiralTiles(map, tileXY(map, 10, 10), 4)).toHaveLength(16);
  });

  it('skips tiles outside the map', () => {
    const map = createMap(6, 6);
    expect(coords(map, spiralTiles(map, 0, 3))).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
  });
});
```

`src/sim/map/slope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMap, tileXY, type MapState } from './map';
import {
  getTileMaxZ,
  getTileSlopeZ,
  getTileZ,
  isSlopeWithOneCornerRaised,
  isTileFlat,
  Slope,
} from './slope';

const setHeight = (map: MapState, x: number, y: number, h: number): void => {
  map.height[tileXY(map, x, y)] = h;
};

describe('GetTileSlopeZ (port of tile_map.cpp)', () => {
  it('reads the N, W, E and S corners from the tile and its neighbours', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 10, 10);
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.Flat, z: 0 });
    setHeight(map, 11, 10, 1); // W corner
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.W, z: 0 });
    expect(isSlopeWithOneCornerRaised(Slope.W)).toBe(true);
    setHeight(map, 11, 11, 1); // S corner
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.W | Slope.S, z: 0 });
    expect(isSlopeWithOneCornerRaised(Slope.W | Slope.S)).toBe(false);
    setHeight(map, 10, 10, 1);
    setHeight(map, 10, 11, 1);
    expect(getTileSlopeZ(map, t)).toEqual({ slope: Slope.Flat, z: 1 });
    expect([isTileFlat(map, t), getTileZ(map, t), getTileMaxZ(map, t)]).toEqual([true, 1, 1]);
  });

  it('flags a corner two levels up as steep', () => {
    const map = createMap(6, 6);
    setHeight(map, 10, 10, 2);
    expect(getTileSlopeZ(map, tileXY(map, 10, 10))).toEqual({ slope: Slope.N | Slope.Steep, z: 0 });
  });

  it('clamps the corners of the last column to the map', () => {
    const map = createMap(6, 6);
    setHeight(map, 63, 10, 1);
    expect(getTileSlopeZ(map, tileXY(map, 63, 10))).toEqual({ slope: Slope.N | Slope.W, z: 0 });
    expect(getTileMaxZ(map, tileXY(map, 63, 10))).toBe(1);
  });
});
```

Run: `npx vitest run src/sim/map/geometry.test.ts src/sim/map/slope.test.ts` — Expected: FAIL, cannot resolve `./geometry` and `./slope`.

- [ ] **Step 2: Implement `geometry.ts`**

```ts
import { getTileType, TileType, tileX, tileXY, tileY, type MapState } from './map';

/** Port of direction_type.h:DiagDirection. */
export const DiagDir = { NE: 0, SE: 1, SW: 2, NW: 3 } as const;
export type DiagDir = (typeof DiagDir)[keyof typeof DiagDir];

/** Port of direction_type.h:Direction. */
export const Dir = { N: 0, NE: 1, E: 2, SE: 3, S: 4, SW: 5, W: 6, NW: 7 } as const;
export type Dir = (typeof Dir)[keyof typeof Dir];

/** (dx, dy) per DiagDirection. Port of map.cpp:_tileoffs_by_diagdir. */
export const DIAGDIR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];
/** (dx, dy) per Direction. Port of map.cpp:_tileoffs_by_dir. */
export const DIR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
];

/** OpenTTD's INVALID_TILE (0xFFFFFFFF). */
export const INVALID_TILE = -1;

export const reverseDiagDir = (d: DiagDir): DiagDir => (d ^ 2) as DiagDir;
/** Port of direction_func.h:ChangeDiagDir(d, DIAGDIRDIFF_90RIGHT). */
export const diagDirRight = (d: DiagDir): DiagDir => ((d + 1) & 3) as DiagDir;
/** Port of direction_func.h:ChangeDiagDir(d, DIAGDIRDIFF_90LEFT). */
export const diagDirLeft = (d: DiagDir): DiagDir => ((d + 3) & 3) as DiagDir;
export const reverseDir = (d: Dir): Dir => (d ^ 4) as Dir;

/** Port of map_func.h:TileDiffXY. */
export const tileDiffXY = (map: MapState, dx: number, dy: number): number => dy * map.sizeX + dx;

export function tileOffsByDiagDir(map: MapState, d: DiagDir): number {
  const [dx, dy] = DIAGDIR_OFFSETS[d]!;
  return tileDiffXY(map, dx, dy);
}

export function tileOffsByDir(map: MapState, d: Dir): number {
  const [dx, dy] = DIR_OFFSETS[d]!;
  return tileDiffXY(map, dx, dy);
}

/** Port of map_func.h:TileAddXY (no wrap check, like the C++ release build). */
export const tileAddXY = (map: MapState, t: number, dx: number, dy: number): number =>
  t + tileDiffXY(map, dx, dy);

/** Port of map.cpp:TileAddWrap with freeform edges (row 0 and column 0 are refused). */
export function tileAddWrap(map: MapState, t: number, dx: number, dy: number): number {
  const x = tileX(map, t) + dx;
  const y = tileY(map, t) + dy;
  // C++ uses uint: a negative x or y wraps to a huge value and fails the MaxX/MaxY test.
  if (x <= 0 || y <= 0) return INVALID_TILE;
  if (x >= map.sizeX - 1 || y >= map.sizeY - 1) return INVALID_TILE;
  return tileXY(map, x, y);
}

/** Port of map_func.h:AddTileIndexDiffCWrap. */
export function addTileIndexDiffCWrap(map: MapState, t: number, dx: number, dy: number): number {
  const x = tileX(map, t) + dx;
  const y = tileY(map, t) + dy;
  if (x < 0 || y < 0 || x >= map.sizeX || y >= map.sizeY) return INVALID_TILE;
  return tileXY(map, x, y);
}

/** Port of map_func.h:IsValidTile. */
export const isValidTile = (map: MapState, t: number): boolean =>
  t >= 0 && t < map.size && getTileType(map, t) !== TileType.Void;

const absDx = (map: MapState, a: number, b: number): number =>
  Math.abs(tileX(map, a) - tileX(map, b));
const absDy = (map: MapState, a: number, b: number): number =>
  Math.abs(tileY(map, a) - tileY(map, b));

/** Port of map.cpp:DistanceManhattan. */
export const distanceManhattan = (map: MapState, a: number, b: number): number =>
  absDx(map, a, b) + absDy(map, a, b);
/** Port of map.cpp:DistanceSquare. */
export const distanceSquare = (map: MapState, a: number, b: number): number =>
  absDx(map, a, b) ** 2 + absDy(map, a, b) ** 2;
/** Port of map.cpp:DistanceMax. */
export const distanceMax = (map: MapState, a: number, b: number): number =>
  Math.max(absDx(map, a, b), absDy(map, a, b));

/** Port of map.cpp:DistanceFromEdge. */
export function distanceFromEdge(map: MapState, t: number): number {
  const x = tileX(map, t);
  const y = tileY(map, t);
  return Math.min(x, y, map.sizeX - 1 - x, map.sizeY - 1 - y);
}

/** n defined for 256×256, scaled by area and rounded up. Port of map_func.h:Map::ScaleBySize. */
export const scaleBySize = (map: MapState, n: number): number =>
  Math.floor((n * 2 ** (map.logX + map.logY - 12) + 15) / 16);

/** n defined for 256×256, scaled by half the circumference. Port of map_func.h:Map::ScaleBySize1D. */
export const scaleBySize1D = (map: MapState, n: number): number =>
  Math.floor((n * 2 ** map.logX + n * 2 ** map.logY + 511) / 512);

/** Port of map_func.h:Map::ScaleByLandProportion (64-bit product, truncating). */
export const scaleByLandProportion = (
  n: number,
  initialLandCount: number,
  mapSize: number,
): number => Math.floor((n * initialLandCount) / mapSize);

/** Port of map_func.h:RandomTileSeed (`r` is a uint32 draw). */
export const randomTile = (map: MapState, r: number): number => r & (map.size - 1);

/**
 * Tiles of a square spiral, skipping tiles outside the map. Port of
 * tilearea.cpp:SpiralTileIterator (the `center, diameter` constructor).
 */
export function spiralTiles(map: MapState, centre: number, diameter: number): number[] {
  const tiles: number[] = [];
  const maxRadius = Math.floor(diameter / 2);
  const extent = diameter % 2 === 1 ? 1 : 0;
  let x = tileX(map, centre);
  let y = tileY(map, centre);
  const inside = (): boolean => x >= 0 && y >= 0 && x < map.sizeX && y < map.sizeY;
  if (diameter % 2 === 1) {
    if (inside()) tiles.push(tileXY(map, x, y));
    x += 1; // DIR_W offset (1, -1): west corner of the first ring
    y -= 1;
  } else {
    x += 1; // west corner of the centre 2×2 block
  }
  let radius = 0;
  let dir = 0;
  let position = extent + 1;
  while (radius < maxRadius) {
    if (inside()) tiles.push(tileXY(map, x, y));
    const [ox, oy] = DIAGDIR_OFFSETS[dir]!;
    x += ox;
    y += oy;
    if (--position > 0) continue;
    if (++dir === 4) {
      x += 1;
      y -= 1;
      radius++;
      dir = 0;
    }
    position = extent + radius * 2 + 1;
  }
  return tiles;
}
```

- [ ] **Step 3: Implement `slope.ts`**

```ts
import { tileX, tileXY, tileY, type MapState } from './map';

/** Port of slope_type.h:Slope (corner bits; Steep marks a corner two levels up). */
export const Slope = { Flat: 0, W: 1, S: 2, E: 4, N: 8, Steep: 16 } as const;

/** Port of tile_map.cpp:GetTileSlopeZ (N = this tile, W = x+1, E = y+1, S = both; clamped). */
export function getTileSlopeZ(map: MapState, t: number): { slope: number; z: number } {
  const x1 = tileX(map, t);
  const y1 = tileY(map, t);
  const x2 = Math.min(x1 + 1, map.sizeX - 1);
  const y2 = Math.min(y1 + 1, map.sizeY - 1);
  const n = map.height[t]!;
  const w = map.height[tileXY(map, x2, y1)]!;
  const e = map.height[tileXY(map, x1, y2)]!;
  const s = map.height[tileXY(map, x2, y2)]!;
  const min = Math.min(n, w, e, s);
  let slope: number = Slope.Flat;
  if (n !== min) slope |= Slope.N;
  if (w !== min) slope |= Slope.W;
  if (e !== min) slope |= Slope.E;
  if (s !== min) slope |= Slope.S;
  if (Math.max(n, w, e, s) - min === 2) slope |= Slope.Steep;
  return { slope, z: min };
}

export const getTileSlope = (map: MapState, t: number): number => getTileSlopeZ(map, t).slope;
/** Port of tile_map.h:GetTileZ (lowest corner). */
export const getTileZ = (map: MapState, t: number): number => getTileSlopeZ(map, t).z;
export const isTileFlat = (map: MapState, t: number): boolean =>
  getTileSlope(map, t) === Slope.Flat;

/** Port of tile_map.cpp:GetTileMaxZ (highest corner). */
export function getTileMaxZ(map: MapState, t: number): number {
  const x1 = tileX(map, t);
  const y1 = tileY(map, t);
  const x2 = Math.min(x1 + 1, map.sizeX - 1);
  const y2 = Math.min(y1 + 1, map.sizeY - 1);
  return Math.max(
    map.height[t]!,
    map.height[tileXY(map, x2, y1)]!,
    map.height[tileXY(map, x1, y2)]!,
    map.height[tileXY(map, x2, y2)]!,
  );
}

/** Port of slope_func.h:IsSlopeWithOneCornerRaised. */
export const isSlopeWithOneCornerRaised = (slope: number): boolean =>
  slope === Slope.W || slope === Slope.S || slope === Slope.E || slope === Slope.N;
```

Run: `npx vitest run src/sim/map` — Expected: all passed. Then `npm run lint && npm run typecheck`.

- [ ] **Step 4: Commit** — `feat: port map geometry and tile slopes` (body: every generation step needs OpenTTD's offsets, wrap rules, `ScaleBySize` and corner-based slopes; the spiral order decides which tile wins ties in town placement, so it is ported from the iterator rather than reinvented. `Refs #N`). PR into `stage-1/block-1.2`.

---

### Task 2: TerraGenesis land mask

**Files:**

- Create: `src/sim/world/settings.ts`, `src/sim/world/tgp.ts`, `src/sim/world/tgp.test.ts`
- Modify: `docs/game/differences.md`

**Interfaces:**

- Consumes: `Randomizer`, `nextRandom`, `randomRange` (1.1); `createMap`, `isInnerTile`, `makeVoid`, `tileXY` (1.1); `ClearGround`, `makeClear` (1.1).
- Produces (`settings.ts`): `WORLD` (readonly constants: `terrainType 1`, `smoothness 1`, `quantitySeaLakes 0`, `mapHeightLimit 30`, `largerTowns 4`, `initialCitySize 2`, `industryPlatform 1`).
- Produces (`tgp.ts`): `i2h(i)`, `h2i(h)`, `a2h(a)`, `BorderFlag` (`NorthEast 1, SouthEast 2, SouthWest 4, NorthWest 8`), `tgpMaxHeight(logX, logY): number`, `getAmplitude(frequency, logX, logY): number`, `interface HeightMap { h: Int16Array; sizeX: number; sizeY: number; dimX: number }`, `createHeightMap(sizeX, sizeY): HeightMap`, `randomHeight(r: Randomizer, amplitude: number): number`, `heightMapGenerate(hm, r, logX, logY): void`, `heightMapAdjustWaterLevel(hm, waterPercent, hMaxNew): void`, `intNoise(x, y, prime, seed): number`, `perlinCoastNoise2D(x, y, p, prime, seed): number`, `heightMapCoastLines(hm, borders, smallestLog, seed): void`, `heightMapSmoothCoastInDirection(hm, orgX, orgY, dirX, dirY): void`, `heightMapSmoothCoasts(hm, borders): void`, `heightMapSmoothSlopes(hm, dhMax): void`, `generateTerrain(map: MapState, r: Randomizer, seed: number): void`.

- [ ] **Step 1: Write the failing test** (`src/sim/world/tgp.test.ts`). Values: `int_noise` computed independently in C with uint32 arithmetic; `RandomHeight` from the 1.1 random vectors; pass examples worked by hand from `tgp.cpp`.

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createMap, getTileType, TileType, tileXY } from '../map/map';
import {
  a2h,
  createHeightMap,
  generateTerrain,
  getAmplitude,
  h2i,
  heightMapAdjustWaterLevel,
  heightMapGenerate,
  heightMapSmoothCoastInDirection,
  heightMapSmoothSlopes,
  i2h,
  intNoise,
  randomHeight,
  tgpMaxHeight,
} from './tgp';

const advanced = (seed: number, draws: number): Randomizer => {
  const r = createRandomizer(seed);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

const terrainHeights = (seed: number): Uint8Array => {
  const map = createMap(6, 6);
  generateTerrain(map, createRandomizer(seed), seed);
  return map.height;
};

describe('TGP fixed point and tables (port of tgp.cpp)', () => {
  it('converts heights and amplitudes with arithmetic shifts', () => {
    expect([i2h(1), i2h(8), h2i(31), h2i(-1), a2h(64), a2h(-1)]).toEqual([16, 128, 1, -1, 1, -1]);
  });

  it('picks the flat-terrain maximum height by the smaller map side', () => {
    const sizes = [
      [6, 6],
      [7, 7],
      [8, 8],
      [9, 9],
      [10, 10],
      [10, 6],
    ] as const;
    expect(sizes.map(([x, y]) => tgpMaxHeight(x, y))).toEqual([80, 112, 128, 144, 224, 80]);
  });

  it('uses the smooth amplitudes and drops octaves the map is too low for', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9].map((f) => getAmplitude(f, 8, 8))).toEqual([
      0, 24000, 12800, 6400, 2700, 1024, 128, 16,
    ]);
    expect([0, 1, 2, 3].map((f) => getAmplitude(f, 10, 10))).toEqual([0, 0, 0, 24000]);
  });

  it('spreads random heights over ±amplitude like RandomHeight', () => {
    const r = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomHeight(r, 24000))).toEqual([
      -282, 238, 327, -165, 361,
    ]);
    const r2 = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomHeight(r2, 1024))).toEqual([-12, 10, 13, -7, 15]);
  });
});

describe('coast noise with 32-bit integers (port of tgp.cpp:int_noise, ruling R3)', () => {
  it.each([
    [0, 0, 53, 0, -0.2817909838631749],
    [5, 7, 179, 12345, -0.8151024850085378],
    [100, 3, 101, 0xdeadbeef, 0.9190056482329965],
    [-3, 250, 211, 42, -0.03440327662974596],
  ])('int_noise(%i, %i, %i) with seed %i', (x, y, prime, seed, expected) => {
    expect(intNoise(x, y, prime, seed)).toBe(expected);
  });
});

describe('height map passes (port of tgp.cpp)', () => {
  it('HeightMapSmoothSlopes caps each vertex at its neighbours plus dh', () => {
    const hm = createHeightMap(2, 2);
    hm.h.set([0, 100, 100, 100, 100, 100, 100, 100, 100]);
    heightMapSmoothSlopes(hm, 10);
    expect([...hm.h]).toEqual([0, 10, 20, 10, 20, 30, 20, 30, 40]);
  });

  it('HeightMapSmoothCoastInDirection softens the first land it meets', () => {
    const hm = createHeightMap(8, 2);
    for (let x = 3; x <= 8; x++) hm.h[x] = 80;
    heightMapSmoothCoastInDirection(hm, 0, 0, 1, 0);
    expect([...hm.h.subarray(0, 9)]).toEqual([0, 0, 0, 20, 25, 31, 38, 46, 80]);
  });

  it('HeightMapAdjustWaterLevel maps the water level to 16 and clamps', () => {
    const hm = createHeightMap(2, 2);
    hm.h.set([-20, -10, 0, 10, 20, 30, 40, 50, 60]);
    heightMapAdjustWaterLevel(hm, 512, 128);
    expect([...hm.h]).toEqual([0, 16, 34, 52, 70, 89, 107, 125, 127]);
  });

  it.each([
    [6, 6, 5718],
    [7, 6, 11304],
    [8, 8, 88399],
  ] as const)('HeightMapGenerate on 2^%i×2^%i draws Random() %i times', (logX, logY, draws) => {
    const r = createRandomizer(7);
    heightMapGenerate(createHeightMap(1 << logX, 1 << logY), r, logX, logY);
    expect(r).toEqual(advanced(7, draws));
  });
});

describe('generateTerrain (TGP up to the second SmoothSlopes, ruling R2)', () => {
  it('writes two height levels, a void border and grass inside', () => {
    const map = createMap(6, 6);
    generateTerrain(map, createRandomizer(1), 1);
    expect(map.height.every((h) => h <= 1)).toBe(true);
    for (const [x, y] of [
      [0, 5],
      [5, 0],
      [63, 5],
      [5, 63],
    ] as const) {
      expect(getTileType(map, tileXY(map, x, y))).toBe(TileType.Void);
    }
    expect(getTileType(map, tileXY(map, 5, 5))).toBe(TileType.Clear);
  });

  it('draws the water borders right after the noise (one more Random())', () => {
    const r = createRandomizer(1);
    generateTerrain(createMap(6, 6), r, 1);
    expect(r).toEqual(advanced(1, 5719));
  });

  it('is deterministic for a seed and changes with it', () => {
    expect(terrainHeights(1)).toEqual(terrainHeights(1));
    expect(terrainHeights(1)).not.toEqual(terrainHeights(2));
  });
});
```

Run: `npx vitest run src/sim/world/tgp.test.ts` — Expected: FAIL, cannot resolve `./tgp`.

- [ ] **Step 2: Implement `settings.ts`**

```ts
/**
 * Stage 1 world settings: OpenTTD 15.3 defaults that the new-game window does not expose.
 * Sources: table/settings/world_settings.ini, difficulty_settings.ini, economy_settings.ini.
 */
export const WORLD = {
  /** difficulty.terrain_type: 1 = Flat. */
  terrainType: 1,
  /** game_creation.tgen_smoothness: 1 = Smooth. */
  smoothness: 1,
  /** difficulty.quantity_sea_lakes: 0 = Very low. */
  quantitySeaLakes: 0,
  /** construction.map_height_limit, fixed for Stage 1 (ruling R2; "auto" gives 30 on maps up to 1024²). */
  mapHeightLimit: 30,
  /** economy.larger_towns: one town in four is a city. */
  largerTowns: 4,
  /** economy.initial_city_size. */
  initialCitySize: 2,
  /** construction.industry_platform. */
  industryPlatform: 1,
} as const;
```

- [ ] **Step 3: Implement `tgp.ts`** — port of `tgp.cpp` (`TGPGetMaxHeight`, `GetAmplitude`, `RandomHeight`, `HeightMapGenerate`, `HeightMapGetMinMaxAvg`, `HeightMapMakeHistogram`, `HeightMapAdjustWaterLevel`, `int_noise`, `interpolated_noise`, `perlin_coast_noise_2D`, `HeightMapCoastLines`, `HeightMapSmoothCoastInDirection`, `HeightMapSmoothCoasts`, `HeightMapSmoothSlopes`, `HeightMapNormalize` up to the second smoothing, `GenerateTerrainPerlin`'s transfer). The height map is an `Int16Array`, so `+=` wraps like C++'s `int16_t`. C++ integer division truncates: use `Math.trunc` on every `/` between integers.

```ts
import { nextRandom, randomRange, type Randomizer } from '../core/random';
import { ClearGround, makeClear } from '../map/clear';
import { isInnerTile, makeVoid, tileXY, type MapState } from '../map/map';
import { WORLD } from './settings';

const HEIGHT_DECIMAL_BITS = 4;
const AMPLITUDE_DECIMAL_BITS = 10;
const MAX_TGP_FREQUENCIES = 10;
const WATER_PERCENT_FACTOR = 1024;
/** Port of tgp.cpp:_water_percent (by difficulty.quantity_sea_lakes). */
const WATER_PERCENT = [70, 170, 270, 420] as const;
/** Port of tgp.cpp:TGPGetMaxHeight max_height[terrain_type][min(LogX, LogY) - 6]. */
const MAX_HEIGHT = [
  [3, 3, 3, 3, 4, 5, 7],
  [5, 7, 8, 9, 14, 19, 31],
  [8, 9, 10, 15, 23, 37, 61],
  [10, 11, 17, 19, 49, 63, 73],
  [12, 19, 25, 31, 67, 75, 87],
] as const;
/** Port of tgp.cpp:GetAmplitude amplitudes[smoothness] (×1024). */
const AMPLITUDES = [
  [16000, 5600, 1968, 688, 240, 16, 16],
  [24000, 12800, 6400, 2700, 1024, 128, 16],
  [32000, 19200, 12800, 8000, 3200, 256, 64],
  [48000, 24000, 19200, 16000, 8000, 512, 320],
] as const;
const EXTRAPOLATION_FACTORS = [3.3, 2.8, 2.3, 1.8] as const;

export const i2h = (i: number): number => i << HEIGHT_DECIMAL_BITS;
export const h2i = (h: number): number => h >> HEIGHT_DECIMAL_BITS;
export const a2h = (a: number): number => a >> (AMPLITUDE_DECIMAL_BITS - HEIGHT_DECIMAL_BITS);

/** Port of genworld.h:BorderFlag (bit per map edge). */
export const BorderFlag = { NorthEast: 1, SouthEast: 2, SouthWest: 4, NorthWest: 8 } as const;

export function tgpMaxHeight(logX: number, logY: number): number {
  const fromTable = MAX_HEIGHT[WORLD.terrainType][Math.min(logX, logY) - 6]!;
  return i2h(Math.min(fromTable, WORLD.mapHeightLimit));
}

export function getAmplitude(frequency: number, logX: number, logY: number): number {
  const table = AMPLITUDES[WORLD.smoothness];
  let index = frequency - MAX_TGP_FREQUENCIES + table.length;
  let amplitude: number = table[Math.max(0, index)]!;
  if (index >= 0) return amplitude;
  const factor = EXTRAPOLATION_FACTORS[WORLD.smoothness];
  let heightRange = i2h(16);
  do {
    amplitude = Math.trunc(factor * amplitude);
    heightRange <<= 1;
    index++;
  } while (index < 0);
  const k = Math.trunc((tgpMaxHeight(logX, logY) - heightRange) / heightRange);
  return Math.min(Math.max(k, 0), 1) * amplitude;
}

export interface HeightMap {
  h: Int16Array;
  sizeX: number;
  sizeY: number;
  dimX: number;
}

export function createHeightMap(sizeX: number, sizeY: number): HeightMap {
  return { h: new Int16Array((sizeX + 1) * (sizeY + 1)), sizeX, sizeY, dimX: sizeX + 1 };
}

const at = (hm: HeightMap, x: number, y: number): number => x + y * hm.dimX;

export const randomHeight = (r: Randomizer, amplitude: number): number =>
  a2h(randomRange(r, 2 * amplitude + 1) - amplitude);

export function heightMapGenerate(hm: HeightMap, r: Randomizer, logX: number, logY: number): void {
  const start = Math.max(MAX_TGP_FREQUENCIES - Math.min(logX, logY), 0);
  let first = true;
  for (let frequency = start; frequency < MAX_TGP_FREQUENCIES; frequency++) {
    const amplitude = getAmplitude(frequency, logX, logY);
    if (amplitude === 0) continue;
    const step = 1 << (MAX_TGP_FREQUENCIES - frequency - 1);
    if (first) {
      for (let y = 0; y <= hm.sizeY; y += step)
        for (let x = 0; x <= hm.sizeX; x += step) hm.h[at(hm, x, y)] = randomHeight(r, amplitude);
      first = false;
      continue;
    }
    for (let y = 0; y <= hm.sizeY; y += 2 * step)
      for (let x = 0; x <= hm.sizeX - 2 * step; x += 2 * step)
        hm.h[at(hm, x + step, y)] = Math.trunc(
          (hm.h[at(hm, x, y)]! + hm.h[at(hm, x + 2 * step, y)]!) / 2,
        );
    for (let y = 0; y <= hm.sizeY - 2 * step; y += 2 * step)
      for (let x = 0; x <= hm.sizeX; x += step)
        hm.h[at(hm, x, y + step)] = Math.trunc(
          (hm.h[at(hm, x, y)]! + hm.h[at(hm, x, y + 2 * step)]!) / 2,
        );
    for (let y = 0; y <= hm.sizeY; y += step) {
      for (let x = 0; x <= hm.sizeX; x += step) {
        const i = at(hm, x, y);
        hm.h[i] = hm.h[i]! + randomHeight(r, amplitude); // Int16Array store wraps like int16_t +=
      }
    }
  }
}
```

Port the remaining functions with these exact semantics (read `tgp.cpp` alongside):

- `heightMapAdjustWaterLevel(hm, waterPercent, hMaxNew)`: `hMin`/`hMax` over **all** `(sizeX+1)×(sizeY+1)` entries; `desired = Math.trunc(waterPercent * sizeX * sizeY / WATER_PERCENT_FACTOR)`; histogram walk from `hMin` while `level < hMax` (break when the running count `>= desired`); then every entry `h = Math.trunc(hMaxNew * (h - level) / (hMax - level)) + i2h(1)`, `h < 0 → 0`, `h >= hMaxNew → hMaxNew - 1`.
- `intNoise(x, y, prime, seed)` (ruling R3, 32-bit):

  ```ts
  export function intNoise(x: number, y: number, prime: number, seed: number): number {
    let n = (x + Math.imul(y, prime) + seed) | 0;
    n = ((n << 13) ^ n) | 0;
    const v = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) | 0;
    return 1.0 - (v & 0x7fffffff) / 1073741824.0;
  }
  ```

- `interpolatedNoise`: integer parts with `Math.trunc` (C++ `(int)`), four `intNoise` corners, two linear interpolations in x then one in y (`a + f * (b - a)`).
- `perlinCoastNoise2D(x, y, p, prime, seed)`: `for i in 0..5: total += interpolatedNoise((x * (1 << i)) / 64, (y * (1 << i)) / 64, prime, seed) * Math.pow(p, i)`.
- `heightMapCoastLines(hm, borders, smallestLog, seed)`: `S = Math.trunc(smallestLog * smallestLog / 64)`, `margin = 4`; the four edge formulas of `world-generation.md` §4.3.3 with primes 53/179 (NE), 101/67 (SW), 167/211 (NW), 71/193 (SE), `Math.abs`, `max(S + m, S + margin - m)`, the `/ 1.5` rule when `smallestLog < 8 && m > 5`, loops exactly as in C++ (`for (x = 0; x < max_x; x++)`, `for (x = sizeX; x > sizeX - 1 - max_x; x--)`, same for y).
- `heightMapSmoothCoastInDirection`: `IsValidXY` is `0 <= x < sizeX && 0 <= y < sizeY` (not `dimX`); search ≤ 35 steps for `h >= i2h(1)` or a side neighbour `> 0`; then smooth ≤ 36 tiles with `h = Math.min(h, hPrev + 4 + depth)` starting from `hPrev = i2h(1)`.
- `heightMapSmoothCoasts(hm, borders)`: NW and SE first (`for x < sizeX`), then NE and SW (`for y < sizeY`), start points and directions as in `world-generation.md` §4.3.4.
- `heightMapSmoothSlopes(hm, dhMax)`: ascending scan with the `x-1`/`y-1` neighbours (clamped to the vertex itself at 0), then descending scan with `x+1`/`y+1` (clamped at `sizeX`/`sizeY`).

`generateTerrain` ties it together:

```ts
/**
 * TerraGenesis up to the second HeightMapSmoothSlopes, thresholded to two levels (ruling R2),
 * then InitializeLandscape's tile types. Port of tgp.cpp:GenerateTerrainPerlin.
 */
export function generateTerrain(map: MapState, r: Randomizer, seed: number): void {
  const hm = createHeightMap(map.sizeX, map.sizeY);
  heightMapGenerate(hm, r, map.logX, map.logY);
  const hMaxNew = tgpMaxHeight(map.logX, map.logY);
  const roughness = 7 + 3 * WORLD.smoothness;
  heightMapAdjustWaterLevel(hm, WATER_PERCENT[WORLD.quantitySeaLakes], hMaxNew);
  const borders = nextRandom(r) & 0xf; // water_borders == BorderFlag::Random: GB(Random(), 0, 4)
  heightMapCoastLines(hm, borders, Math.min(map.logX, map.logY), seed);
  heightMapSmoothSlopes(hm, roughness);
  heightMapSmoothCoasts(hm, borders);
  heightMapSmoothSlopes(hm, roughness);
  // HeightMapSineTransform and HeightMapCurves never move a vertex across level 1 (world-generation.md §4.3.2).
  for (let y = 0; y < map.sizeY; y++) {
    for (let x = 0; x < map.sizeX; x++) {
      const t = tileXY(map, x, y);
      if (isInnerTile(map, t)) makeClear(map, t, ClearGround.Grass, 3);
      else makeVoid(map, t);
      // Void tiles keep the height-map height, as OpenTTD does (ruling R2).
      map.height[t] = h2i(hm.h[at(hm, x, y)]!) >= 1 ? 1 : 0;
    }
  }
}
```

(`WATER_PERCENT_FACTOR` is used by `heightMapAdjustWaterLevel`.)

Run: `npx vitest run src/sim/world/tgp.test.ts` — Expected: all passed.

- [ ] **Step 4: Document the floating-point limitation** — add a row to the table in `docs/game/differences.md`:

```markdown
| World generation | Same map on every machine | Same seed gives the same world on one browser engine; another engine may differ | TerraGenesis's floating-point steps are ported as in C++ (ruling R3); multiplayer will send the map instead of regenerating it |
```

- [ ] **Step 5: Commit** — `feat: port TerraGenesis for the sea and land mask` (body: ruling R2 — TerraGenesis up to the second smoothing is what decides where the sea is, so a two-level map keeps OpenTTD's lakes, sea level and noisy coasts; `int_noise` is 32-bit to be the same on every platform JavaScript runs on. `Refs #N`). PR into the block branch.

---

### Task 3: Sea, shore and the water tile loop

**Files:**

- Create: `src/sim/map/water.ts`, `src/sim/map/flood.ts`, `src/sim/map/tree-map.ts`, `src/sim/map/landscape.ts`, `src/sim/map/water.test.ts`, `src/sim/map/tree-map.test.ts`
- Modify: `src/sim/game.ts`, `src/sim/game.test.ts`, `docs/reference/openttd/map.md`

**Interfaces:**

- Consumes: Task 1 (`Dir`, `DIR_OFFSETS`, `addTileIndexDiffCWrap`, `isValidTile`, `reverseDir`, `tileOffsByDir`, `getTileSlopeZ`, `getTileSlope`, `isSlopeWithOneCornerRaised`, `Slope`); 1.1 (`makeClear`, `ClearGround`, `resetTileKeepingHeight`, `setTileType`, `OWNER_NONE`, `OWNER_WATER`).
- Produces (`water.ts`): `WaterClass` (`Sea 0, Canal 1, River 2, Invalid 3`), `WaterTileType` (`Clear 0, Coast 1, Lock 2, Depot 3`), `makeSea(map, t)`, `makeShore(map, t)`, `getWaterClass(map, t)`, `setWaterClass(map, t, wc)`, `getWaterTileType(map, t)`, `isWaterTile(map, t)` (water type Clear), `isCoastTile(map, t)`, `hasTileWaterClass(map, t)`, `isTileOnWater(map, t)`, `hasTileWaterGround(map, t)`, `isNonFloodingWaterTile(map, t)`, `setNonFloodingWaterTile(map, t, on)`, `clearNeighbourNonFloodingStates(map, t)`.
- Produces (`tree-map.ts`): `TreeGround` (`Grass 0, Rough 1, SnowDesert 2, Shore 3, RoughSnow 4`), `TreeGrowth` (`Growing1 0 … Grown 3, Dying1 4, Dying2 5, Dead 6`), `TREE_COUNT_TEMPERATE = 12`, `makeTree(map, t, type, count, growth, ground, density)` (`count` = trees − 1), `getTreeType`, `getTreeGround`, `getTreeDensity`, `setTreeGroundDensity(map, t, ground, density)`, `getTreeCount` (1..4), `addTreeCount(map, t, c)`, `getTreeGrowth`, `setTreeGrowth(map, t, g)`, `addTreeGrowth(map, t, a)`.
- Produces (`landscape.ts`): `doClearSquare(map, t, generatingWorld: boolean): void`, `canAutoClear(map, t, noWater: boolean): boolean` (extended for roads in Task 6).
- Produces (`flood.ts`): `FLOOD_FROM_DIRS: readonly (readonly Dir[])[]` (index = slope 0..14, ascending `Dir` order like OpenTTD's `Directions` bitset), `FloodingBehaviour` (`None 0, Active 1, Passive 2, DryUp 3`), `getFloodingBehaviour(map, t)`, `convertGroundTilesIntoWaterTiles(map)`, `tileLoopWater(map, t, markDirty)`, `tileLoopVoid(map, t, markDirty)`.
- Produces (`game.ts`): `createEmptyGame(options?: Partial<GameOptions>): GameState` — port of `heightmap.cpp:FlatEmptyWorld` (every tile, void included, at height 1); the 1.1 `createGame` now calls it (Task 4 replaces `createGame`). `tick` runs the water and void tile loops.

- [ ] **Step 1: Write the failing tests**

`src/sim/map/tree-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { getTileType, TileType, tileXY } from './map';
import {
  getTreeCount,
  getTreeDensity,
  getTreeGround,
  getTreeGrowth,
  getTreeType,
  makeTree,
  TreeGround,
  TreeGrowth,
} from './tree-map';
import { getWaterClass, WaterClass } from './water';

describe('tree tiles (port of tree_map.h)', () => {
  it('makes a tree tile with the MakeTree bit layout', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 5, 2, TreeGrowth.Grown, TreeGround.Rough, 3);
    expect(getTileType(map, t)).toBe(TileType.Trees);
    expect([map.m1[t], map.m2[t], map.m3[t], map.m4[t], map.m5[t]]).toEqual([0x70, 112, 5, 0, 131]);
    expect([
      getTreeType(map, t),
      getTreeCount(map, t),
      getTreeGrowth(map, t),
      getTreeGround(map, t),
      getTreeDensity(map, t),
    ]).toEqual([5, 3, TreeGrowth.Grown, TreeGround.Rough, 3]);
  });

  it('puts trees on a shore in the sea water class', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 0, 0, TreeGrowth.Growing1, TreeGround.Shore, 3);
    expect([map.m1[t], getWaterClass(map, t)]).toEqual([0x10, WaterClass.Sea]);
  });
});
```

`src/sim/map/water.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { ClearGround, getClearDensity, getClearGround } from './clear';
import {
  convertGroundTilesIntoWaterTiles,
  FLOOD_FROM_DIRS,
  FloodingBehaviour,
  getFloodingBehaviour,
  tileLoopVoid,
  tileLoopWater,
} from './flood';
import { Dir } from './geometry';
import { canAutoClear, doClearSquare } from './landscape';
import {
  getTileType,
  OWNER_NONE,
  OWNER_WATER,
  setTileType,
  TileType,
  tileXY,
  type MapState,
} from './map';
import { getTreeGround, makeTree, TreeGround, TreeGrowth } from './tree-map';
import {
  getWaterTileType,
  isCoastTile,
  isNonFloodingWaterTile,
  isWaterTile,
  makeSea,
  makeShore,
  WaterTileType,
} from './water';

const NOOP = (): void => undefined;

/** Flat 64×64 world with a 5×5 block of height-0 vertices at (20..24, 20..24). */
const lakeMap = (): MapState => {
  const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  for (let y = 20; y <= 24; y++) for (let x = 20; x <= 24; x++) map.height[tileXY(map, x, y)] = 0;
  return map;
};

const count = (map: MapState, test: (t: number) => boolean): number => {
  let n = 0;
  for (let t = 0; t < map.size; t++) if (test(t)) n++;
  return n;
};

describe('water tiles (port of water_map.h)', () => {
  it('makes sea and shore tiles owned by water', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const sea = tileXY(map, 5, 5);
    const shore = tileXY(map, 6, 5);
    makeSea(map, sea);
    makeShore(map, shore);
    expect([map.m1[sea], map.m5[sea], map.m1[shore], map.m5[shore]]).toEqual([
      OWNER_WATER,
      0x00,
      OWNER_WATER,
      0x10,
    ]);
    expect([isWaterTile(map, sea), isCoastTile(map, shore), getWaterTileType(map, shore)]).toEqual([
      true,
      true,
      WaterTileType.Coast,
    ]);
  });
});

describe('ConvertGroundTilesIntoWaterTiles (port of water_cmd.cpp)', () => {
  it('keeps the flood-from table of water_cmd.cpp, in Directions bit order', () => {
    expect(FLOOD_FROM_DIRS).toEqual([
      [Dir.NE, Dir.SE, Dir.SW, Dir.NW],
      [Dir.NE, Dir.SE],
      [Dir.NE, Dir.NW],
      [Dir.NE],
      [Dir.SW, Dir.NW],
      [],
      [Dir.NW],
      [Dir.N, Dir.NE, Dir.NW],
      [Dir.SE, Dir.SW],
      [Dir.SE],
      [],
      [Dir.NE, Dir.E, Dir.SE],
      [Dir.SW],
      [Dir.SE, Dir.S, Dir.SW],
      [Dir.SW, Dir.W, Dir.NW],
    ]);
  });

  it('turns all-zero tiles into sea and the sloped ring around them into shore', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    expect(count(map, (t) => isWaterTile(map, t))).toBe(16);
    expect(count(map, (t) => isCoastTile(map, t))).toBe(20);
    expect(isWaterTile(map, tileXY(map, 20, 20)) && isWaterTile(map, tileXY(map, 23, 23))).toBe(
      true,
    );
    expect(isCoastTile(map, tileXY(map, 19, 19)) && isCoastTile(map, tileXY(map, 24, 21))).toBe(
      true,
    );
    expect(getTileType(map, tileXY(map, 18, 18))).toBe(TileType.Clear);
  });

  it('leaves a tile with two opposite corners raised as land', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    map.height[tileXY(map, 31, 30)] = 0; // W corner of (30,30)
    map.height[tileXY(map, 30, 31)] = 0; // E corner of (30,30): slope N|S = 10
    convertGroundTilesIntoWaterTiles(map);
    expect(getTileType(map, tileXY(map, 30, 30))).toBe(TileType.Clear);
  });
});

describe('TileLoop_Water (port of water_cmd.cpp)', () => {
  it('classifies flooding behaviour like GetFloodingBehaviour', () => {
    const map = lakeMap();
    map.height[tileXY(map, 40, 40)] = 0;
    map.height[tileXY(map, 40, 41)] = 0;
    map.height[tileXY(map, 41, 41)] = 0; // tile (40,40) has only its W corner raised
    convertGroundTilesIntoWaterTiles(map);
    expect(getFloodingBehaviour(map, tileXY(map, 21, 21))).toBe(FloodingBehaviour.Active); // sea
    expect(getFloodingBehaviour(map, tileXY(map, 40, 40))).toBe(FloodingBehaviour.Active); // one-corner shore
    expect(getFloodingBehaviour(map, tileXY(map, 19, 21))).toBe(FloodingBehaviour.DryUp); // two-corner shore
    expect(getFloodingBehaviour(map, tileXY(map, 0, 5))).toBe(FloodingBehaviour.Active); // void
    expect(getFloodingBehaviour(map, tileXY(map, 10, 10))).toBe(FloodingBehaviour.None); // grass
  });

  it('dries up a shore whose flood-from neighbour is no longer water', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const shore = tileXY(map, 19, 21); // slope N|E: floods only from SW, the sea tile (20,21)
    doClearSquare(map, tileXY(map, 20, 21), true);
    const dirty: number[] = [];
    tileLoopWater(map, shore, (t) => dirty.push(t));
    expect([
      getTileType(map, shore),
      getClearGround(map, shore),
      getClearDensity(map, shore),
    ]).toEqual([TileType.Clear, ClearGround.Grass, 3]);
    expect(dirty).toContain(shore);
  });

  it('floods a flat height-0 land tile next to active water', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const land = tileXY(map, 20, 21);
    doClearSquare(map, land, true);
    tileLoopWater(map, tileXY(map, 20, 22), NOOP); // the sea tile SE of it
    expect(isWaterTile(map, land)).toBe(true);
  });

  it('marks water surrounded by water as non-flooding, and a change next to it wakes it up', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const inner = tileXY(map, 21, 21);
    tileLoopWater(map, inner, NOOP);
    expect(isNonFloodingWaterTile(map, inner)).toBe(true);
    doClearSquare(map, tileXY(map, 22, 22), true);
    expect(isNonFloodingWaterTile(map, inner)).toBe(false);
  });

  it('floods from the void border (TileLoop_Void)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    for (const [x, y] of [
      [1, 5],
      [2, 5],
      [1, 6],
      [2, 6],
    ] as const)
      map.height[tileXY(map, x, y)] = 0;
    tileLoopVoid(map, tileXY(map, 0, 5), NOOP);
    expect(isWaterTile(map, tileXY(map, 1, 5))).toBe(true);
  });

  it('turns shore trees back to grass trees when they dry up', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const t = tileXY(map, 19, 21);
    makeTree(map, t, 0, 0, TreeGrowth.Grown, TreeGround.Shore, 3);
    doClearSquare(map, tileXY(map, 20, 21), true);
    tileLoopWater(map, t, NOOP);
    expect(getTreeGround(map, t)).toBe(TreeGround.Grass);
  });
});

describe('landscape clearing for towns, industries and water (port of CMD_LANDSCAPE_CLEAR)', () => {
  it('clears grass, trees and shores with Auto, never sea with NoWater, void or buildings', () => {
    const map = lakeMap();
    convertGroundTilesIntoWaterTiles(map);
    const house = tileXY(map, 40, 40);
    setTileType(map, house, TileType.House);
    expect([
      canAutoClear(map, tileXY(map, 10, 10), true),
      canAutoClear(map, tileXY(map, 19, 21), true),
      canAutoClear(map, tileXY(map, 21, 21), true),
      canAutoClear(map, tileXY(map, 21, 21), false),
      canAutoClear(map, tileXY(map, 0, 5), true),
      canAutoClear(map, house, true),
    ]).toEqual([true, true, false, true, false, false]);
  });

  it('DoClearSquare leaves grass, fully grown only while generating the world', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 9, 9);
    makeSea(map, t);
    doClearSquare(map, t, false);
    expect([getClearGround(map, t), getClearDensity(map, t), map.m1[t]]).toEqual([
      ClearGround.Grass,
      0,
      OWNER_NONE,
    ]);
    doClearSquare(map, t, true);
    expect(getClearDensity(map, t)).toBe(3);
  });
});
```

Run: `npx vitest run src/sim/map` — Expected: FAIL, modules not found (`createEmptyGame` is missing too).

- [ ] **Step 2: `createEmptyGame` in `game.ts`** — rename the body of the 1.1 `createGame` into `createEmptyGame`, setting `map.height[t] = 1` on **every** tile after `makeVoid`/`makeClear` (port of `heightmap.cpp:FlatEmptyWorld`, which with freeform edges raises every row and column; void tiles keep height 1 so the border tiles are flat). Keep `export const createGame = createEmptyGame;` until Task 4. In `src/sim/game.test.ts` switch the imports to `createEmptyGame`.

- [ ] **Step 3: Implement `water.ts` and `tree-map.ts`**

```ts
// water.ts
import {
  getTileType,
  OWNER_WATER,
  resetTileKeepingHeight,
  setTileType,
  TileType,
  type MapState,
} from './map';
import { Dir, isValidTile, tileOffsByDir } from './geometry';

/** Port of water_map.h:WaterClass (m1 bits 6..5). */
export const WaterClass = { Sea: 0, Canal: 1, River: 2, Invalid: 3 } as const;
export type WaterClass = (typeof WaterClass)[keyof typeof WaterClass];
/** Port of water_map.h:WaterTileType (m5 bits 7..4). */
export const WaterTileType = { Clear: 0, Coast: 1, Lock: 2, Depot: 3 } as const;
export type WaterTileType = (typeof WaterTileType)[keyof typeof WaterTileType];

export const getWaterClass = (map: MapState, t: number): WaterClass =>
  ((map.m1[t]! >>> 5) & 3) as WaterClass;
export function setWaterClass(map: MapState, t: number, wc: WaterClass): void {
  map.m1[t] = (map.m1[t]! & ~0x60) | (wc << 5);
}
export const getWaterTileType = (map: MapState, t: number): WaterTileType =>
  ((map.m5[t]! >>> 4) & 0xf) as WaterTileType;

/** Port of water_map.h:MakeWater / MakeShore (owner water, class sea, not a docking tile). */
function makeWaterTile(map: MapState, t: number, type: WaterTileType): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Water);
  map.m1[t] = OWNER_WATER | (WaterClass.Sea << 5);
  map.m5[t] = type << 4;
}
/** Port of water_map.h:MakeSea. */
export const makeSea = (map: MapState, t: number): void =>
  makeWaterTile(map, t, WaterTileType.Clear);
/** Port of water_map.h:MakeShore. */
export const makeShore = (map: MapState, t: number): void =>
  makeWaterTile(map, t, WaterTileType.Coast);

/** Port of water_map.h:IsWaterTile (open water: sea, canal, river). */
export const isWaterTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Water && getWaterTileType(map, t) === WaterTileType.Clear;
/** Port of water_map.h:IsCoastTile. */
export const isCoastTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Water && getWaterTileType(map, t) === WaterTileType.Coast;

/** Port of water_map.h:HasTileWaterClass. */
export function hasTileWaterClass(map: MapState, t: number): boolean {
  const type = getTileType(map, t);
  return (
    type === TileType.Water ||
    type === TileType.Station ||
    type === TileType.Industry ||
    type === TileType.Object ||
    type === TileType.Trees
  );
}
export const isTileOnWater = (map: MapState, t: number): boolean =>
  getWaterClass(map, t) !== WaterClass.Invalid;
/** Port of water_map.h:HasTileWaterGround (coast tiles do not count). */
export const hasTileWaterGround = (map: MapState, t: number): boolean =>
  hasTileWaterClass(map, t) && isTileOnWater(map, t) && !isCoastTile(map, t);

/** m3 bit 0. Port of water_map.h:IsNonFloodingWaterTile. */
export const isNonFloodingWaterTile = (map: MapState, t: number): boolean =>
  getTileType(map, t) === TileType.Water && (map.m3[t]! & 1) === 1;
export function setNonFloodingWaterTile(map: MapState, t: number, on: boolean): void {
  map.m3[t] = on ? map.m3[t]! | 1 : map.m3[t]! & ~1;
}

/** Port of water_cmd.cpp:ClearNeighbourNonFloodingStates. */
export function clearNeighbourNonFloodingStates(map: MapState, t: number): void {
  for (let dir = Dir.N; dir <= Dir.NW; dir++) {
    const dest = t + tileOffsByDir(map, dir as Dir);
    if (isValidTile(map, dest) && getTileType(map, dest) === TileType.Water)
      setNonFloodingWaterTile(map, dest, false);
  }
}
```

`tree-map.ts` — port of `tree_map.h` with this layout: m1 = owner `OWNER_NONE` + water class (`Sea` for a shore ground, else `Invalid`); m2 bits 8..6 ground, bits 5..4 density; m3 tree type; m4 = 0; m5 bits 7..6 count − 1, bits 2..0 growth. `makeTree` calls `resetTileKeepingHeight`, `setTileType(Trees)`, sets the fields above. `addTreeCount(map, t, c)`: `m5 += c << 6`; `addTreeGrowth(map, t, a)`: `m5 += a`; `setTreeGrowth`: bits 2..0; `setTreeGroundDensity(map, t, ground, density)`: m2 bits 5..4 and 8..6, then the water class rule.

- [ ] **Step 4: Implement `landscape.ts`**

```ts
import { ClearGround, makeClear } from './clear';
import { getTileType, TileType, type MapState } from './map';
import { clearNeighbourNonFloodingStates, isCoastTile } from './water';

/** Port of landscape.cpp:DoClearSquare. */
export function doClearSquare(map: MapState, t: number, generatingWorld: boolean): void {
  makeClear(map, t, ClearGround.Grass, generatingWorld ? 3 : 0);
  clearNeighbourNonFloodingStates(map, t);
}

/**
 * Whether CMD_LANDSCAPE_CLEAR with DoCommandFlag::Auto succeeds for a non-company caller (a town,
 * world generation, water). Port of the ClearTile_* procs for the Stage 1 tile types.
 */
export function canAutoClear(map: MapState, t: number, noWater: boolean): boolean {
  switch (getTileType(map, t)) {
    case TileType.Clear:
    case TileType.Trees:
      return true;
    case TileType.Water:
      return isCoastTile(map, t) || !noWater; // ClearTile_Water: NoWater refuses open water only
    default:
      return false; // void; houses must be demolished; industries cannot be cleared with Auto
  }
}
```

- [ ] **Step 5: Implement `flood.ts`** — port of `water_cmd.cpp:_flood_from_dirs`, `GetFloodingBehaviour`, `DoFloodTile`, `DoDryUp`, `TileLoop_Water`, `ConvertGroundTilesIntoWaterTiles` and `void_cmd.cpp:TileLoop_Void`. Stage 1 has no foundations (ruling R11), so `GetFoundationSlope` is `getTileSlopeZ`.

```ts
export const FLOOD_FROM_DIRS: readonly (readonly Dir[])[] = [
  [Dir.NE, Dir.SE, Dir.SW, Dir.NW], // SLOPE_FLAT
  [Dir.NE, Dir.SE], // SLOPE_W
  [Dir.NE, Dir.NW], // SLOPE_S
  [Dir.NE], // SLOPE_SW
  [Dir.SW, Dir.NW], // SLOPE_E
  [], // SLOPE_EW
  [Dir.NW], // SLOPE_SE
  [Dir.N, Dir.NE, Dir.NW], // SLOPE_WSE
  [Dir.SE, Dir.SW], // SLOPE_N
  [Dir.SE], // SLOPE_NW
  [], // SLOPE_NS
  [Dir.NE, Dir.E, Dir.SE], // SLOPE_NWS
  [Dir.SW], // SLOPE_NE
  [Dir.SE, Dir.S, Dir.SW], // SLOPE_ENW
  [Dir.SW, Dir.W, Dir.NW], // SLOPE_SEN
];

export const FloodingBehaviour = { None: 0, Active: 1, Passive: 2, DryUp: 3 } as const;
export type FloodingBehaviour = (typeof FloodingBehaviour)[keyof typeof FloodingBehaviour];
```

Behaviour to port (cases that can occur in Stage 1):

- `getFloodingBehaviour`: water → coast: `isSlopeWithOneCornerRaised(slope) ? Active : DryUp`; open water: class `Sea` → `Active`, else `None`; industry: class `Sea` → `Active`, else `None`; trees: ground `Shore` → `DryUp`, else `None`; void → `Active`; everything else `None`.
- `convertGroundTilesIntoWaterTiles(map)`: in tile index order, for every `Clear` tile with `z === 0`: flat → `makeSea`; one corner raised → `makeShore`; otherwise the first `FLOOD_FROM_DIRS[slope & 15]` neighbour (`t + tileOffsByDir`) whose slope (`& 15`) is flat or one-corner-raised, or that is void, makes it `makeShore`.
- `tileLoopWater(map, t, markDirty)`: skip a non-flooding water tile; `Active`: for the 8 directions in `Dir` order, `dest = addTileIndexDiffCWrap(...)`; skip invalid (void) and water tiles; any other tile sets `continueFlooding`; skip shore trees; skip `z > 0`; flood only if `FLOOD_FROM_DIRS[slopeDest & 15]` contains `reverseDir(dir)`; afterwards an `Active` water tile with nothing to flood sets its non-flooding bit. `DryUp`: if any `FLOOD_FROM_DIRS[slope]` neighbour (`addTileIndexDiffCWrap`, void allowed) is `Active` or `Passive`, return; else dry up.
- `doFloodTile`: sloped target → trees not one-corner-raised: `setTreeGroundDensity(Shore, 3)`; trees one-corner-raised and clear: `doClearSquare(map, t, false)` then `makeShore`; flat target (clear or trees) → `doClearSquare(map, t, false)` then `makeSea`. Other tile types never sit at `z = 0` in Stage 1 (nothing is built on slopes, R11) and are left alone. Call `markDirty` on every changed tile.
- `doDryUp`: trees → `setTreeGroundDensity(Grass, 3)`; coast → `doClearSquare(map, t, false)` then `makeClear(Grass, 3)`. `markDirty`.
- `tileLoopVoid` = `tileLoopWater` (void floods its neighbours).

- [ ] **Step 6: Run the water and void tile loops in `tick`** — in `game.ts` add `[TileType.Water]: (t) => tileLoopWater(state.map, t, markDirty)` and `[TileType.Void]: (t) => tileLoopVoid(state.map, t, markDirty)` to the procs passed to `runTileLoop`.

Run: `npx vitest run src/sim` — Expected: all passed.

- [ ] **Step 7: Fix `map.md`** — in `docs/reference/openttd/map.md` §6, replace "water (no effect while all land is at z >= 1)" with "water (Stage 1 coast tiles have z = 0, so flooding and drying up do run; see world-generation.md §4.4)".

- [ ] **Step 8: Commit** — `feat: port sea, shore and the water tile loop` (body: ruling R2 — the sea comes from OpenTTD's own conversion of height-0 tiles, and the water loop keeps reshaping shores, as `world-generation.md` §4.4 traced; `map.md` claimed otherwise and is corrected. The empty world now keeps the border at height 1 like `FlatEmptyWorld`, so flat test maps grow no accidental coast. `Refs #N`). PR into the block branch.

---

### Task 4: World generation pipeline

**Files:**

- Create: `src/sim/world/generate.ts`, `src/sim/world/clear-gen.ts`, `src/sim/world/errors.ts`, `src/sim/world/generate.test.ts`, `tests/perf/generation.test.ts`
- Modify: `src/sim/game.ts`, `src/sim/game.test.ts`, `src/sim/command/command.test.ts`, `src/render/ground.test.ts`, `src/app/main.tsx`, `docs/game/differences.md`, `docs/reference/openttd/world-generation.md`

**Interfaces:**

- Consumes: Tasks 1–3, `runTileLoop` (1.1).
- Produces (`game.ts`): `GameOptions` gains `townCount: number` (difficulty.number_towns 0..3) and `industryDensity: number` (difficulty.industry_density 0..5); `DEFAULT_GAME_OPTIONS = { mapLogX: 8, mapLogY: 8, seed: 0, startingYear: 1950, townCount: 2, industryDensity: 4 }`; `GameState` gains `initialLandCount: number`; `newGameState(options: GameOptions): GameState` (map allocated, nothing generated — `misc.cpp:InitializeGame`); `createEmptyGame(options?)`; `tileLoopProcs(state): TileLoopProcs`; `tick`, `takeDirtyTiles`, `hashGameState` (now hashes `initialLandCount` and the new options). `createGame` leaves `game.ts`.
- Produces (`world/generate.ts`): `interface GenerationProgress { fraction: number }`, `SETTLE_PASSES = 0x500`, `countLandTiles(map): number`, `generateGame(options?: Partial<GameOptions>): Generator<GenerationProgress, GameState, void>`, `createGame(options?: Partial<GameOptions>): GameState`.
- Produces (`world/clear-gen.ts`): `clearTileAttempts(map, r1, r2): { rough: number; rocks: number }`, `generateClearTile(map, random): void`.
- Produces (`world/errors.ts`): `class WorldGenerationError extends Error { readonly key: 'error.noTownCreated' }`.

- [ ] **Step 1: Write the failing tests**

`src/sim/world/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, hashGameState } from '../game';
import { ClearGround, getClearGround } from '../map/clear';
import { getTileType, isInnerTile, TileType, tileXY } from '../map/map';
import { getTileSlopeZ } from '../map/slope';
import { isCoastTile, isWaterTile, makeSea } from '../map/water';
import { clearTileAttempts, generateClearTile } from './clear-gen';
import { countLandTiles, createGame, generateGame, SETTLE_PASSES } from './generate';

/**
 * Golden replay hash of the 64×64 world for seed 1 (ruling R9). Pinned from the first run
 * (Step 6); every later task that changes generation re-pins it and says why in its commit.
 */
const GOLDEN_64_SEED_1 = 'unpinned';

const countClear = (seed: number, ground: ClearGround): number => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  generateClearTile(game.map, createRandomizer(seed));
  let n = 0;
  for (let t = 0; t < game.map.size; t++) {
    if (getTileType(game.map, t) === TileType.Clear && getClearGround(game.map, t) === ground) n++;
  }
  return n;
};

const progressOf = (seed: number): { fractions: number[]; hash: string } => {
  const gen = generateGame({ mapLogX: 6, mapLogY: 6, seed });
  const fractions: number[] = [];
  let step = gen.next();
  while (step.done !== true) {
    fractions.push(step.value.fraction);
    step = gen.next();
  }
  return { fractions, hash: hashGameState(step.value) };
};

describe('GenerateClearTile (port of clear_cmd.cpp)', () => {
  it('derives the rough and rocky attempts from the first two draws', () => {
    expect(
      clearTileAttempts(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 536872454, 3515126559),
    ).toEqual({ rough: 97, rocks: 10 });
    expect(clearTileAttempts(createEmptyGame().map, 536872454, 3515126559)).toEqual({
      rough: 1542,
      rocks: 159,
    });
  });

  it('roughens and rocks clear tiles but never water', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const sea = tileXY(game.map, 30, 30);
    makeSea(game.map, sea);
    generateClearTile(game.map, createRandomizer(12345));
    expect(isWaterTile(game.map, sea)).toBe(true);
    expect(countClear(12345, ClearGround.Rough)).toBeGreaterThan(0);
    expect(countClear(12345, ClearGround.Rocks)).toBeGreaterThan(0);
  });
});

describe('CountLandTiles (port of map.cpp)', () => {
  it('counts every tile but open water, adds 1/12 and caps at the map size', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    expect(countLandTiles(map)).toBe(4096);
    for (let t = 0; t < 1024; t++) makeSea(map, t);
    expect(countLandTiles(map)).toBe(3328);
  });
});

describe('generateGame (port of genworld.cpp:_GenerateWorld)', () => {
  it.each([
    [6, 6],
    [8, 6],
    [6, 8],
  ] as const)('keeps OpenTTD map invariants on 2^%i×2^%i', (mapLogX, mapLogY) => {
    const { map, tickCounter } = createGame({ mapLogX, mapLogY, seed: 3 });
    expect(tickCounter).toBe(SETTLE_PASSES);
    for (let t = 0; t < map.size; t++) {
      expect(map.height[t]).toBeLessThanOrEqual(1);
      expect(getTileType(map, t) === TileType.Void).toBe(!isInnerTile(map, t));
      const { slope, z } = getTileSlopeZ(map, t);
      if (isWaterTile(map, t)) expect({ slope, z }).toEqual({ slope: 0, z: 0 });
      if (isCoastTile(map, t)) {
        expect(z).toBe(0);
        expect(slope).not.toBe(0);
      }
    }
  });

  it('reports rising progress up to 1 and returns the createGame world', () => {
    const { fractions, hash } = progressOf(3);
    expect(fractions).toEqual(fractions.toSorted((a, b) => a - b));
    expect(fractions.at(-1)).toBe(1);
    expect(hash).toBe(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 3 })));
  });

  it('is reproducible from the seed (golden replay hash)', () => {
    expect(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 1 }))).toBe(GOLDEN_64_SEED_1);
    expect(hashGameState(createGame({ mapLogX: 6, mapLogY: 6, seed: 2 }))).not.toBe(
      GOLDEN_64_SEED_1,
    );
  });
});
```

`tests/perf/generation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/sim/world/generate';

describe('world generation performance (ruling R8)', () => {
  it('generates the default 256×256 world in under 3 seconds', () => {
    const start = performance.now();
    const game = createGame({ seed: 1 });
    expect(game.map.size).toBe(65536);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it('can generate a 1024×1024 world', { timeout: 120_000 }, () => {
    expect(createGame({ mapLogX: 10, mapLogY: 10, seed: 1 }).map.size).toBe(1 << 20);
  });
});
```

Run: `npx vitest run src/sim/world tests/perf` — Expected: FAIL, modules not found.

- [ ] **Step 2: Refactor `game.ts`**

- `GameOptions`/`DEFAULT_GAME_OPTIONS` as in Interfaces; `GameState.initialLandCount` (0 until generation).
- `newGameState(options)`: `createMap`, `createRandomizer(options.seed)` (genworld step 1, `SetSeed`), `tickCounter: 0`, both dates, `paused: false`, `createCompany(DEFAULT_MAX_LOAN)`, `dirtyTiles: new Set()`, `initialLandCount: 0`. No tile is touched.
- `createEmptyGame(options)` = `newGameState` + the Task 3 flat world; `initialLandCount = countLandTiles(map)` is not needed there (leave 0).
- `tileLoopProcs(state)`: returns the `TileLoopProcs` that `tick` used inline (clear, water, void); `tick` calls `runTileLoop(state.map, state.tickCounter, tileLoopProcs(state))`.
- `hashGameState`: after the option numbers, also hash `o.townCount`, `o.industryDensity`, `state.initialLandCount`.
- Delete `createGame` from `game.ts`; switch `game.test.ts`, `command/command.test.ts` and `render/ground.test.ts` to `createEmptyGame`; `src/app/main.tsx` imports `createGame` from `../sim/world/generate` and calls `createGame({ seed: crypto.getRandomValues(new Uint32Array(1))[0]! })` (Task 12 moves this to background generation).

- [ ] **Step 3: Implement `clear-gen.ts` and `errors.ts`**

```ts
// clear-gen.ts
import { nextRandom, type Randomizer } from '../core/random';
import { ClearGround, setClearGroundDensity } from '../map/clear';
import { randomTile, scaleBySize, tileOffsByDiagDir, type DiagDir } from '../map/geometry';
import { getTileType, TileType, type MapState } from '../map/map';

/** i and gi of GenerateClearTile, from its first two draws. */
export function clearTileAttempts(
  map: MapState,
  r1: number,
  r2: number,
): { rough: number; rocks: number } {
  return {
    rough: scaleBySize(map, (r1 & 0x3ff) + 0x400),
    rocks: scaleBySize(map, (r2 & 0x7f) + 0x80),
  };
}

/** Port of clear_cmd.cpp:GenerateClearTile (temperate: no desert). */
export function generateClearTile(map: MapState, random: Randomizer): void {
  const { rough, rocks } = clearTileAttempts(map, nextRandom(random), nextRandom(random));
  for (let i = 0; i < rough; i++) {
    const t = randomTile(map, nextRandom(random));
    if (getTileType(map, t) === TileType.Clear) setClearGroundDensity(map, t, ClearGround.Rough, 3);
  }
  for (let i = 0; i < rocks; i++) {
    const r = nextRandom(random);
    let t = randomTile(map, r);
    if (getTileType(map, t) !== TileType.Clear) continue;
    let j = ((r >>> 16) & 0xf) + 5;
    patch: for (;;) {
      setClearGroundDensity(map, t, ClearGround.Rocks, 3);
      let next: number;
      do {
        if (--j === 0) break patch;
        next = t + tileOffsByDiagDir(map, (nextRandom(random) & 3) as DiagDir);
      } while (getTileType(map, next) !== TileType.Clear);
      t = next;
    }
  }
}
```

Add `setClearGroundDensity(map, t, ground, density)` to `map/clear.ts` (port of `clear_map.h:SetClearGroundDensity`: `m5 = ground << 2 | density`, counter reset).

```ts
// errors.ts
/** World generation stopped the way OpenTTD aborts it (the key is an i18n message). */
export class WorldGenerationError extends Error {
  constructor(readonly key: 'error.noTownCreated') {
    super(key);
    this.name = 'WorldGenerationError';
  }
}
```

- [ ] **Step 4: Implement `generate.ts`** (generation starts from `newGameState`, never from the flat empty world)

```ts
import {
  DEFAULT_GAME_OPTIONS,
  newGameState,
  tileLoopProcs,
  type GameOptions,
  type GameState,
} from '../game';
import { convertGroundTilesIntoWaterTiles } from '../map/flood';
import { runTileLoop } from '../map/tile-loop';
import { isWaterTile } from '../map/water';
import type { MapState } from '../map/map';
import { generateClearTile } from './clear-gen';
import { generateTerrain } from './tgp';

export interface GenerationProgress {
  /** 0..1, rising. */
  fraction: number;
}

/** Tile-loop passes after generation so grass, trees and shores settle. Port of genworld.cpp (0x500). */
export const SETTLE_PASSES = 0x500;

/** Port of map.cpp:Map::CountLandTiles (coast and void count as land). */
export function countLandTiles(map: MapState): number {
  let land = 0;
  for (let t = 0; t < map.size; t++) if (!isWaterTile(map, t)) land++;
  return Math.min(land + Math.floor(land / 12), map.size);
}

/**
 * Builds a new world in OpenTTD's order, yielding progress between steps.
 * Port of genworld.cpp:_GenerateWorld (new game, TerraGenesis, temperate).
 */
export function* generateGame(
  options: Partial<GameOptions> = {},
): Generator<GenerationProgress, GameState, void> {
  const state = newGameState({ ...DEFAULT_GAME_OPTIONS, ...options });
  // Step 2 (StartupEconomy's draw) is not replicated: it has no effect on the map (ruling R1).
  generateTerrain(state.map, state.random, state.options.seed >>> 0);
  yield { fraction: 0.2 };
  convertGroundTilesIntoWaterTiles(state.map);
  // CreateRivers is skipped: no spring exists on a two-level map (world-generation.md §4.8, ruling R1).
  generateClearTile(state.map, state.random);
  state.initialLandCount = countLandTiles(state.map);
  yield { fraction: 0.25 };
  // Towns (Task 9), industries (Task 10) and trees (Task 5) are inserted here, in that order.
  const procs = tileLoopProcs(state);
  for (let pass = 0; pass < SETTLE_PASSES; pass++) {
    runTileLoop(state.map, state.tickCounter, procs);
    state.tickCounter++;
    if (pass % 64 === 63) yield { fraction: 0.8 + (0.2 * (pass + 1)) / SETTLE_PASSES };
  }
  state.dirtyTiles.clear();
  return state;
}

/** Runs generateGame to the end. */
export function createGame(options: Partial<GameOptions> = {}): GameState {
  const gen = generateGame(options);
  let step = gen.next();
  while (step.done !== true) step = gen.next();
  return step.value;
}
```

(The settle loop calls `runTileLoop` **before** incrementing the counter, as genworld.cpp does; `tick` increments first.)

- [ ] **Step 5: Run and check** — `npx vitest run src/sim tests/perf` — Expected: all pass except the golden hash test, which fails printing the received hash.

- [ ] **Step 6: Pin the golden hash** — copy the 8-hex-digit value from the failure message into `GOLDEN_64_SEED_1`. Run again — Expected: all passed. Run `npm test && npm run lint && npm run typecheck && npm run test:e2e` (the app now boots on a generated 256×256 world).

- [ ] **Step 7: Docs** — `docs/game/differences.md`, add rows:

```markdown
| Random numbers | One stream from the seed | Same generator and formulas; the sequence of draws differs | D1: draws with no effect on a Stage 1 map are not replicated (ruling R1) |
| Terrain | Hills | Sea at height 0, land at height 1 (Stage 2 adds relief) | D4 |
| Rivers | Generated | Not generated until Stage 2 | Springs need higher ground (ruling R1) |
| Lighthouses, transmitters | Generated | Not generated yet | Objects are not in Stage 1 |
```

In `docs/reference/openttd/world-generation.md` §4.1 step 6, replace "#tiles that are not MP_WATER" with "#tiles that are not open water (`IsWaterTile`: water type Clear), so coast and void count as land".

- [ ] **Step 8: Commit** — `feat: generate worlds in OpenTTD's order` (body: the pipeline is a generator so the app can run it in slices (R8); the order and the 1280 settle passes follow `_GenerateWorld`, so later tasks only plug their step in; the golden hash pins determinism (R9). `Refs #N`). PR into the block branch.

---

### Task 5: Trees

**Files:**

- Create: `src/sim/world/trees.ts`, `src/sim/world/trees.test.ts`
- Modify: `src/sim/game.ts` (`treeTickCounter`, procs, `tick`, hash), `src/sim/world/generate.ts`, `src/sim/world/generate.test.ts` (re-pin)

**Interfaces:**

- Consumes: Tasks 1–4 (`tree-map.ts`, `water.ts`, `flood.ts`, `geometry.ts`, `slope.ts`).
- Produces (`game.ts`): `GameState.treeTickCounter: number` (uint8 `_trees_tick_ctr`, 0 at start, hashed); `tick` calls `onTickTrees(state)` right after `runTileLoop` (port of `landscape.cpp:CallLandscapeTick` order); procs gain `[TileType.Trees]: (t) => tileLoopTrees(state, t, markDirty)`.
- Produces (`trees.ts`): `canPlantTreesOnTile(map, t, allowDesert): boolean`, `placeTree(map, t, r: number): void`, `interface Point { x: number; y: number }`, `createStarShapedPolygon(radius: number, phases: readonly number[], segments: number): Point[]`, `isPointInStarShapedPolygon(x, y, shape: readonly Point[]): boolean`, `treeGroupCount(map, r): number`, `generateTrees(state: GameState): void`, `tileLoopTrees(state, t, markDirty): void`, `onTickTrees(state): void`.

- [ ] **Step 1: Write the failing test** (`src/sim/world/trees.test.ts`). Polygon vertices computed independently in C with `sinf`/`cosf` and float accumulation; random draws from the seed-12345 sequence `536872454, 3515126559, 4023459891, 1208093797, 4215375298, 2178421593, …, 386989480 (13th)`.

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { ClearGround, getClearDensity, getClearGround, setClearGroundDensity } from '../map/clear';
import { getTileType, TileType, tileXY } from '../map/map';
import {
  getTreeCount,
  getTreeDensity,
  getTreeGround,
  getTreeGrowth,
  getTreeType,
  makeTree,
  TreeGround,
  TreeGrowth,
} from '../map/tree-map';
import { makeShore } from '../map/water';
import {
  canPlantTreesOnTile,
  createStarShapedPolygon,
  generateTrees,
  isPointInStarShapedPolygon,
  onTickTrees,
  placeTree,
  tileLoopTrees,
  treeGroupCount,
} from './trees';

const NOOP = (): void => undefined;

const advanced = (draws: number): Randomizer => {
  const r = createRandomizer(12345);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

/** 64×64 empty game with one grown tree at (5,5), ticked so (5,5) gets a tree update (cycle 111). */
const treeGame = (draws: number): { game: GameState; t: number } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.random = advanced(draws);
  game.tickCounter = 11 * 256; // cycle = 11*5 + 9*5 + 11 = 111: 111 % 16 == 15 and 111 & 7 == 7
  const t = tileXY(game.map, 5, 5);
  makeTree(game.map, t, 4, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
  return { game, t };
};

describe('placing trees (port of tree_cmd.cpp)', () => {
  it('takes type, count, growth and ground from the random bits (PlaceTree)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const a = tileXY(map, 5, 5);
    const b = tileXY(map, 6, 5);
    placeTree(map, a, 0xffffffff);
    placeTree(map, b, 0x12345678);
    expect([
      getTreeType(map, a),
      getTreeCount(map, a),
      getTreeGrowth(map, a),
      getTreeGround(map, a),
      getTreeDensity(map, a),
    ]).toEqual([11, 4, TreeGrowth.Dead, TreeGround.Rough, 3]);
    expect([
      getTreeType(map, b),
      getTreeCount(map, b),
      getTreeGrowth(map, b),
      getTreeGround(map, b),
    ]).toEqual([0, 1, TreeGrowth.Dying1, TreeGround.Rough]);
  });

  it('plants on grass and multi-corner shores, never on rocks or one-corner shores', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const rocks = tileXY(map, 5, 5);
    setClearGroundDensity(map, rocks, ClearGround.Rocks, 3);
    const shore = tileXY(map, 7, 7);
    map.height[tileXY(map, 8, 7)] = 0;
    map.height[tileXY(map, 8, 8)] = 0;
    makeShore(map, shore); // corners N, E raised
    expect([
      canPlantTreesOnTile(map, tileXY(map, 9, 9), true),
      canPlantTreesOnTile(map, rocks, true),
      canPlantTreesOnTile(map, shore, true),
    ]).toEqual([true, false, true]);
  });

  it('builds grove polygons like CreateStarShapedPolygon (float maths, ruling R3)', () => {
    const shape = createStarShapedPolygon(16, [0, 0, 0, 0], 16);
    expect(shape.map(({ x, y }) => [x, y])).toEqual([
      [8, 0],
      [11, 4],
      [9, 9],
      [4, 11],
      [0, 11],
      [-3, 9],
      [-6, 6],
      [-7, 3],
      [-7, 0],
      [-6, -2],
      [-4, -4],
      [-2, -5],
      [0, -5],
      [1, -3],
      [1, -1],
      [3, -1],
    ]);
    expect([
      isPointInStarShapedPolygon(2, 1, shape),
      isPointInStarShapedPolygon(12, 12, shape),
    ]).toEqual([true, false]);
  });

  it('scales the number of groves by map size', () => {
    expect([
      treeGroupCount(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 536872454),
      treeGroupCount(createEmptyGame().map, 536872454),
    ]).toEqual([2, 31]);
  });

  it('generates trees only where they can grow', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const rocks = tileXY(game.map, 30, 30);
    setClearGroundDensity(game.map, rocks, ClearGround.Rocks, 3);
    generateTrees(game);
    let trees = 0;
    for (let t = 0; t < game.map.size; t++)
      if (getTileType(game.map, t) === TileType.Trees) trees++;
    expect(trees).toBeGreaterThan(0);
    expect(getTileType(game.map, rocks)).toBe(TileType.Clear);
  });
});

describe('TileLoop_Trees (port of tree_cmd.cpp)', () => {
  it('starts dying on a draw of 0', () => {
    const { game, t } = treeGame(12); // next draw 386989480: & 7 == 0
    tileLoopTrees(game, t, NOOP);
    expect(getTreeGrowth(game.map, t)).toBe(TreeGrowth.Dying1);
  });

  it('adds a tree to the tile on a draw of 1', () => {
    const { game, t } = treeGame(5); // 2178421593: & 7 == 1
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([
      2,
      TreeGrowth.Growing1,
    ]);
  });

  it('seeds a neighbour on a draw of 2', () => {
    const { game, t } = treeGame(4); // 4215375298: & 7 == 2, then 2178421593 % 8 == 1 (NE)
    tileLoopTrees(game, t, NOOP);
    const ne = tileXY(game.map, 4, 5);
    expect([
      getTileType(game.map, ne),
      getTreeType(game.map, ne),
      getTreeCount(game.map, ne),
      getTreeGrowth(game.map, ne),
    ]).toEqual([TileType.Trees, 4, 1, TreeGrowth.Growing1]);
  });

  it('does nothing on draws 3..7', () => {
    const { game, t } = treeGame(0); // 536872454: & 7 == 6
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([1, TreeGrowth.Grown]);
  });

  it('removes a dead tree, leaving its grass (grown one step first: cycle & 7 == 7)', () => {
    const { game, t } = treeGame(0);
    makeTree(game.map, t, 4, 0, TreeGrowth.Dead, TreeGround.Grass, 2);
    tileLoopTrees(game, t, NOOP);
    expect([
      getTileType(game.map, t),
      getClearGround(game.map, t),
      getClearDensity(game.map, t),
    ]).toEqual([TileType.Clear, ClearGround.Grass, 3]);
    makeTree(game.map, t, 4, 1, TreeGrowth.Dead, TreeGround.Grass, 2);
    tileLoopTrees(game, t, NOOP);
    expect([getTreeCount(game.map, t), getTreeGrowth(game.map, t)]).toEqual([1, TreeGrowth.Grown]);
  });

  it('grows the grass under trees every eighth visit', () => {
    const { game, t } = treeGame(0);
    makeTree(game.map, t, 4, 0, TreeGrowth.Growing1, TreeGround.Grass, 1);
    tileLoopTrees(game, t, NOOP);
    expect([getTreeDensity(game.map, t), getTreeGrowth(game.map, t)]).toEqual([
      2,
      TreeGrowth.Growing2,
    ]);
  });
});

describe('OnTick_Trees (port of tree_cmd.cpp)', () => {
  it('on 64×64 plants a random tree every 16 ticks when the counter wraps', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    game.tickCounter = 17;
    onTickTrees(game);
    expect([game.treeTickCounter, game.random]).toEqual([0, createRandomizer(0)]);
    game.tickCounter = 16;
    onTickTrees(game);
    expect(game.treeTickCounter).toBe(255);
    expect(game.random).not.toEqual(createRandomizer(0));
  });
});
```

Run: `npx vitest run src/sim/world/trees.test.ts` — Expected: FAIL, cannot resolve `./trees`.

- [ ] **Step 2: Implement `trees.ts`** — port of `tree_cmd.cpp`: `CanPlantTreesOnTile`, `PlantTreesOnTile`, `GetRandomTreeType` (temperate: `seed * 12 / 256`), `PlaceTree` (type `GB(r,24,8)`, count `GB(r,22,2)`, growth `min(GB(r,16,3), 6)`, then unless the ground is shore `setTreeGroundDensity(GB(r,28,1), 3)`), `CreateStarShapedPolygon`, `CreateRandomStarShapedPolygon`, `IsPointInTriangle`, `IsPointInStarShapedPolygon`, `PlaceTreeGroups`, `PlaceTreeAtSameHeight`, `PlaceTreesRandomly` (TP_IMPROVED), `GenerateTrees`, `TileLoop_Trees` (temperate), `DecrementTreeCounter`, `PlantRandomTree`, `OnTick_Trees` (`ETP_SPREAD_ALL`).

Float steps (ruling R3) use `Math.fround` at every C++ `float` operation:

```ts
const f = Math.fround;
/** Port of tree_cmd.cpp:CreateRandomStarShapedPolygon PHASE_DIVISOR. */
const PHASE_DIVISOR = f((2147483647 / Math.PI) * 2);

export interface Point {
  x: number;
  y: number;
}

/** Port of tree_cmd.cpp:CreateStarShapedPolygon (harmonic i: amplitude radius >> (i+1), frequency i+1). */
export function createStarShapedPolygon(
  radius: number,
  phases: readonly number[],
  segments: number,
): Point[] {
  const amplitudes = [
    Math.trunc(radius / 2),
    Math.trunc(radius / 4),
    Math.trunc(radius / 8),
    Math.trunc(radius / 16),
  ];
  const step = f((Math.PI * 2) / segments);
  const shape: Point[] = [];
  let theta = f(0);
  for (let k = 0; k < segments; k++) {
    let deviation = f(0);
    for (let h = 0; h < 4; h++) {
      deviation = f(
        deviation + f(f(Math.sin(f(f(theta + phases[h]!) * (h + 1)))) * amplitudes[h]!),
      );
    }
    const adjusted = f(f(radius / 2) + f(deviation / 2));
    shape.push({
      x: Math.trunc(f(f(Math.cos(theta)) * adjusted)),
      y: Math.trunc(f(f(Math.sin(theta)) * adjusted)),
    });
    theta = f(theta + step);
  }
  return shape;
}
```

`CreateRandomStarShapedPolygon` draws four phases `f(f(nextRandom(r)) / PHASE_DIVISOR)` in order. `treeGroupCount(map, r) = scaleBySize(map, (r & 0x1f) + 25)`. `PlaceTreesRandomly` (TP_IMPROVED): extra trees `j = getTileZ(tile) * 2`, then `j = Math.trunc(j * 15 / WORLD.mapHeightLimit)` (one extra tree on height-1 land, none on height-0 slopes). `generateTrees(state)`: `num_groups` draw, `PlaceTreeGroups`, then `PlaceTreesRandomly` twice.

`tileLoopTrees(state, t, markDirty)`: shore ground → `tileLoopWater(map, t, markDirty)` first; `cycle = 11 * x + 9 * y + (state.tickCounter >>> 8)`; grass density growth on `(cycle & 7) === 7`; tree update on `cycle % 16 === 15` with the switch of `tree_cmd.cpp:TileLoop_Trees` (`GB(Random(), 0, 3)`: 0 dying, 1 add a tree if `count < 4` else fall through, 2 neighbour `t + tileOffsByDir(Random() % 8)` planted with `PlantTreesOnTile(type, 0, Growing1)` unless it cannot hold trees or is clear grass with density ≠ 3; `Dead` → count − 1 or back to clear grass/rough/shore; others `addTreeGrowth(1)`); `markDirty(t)` at the end as C++ does (also when only growth changed).

`onTickTrees(state)`: `skip = scaleBySize(map, 16)`; `if (skip < 16 && (state.tickCounter & (16 / skip - 1)) !== 0) return`; `DecrementTreeCounter` (`old = ctr; ctr = (ctr - scaleBySize(map, 1)) & 0xff; return old <= ctr`); on wrap `PlantRandomTree(false)` (`r = Random()`, tile `r & mask`, `CanPlantTreesOnTile(tile, false)`, type from `GB(r, 24, 8)`, `PlantTreesOnTile(type, 0, Growing1)`).

- [ ] **Step 3: Wire it** — `game.ts`: `treeTickCounter` in `GameState`, `newGameState` (0) and `hashGameState`; Trees proc; `tick`: `runTileLoop(...)` then `onTickTrees(state)`. `generate.ts`: after the clear-tile step and before the settle passes, `generateTrees(state); yield { fraction: 0.8 };` (towns and industries will go before it).

Run: `npx vitest run src/sim tests/perf` — Expected: all pass except the golden hash (generation changed). Re-pin `GOLDEN_64_SEED_1` from the failure message; run again — all passed.

- [ ] **Step 4: Commit** — `feat: generate trees and let them grow and spread` (body: TP_IMPROVED groves and random trees as OpenTTD places them, and the tree tile loop and random planting keep the world alive during play (`ETP_SPREAD_ALL`); grove shapes use float maths like the C++ (R3); golden hash re-pinned because generation now plants trees. `Refs #N`). PR into the block branch.

---

### Task 6: Town roads, towns and zones

**Files:**

- Create: `src/sim/map/road-map.ts`, `src/sim/town/town.ts`, `src/sim/town/town-roads.ts`, `src/sim/map/road-map.test.ts`, `src/sim/town/town.test.ts`, `src/sim/town/town-roads.test.ts`
- Modify: `src/sim/map/landscape.ts`, `src/sim/game.ts`

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces (`road-map.ts`): `RoadBits` (`None 0, NW 1, SW 2, SE 4, NE 8, X 10, Y 5, N 9, E 12, S 6, W 3, All 15`), `RoadTileType` (`Normal 0, Crossing 1, Depot 2`), `Roadside` (`Barren 0, Grass 1, Paved 2, StreetLights 3, Trees 5, GrassRoadWorks 6, PavedRoadWorks 7`), `ROADTYPE_ROAD = 0`, `INVALID_ROADTYPE = 63`, `diagDirToRoadBits(d: DiagDir): number`, `mirrorRoadBits(r)`, `complementRoadBits(r)`, `isStraightRoad(r)`, `makeRoadNormal(map, t, bits, townIndex)` (town-owned road), `getRoadTileType(map, t)`, `isNormalRoadTile(map, t)`, `getRoadBits(map, t)`, `setRoadBits(map, t, bits)`, `getRoadOwner(map, t)`, `getTownIndex(map, t)` (m2 of road and house tiles), `getRoadside(map, t)`, `setRoadside(map, t, rs)`, `getTownRoadBits(map, t)` (normal road → bits; any other tile → `None`; crossings arrive in 1.3).
- Produces (`town.ts`): `HouseZone` (`Edge 0, Outskirt 1, OuterSuburb 2, InnerSuburb 3, Centre 4`) + type, `TownFlag` (`HasChurch 1, HasStadium 2`, bitmask), `interface Town { index: number; xy: number; nameParts: number; isCity: boolean; numHouses: number; population: number; squaredZoneRadius: number[]; flags: number }`, `newTown(index, xy, nameParts, isCity): Town`, `updateTownRadius(town): void`, `getTownRadiusGroup(map, town, t): HouseZone`, `closestTownFromTile(state, t, threshold: number): Town | undefined` (`threshold` `Infinity` for `UINT_MAX`).
- Produces (`town-roads.ts`): `cleanUpRoadBits(map, t, bits): number`, `canTownBuildRoad(map, t, bits): boolean`, `buildTownRoad(state, town, t, bits): boolean`, `TOWN_ROAD_TYPES`, `tileLoopRoad(state, t, markDirty): void`.
- Produces (`game.ts`): `GameState.towns: Town[]` (`[]` in `newGameState`, hashed: index, xy, nameParts, isCity, numHouses, population, the 5 radii, flags); proc `[TileType.Road]: (t) => tileLoopRoad(state, t, markDirty)`.
- Extends `canAutoClear`: a normal road with exactly one bit → `true` (a town, world generation or water may remove a single town road piece: `road_cmd.cpp:ClearTile_Road` + `CheckAllowRemoveRoad`, which lets non-companies remove normal road); two or more bits → `false`.

- [ ] **Step 1: Write the failing tests**

`src/sim/map/road-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { DiagDir } from './geometry';
import { OWNER_TOWN, TileType, getTileType, tileXY } from './map';
import {
  complementRoadBits,
  diagDirToRoadBits,
  getRoadBits,
  getRoadOwner,
  getRoadside,
  getTownIndex,
  getTownRoadBits,
  isStraightRoad,
  makeRoadNormal,
  mirrorRoadBits,
  RoadBits,
  Roadside,
} from './road-map';

describe('road bits (port of road_type.h, road_func.h)', () => {
  it('maps directions to road pieces and back', () => {
    const dirs = [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const;
    expect(dirs.map(diagDirToRoadBits)).toEqual([
      RoadBits.NE,
      RoadBits.SE,
      RoadBits.SW,
      RoadBits.NW,
    ]);
    expect([
      mirrorRoadBits(RoadBits.NW),
      mirrorRoadBits(RoadBits.SW),
      complementRoadBits(RoadBits.X),
    ]).toEqual([RoadBits.SE, RoadBits.NE, RoadBits.Y]);
    expect([isStraightRoad(RoadBits.X), isStraightRoad(RoadBits.N)]).toEqual([true, false]);
  });
});

describe('town road tiles (port of road_map.h:MakeRoadNormal)', () => {
  it('writes the fields roads.md §3.3 lists for a town road', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 10, 10);
    makeRoadNormal(map, t, RoadBits.X, 3);
    expect(getTileType(map, t)).toBe(TileType.Road);
    expect([
      map.m1[t],
      map.m2[t],
      map.m3[t],
      map.m4[t]! & 0x3f,
      map.m5[t],
      map.m6[t]! & 0xfc,
      map.m7[t],
      map.m8[t],
    ]).toEqual([0x0f, 3, 0xf0, 0, 10, 0, 0, 0xfc0]);
    expect([
      getRoadOwner(map, t),
      getTownIndex(map, t),
      getRoadBits(map, t),
      getRoadside(map, t),
    ]).toEqual([OWNER_TOWN, 3, RoadBits.X, Roadside.Barren]);
    expect([getTownRoadBits(map, t), getTownRoadBits(map, tileXY(map, 11, 10))]).toEqual([
      RoadBits.X,
      RoadBits.None,
    ]);
  });
});
```

`src/sim/town/town.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { tileXY } from '../map/map';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import {
  closestTownFromTile,
  getTownRadiusGroup,
  HouseZone,
  newTown,
  updateTownRadius,
} from './town';

describe('town zones (port of town_cmd.cpp:UpdateTownRadius, GetTownRadiusGroup)', () => {
  it.each([
    [0, [4, 0, 0, 0, 0]],
    [20, [64, 0, 4, 0, 0]],
    [91, [121, 81, 0, 49, 36]],
    [92, [125, 84, 0, 50, 38]],
    [200, [335, 210, 0, 120, 80]],
  ])('a town with %i houses has squared radii %j', (houses, radii) => {
    const town = newTown(0, 0, 0, false);
    town.numHouses = houses;
    updateTownRadius(town);
    expect(town.squaredZoneRadius).toEqual(radii);
  });

  it('picks the highest zone whose radius covers the tile', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(map, 32, 32), 0, false);
    town.numHouses = 91;
    updateTownRadius(town);
    const zoneAt = [
      [5, 2],
      [6, 0],
      [7, 0],
      [9, 0],
      [11, 0],
    ] as const;
    expect(
      zoneAt.map(([dx, dy]) => getTownRadiusGroup(map, town, tileXY(map, 32 + dx, 32 + dy))),
    ).toEqual([
      HouseZone.Centre,
      HouseZone.InnerSuburb,
      HouseZone.Outskirt,
      HouseZone.Edge,
      HouseZone.Edge,
    ]);
  });
});

describe('ClosestTownFromTile (port of town_cmd.cpp)', () => {
  it('uses Manhattan distance, the lowest index on ties, the threshold, and the owner of town roads', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    game.towns.push(
      newTown(0, tileXY(map, 10, 10), 0, false),
      newTown(1, tileXY(map, 20, 10), 0, false),
    );
    expect(closestTownFromTile(game, tileXY(map, 15, 10), Infinity)?.index).toBe(0);
    expect(closestTownFromTile(game, tileXY(map, 16, 10), Infinity)?.index).toBe(1);
    expect(closestTownFromTile(game, tileXY(map, 15, 10), 5)).toBeUndefined();
    const road = tileXY(map, 19, 10);
    makeRoadNormal(map, road, RoadBits.X, 0);
    expect(closestTownFromTile(game, road, 1)?.index).toBe(0);
  });
});
```

`src/sim/town/town-roads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { ClearGround, getClearDensity, getClearGround } from '../map/clear';
import { canAutoClear, doClearSquare } from '../map/landscape';
import { getTileType, setTileType, TileType, tileXY } from '../map/map';
import {
  getRoadBits,
  getRoadside,
  getTownIndex,
  makeRoadNormal,
  RoadBits,
  Roadside,
  setRoadside,
} from '../map/road-map';
import { makeSea, makeShore } from '../map/water';
import { newTown, updateTownRadius } from './town';
import { buildTownRoad, canTownBuildRoad, cleanUpRoadBits, tileLoopRoad } from './town-roads';

const NOOP = (): void => undefined;

describe('CleanUpRoadBits (port of road.cpp)', () => {
  it('drops pieces that point at houses, open water and the map edge', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 10, 10);
    setTileType(map, tileXY(map, 10, 11), TileType.House); // SE
    makeSea(map, tileXY(map, 11, 10)); // SW
    makeShore(map, tileXY(map, 10, 9)); // NW: coast is connective
    expect(cleanUpRoadBits(map, t, RoadBits.All)).toBe(RoadBits.NE | RoadBits.NW);
    expect(cleanUpRoadBits(map, tileXY(map, 1, 10), RoadBits.X)).toBe(RoadBits.SW);
    expect(cleanUpRoadBits(map, tileXY(map, 0, 10), RoadBits.X)).toBe(RoadBits.None);
  });
});

describe('town road building (port of road_cmd.cpp:CmdBuildRoad for OWNER_TOWN)', () => {
  it('builds on flat clear land and adds pieces to its own road', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 30, 30), 0, false);
    game.towns.push(town);
    const t = tileXY(game.map, 30, 30);
    expect(canTownBuildRoad(game.map, t, RoadBits.NE)).toBe(true);
    expect(buildTownRoad(game, town, t, RoadBits.NE)).toBe(true);
    expect(canTownBuildRoad(game.map, t, RoadBits.NE)).toBe(false); // already built
    expect(buildTownRoad(game, town, t, RoadBits.SW)).toBe(true);
    expect([getRoadBits(game.map, t), getTownIndex(game.map, t)]).toEqual([RoadBits.X, 0]);
  });

  it('refuses sea, houses and sloped land (ruling R11)', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeSea(map, tileXY(map, 5, 5));
    setTileType(map, tileXY(map, 6, 5), TileType.House);
    map.height[tileXY(map, 8, 5)] = 0; // tile (7,5) gets a raised-corner slope
    expect([
      canTownBuildRoad(map, tileXY(map, 5, 5), RoadBits.X),
      canTownBuildRoad(map, tileXY(map, 6, 5), RoadBits.X),
      canTownBuildRoad(map, tileXY(map, 7, 5), RoadBits.X),
    ]).toEqual([false, false, false]);
  });

  it('lets towns clear a one-piece road stub but not a longer road', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const stub = tileXY(map, 9, 9);
    makeRoadNormal(map, stub, RoadBits.NE, 0);
    makeRoadNormal(map, tileXY(map, 9, 10), RoadBits.X, 0);
    expect([canAutoClear(map, stub, true), canAutoClear(map, tileXY(map, 9, 10), true)]).toEqual([
      true,
      false,
    ]);
    doClearSquare(map, stub, true);
    expect([getTileType(map, stub), getClearGround(map, stub), getClearDensity(map, stub)]).toEqual(
      [TileType.Clear, ClearGround.Grass, 3],
    );
  });
});

describe('TileLoop_Road roadside (port of road_cmd.cpp)', () => {
  it('steps the roadside towards the zone target', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
    town.numHouses = 91;
    updateTownRadius(town);
    game.towns.push(town);
    const centre = tileXY(game.map, 32, 32);
    const edge = tileXY(game.map, 42, 32); // d² = 100: Edge
    const outskirt = tileXY(game.map, 39, 32); // d² = 49: Outskirt
    for (const t of [centre, edge, outskirt]) makeRoadNormal(game.map, t, RoadBits.X, 0);
    setRoadside(game.map, outskirt, Roadside.Grass);
    for (const t of [centre, edge, outskirt]) tileLoopRoad(game, t, NOOP);
    expect([
      getRoadside(game.map, centre),
      getRoadside(game.map, edge),
      getRoadside(game.map, outskirt),
    ]).toEqual([Roadside.Paved, Roadside.Grass, Roadside.Barren]);
    for (const t of [centre, edge, outskirt]) tileLoopRoad(game, t, NOOP);
    expect([
      getRoadside(game.map, centre),
      getRoadside(game.map, edge),
      getRoadside(game.map, outskirt),
    ]).toEqual([Roadside.StreetLights, Roadside.Grass, Roadside.Paved]);
  });
});
```

Run: `npx vitest run src/sim/map/road-map.test.ts src/sim/town` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `road-map.ts`** — port of `road_map.h` for normal town roads (roads.md §3, §3.3). Layout: m1 bits 4..0 owner; m2 town index; m3 = `OWNER_TOWN << 4` (tram owner stored as town, no tram bits); m4 bits 5..0 road type; m5 bits 3..0 road bits, bits 5..4 one-way (0), bits 7..6 `RoadTileType`; m6 bits 5..3 roadside; m7 = 0; m8 bits 11..6 tram type (63). `makeRoadNormal(map, t, bits, townIndex)`: `resetTileKeepingHeight`, `setTileType(Road)`, `m1 = OWNER_TOWN`, `m2 = townIndex`, `m3 = 0xf0`, `m4 = ROADTYPE_ROAD`, `m5 = bits`, `m8 = INVALID_ROADTYPE << 6`. `diagDirToRoadBits(d) = RoadBits.NW << (3 ^ d)`; `mirrorRoadBits(r) = ((r & 3) << 2) | ((r >> 2) & 3)`; `complementRoadBits(r) = 15 ^ r`.

- [ ] **Step 3: Implement `town.ts`**

```ts
import type { GameState } from '../game';
import { distanceManhattan, distanceSquare } from '../map/geometry';
import { getTileType, OWNER_TOWN, TileType, type MapState } from '../map/map';
import { getRoadOwner, getTownIndex, isNormalRoadTile } from '../map/road-map';

/** Port of house.h:HouseZone (town zones only). */
export const HouseZone = {
  Edge: 0,
  Outskirt: 1,
  OuterSuburb: 2,
  InnerSuburb: 3,
  Centre: 4,
} as const;
export type HouseZone = (typeof HouseZone)[keyof typeof HouseZone];

/** Port of town.h:TownFlag (the two Stage 1 uses: one church and one stadium per town). */
export const TownFlag = { HasChurch: 1, HasStadium: 2 } as const;

/** The Town fields Stage 1 uses. Port of town.h:Town. */
export interface Town {
  index: number;
  /** Centre tile. */
  xy: number;
  /** 32-bit seed of the generated name (Town::townnameparts). */
  nameParts: number;
  /** Town::larger_town. */
  isCity: boolean;
  numHouses: number;
  population: number;
  /** cache.squared_town_zone_radius, by HouseZone. */
  squaredZoneRadius: number[];
  /** TownFlag bits. */
  flags: number;
}

export function newTown(index: number, xy: number, nameParts: number, isCity: boolean): Town {
  const town: Town = {
    index,
    xy,
    nameParts,
    isCity,
    numHouses: 0,
    population: 0,
    squaredZoneRadius: [0, 0, 0, 0, 0],
    flags: 0,
  };
  updateTownRadius(town);
  return town;
}

/** Port of town_cmd.cpp:UpdateTownRadius _town_squared_town_zone_radius_data. */
const ZONE_RADIUS_TABLE: readonly (readonly number[])[] = [
  [4, 0, 0, 0, 0],
  [16, 0, 0, 0, 0],
  [25, 0, 0, 0, 0],
  [36, 0, 0, 0, 0],
  [49, 0, 4, 0, 0],
  [64, 0, 4, 0, 0],
  [64, 0, 9, 0, 1],
  [64, 0, 9, 0, 4],
  [64, 0, 16, 0, 4],
  [81, 0, 16, 0, 4],
  [81, 0, 16, 0, 4],
  [81, 0, 25, 0, 9],
  [81, 36, 25, 0, 9],
  [81, 36, 25, 16, 9],
  [81, 49, 0, 25, 9],
  [81, 64, 0, 25, 9],
  [81, 64, 0, 36, 9],
  [81, 64, 0, 36, 16],
  [100, 81, 0, 49, 16],
  [100, 81, 0, 49, 25],
  [121, 81, 0, 49, 25],
  [121, 81, 0, 49, 25],
  [121, 81, 0, 49, 36],
];

export function updateTownRadius(town: Town): void {
  if (town.numHouses < ZONE_RADIUS_TABLE.length * 4) {
    town.squaredZoneRadius = [...ZONE_RADIUS_TABLE[Math.floor(town.numHouses / 4)]!];
    return;
  }
  const mass = Math.floor(town.numHouses / 8);
  town.squaredZoneRadius = [mass * 15 - 40, mass * 9 - 15, 0, mass * 5 - 5, mass * 3 + 5];
}

/** Port of town_cmd.cpp:GetTownRadiusGroup (fund_buildings_months is always 0 in Stage 1). */
export function getTownRadiusGroup(map: MapState, town: Town, t: number): HouseZone {
  const d = distanceSquare(map, t, town.xy);
  let zone: number = HouseZone.Edge;
  for (let i = HouseZone.Edge; i <= HouseZone.Centre; i++)
    if (d < town.squaredZoneRadius[i]!) zone = i;
  return zone as HouseZone;
}

/** Port of town_cmd.cpp:ClosestTownFromTile / CalcClosestTownFromTile (ties: lowest index). */
export function closestTownFromTile(
  state: GameState,
  t: number,
  threshold: number,
): Town | undefined {
  const { map } = state;
  const type = getTileType(map, t);
  if (
    type === TileType.House ||
    (type === TileType.Road && isNormalRoadTile(map, t) && getRoadOwner(map, t) === OWNER_TOWN)
  ) {
    return state.towns[getTownIndex(map, t)];
  }
  let best: Town | undefined;
  let bestDistance = Infinity;
  for (const town of state.towns) {
    const d = distanceManhattan(map, t, town.xy);
    if (d < bestDistance) {
      best = town;
      bestDistance = d;
    }
  }
  return best !== undefined && bestDistance < threshold ? best : undefined;
}
```

- [ ] **Step 4: Implement `town-roads.ts`**

- `cleanUpRoadBits(map, t, bits)` — port of `road.cpp:CleanUpRoadBits` for Stage 1 types: `!isValidTile(map, t)` → `None`; for each direction with its bit set, the neighbour `t + tileOffsByDiagDir` is connective when it is clear or trees, a normal road tile, or a water tile that is not open water (coast); anything else (house, industry, void, open water) drops the bit.
- `canTownBuildRoad(map, t, bits)` — the `CMD_BUILD_ROAD(Auto, NoWater)` test for a town: the tile must be flat (ruling R11); a normal road tile passes unless it already has all of `bits` (`ALREADY_BUILT`); clear and trees pass; everything else (water, house, industry, void) fails.
- `buildTownRoad(state, town, t, bits)` — `CMD_BUILD_ROAD(Execute)` for `OWNER_TOWN` (roads.md §4.10): returns `false` when `canTownBuildRoad` fails; on a road tile `setRoadBits(existing | bits)` (town index and roadside kept); otherwise `doClearSquare(map, t, true)` then `makeRoadNormal(map, t, bits, town.index)`; `state.dirtyTiles.add(t)`; returns `true`.
- `TOWN_ROAD_TYPES` = `[[Grass, Grass], [Paved, Paved], [Paved, Paved], [Trees, Trees], [StreetLights, Paved]]` (by `HouseZone`).
- `tileLoopRoad(state, t, markDirty)` — port of `road_cmd.cpp:TileLoop_Road` (temperate, no road works; roads.md §4.11): `town = closestTownFromTile(state, t, Infinity)`; `grp = town ? getTownRadiusGroup(...) : Edge`; `[target, pre] = TOWN_ROAD_TYPES[grp]`; `cur === target → return`; `cur === pre → target`; `cur === Barren → pre`; else `Barren`; `setRoadside`, `markDirty(t)`.

- [ ] **Step 5: Extend `canAutoClear` and `game.ts`** as in Interfaces (road case: `isNormalRoadTile && popcount(getRoadBits) === 1`). `GameState.towns`, its hash and the Road proc.

Run: `npx vitest run src/sim` — Expected: all passed (the golden hash is unchanged: no town exists yet).

- [ ] **Step 6: Commit** — `feat: add town road tiles and town zones` (body: ruling R5 — only normal road tiles, owned by towns, with OpenTTD's field layout so crossings in block 1.3 build on it; zones and the roadside loop follow `UpdateTownRadius`/`TileLoop_Road`; ruling R11 keeps town roads off slopes. `Refs #N`). PR into the block branch.

---

### Task 7: Houses

**Files:**

- Create: `src/sim/map/house-map.ts`, `src/sim/town/house-specs.ts`, `src/sim/town/houses.ts`, `src/sim/town/house-specs.test.ts`, `src/sim/town/houses.test.ts`
- Modify: `src/sim/game.ts`, `docs/reference/openttd/towns-industries.md`

**Interfaces:**

- Consumes: Tasks 1–6.
- Produces (`house-map.ts`): `TOWN_HOUSE_COMPLETED = 3`, `makeHouseTile(map, t, townIndex, counter, stage, type, randomBits)`, `getHouseType(map, t)` (m8 bits 11..0), `isHouseCompleted(map, t)` (m3 bit 7), `getHouseBuildingStage(map, t)`, `getHouseConstructionTick(map, t)`, `incHouseConstructionTick(map, t)`, `resetHouseAge(map, t)`.
- Produces (`house-specs.ts`): `MAX_YEAR = 5_000_000`, `HOUSE_PROBABILITY = 16`, `type HouseSize = '1x1' | '1x2' | '2x2' | 'part'`, `interface HouseSpec { id: number; minYear: number; maxYear: number; population: number; mailGeneration: number; acceptance: readonly [number, number, number]; size: HouseSize; church: boolean; stadium: boolean; zones: number }` (`zones`: bit `1 << HouseZone`), `HOUSE_SPECS: readonly HouseSpec[]` (temperate rows, id order), `houseSpec(id): HouseSpec`, `houseCandidates(zone: HouseZone): HouseSpec[]`.
- Produces (`houses.ts`): `canBuildHouseHere(map, t): boolean`, `checkFree2x2Area(map, t, maxZ): boolean`, `checkTownBuild2x2House(map, t, maxZ): number` (north tile or `INVALID_TILE`), `tryBuildTownHouse(state, town, t, generatingWorld: boolean): boolean`, `buildTownHouse(state, town, t, spec, randomBits, generatingWorld): void`, `tileLoopTown(state, t, markDirty): void`.
- Produces (`game.ts`): proc `[TileType.House]: (t) => tileLoopTown(state, t, markDirty)`.

- [ ] **Step 1: Write the failing tests**

`src/sim/town/house-specs.test.ts` (candidate lists and availability from `town-building.md` §4.11):

```ts
import { describe, expect, it } from 'vitest';
import { HOUSE_PROBABILITY, houseCandidates } from './house-specs';
import { HouseZone } from './town';

const CANDIDATES: Record<HouseZone, number[]> = {
  [HouseZone.Edge]: [0x03, 0x06, 0x14, 0x18, 0x19, 0x1a, 0x20],
  [HouseZone.Outskirt]: [0x02, 0x03, 0x06, 0x14, 0x18, 0x1a, 0x20, 0x28],
  [HouseZone.OuterSuburb]: [
    0x02, 0x03, 0x06, 0x07, 0x0b, 0x0e, 0x0f, 0x10, 0x14, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x20, 0x27,
    0x28,
  ],
  [HouseZone.InnerSuburb]: [
    0x01, 0x02, 0x03, 0x06, 0x09, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x14, 0x1a, 0x1b, 0x1c, 0x1d, 0x1f,
    0x20, 0x24, 0x27, 0x28,
  ],
  [HouseZone.Centre]: [
    0x00, 0x01, 0x04, 0x07, 0x09, 0x0a, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x1b, 0x1c, 0x1d,
    0x1e, 0x1f, 0x24, 0x27, 0x28,
  ],
};
const VALID_1950: Record<HouseZone, number[]> = {
  [HouseZone.Edge]: [0x03, 0x06, 0x14, 0x18, 0x19, 0x1a],
  [HouseZone.Outskirt]: [0x03, 0x06, 0x14, 0x18, 0x1a],
  [HouseZone.OuterSuburb]: [0x03, 0x06, 0x0b, 0x0e, 0x0f, 0x10, 0x14, 0x1a, 0x1b, 0x1d, 0x27],
  [HouseZone.InnerSuburb]: [
    0x03, 0x06, 0x09, 0x0c, 0x0e, 0x0f, 0x10, 0x14, 0x1a, 0x1b, 0x1d, 0x1f, 0x27,
  ],
  [HouseZone.Centre]: [0x09, 0x0a, 0x0e, 0x0f, 0x10, 0x1b, 0x1d, 0x1f, 0x27],
};
const ZONES = [
  HouseZone.Edge,
  HouseZone.Outskirt,
  HouseZone.OuterSuburb,
  HouseZone.InnerSuburb,
  HouseZone.Centre,
] as const;

describe('temperate house table (port of table/town_land.h)', () => {
  it.each(ZONES)('zone %i has OpenTTD candidates and probability_max', (zone) => {
    const ids = houseCandidates(zone).map((s) => s.id);
    expect(ids).toEqual(CANDIDATES[zone]);
    expect(ids.length * HOUSE_PROBABILITY).toBe({ 0: 112, 1: 128, 2: 272, 3: 320, 4: 336 }[zone]);
  });

  it.each(ZONES)('zone %i offers the houses of 1950', (zone) => {
    const valid = houseCandidates(zone).filter((s) => s.minYear <= 1950 && 1950 <= s.maxYear);
    expect(valid.map((s) => s.id)).toEqual(VALID_1950[zone]);
  });
});
```

`src/sim/town/houses.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom, type Randomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { INVALID_TILE } from '../map/geometry';
import {
  getHouseType,
  getHouseBuildingStage,
  isHouseCompleted,
  makeHouseTile,
} from '../map/house-map';
import { getTileType, TileType, tileXY } from '../map/map';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import { houseSpec } from './house-specs';
import {
  buildTownHouse,
  canBuildHouseHere,
  checkTownBuild2x2House,
  tileLoopTown,
  tryBuildTownHouse,
} from './houses';
import { newTown, TownFlag, type Town } from './town';

const NOOP = (): void => undefined;

const advanced = (draws: number): Randomizer => {
  const r = createRandomizer(12345);
  for (let i = 0; i < draws; i++) nextRandom(r);
  return r;
};

const townGame = (): { game: GameState; town: Town } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
  game.towns.push(town);
  game.random = createRandomizer(12345);
  return { game, town };
};

describe('BuildTownHouse at world generation (port of town_cmd.cpp)', () => {
  it('completes the house and adds its population when Chance16(1,7) fails', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32);
    buildTownHouse(game, town, t, houseSpec(0x06), 0xab, true);
    expect([
      getHouseType(game.map, t),
      isHouseCompleted(game.map, t),
      game.map.m1[t],
      town.population,
      town.numHouses,
    ]).toEqual([0x06, true, 0xab, 30, 1]);
  });

  it('leaves the house unfinished when Chance16(1,7) passes', () => {
    const { game, town } = townGame();
    game.random = advanced(4); // construction_random 4215375298 (stage 2, counter 0), then 2178421593 passes 1/7
    const t = tileXY(game.map, 40, 32);
    buildTownHouse(game, town, t, houseSpec(0x06), 0, true);
    expect([
      isHouseCompleted(game.map, t),
      getHouseBuildingStage(game.map, t),
      game.map.m5[t],
      town.population,
    ]).toEqual([false, 2, 16, 0]);
  });

  it('writes the four stadium tiles with consecutive types', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 20, 20);
    buildTownHouse(game, town, t, houseSpec(0x14), 0, true);
    const tiles = [
      [20, 20],
      [20, 21],
      [21, 20],
      [21, 21],
    ] as const;
    expect(tiles.map(([x, y]) => getHouseType(game.map, tileXY(game.map, x, y)))).toEqual([
      0x14, 0x15, 0x16, 0x17,
    ]);
    expect(town.numHouses).toBe(1);
  });
});

describe('TileLoop_Town construction (port of town_cmd.cpp:AdvanceHouseConstruction)', () => {
  it('completes a house begun at stage 0 on its 24th visit and adds its population', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32);
    makeHouseTile(game.map, t, 0, 0, 0, 0x06, 0);
    town.numHouses = 1;
    for (let i = 0; i < 23; i++) tileLoopTown(game, t, NOOP);
    expect([isHouseCompleted(game.map, t), town.population]).toEqual([false, 0]);
    tileLoopTown(game, t, NOOP);
    expect([isHouseCompleted(game.map, t), town.population, game.map.m5[t]]).toEqual([true, 30, 0]);
  });
});

describe('TryBuildTownHouse (port of town_cmd.cpp)', () => {
  it('builds the first pick of the weighted draw: the church on an edge tile for seed 12345', () => {
    const { game, town } = townGame();
    const t = tileXY(game.map, 40, 32); // d² = 64: Edge
    expect(tryBuildTownHouse(game, town, t, true)).toBe(true);
    expect([getHouseType(game.map, t), (town.flags & TownFlag.HasChurch) !== 0]).toEqual([
      0x03,
      true,
    ]);
  });

  it('skips a second church and keeps drawing (swap-removed list): cottages', () => {
    const { game, town } = townGame();
    town.flags |= TownFlag.HasChurch;
    const t = tileXY(game.map, 40, 32);
    expect(tryBuildTownHouse(game, town, t, true)).toBe(true);
    expect(getHouseType(game.map, t)).toBe(0x19);
  });

  it('needs flat land that a town may clear (ruling R11)', () => {
    const { game } = townGame();
    const { map } = game;
    map.height[tileXY(map, 11, 10)] = 0; // tile (10,10) sloped
    makeRoadNormal(map, tileXY(map, 12, 12), RoadBits.NE, 0);
    makeRoadNormal(map, tileXY(map, 13, 12), RoadBits.X, 0);
    const tiles = [
      tileXY(map, 20, 20),
      tileXY(map, 10, 10),
      tileXY(map, 12, 12),
      tileXY(map, 13, 12),
    ];
    expect(tiles.map((t) => canBuildHouseHere(map, t))).toEqual([true, false, true, false]);
  });

  it('places a 2×2 house on the first free block, clockwise (CheckTownBuild2x2House)', () => {
    const { game } = townGame();
    const { map } = game;
    const t = tileXY(map, 20, 20);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(t);
    makeHouseTile(map, tileXY(map, 21, 20), 0, 0, 3, 0x06, 0);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(tileXY(map, 19, 19));
    for (const [x, y] of [
      [19, 19],
      [19, 21],
    ] as const)
      makeHouseTile(map, tileXY(map, x, y), 0, 0, 3, 0x06, 0);
    expect(checkTownBuild2x2House(map, t, 1)).toBe(INVALID_TILE);
    expect(getTileType(map, t)).toBe(TileType.Clear);
  });
});
```

(The 2×2 order is `t`, `t+(0,-1)`, `t+(-1,-1)`, `t+(-1,0)`: a house at `(21,20)` blocks the first two; `(19,19)` is the first free block's north tile. Blocking `(19,19)` and `(19,21)` leaves no free block.)

Run: `npx vitest run src/sim/town` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `house-map.ts`** — port of `town_map.h` (15.3 layout): m1 random bits; m2 town index; m3 bit 7 completed, bit 5 protected (0), bits 4..0 triggers (0); m5 `stage << 3 | counter` while building, house age once completed; m6 bits 7..2 processing time (0); m7 animation frame (0); m8 bits 11..0 house type, bits 15..12 = 0. `incHouseConstructionTick`: add 1 to m5 bits 4..0 (wrapping inside 5 bits); if the stage (bits 4..3) becomes 3, set the completed bit. `getHouseConstructionTick` = completed ? 0 : m5 & 7; `getHouseBuildingStage` = completed ? 3 : (m5 >> 3) & 3; `resetHouseAge` = `m5 = 0`. Fix `towns-industries.md` §3 "House tile": the house type is in m8 bits 11..0 (not m4 + m3 bit 6).

- [ ] **Step 3: Implement `house-specs.ts`** — the temperate rows of `table/town_land.h:_original_house_specs` (towns-industries.md §4.7; verify each row against the C++ `MS(...)` lines). `Z = { E: 1, O: 2, OS: 4, IS: 8, C: 16 }`, `MAX_YEAR = 5_000_000`:

```ts
// id, years, population, mail, acceptance [passengers, mail, goods] (eighths), size/flags, zones
export const HOUSE_SPECS: readonly HouseSpec[] = [
  spec(0x00, 1963, MAX_YEAR, 187, 70, [8, 3, 4], '1x1', Z.C),
  spec(0x01, 1957, MAX_YEAR, 85, 55, [8, 3, 4], '1x1', Z.C | Z.IS),
  spec(0x02, 1968, MAX_YEAR, 40, 20, [8, 3, 1], '1x1', Z.IS | Z.OS | Z.O),
  spec(0x03, 0, MAX_YEAR, 5, 2, [2, 0, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E, { church: true }),
  spec(0x04, 1975, MAX_YEAR, 220, 85, [10, 4, 6], '1x1', Z.C),
  spec(0x06, 0, MAX_YEAR, 30, 12, [4, 1, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E),
  spec(0x07, 1959, MAX_YEAR, 140, 22, [6, 1, 2], '1x2', Z.C | Z.OS),
  spec(0x08, 1959, MAX_YEAR, 0, 22, [6, 1, 2], 'part', 0),
  spec(0x09, 1945, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.C | Z.IS),
  spec(0x0a, 1945, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.C),
  spec(0x0b, 0, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.OS),
  spec(0x0c, 1935, MAX_YEAR, 0, 0, [2, 0, 0], '1x1', Z.IS),
  spec(0x0d, 1951, MAX_YEAR, 150, 65, [8, 2, 4], '1x1', Z.C | Z.IS),
  spec(0x0e, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x0f, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x10, 1930, 1960, 95, 48, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x11, 1977, MAX_YEAR, 130, 50, [10, 3, 6], '1x1', Z.C),
  spec(0x12, 1983, MAX_YEAR, 6, 10, [6, 3, 8], '1x1', Z.C),
  spec(0x13, 1985, MAX_YEAR, 110, 55, [6, 2, 6], '1x1', Z.C),
  spec(0x14, 0, MAX_YEAR, 65, 5, [4, 0, 0], '2x2', Z.IS | Z.OS | Z.O | Z.E, { stadium: true }),
  spec(0x15, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x16, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x17, 0, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x18, 0, 1951, 15, 6, [3, 1, 0], '1x1', Z.O | Z.E),
  spec(0x19, 0, 1952, 12, 7, [3, 1, 0], '1x1', Z.E),
  spec(0x1a, 1931, MAX_YEAR, 13, 8, [3, 1, 0], '1x1', Z.IS | Z.OS | Z.O | Z.E),
  spec(0x1b, 1935, MAX_YEAR, 100, 35, [7, 2, 2], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1c, 1963, MAX_YEAR, 170, 50, [8, 3, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1d, 0, 1955, 100, 40, [6, 2, 3], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x1e, 1973, MAX_YEAR, 180, 64, [8, 3, 3], '1x1', Z.C | Z.OS),
  spec(0x1f, 0, MAX_YEAR, 35, 23, [8, 2, 2], '1x1', Z.C | Z.IS),
  spec(0x20, 1958, MAX_YEAR, 65, 5, [4, 0, 0], '2x2', Z.IS | Z.OS | Z.O | Z.E, { stadium: true }),
  spec(0x21, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x22, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x23, 1958, MAX_YEAR, 0, 5, [4, 0, 0], 'part', 0),
  spec(0x24, 2000, MAX_YEAR, 140, 65, [8, 3, 2], '1x1', Z.C | Z.IS),
  spec(0x27, 1945, MAX_YEAR, 35, 23, [8, 2, 2], '1x1', Z.C | Z.IS | Z.OS),
  spec(0x28, 1983, MAX_YEAR, 180, 5, [8, 2, 3], '2x2', Z.C | Z.IS | Z.OS | Z.O),
  spec(0x29, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
  spec(0x2a, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
  spec(0x2b, 1983, MAX_YEAR, 0, 5, [8, 2, 3], 'part', 0),
];
```

`spec(id, minYear, maxYear, population, mail, acceptance, size, zones, flags = {})` is a module-level constructor; `houseCandidates(zone)` filters `(s.zones & (1 << zone)) !== 0` in table order (the temperate climate bit is implied: the table holds only temperate rows).

- [ ] **Step 4: Implement `houses.ts`** — port of `town_cmd.cpp:CanBuildHouseHere`, `CheckBuildHouseSameZ`, `CheckFree2x2Area`, `CheckTownBuild2x2House`, `CheckTownBuild2House` (1×2 hotel: try `t + (0,1)`, else `t + (0,-1)` and move the north tile), `TryBuildTownHouse`, `BuildTownHouse`, `MakeTownHouse`, `AdvanceSingleHouseConstruction`, `AdvanceHouseConstruction`, `TileLoop_Town` (construction only: completed houses do nothing until block 1.5, ruling R4).

```ts
/** Port of town_cmd.cpp:CanBuildHouseHere (flat only, ruling R11; RoadTypesAllowHouseHere is always true with one road type). */
export const canBuildHouseHere = (map: MapState, t: number): boolean =>
  isTileFlat(map, t) && canAutoClear(map, t, true);

/** Port of town_cmd.cpp:TryBuildTownHouse (TL_ORIGINAL, temperate). */
export function tryBuildTownHouse(
  state: GameState,
  town: Town,
  t: number,
  generatingWorld: boolean,
): boolean {
  const { map } = state;
  if (!canBuildHouseHere(map, t)) return false;
  const maxZ = getTileMaxZ(map, t);
  const candidates = houseCandidates(getTownRadiusGroup(map, town, t));
  let probabilityMax = candidates.length * HOUSE_PROBABILITY;
  const year = state.calendar.year;
  while (probabilityMax > 0) {
    let r = randomRange(state.random, probabilityMax);
    let i = 0;
    while (HOUSE_PROBABILITY <= r) {
      r -= HOUSE_PROBABILITY;
      i++;
    }
    const spec = candidates[i]!;
    probabilityMax -= HOUSE_PROBABILITY;
    candidates[i] = candidates.at(-1)!; // swap-remove: the order changes, as in C++
    candidates.pop();
    if (year < spec.minYear || year > spec.maxYear) continue;
    if (
      (spec.church && (town.flags & TownFlag.HasChurch) !== 0) ||
      (spec.stadium && (town.flags & TownFlag.HasStadium) !== 0)
    )
      continue;
    let north = t;
    if (spec.size === '2x2') {
      north = checkTownBuild2x2House(map, t, maxZ);
      if (north === INVALID_TILE) continue;
    } else if (spec.size === '1x2') {
      north = checkTownBuild2House(map, t, maxZ);
      if (north === INVALID_TILE) continue;
    }
    const randomBits = nextRandom(state.random);
    if (spec.church) town.flags |= TownFlag.HasChurch;
    if (spec.stadium) town.flags |= TownFlag.HasStadium;
    buildTownHouse(state, town, north, spec, randomBits, generatingWorld);
    return true;
  }
  return false;
}
```

`buildTownHouse(state, town, t, spec, randomBits, generatingWorld)`: `town.numHouses++`; `counter = 0`, `stage = 0`; when `generatingWorld`: `cr = nextRandom`, `stage = 3`, `if (chance16I(1, 7, nextRandom(...))) stage = cr & 3`; `stage === 3 → town.population += spec.population`, else `counter = (cr >>> 2) & 3`; `MakeTownHouse`: every tile of the building gets `doClearSquare(map, tile, generatingWorld)` then `makeHouseTile(map, tile, town.index, counter, stage, type, randomBits & 0xff)` with `type` = spec id for the north tile, `+1` for `(0,1)` (1×2 and 2×2), `+1` for `(1,0)` and `+1` for `(1,1)` (2×2); `updateTownRadius(town)`; add the tiles to `state.dirtyTiles`.

`tileLoopTown(state, t, markDirty)`: if the tile is not completed, advance the house: the tile's own spec size decides which tiles advance (`'1x1' | '1x2' | '2x2'` → `t`; `'1x2' | '2x2'` → `t+(0,1)`; `'2x2'` → `t+(1,0)` and `t+(1,1)`; `'part'` → none); each advance does `incHouseConstructionTick`, returns if the tick is not 0, adds the spec's population to the town (`state.towns[getTownIndex]`) and `resetHouseAge` when completed, and `markDirty`.

- [ ] **Step 5: House proc in `game.ts`.** Run: `npx vitest run src/sim` — Expected: all passed.

- [ ] **Step 6: Commit** — `feat: build town houses like OpenTTD` (body: the weighted pick with swap-removal, year and church/stadium checks after the pick, and the 1-in-7 unfinished houses at generation are what make a town look like OpenTTD's; the construction loop completes them during play (R4); houses stay off slopes (R11). `Refs #N`). PR into the block branch.

---

### Task 8: Town growth walk

**Files:**

- Create: `src/sim/town/growth.ts`, `src/sim/town/growth.test.ts`

**Interfaces:**

- Consumes: Tasks 1–7 (`cleanUpRoadBits`, `canTownBuildRoad`, `buildTownRoad`, `tryBuildTownHouse`, `getTownRoadBits`, `canAutoClear`, `hasTileWaterGround`, `isTileFlat`, geometry).
- Produces: `GrowthResult` (`Succeed 0, SearchStopped 1, Continue 2`), `TOWN_COORD_MOD`, `genRandomRoadBits(random): number`, `canFollowRoad(map, t, dir: DiagDir): boolean`, `isNeighbourRoadTile(map, t, dir: DiagDir, distMulti: number): boolean`, `isRoadAllowedHere(map, t, dir: DiagDir): boolean`, `growTownInTile(state, town, t, curRb: number, targetDir: number): GrowthResult` (`targetDir` 0..3 or 4 = `DIAGDIR_END`), `growTownAtRoad(state, town, t): boolean`, `growTown(state, town): boolean`. Stage 1 calls these only during world generation (ruling R4), so house building passes `generatingWorld = true`.

- [ ] **Step 1: Write the failing test** (`src/sim/town/growth.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { DiagDir, DIAGDIR_OFFSETS, DIR_OFFSETS, isValidTile } from '../map/geometry';
import { getTileType, OWNER_TOWN, setTileType, TileType, tileXY } from '../map/map';
import {
  diagDirToRoadBits,
  getRoadBits,
  getRoadOwner,
  getTownIndex,
  makeRoadNormal,
  RoadBits,
} from '../map/road-map';
import { makeSea } from '../map/water';
import {
  canFollowRoad,
  genRandomRoadBits,
  growTown,
  isNeighbourRoadTile,
  isRoadAllowedHere,
} from './growth';
import { newTown, updateTownRadius, type Town } from './town';

const townAt32 = (seed: number): { game: GameState; town: Town } => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
  game.towns.push(town);
  game.random = createRandomizer(seed);
  return { game, town };
};

const houseTiles = (game: GameState): Set<number> => {
  const tiles = new Set<number>();
  for (let t = 0; t < game.map.size; t++)
    if (getTileType(game.map, t) === TileType.House) tiles.add(t);
  return tiles;
};

const touchesRoad = (game: GameState, t: number): boolean =>
  DIR_OFFSETS.some(([dx, dy]) => {
    const n = t + dy * game.map.sizeX + dx;
    return getTileType(game.map, n) === TileType.Road;
  });

describe('town road helpers (port of town_cmd.cpp)', () => {
  it('draws two road pieces like GenRandomRoadBits', () => {
    expect(genRandomRoadBits(createRandomizer(12345))).toBe(RoadBits.Y);
  });

  it('follows roads and empty land, never houses, water or the map edge', () => {
    const { game } = townAt32(1);
    const { map } = game;
    const t = tileXY(map, 10, 10);
    setTileType(map, tileXY(map, 10, 11), TileType.House); // SE
    makeSea(map, tileXY(map, 11, 10)); // SW
    makeRoadNormal(map, tileXY(map, 10, 9), RoadBits.Y, 0); // NW
    expect(
      [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW].map((d) => canFollowRoad(map, t, d)),
    ).toEqual([true, false, false, true]);
    expect(canFollowRoad(map, tileXY(map, 1, 10), DiagDir.NE)).toBe(false);
  });

  it('refuses a road beside a parallel road (IsNeighbourRoadTile, TL_ORIGINAL)', () => {
    const { game } = townAt32(1);
    const { map } = game;
    const t = tileXY(map, 20, 20);
    makeRoadNormal(map, tileXY(map, 20, 19), RoadBits.Y, 0);
    expect(isNeighbourRoadTile(map, t, DiagDir.NE, 1)).toBe(false);
    makeRoadNormal(map, tileXY(map, 20, 19), RoadBits.X, 0);
    expect(isNeighbourRoadTile(map, t, DiagDir.NE, 1)).toBe(true);
    expect(isRoadAllowedHere(map, t, DiagDir.NE)).toBe(false);
  });

  it('allows roads on flat clear land only (IsRoadAllowedHere, ruling R11)', () => {
    const { game } = townAt32(1);
    const { map } = game;
    makeSea(map, tileXY(map, 5, 5));
    map.height[tileXY(map, 8, 5)] = 0; // (7,5) sloped
    const tiles = [tileXY(map, 10, 10), tileXY(map, 0, 10), tileXY(map, 5, 5), tileXY(map, 7, 5)];
    expect(tiles.map((t) => isRoadAllowedHere(map, t, DiagDir.NE))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});

describe('GrowTown (port of town_cmd.cpp)', () => {
  it('starts a town with a random two-piece road on its centre tile', () => {
    const { game, town } = townAt32(12345);
    expect(growTown(game, town)).toBe(true);
    const t = town.xy;
    expect([
      getTileType(game.map, t),
      getRoadBits(game.map, t),
      getRoadOwner(game.map, t),
      getTownIndex(game.map, t),
    ]).toEqual([TileType.Road, RoadBits.Y, OWNER_TOWN, 0]);
  });

  it('grows roads and houses; each new house touches a road when built (ruling R13)', () => {
    const { game, town } = townAt32(42);
    town.numHouses += 20; // DoCreateTown's "pretend bigger" fudge
    updateTownRadius(town);
    for (let i = 0; i < 80; i++) {
      const before = houseTiles(game);
      growTown(game, town);
      const added = [...houseTiles(game)].filter((t) => !before.has(t));
      if (added.length > 0) expect(added.some((t) => touchesRoad(game, t))).toBe(true);
    }
    expect(town.numHouses).toBeGreaterThan(20);
    for (let t = 0; t < game.map.size; t++) {
      if (getTileType(game.map, t) !== TileType.Road) continue;
      expect([getRoadOwner(game.map, t), getTownIndex(game.map, t)]).toEqual([OWNER_TOWN, 0]);
      for (const d of [DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW] as const) {
        if ((getRoadBits(game.map, t) & diagDirToRoadBits(d)) === 0) continue;
        const [dx, dy] = DIAGDIR_OFFSETS[d]!;
        expect(isValidTile(game.map, t + dy * game.map.sizeX + dx)).toBe(true); // no piece points off the map
      }
    }
  });
});
```

Run: `npx vitest run src/sim/town/growth.test.ts` — Expected: FAIL, cannot resolve `./growth`.

- [ ] **Step 2: Implement `growth.ts`** — port of `town_cmd.cpp:GenRandomRoadBits`, `CanFollowRoad`, `IsNeighbourRoadTile`, `IsRoadAllowedHere`, `GrowTownInTile`, `GrowTownAtRoad`, `GrowTown` for `TL_ORIGINAL` with both expand modes (Buildings and Roads). Read `town-building.md` §4.6–4.9 and the C++ (`town_cmd.cpp` lines 1043–1955) side by side. Key code:

```ts
/** _town_coord_mod. Port of town_cmd.cpp:GrowTown. */
export const TOWN_COORD_MOD: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 0],
  [0, 2],
  [2, 0],
  [0, -2],
  [-1, -1],
  [-2, 2],
  [2, 2],
  [2, -2],
  [0, 0],
];
const DIAGDIR_END = 4;

/** Port of town_cmd.cpp:GenRandomRoadBits. */
export function genRandomRoadBits(random: Randomizer): number {
  const r = nextRandom(random);
  const a = r & 3;
  let b = (r >>> 8) & 3;
  if (a === b) b ^= 2;
  return (RoadBits.NW << a) + (RoadBits.NW << b);
}

/** Port of town_cmd.cpp:IsNeighbourRoadTile. */
export function isNeighbourRoadTile(
  map: MapState,
  t: number,
  dir: DiagDir,
  distMulti: number,
): boolean {
  if (!isValidTile(map, t)) return false;
  const right = tileOffsByDiagDir(map, diagDirRight(dir));
  const left = tileOffsByDiagDir(map, diagDirLeft(dir));
  const back = tileOffsByDiagDir(map, reverseDiagDir(dir));
  for (let pos = 4; pos < (distMulti + 1) * 4; pos++) {
    let cur = ((pos & 1) !== 0 ? right : left) * (pos >> 2);
    if ((pos & 2) !== 0) cur += back;
    const bit = diagDirToRoadBits((pos & 2) !== 0 ? dir : reverseDiagDir(dir));
    if (isValidTile(map, t + cur) && (getTownRoadBits(map, t + cur) & bit) !== 0) return true;
  }
  return false;
}

/** Port of town_cmd.cpp:IsRoadAllowedHere; a sloped tile refuses the road (ruling R11), so no slope-branch draws. */
export function isRoadAllowedHere(map: MapState, t: number, dir: DiagDir): boolean {
  if (distanceFromEdge(map, t) === 0) return false;
  if (getTownRoadBits(map, t) === RoadBits.None) {
    const bits = dir === DiagDir.NW || dir === DiagDir.SE ? RoadBits.Y : RoadBits.X;
    if (!canTownBuildRoad(map, t, bits) && !canAutoClear(map, t, true)) return false;
  }
  if (!isTileFlat(map, t)) return false;
  return !isNeighbourRoadTile(map, t, dir, 1);
}
```

`canFollowRoad(map, t, dir)`: `target = t + tileOffsByDiagDir(map, dir)`; invalid or `hasTileWaterGround` → false; road → `getTownRoadBits !== None`; house, industry, object → false; any other type → true.

`growTownInTile(state, town, t, curRb, targetDir)` — the three branches of the C++ (quoted in `town-building.md` §4.8), with these Stage 1 decisions:

- Branch A (`curRb === None`): no `Chance16(1, 6)`/`LevelTownLand` (ruling R1/R11); `isRoadAllowedHere(t, targetDir)` else `SearchStopped`; `source = reverseDiagDir(targetDir)`; `if (chance16I(1, 4, nextRandom(random))) do targetDir = randomRange(random, 4) while (targetDir === source)`; if the road may not continue (`isRoadAllowedHere(t + offset(targetDir), targetDir)` false): a curve → `SearchStopped`; straight → `SearchStopped` unless the tile 90° right or left of `t` is a house; `rcmd = bit(targetDir) | bit(source)`.
- Branch B (`curRb !== None && targetDir < 4 && !(curRb & bit(reverse(targetDir)))`): `rcmd = bit(reverse(targetDir))` (`TownCanGrowRoad` is always true with one road type).
- Branch C (otherwise): `targetDir = randomRange(random, 4)`; `targetRb = bit(targetDir)`; if `curRb & targetRb`: continue unless `(curRb & RoadBits.X) === targetRb`; corner house tile by `curRb` (`N → (1,1)`, `S → (-1,-1)`, `E → (1,-1)`, `W → (-1,1)`), other shapes → `Continue`; `targetDir = 4`; else `houseTile = t + offset(targetDir)`. `hasTileWaterGround(houseTile)` or `!isValidTile(houseTile)` → `Continue`. `allowHouse = targetDir === 4 ? true : !isRoadAllowedHere(houseTile, targetDir) || chance16I(6, 10, nextRandom(random))` (the draw only happens when the road is allowed); `rcmd = targetRb`. If `allowHouse`: when `houseTile` is not a house, `tryBuildTownHouse(state, town, houseTile, true)` → `Succeed`; return the result (`Continue` if nothing was built). Otherwise fall through to the common ending.
- Common ending: `hasTileWaterGround(t)` → `SearchStopped`; `rcmd = cleanUpRoadBits(map, t, rcmd)`, `None` → `SearchStopped`; `GrowTownWithBridge`/`GrowTownWithTunnel` are not ported (bridges start on slopes or cross rivers, rails or one-way roads, none of which exist in Stage 1: both return false); `buildTownRoad(state, town, t, rcmd) ? Succeed : SearchStopped`.

`growTownAtRoad(state, town, t)` — exactly the C++ loop: `targetDir = 4`; `iterations = 10 + Math.trunc(town.numHouses * 4 / 9)`; `do { curRb = getTownRoadBits(t); result = growTownInTile(...); Succeed → return true; SearchStopped → iterations = 0; if (targetDir < 4) curRb &= ~bit(reverse(targetDir)); if (curRb === None) return false; do { if (curRb === None) return false; do targetDir = randomRange(random, 4) while (!(curRb & bit(targetDir))); curRb &= ~bit(targetDir); } while (!canFollowRoad(map, t, targetDir)); t += offset(targetDir); if (t is a normal road owned by OWNER_TOWN && getTownIndex(t) !== town.index) return false; } while (--iterations >= 0); return false`. Note `curRb` keeps the bits read **before** `growTownInTile` built anything, as in C++.

`growTown(state, town)` — two passes over `TOWN_COORD_MOD` from `town.xy` (the tile is checked before stepping): the first tile with town road bits → `growTownAtRoad`; otherwise the first tile that is not a house, is flat and `canAutoClear(map, tile, true)` gets `buildTownRoad(state, town, tile, genRandomRoadBits(random))` and returns `true`; else `false`.

Run: `npx vitest run src/sim/town` — Expected: all passed.

- [ ] **Step 3: Commit** — `feat: port the town growth walk` (body: towns build their roads and houses with the same random walk OpenTTD uses for growth (`GrowTownAtRoad`/`GrowTownInTile`), so generated towns have OpenTTD's shape; Stage 1 runs it only at world generation (R4) and keeps it on flat land (R11). `Refs #N`). PR into the block branch.

---

### Task 9: Town names and town generation

**Files:**

- Create: `src/sim/town/town-names.ts`, `src/sim/town/town-gen.ts`, `src/sim/town/town-names.test.ts`, `src/sim/town/town-gen.test.ts`
- Modify: `src/sim/world/generate.ts`, `src/sim/world/generate.test.ts` (re-pin), `docs/game/differences.md`

**Interfaces:**

- Consumes: Tasks 1–8, `WorldGenerationError` (Task 4), `WORLD` (Task 2).
- Produces (`town-names.ts`): `townName(parts: number): string`, `generateTownName(random, used: Set<string> | null, existing?: readonly string[]): number | null`.
- Produces (`town-gen.ts`): `defaultTownCount(map, level: number): number`, `townCanBePlacedHere(state, t): boolean`, `getClosestWaterDistance(map, t): number`, `findNearestGoodCoastalTownSpot(state, t): number`, `doCreateTown(state, town): void`, `deleteTown(state, town): void`, `createRandomTown(state, attempts, nameParts, isCity): Town | null`, `generateTowns(state): Generator<number, void, void>` (yields its own progress 0..1; throws `WorldGenerationError('error.noTownCreated')`).

- [ ] **Step 1: Write the failing tests**

`src/sim/town/town-names.test.ts` (expected names derived by hand from `townname.cpp:MakeEnglishOriginalTownName`: seed 0 → `Wr`+`ar`+`n`+`ville` → `Wrar`→`Inve`; `0xffffffff` → prefix 3, parts 25/7/6/22, suffix 8; `2193152` → `C`+`e`+`n`+`ville` → `Ce`→`Ke`):

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer, nextRandom } from '../core/random';
import { generateTownName, townName } from './town-names';

const NAME =
  /^(Great |Little |New |Fort )?[A-Z][a-z]*(-on-sea| Bay| Market| Cross| Bridge| Falls| City| Ridge| Springs)?$/;
const REPLACED = [
  'Ce',
  'Ci',
  'Cunt',
  'Slag',
  'Slut',
  'Drar',
  'Dreh',
  'Frar',
  'Grar',
  'Brar',
  'Wrar',
];

const randomNames = (count: number): string[] => {
  const r = createRandomizer(99);
  return Array.from({ length: count }, () => townName(nextRandom(r)));
};

describe('English (Original) town names (port of townname.cpp)', () => {
  it.each([
    [0, 'Invenville'],
    [0xffffffff, 'Fort Wenfingburg Springs'],
    [2193152, 'Kenville'],
  ])('seed %i is %s', (seed, name) => {
    expect(townName(seed)).toBe(name);
  });

  it('builds every name from the OpenTTD tables, shorter than 32 characters', () => {
    for (const name of randomNames(2000)) {
      expect(name).toMatch(NAME);
      expect(name.length).toBeLessThan(32);
    }
  });

  it('never starts a name with a replaced pattern', () => {
    for (const name of randomNames(2000))
      expect(REPLACED.some((p) => name.startsWith(p))).toBe(false);
  });

  it('draws again when the name is taken, and records the new one (GenerateTownName)', () => {
    const used = new Set([townName(536872454)]);
    expect(generateTownName(createRandomizer(12345), used)).toBe(3515126559);
    expect(used.has(townName(3515126559))).toBe(true);
  });
});
```

`src/sim/town/town-gen.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { distanceFromEdge, distanceManhattan } from '../map/geometry';
import { getHouseType, isHouseCompleted } from '../map/house-map';
import { getTileType, isInnerTile, TileType, tileXY } from '../map/map';
import { makeRoadNormal, RoadBits } from '../map/road-map';
import { makeSea } from '../map/water';
import { WorldGenerationError } from '../world/errors';
import { createGame, countLandTiles } from '../world/generate';
import { houseSpec } from './house-specs';
import { buildTownHouse } from './houses';
import { townName } from './town-names';
import {
  defaultTownCount,
  deleteTown,
  doCreateTown,
  generateTowns,
  townCanBePlacedHere,
} from './town-gen';
import { newTown } from './town';

const SEA_TILES = [
  [30, 30],
  [31, 30],
  [33, 30],
  [34, 30],
  [30, 31],
  [31, 31],
  [33, 31],
  [34, 31],
  [30, 33],
  [31, 33],
  [33, 33],
  [34, 33],
  [30, 34],
] as const;

const emptyGame = (): GameState => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.random = createRandomizer(12345);
  return game;
};

const seaGame = (): GameState => {
  const game = emptyGame();
  for (let t = 0; t < game.map.size; t++) if (isInnerTile(game.map, t)) makeSea(game.map, t);
  game.initialLandCount = countLandTiles(game.map);
  return game;
};

const runTowns = (game: GameState): void => {
  const gen = generateTowns(game);
  while (gen.next().done !== true) {
    // progress only
  }
};

const generationErrorKey = (game: GameState): string | null => {
  try {
    runTowns(game);
    return null;
  } catch (error) {
    return error instanceof WorldGenerationError ? error.key : 'not a WorldGenerationError';
  }
};

describe('town placement (port of town_cmd.cpp)', () => {
  it('scales the default town count by map size (GetDefaultTownsForMapSize)', () => {
    const counts = [
      [8, 8, 2],
      [6, 6, 2],
      [10, 10, 2],
      [8, 8, 0],
      [8, 8, 3],
    ] as const;
    expect(
      counts.map(([x, y, level]) =>
        defaultTownCount(createEmptyGame({ mapLogX: x, mapLogY: y }).map, level),
      ),
    ).toEqual([23, 2, 368, 5, 46]);
  });

  it('needs 12 tiles from the edge, 20 tiles from other towns and a flat dry site (TownCanBePlacedHere)', () => {
    const game = emptyGame();
    const { map } = game;
    expect([
      townCanBePlacedHere(game, tileXY(map, 32, 32)),
      townCanBePlacedHere(game, tileXY(map, 11, 32)),
      townCanBePlacedHere(game, tileXY(map, 12, 32)),
    ]).toEqual([true, false, true]);
    game.towns.push(newTown(0, tileXY(map, 32, 32), 0, false));
    expect([
      townCanBePlacedHere(game, tileXY(map, 40, 43)),
      townCanBePlacedHere(game, tileXY(map, 40, 44)),
    ]).toEqual([false, true]);
  });

  it('needs 12 of the 25 tiles around the centre to be dry and level', () => {
    const game = emptyGame();
    const { map } = game;
    for (const [x, y] of SEA_TILES) makeSea(map, tileXY(map, x, y));
    expect(townCanBePlacedHere(game, tileXY(map, 32, 32))).toBe(true); // 12 qualify
    makeSea(map, tileXY(map, 31, 34));
    expect(townCanBePlacedHere(game, tileXY(map, 32, 32))).toBe(false); // 11 qualify
  });
});

describe('DoCreateTown (port of town_cmd.cpp)', () => {
  it('grows 4x times with x = (Random() & 15) + 8, then counts real houses and population', () => {
    const game = emptyGame();
    const town = newTown(0, tileXY(game.map, 32, 32), 0, false);
    game.towns.push(town);
    doCreateTown(game, town); // first draw 536872454: x = 14
    let buildings = 0;
    let population = 0;
    for (let t = 0; t < game.map.size; t++) {
      if (getTileType(game.map, t) !== TileType.House) continue;
      const spec = houseSpec(getHouseType(game.map, t));
      if (spec.size !== 'part') buildings++;
      if (isHouseCompleted(game.map, t)) population += spec.population;
    }
    expect([town.numHouses, town.population]).toEqual([buildings, population]);
    expect(buildings).toBeGreaterThan(0);
  });

  it('deletes a town by clearing its roads and houses only (CmdDeleteTown)', () => {
    const game = emptyGame();
    const { map } = game;
    const keep = newTown(0, tileXY(map, 20, 20), 1, false);
    const gone = newTown(1, tileXY(map, 44, 44), 2, false);
    game.towns.push(keep, gone);
    makeRoadNormal(map, tileXY(map, 20, 20), RoadBits.X, 0);
    makeRoadNormal(map, tileXY(map, 44, 44), RoadBits.X, 1);
    buildTownHouse(game, gone, tileXY(map, 45, 44), houseSpec(0x06), 0, true);
    deleteTown(game, gone);
    expect([
      getTileType(map, tileXY(map, 20, 20)),
      getTileType(map, tileXY(map, 44, 44)),
      getTileType(map, tileXY(map, 45, 44)),
    ]).toEqual([TileType.Road, TileType.Clear, TileType.Clear]);
    expect(game.towns.map((t) => t.index)).toEqual([0]);
  });
});

describe('GenerateTowns (port of town_cmd.cpp)', () => {
  it('places towns by the rules on the default world', () => {
    const { map, towns } = createGame({ seed: 5 });
    expect(towns.length).toBeGreaterThan(0);
    for (const a of towns) {
      expect(distanceFromEdge(map, a.xy)).toBeGreaterThanOrEqual(12);
      expect(a.population).toBeGreaterThan(0);
      for (const b of towns)
        if (a !== b) expect(distanceManhattan(map, a.xy, b.xy)).toBeGreaterThanOrEqual(20);
    }
    expect(new Set(towns.map((t) => townName(t.nameParts))).size).toBe(towns.length);
    // The city flag uses the number of towns created so far: one town in four, every fourth index.
    const first = towns.findIndex((t) => t.isCity);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
    expect(towns.every((t, i) => t.isCity === (i % 4 === first))).toBe(true);
  });

  it('fails like OpenTTD when no town fits (ruling R12)', () => {
    expect(generationErrorKey(seaGame())).toBe('error.noTownCreated');
  });
});
```

Run: `npx vitest run src/sim/town` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `town-names.ts`** — port of `townname.cpp:SeedChance`, `SeedChanceBias`, `MakeEnglishOriginalTownName`, `ReplaceWords`, `ReplaceEnglishWords` (original: `Ce→Ke`, `Ci→Ki`, `Cunt→East`, `Slag→Pits`, `Slut→Edin`, `Drar→Quar`, `Dreh→Bash`, `Frar→Shor`, `Grar→Aber`, `Brar→Over`, `Wrar→Inve`, each only at index 0 of the whole name) and `GenerateTownName` (1000 tries of `nextRandom`; a name of 32+ characters is refused; with `used`: refuse names in the set, insert the accepted one; with `used === null`: refuse names equal to `existing`). Tables from `table/townname.h` (`_name_original_english_1..6`, copied in `town-building.md` §4.12). `SeedChance(shift, max, seed) = (((seed >>> shift) & 0xffff) * max) >>> 16`.

- [ ] **Step 3: Implement `town-gen.ts`** — port of `town_cmd.cpp:GetDefaultTownsForMapSize`, `TownCanBePlacedHere` (incl. `IsCloseToTown(tile, 20)` as Manhattan `< 20` to any centre), `water_map.cpp:GetClosestWaterDistance` (`water = true`), `FindNearestGoodCoastalTownSpot`, `DoCreateTown`, `CmdDeleteTown` (generation case), `CreateRandomTown`, `GenerateTowns` (town-building.md §4.2–4.5):

```ts
/** Port of town_cmd.cpp:GetDefaultTownsForMapSize (difficulty.number_towns 0..3). */
export const defaultTownCount = (map: MapState, level: number): number =>
  scaleBySize(map, [5, 11, 23, 46][level]!);

/** Port of town_cmd.cpp:GenerateTowns (TL_ORIGINAL, larger_towns 4). Yields its own progress. */
export function* generateTowns(state: GameState): Generator<number, void, void> {
  const { map, random } = state;
  let total = scaleByLandProportion(
    defaultTownCount(map, state.options.townCount) + (nextRandom(random) & 7),
    state.initialLandCount,
    map.size,
  );
  total = Math.min(Math.max(total, 1), 64000);
  const used = new Set<string>();
  const cityOffset = WORLD.largerTowns === 0 ? 0 : nextRandom(random) % WORLD.largerTowns;
  let created = 0;
  for (let i = 0; i < total; i++) {
    const isCity = WORLD.largerTowns !== 0 && (cityOffset + created) % WORLD.largerTowns === 0;
    const parts = generateTownName(random, used);
    if (parts !== null && createRandomTown(state, 20, parts, isCity) !== null) created++;
    yield (i + 1) / total;
  }
  if (created > 0) return;
  const parts = generateTownName(random, null, []);
  if (parts !== null && createRandomTown(state, 10000, parts, WORLD.largerTowns !== 0) !== null)
    return;
  throw new WorldGenerationError('error.noTownCreated');
}

/** Port of town_cmd.cpp:CreateRandomTown (AlignTileToGrid is a no-op for TL_ORIGINAL). */
export function createRandomTown(
  state: GameState,
  attempts: number,
  nameParts: number,
  isCity: boolean,
): Town | null {
  const { map } = state;
  for (let i = 0; i < attempts; i++) {
    let tile = randomTile(map, nextRandom(state.random));
    if (getTileType(map, tile) === TileType.Water) {
      tile = findNearestGoodCoastalTownSpot(state, tile);
      if (tile === INVALID_TILE) continue;
    } else if (!townCanBePlacedHere(state, tile)) {
      continue;
    }
    const town = newTown(state.towns.length, tile, nameParts, isCity);
    state.towns.push(town);
    doCreateTown(state, town);
    if (town.population > 0) return town;
    deleteTown(state, town);
  }
  return null;
}

/** Port of town_cmd.cpp:DoCreateTown (TSZ_RANDOM, not manual). */
export function doCreateTown(state: GameState, town: Town): void {
  let x = (nextRandom(state.random) & 0xf) + 8;
  if (town.isCity) x *= WORLD.initialCitySize;
  town.numHouses += x;
  updateTownRadius(town);
  for (let i = x * 4; i > 0; i--) growTown(state, town);
  town.numHouses -= x;
  updateTownRadius(town);
  // UpdateTownGrowthRate (growth, R4) and UpdateTownMaxPass (passenger statistics) wait for block 1.5.
}
```

`deleteTown(state, town)`: every house tile and every town-owned normal road tile whose `getTownIndex === town.index` gets `doClearSquare(map, t, true)`; then `state.towns.pop()` (the deleted town is always the last one created, so the pool index is reused like OpenTTD's lowest free index). `townCanBePlacedHere` checks, in order: `distanceFromEdge < 12`; any town centre at Manhattan `< 20`; tile not clear/trees or not flat; then the 25-tile spiral (`spiralTiles(map, t, 5)`), stopping at 12, counting clear tiles not rough and tree tiles not on rough ground with `getTileMaxZ <= h + 1 && getTileZ >= h - 1`.

- [ ] **Step 4: Wire into `generate.ts`** — before trees: `for (const p of generateTowns(state)) yield { fraction: 0.25 + 0.3 * p };`.

- [ ] **Step 5: Run** — `npx vitest run src/sim tests/perf` — Expected: all pass except the golden hash; re-pin `GOLDEN_64_SEED_1`; run again — all passed. If seed 1 makes no town on 64×64, `createGame` throws: then use seed 2 for the golden test and say so in the commit body. `differences.md`: add

```markdown
| Building on slopes | Allowed with foundations | Towns build only on flat land; industries need a level site (no terraforming) | D4 / ruling R11: only coast-side land at height 0 is affected; Stage 2 adds foundations |
| Town growth | Towns grow during play | Towns keep their generated size | Ruling R4: growth and ratings come in a later stage |
```

- [ ] **Step 6: Commit** — `feat: generate named towns with roads and houses` (body: `GenerateTowns` as in OpenTTD — count scaled by map and land, one city in four, English names unique by string, 20 attempts, failed towns deleted; a world where no town fits stops with an error like OpenTTD (R12) instead of a town-less map; golden hash re-pinned. `Refs #N`). PR into the block branch.

---

### Task 10: Coal mines and power stations

**Files:**

- Create: `src/sim/map/industry-map.ts`, `src/sim/industry/industry-specs.ts`, `src/sim/industry/industry-gen.ts`, `src/sim/industry/industry-gen.test.ts`
- Modify: `src/sim/game.ts`, `src/sim/world/generate.ts`, `src/sim/world/generate.test.ts` (re-pin), `docs/game/differences.md`

**Interfaces:**

- Consumes: Tasks 1–9.
- Produces (`industry-map.ts`): `makeIndustry(map, t, index, gfx, randomBits)`, `getIndustryIndex(map, t)` (m2), `getIndustryGfx(map, t)` (m5 + m6 bit 2), `isIndustryCompleted(map, t)` (m1 bit 7), `getIndustryConstructionStage(map, t)`, `setIndustryConstructionStage(map, t, s)` (m1 bits 1..0), `getIndustryConstructionCounter(map, t)`, `setIndustryConstructionCounter(map, t, c)` (m1 bits 3..2), `setIndustryCompleted(map, t)`.
- Produces (`industry-specs.ts`): `IndustryType` (`CoalMine 0, PowerStation 1`) + type, `interface LayoutTile { dx: number; dy: number; gfx: number }`, `interface IndustrySpec { type: IndustryType; layouts: readonly (readonly LayoutTile[])[]; conflicting: IndustryType; productionRate: number }`, `INDUSTRY_SPECS`, `TEMPERATE_LAND_INDUSTRIES: readonly { openttdType: number; chance: number; scale1D: boolean; stage1: IndustryType | null }[]`, `PRODLEVEL_DEFAULT = 0x10`.
- Produces (`industry-gen.ts`): `interface Industry { index: number; type: IndustryType; tile: number; width: number; height: number; townIndex: number; layoutIndex: number; productionRate: number; counter: number; randomColour: number; random: number; prodLevel: number }`, `numberOfIndustries(map, density): number`, `industryGenerationPlan(map, density, initialLandCount): { probs: number[]; total: number; forced: number[]; randomPicks: number } | null`, `industryPlatformIsLevel(map, t, layout): boolean`, `createNewIndustry(state, t, type): Industry | null`, `generateIndustries(state): Generator<number, void, void>`, `tileLoopIndustry(state, t, markDirty): void`.
- Produces (`game.ts`): `GameState.industries: Industry[]` (`[]`, hashed: every field), proc `[TileType.Industry]: (t) => tileLoopIndustry(state, t, markDirty)`.

- [ ] **Step 1: Write the failing test** (`src/sim/industry/industry-gen.test.ts`). Draws for `createNewIndustry` with seed 12345 (`random_var8f` dropped, ruling R1): `536872454` initial bits (`& 0xffff` = 1542), `3515126559` layout (`RandomRange(4)` = 3), `4023459891` rate (`RandomRange(256)` = 239 → `(239 + 128) * 15 >> 8` = 21), `1208093797` colour/counter (`& 0xffff` = 3173 → colour 5, counter 198), then one draw per tile (low byte → m3: 194, 89, 206, 223, 105, 57, 62, 198, 168, 131).

```ts
import { describe, expect, it } from 'vitest';
import { createRandomizer } from '../core/random';
import { createEmptyGame, type GameState } from '../game';
import { distanceMax } from '../map/geometry';
import { getIndustryGfx, getIndustryIndex, isIndustryCompleted } from '../map/industry-map';
import { getTileType, TileType, tileXY } from '../map/map';
import { getTileSlopeZ } from '../map/slope';
import { newTown } from '../town/town';
import { createGame } from '../world/generate';
import {
  createNewIndustry,
  industryGenerationPlan,
  industryPlatformIsLevel,
  numberOfIndustries,
  tileLoopIndustry,
} from './industry-gen';
import { INDUSTRY_SPECS, IndustryType } from './industry-specs';

const NOOP = (): void => undefined;

const oneTownGame = (): GameState => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.towns.push(newTown(0, tileXY(game.map, 32, 32), 0, false));
  game.random = createRandomizer(12345);
  return game;
};

describe('industry specs (port of table/build_industry.h)', () => {
  it('keeps the coal mine and power station layouts', () => {
    const coal = INDUSTRY_SPECS[IndustryType.CoalMine]!;
    const power = INDUSTRY_SPECS[IndustryType.PowerStation]!;
    expect(coal.layouts.map((l) => l.length)).toEqual([6, 9, 6, 10]);
    expect(power.layouts.map((l) => l.length)).toEqual([8, 8, 6]);
    expect(coal.layouts[0]).toEqual([
      { dx: 1, dy: 1, gfx: 0 },
      { dx: 1, dy: 2, gfx: 2 },
      { dx: 0, dy: 0, gfx: 5 },
      { dx: 1, dy: 0, gfx: 6 },
      { dx: 2, dy: 0, gfx: 3 },
      { dx: 2, dy: 2, gfx: 3 },
    ]);
    expect([
      coal.conflicting,
      power.conflicting,
      coal.productionRate,
      power.productionRate,
    ]).toEqual([IndustryType.PowerStation, IndustryType.CoalMine, 15, 0]);
  });
});

describe('GenerateIndustries counts (port of industry_cmd.cpp, ruling R10)', () => {
  it('scales the number of industries by density and map size', () => {
    const map256 = createEmptyGame().map;
    const map64 = createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map;
    expect([0, 1, 2, 3, 4, 5].map((d) => numberOfIndustries(map256, d))).toEqual([
      0, 0, 10, 25, 55, 80,
    ]);
    expect([0, 1, 2, 3, 4, 5].map((d) => numberOfIndustries(map64, d))).toEqual([0, 0, 1, 2, 4, 5]);
  });

  it('forces one of each temperate type, then draws the rest by chance', () => {
    const plan = industryGenerationPlan(createEmptyGame().map, 4, 65536);
    expect(plan?.probs).toEqual([128, 80, 80, 80, 64, 80, 80, 144, 64, 80]);
    expect([plan?.total, plan?.forced, plan?.randomPicks]).toEqual([
      880,
      [0, 1, 2, 3, 4, 6, 8, 9, 11, 18],
      45,
    ]);
    const small = industryGenerationPlan(createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map, 4, 4096);
    expect([small?.total, small?.randomPicks]).toEqual([67, 0]);
    expect(industryGenerationPlan(createEmptyGame().map, 0, 65536)).toBeNull();
  });
});

describe('CreateNewIndustry (port of industry_cmd.cpp)', () => {
  it('builds a coal mine with OpenTTD draws and tile fields', () => {
    const game = oneTownGame();
    const ind = createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    expect(ind).toEqual({
      index: 0,
      type: IndustryType.CoalMine,
      tile: tileXY(game.map, 20, 20),
      width: 3,
      height: 4,
      townIndex: 0,
      layoutIndex: 3,
      productionRate: 21,
      counter: 198,
      randomColour: 5,
      random: 1542,
      prodLevel: 0x10,
    });
    const t = tileXY(game.map, 20, 21); // layout 3, first tile (0,1) gfx 0
    expect([
      getTileType(game.map, t),
      getIndustryIndex(game.map, t),
      getIndustryGfx(game.map, t),
      game.map.m3[t],
      game.map.m1[t],
    ]).toEqual([TileType.Industry, 0, 0, 194, 0x6e]);
    expect(game.map.m3[tileXY(game.map, 22, 22)]).toBe(131);
  });

  it('completes a generated tile on its first tile-loop visit', () => {
    const game = oneTownGame();
    createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    const t = tileXY(game.map, 20, 21);
    tileLoopIndustry(game, t, NOOP);
    expect([isIndustryCompleted(game.map, t), game.map.m1[t]]).toEqual([true, 0xe3]);
  });

  it('refuses a conflicting industry within 14 tiles and a second one of a type per town', () => {
    const game = oneTownGame();
    createNewIndustry(game, tileXY(game.map, 20, 20), IndustryType.CoalMine);
    expect(createNewIndustry(game, tileXY(game.map, 30, 20), IndustryType.PowerStation)).toBeNull();
    expect(createNewIndustry(game, tileXY(game.map, 45, 45), IndustryType.CoalMine)).toBeNull();
  });

  it('needs a level platform (ruling R11)', () => {
    const game = oneTownGame();
    const layout = INDUSTRY_SPECS[IndustryType.CoalMine]!.layouts[0]!;
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 20, 20), layout)).toBe(true);
    game.map.height[tileXY(game.map, 24, 24)] = 0; // a vertex of the platform margin
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 20, 20), layout)).toBe(false);
    expect(industryPlatformIsLevel(game.map, tileXY(game.map, 2, 20), layout)).toBe(false); // too close to the edge
  });
});

describe('GenerateIndustries on the default world', () => {
  it('keeps the distance and one-per-town rules, on level land', () => {
    const game = createGame({ seed: 5 });
    const { map, industries } = game;
    const mines = industries.filter((i) => i.type === IndustryType.CoalMine);
    const stations = industries.filter((i) => i.type === IndustryType.PowerStation);
    expect(mines.length).toBeGreaterThan(0);
    expect(stations.length).toBeGreaterThan(0);
    for (const m of mines)
      for (const s of stations) expect(distanceMax(map, m.tile, s.tile)).toBeGreaterThan(14);
    for (const list of [mines, stations])
      expect(new Set(list.map((i) => i.townIndex)).size).toBe(list.length);
    for (let t = 0; t < map.size; t++) {
      if (getTileType(map, t) !== TileType.Industry) continue;
      expect(getTileSlopeZ(map, t)).toEqual({ slope: 0, z: 1 });
      expect(industries[getIndustryIndex(map, t)]).toBeDefined();
    }
  });
});
```

Run: `npx vitest run src/sim/industry` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `industry-map.ts`** — port of `industry_map.h:MakeIndustry` and accessors: `resetTileKeepingHeight`, `setTileType(Industry)`, `m1 = WaterClass.Invalid << 5` (land), `m2 = index`, `m3 = randomBits & 0xff`, `m4 = 0`, `m5 = gfx & 0xff`, `m6 = ((gfx >> 8) & 1) << 2`, `m7 = m8 = 0`. Completed: m1 bit 7; stage: m1 bits 1..0 (3 when completed); counter: m1 bits 3..2.

- [ ] **Step 3: Implement `industry-specs.ts`** — layouts verbatim from `table/build_industry.h` (`_tile_table_coal_mine_0..3`, `_tile_table_power_station_0..2`; `MK(x, y, gfx)` → `{ dx: x, dy: y, gfx }`, in source order; copied in `towns-industries.md` §4.9). `TEMPERATE_LAND_INDUSTRIES` (appear_creation[temperate] > 0, in `IndustryType` order; ruling R10):

```ts
export const TEMPERATE_LAND_INDUSTRIES = [
  { openttdType: 0, chance: 8, scale1D: false, stage1: IndustryType.CoalMine }, // coal mine
  { openttdType: 1, chance: 5, scale1D: false, stage1: IndustryType.PowerStation }, // power station
  { openttdType: 2, chance: 5, scale1D: false, stage1: null }, // sawmill
  { openttdType: 3, chance: 5, scale1D: false, stage1: null }, // forest
  { openttdType: 4, chance: 4, scale1D: true, stage1: null }, // oil refinery (CHECK_REFINERY: ScaleBySize1D)
  { openttdType: 6, chance: 5, scale1D: false, stage1: null }, // factory
  { openttdType: 8, chance: 5, scale1D: false, stage1: null }, // steel mill
  { openttdType: 9, chance: 9, scale1D: false, stage1: null }, // farm
  { openttdType: 11, chance: 4, scale1D: false, stage1: null }, // oil wells
  { openttdType: 18, chance: 5, scale1D: false, stage1: null }, // iron ore mine
] as const;
```

(The temperate oil rig and bank have creation chance 0; the water pass therefore places nothing.)

- [ ] **Step 4: Implement `industry-gen.ts`** — port of `industry_cmd.cpp:GetNumberOfIndustries` (`[0, 0, 10, 25, 55, 80]`, `min(64000, ScaleBySize)`), `GetScaledIndustryGenerationProbability` (`chance * 16`, then `ScaleBySize` or `ScaleBySize1D`), `GenerateIndustries`, `PlaceIndustry` (10000 tries when forced, else 2000, each `createNewIndustry(state, randomTile(map, nextRandom(random)), type)`), `CreateNewIndustry`, `CreateNewIndustryHelper`, `CheckIfFarEnoughFromConflictingIndustry` (`DistanceMax(tile, other.tile) <= 14` → refuse), `FindTownForIndustry` (`closestTownFromTile(state, t, Infinity)`; refuse if an industry of this type already has that town — `multiple_industry_per_town` false), `CheckIfIndustryTilesAreFree` (`tileAddWrap` per layout tile; invalid → refuse; on water (`hasTileWaterClass && isTileOnWater`) → refuse; `canAutoClear(map, tile, false)` else refuse), `CheckIfCanLevelIndustryPlatform` as `industryPlatformIsLevel` (ruling R11: `x` or `y` of the north tile `<= industryPlatform + 1` → false; the area from `t + (-1, -1)` of `(maxDx + 4) × (maxDy + 4)` tiles must fit (`x + w < MaxX`, `y + h < MaxY`) and every tile in it must have `map.height === map.height[t]`), `DoCreateNewIndustry`, `MakeIndustryTileBigger`, `TileLoop_Industry` (construction only; production is block 1.5).

```ts
export function industryGenerationPlan(
  map: MapState,
  density: number,
  initialLandCount: number,
): { probs: number[]; total: number; forced: number[]; randomPicks: number } | null {
  if (density === 0) return null; // ID_FUND_ONLY
  const probs = TEMPERATE_LAND_INDUSTRIES.map((s) =>
    s.scale1D ? scaleBySize1D(map, s.chance * 16) : scaleBySize(map, s.chance * 16),
  );
  const total = probs.reduce((a, b) => a + b, 0);
  const forced = TEMPERATE_LAND_INDUSTRIES.filter((_, i) => probs[i]! > 0).map(
    (s) => s.openttdType,
  );
  let amount = total > 0 ? Math.floor((total * numberOfIndustries(map, density)) / total) : 0; // water total is 0
  amount = scaleByLandProportion(amount, initialLandCount, map.size);
  if (total === 0 || amount < forced.length) amount = forced.length;
  return { probs, total, forced, randomPicks: amount - forced.length };
}
```

`generateIndustries(state)`: forced types in order (`placeInitialIndustry(type, tryHard = true)`, a no-op for types without `stage1`), then `randomPicks` times `r = randomRange(random, total)` → type by cumulative `probs` → `placeInitialIndustry(type, false)`; yield `done / steps` after each.

`createNewIndustry(state, t, type)`: `random = nextRandom & 0xffff` (seed2; the NewGRF `random_var8f` draw is not replicated, ruling R1), `layoutIndex = randomRange(random, layouts.length)`, then the checks in C++ order (conflict, town, tiles free, level platform); `doCreateNewIndustry`: rate randomised for the coal mine (`Math.min(255, ((randomRange(random, 256) + 128) * 15) >> 8)`, `economy.type` smooth), `r = nextRandom & 0xffff` → `randomColour = r & 0xf`, `counter = (r >>> 4) & 0xfff`; for each layout tile in order: `doClearSquare(map, tile, true)`, `makeIndustry(map, tile, index, gfx, nextRandom(random) & 0xff)`, counter 3 and stage 2 (generation); `width`/`height` = bounding box of the layout (max `dx` + 1, max `dy` + 1; `tile` stays the base tile); push to `state.industries`; add the tiles to `dirtyTiles`.

`tileLoopIndustry(state, t, markDirty)`: if not completed: counter + 1; at 4 → counter 0, stage + 1, stage 3 → `setIndustryCompleted`; `markDirty(t)`.

- [ ] **Step 5: Wire** — `game.ts` (`industries`, hash, proc); `generate.ts`, after towns and before trees: `for (const p of generateIndustries(state)) yield { fraction: 0.55 + 0.15 * p };`. Run `npx vitest run src/sim tests/perf`; re-pin `GOLDEN_64_SEED_1`; run again — all passed. `differences.md`:

```markdown
| Industries | 10 temperate types | Coal mines and power stations only; picks of other types place nothing | Ruling R10: the number of mines and power stations matches OpenTTD |
```

- [ ] **Step 6: Commit** — `feat: generate coal mines and power stations` (body: R6/R10 — OpenTTD's count, forced-one and weighted picks over the full temperate table, so a 64×64 map gets one mine and one power station like the guided game D7 expects, and a 256×256 map about as many as OpenTTD; placement keeps the 14-tile conflict rule and one industry per town; sites must already be level (R11); golden hash re-pinned. `Refs #N`). PR into the block branch.

---

### Task 11: Drawing the world

**Files:**

- Create: `src/render/objects.ts`, `src/render/atlas.ts`, `src/render/objects.test.ts`, `src/render/atlas.test.ts`, `tools/blocks-theme.mjs`, the new SVGs in `public/themes/blocks/sprites/`
- Modify: `src/render/theme.ts`, `src/render/ground.ts`, `src/render/ground.test.ts`, `src/render/theme.test.ts`, `src/render/MapScene.ts`, `public/themes/blocks/theme.json`

**Interfaces:**

- Consumes: the map accessors of Tasks 3–10, `HOUSE_SPECS`.
- Produces (`theme.ts`): `GROUND_SPRITE_IDS` (38 ids: `terrain.void`, `terrain.grass.0..3`, `terrain.unknown`, `terrain.rough`, `terrain.rocks`, `water.sea`, `water.coast.{1,2,3,4,6,7,8,9,11,12,13,14}`, `road.1..road.15`, `ground.house`, `ground.industry`), `OBJECT_SPRITE_IDS` (36 ids: `tree.small`, `tree.medium`, `tree.large`, `tree.dying`, `tree.dead`, `house.construction.0..2`, `house.church`, `house.town-houses`, `house.statue`, `house.fountain`, `house.park`, `house.shops-offices`, `house.stadium.0..3`, `house.old-houses`, `house.cottages`, `house.houses`, `house.flats`, `house.theatre`, `house.cinema`, `industry.gfx.0..10`, `object.unknown`), `SPRITE_IDS = [...GROUND_SPRITE_IDS, ...OBJECT_SPRITE_IDS]`, `OBJECT_PX_HEIGHT = 128`.
- Produces (`ground.ts`): `groundSprite(map, t): SpriteId` for every Stage 1 tile.
- Produces (`objects.ts`): `interface ObjectSprite { sprite: SpriteId; dx: number; dy: number }`, `TREE_OFFSETS`, `houseSprite(houseId: number): SpriteId`, `objectSprites(map, t): ObjectSprite[]`, `interface PlacedObject { sprite: SpriteId; px: number; py: number }` (px = horizontal centre, py = bottom, in chunk pixels), `chunkObjects(map, col, row): PlacedObject[]` (draw order).
- Produces (`atlas.ts`): `ATLAS_COLUMNS = 16`, `atlasCell(index, width, height): { x: number; y: number }`.
- Produces (`MapScene.ts`): `showGame(state: GameState, focusTile?: number): void` (swap the world at the next update; centre on `focusTile` or the map centre; set `data-game-ready="true"` after that update). The constructor still takes `(state, theme, fallback, themeBase, fallbackBase)` and never announces readiness for that first state (it is a placeholder from Task 12 on).

- [ ] **Step 1: Write the failing tests**

`src/render/ground.test.ts` (extend; keep the 1.1 case):

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { ClearGround, setClearGroundDensity } from '../sim/map/clear';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { makeRoadNormal, RoadBits } from '../sim/map/road-map';
import { makeTree, TreeGround, TreeGrowth } from '../sim/map/tree-map';
import { makeSea, makeShore } from '../sim/map/water';
import { groundSprite } from './ground';

describe('ground sprites', () => {
  it('picks void, grass by density, and unknown otherwise', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    expect(groundSprite(map, tileXY(map, 0, 0))).toBe('terrain.void');
    const t = tileXY(map, 5, 5);
    expect(groundSprite(map, t)).toBe('terrain.grass.3');
    map.m5[t] = 1;
    expect(groundSprite(map, t)).toBe('terrain.grass.1');
  });

  it('draws rough, rocks, sea, coast by slope, roads by bits and building ground', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const at = (x: number, y: number): number => tileXY(map, x, y);
    setClearGroundDensity(map, at(5, 5), ClearGround.Rough, 3);
    setClearGroundDensity(map, at(6, 5), ClearGround.Rocks, 3);
    makeSea(map, at(7, 5));
    for (const [x, y] of [
      [10, 10],
      [10, 11],
      [11, 11],
    ] as const)
      map.height[at(x, y)] = 0;
    makeShore(map, at(10, 10)); // only the W corner raised: slope 1
    makeRoadNormal(map, at(8, 5), RoadBits.X, 0);
    makeHouseTile(map, at(9, 5), 0, 0, 3, 0x06, 0);
    makeIndustry(map, at(12, 5), 0, 8, 0);
    makeTree(map, at(13, 5), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 2);
    makeTree(map, at(14, 5), 0, 0, TreeGrowth.Grown, TreeGround.Rough, 3);
    const tiles = [
      at(5, 5),
      at(6, 5),
      at(7, 5),
      at(10, 10),
      at(8, 5),
      at(9, 5),
      at(12, 5),
      at(13, 5),
      at(14, 5),
    ];
    expect(tiles.map((t) => groundSprite(map, t))).toEqual([
      'terrain.rough',
      'terrain.rocks',
      'water.sea',
      'water.coast.1',
      'road.10',
      'ground.house',
      'ground.industry',
      'terrain.grass.2',
      'terrain.rough',
    ]);
  });
});
```

(`at` captures `map`, so it is allowed inside the test.)

`src/render/objects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { makeHouseTile } from '../sim/map/house-map';
import { makeIndustry } from '../sim/map/industry-map';
import { tileXY } from '../sim/map/map';
import { makeTree, TreeGround, TreeGrowth } from '../sim/map/tree-map';
import { HOUSE_SPECS } from '../sim/town/house-specs';
import { chunkObjects, houseSprite, objectSprites, TREE_OFFSETS } from './objects';

describe('object sprites', () => {
  it('draws one sprite per tree, sized by growth', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(map, 5, 5);
    makeTree(map, t, 0, 2, TreeGrowth.Grown, TreeGround.Grass, 3);
    expect(objectSprites(map, t)).toEqual(
      TREE_OFFSETS[2]!.map(([dx, dy]) => ({ sprite: 'tree.large', dx, dy })),
    );
  });

  it('draws houses by type or construction stage, and industry tiles by gfx', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeHouseTile(map, tileXY(map, 5, 5), 0, 0, 3, 0x03, 0);
    makeHouseTile(map, tileXY(map, 6, 5), 0, 2, 1, 0x06, 0);
    makeIndustry(map, tileXY(map, 7, 5), 0, 8, 0);
    expect([5, 6, 7].map((x) => objectSprites(map, tileXY(map, x, 5))[0]?.sprite)).toEqual([
      'house.church',
      'house.construction.1',
      'industry.gfx.8',
    ]);
  });

  it('has a sprite for every house that can exist in 1950', () => {
    for (const spec of HOUSE_SPECS) {
      if (spec.minYear <= 1950 && 1950 <= spec.maxYear)
        expect(houseSprite(spec.id), spec.id.toString(16)).not.toBe('object.unknown');
    }
  });

  it('lists a chunk top row first, left to right, anchored at the tile bottom centre', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    makeTree(map, tileXY(map, 2, 3), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
    makeHouseTile(map, tileXY(map, 1, 5), 0, 0, 3, 0x06, 0);
    expect(chunkObjects(map, 0, 0)).toEqual([
      { sprite: 'house.town-houses', px: 5 * 64 + 32, py: 1 * 64 + 64 },
      { sprite: 'tree.large', px: 3 * 64 + 32, py: 2 * 64 + 64 },
    ]);
  });
});
```

`src/render/atlas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { atlasCell } from './atlas';

describe('sprite atlas grid', () => {
  it('fills rows of 16 cells', () => {
    expect([atlasCell(0, 64, 64), atlasCell(17, 64, 64), atlasCell(16, 64, 128)]).toEqual([
      { x: 0, y: 0 },
      { x: 64, y: 64 },
      { x: 0, y: 128 },
    ]);
  });
});
```

`src/render/theme.test.ts`: keep every 1.1 test; add

```ts
it('splits sprites into ground and object lists covering every id once', () => {
  expect([...GROUND_SPRITE_IDS, ...OBJECT_SPRITE_IDS].toSorted()).toEqual(
    [...SPRITE_IDS].toSorted(),
  );
  expect(new Set(SPRITE_IDS).size).toBe(SPRITE_IDS.length);
});
```

Run: `npx vitest run src/render` — Expected: FAIL (modules missing; the coverage test fails until the theme is generated).

- [ ] **Step 2: Implement `theme.ts`, `ground.ts`, `objects.ts`, `atlas.ts`**

- `groundSprite`: void → `terrain.void`; clear → grass by density / `terrain.rough` / `terrain.rocks` / else `terrain.unknown`; water → coast `water.coast.<slope>` (if that id exists, else `terrain.unknown`) or `water.sea`; trees → by tree ground (grass → `terrain.grass.<density>`, rough → `terrain.rough`, shore → the coast sprite of the tile's slope); road → `road.<bits>` (bits 1..15); house → `ground.house`; industry → `ground.industry`; else `terrain.unknown`.
- `TREE_OFFSETS = [[[0, 0]], [[-12, -8], [12, 8]], [[-14, -10], [14, -6], [0, 12]], [[-14, -12], [14, -12], [-14, 12], [14, 12]]]` (by tree count − 1); tree sprite by growth: 0–1 small, 2 medium, 3 large, 4–5 dying, 6 dead.
- `houseSprite`: `0x03` church; `0x06` town-houses; `0x09` statue; `0x0a` fountain; `0x0b`, `0x0c` park; `0x0e`, `0x0f`, `0x10`, `0x1d` shops-offices; `0x14..0x17` stadium.0..3; `0x18` old-houses; `0x19` cottages; `0x1a` houses; `0x1b` flats; `0x1f` theatre; `0x27` cinema; other ids `object.unknown`. Unfinished houses use `house.construction.<stage>`.
- `objectSprites`: trees, houses, industry tiles (`industry.gfx.<gfx>`), `[]` otherwise.
- `chunkObjects(map, col, row)`: for `cy` 0..31 (tile x = `row * 32 + cy`), for `cx` 0..31 (tile y = `col * 32 + cx`), each object of the tile sorted by `dy`: `{ sprite, px: cx * 64 + 32 + dx, py: cy * 64 + 64 + dy }`.
- `atlasCell(i, w, h) = { x: (i % ATLAS_COLUMNS) * w, y: Math.floor(i / ATLAS_COLUMNS) * h }`.

- [ ] **Step 3: Generate the placeholder art** — `tools/blocks-theme.mjs` (Node, no dependencies) writes one SVG per new sprite id into `public/themes/blocks/sprites/` and merges the ids into `public/themes/blocks/theme.json` (existing entries kept). Ground sprites are 64×64; object sprites are 64×128 with the tile footprint in the bottom 64 px. Screen corners of a tile: N = top-left, E = top-right, W = bottom-left, S = bottom-right (projection of 1.1). Shapes (simple, friendly, clearly placeholder):

```js
// tools/blocks-theme.mjs — placeholder sprites for the "blocks" theme (block 1.2). Run: node tools/blocks-theme.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'public/themes/blocks';
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;
const grid =
  '<rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="#ffffff" stroke-opacity="0.3"/>';
const tile = (fill, extra = '') =>
  svg(64, 64, `<rect width="64" height="64" fill="${fill}"/>${extra}${grid}`);
const CORNERS = { 1: [0, 64], 2: [64, 64], 4: [64, 0], 8: [0, 0] }; // W, S, E, N
const corner = ([x, y]) =>
  `<polygon points="${x},${y} ${x === 0 ? 36 : 28},${y} ${x},${y === 0 ? 36 : 28}" fill="#e8d9a8"/>`;
const coast = (slope) =>
  tile(
    '#6ec6e8',
    Object.entries(CORNERS)
      .filter(([bit]) => slope & Number(bit))
      .map(([, c]) => corner(c))
      .join(''),
  );
const ARMS = {
  1: '<rect x="0" y="22" width="32" height="20"/>',
  2: '<rect x="22" y="32" width="20" height="32"/>',
  4: '<rect x="32" y="22" width="32" height="20"/>',
  8: '<rect x="22" y="0" width="20" height="32"/>',
};
const road = (bits) =>
  tile(
    '#8fd18a',
    `<g fill="#8a8d91"><rect x="22" y="22" width="20" height="20"/>${Object.entries(ARMS)
      .filter(([bit]) => bits & Number(bit))
      .map(([, r]) => r)
      .join('')}</g>`,
  );
const object = (body) => svg(64, 128, body);
const tree = (r, crown) =>
  object(
    `<rect x="30" y="${116 - r}" width="4" height="${r}" fill="#7a5230"/><circle cx="32" cy="${112 - r}" r="${r}" fill="${crown}"/>`,
  );
const house = (h, wall, roof) =>
  object(
    `<rect x="10" y="${120 - h}" width="44" height="${h}" fill="${wall}" stroke="#2d4a3e"/><polygon points="6,${122 - h} 32,${100 - h} 58,${122 - h}" fill="${roof}" stroke="#2d4a3e"/>`,
  );

const sprites = {
  'terrain.rough': tile(
    '#a3c27a',
    '<g fill="#7f9c5a"><circle cx="16" cy="18" r="4"/><circle cx="44" cy="30" r="5"/><circle cx="24" cy="46" r="4"/></g>',
  ),
  'terrain.rocks': tile(
    '#b9b4a8',
    '<g fill="#8c877c"><ellipse cx="20" cy="22" rx="9" ry="6"/><ellipse cx="44" cy="40" rx="10" ry="7"/></g>',
  ),
  'water.sea': tile(
    '#6ec6e8',
    '<path d="M8 32 q8 -6 16 0 t16 0 t16 0" fill="none" stroke="#a8e0f2" stroke-width="3"/>',
  ),
  'ground.house': tile('#d9cfc0'),
  'ground.industry': tile(
    '#c2b8a8',
    '<rect x="4" y="4" width="56" height="56" fill="none" stroke="#9a9080" stroke-width="2"/>',
  ),
  'tree.small': tree(8, '#5fbf6a'),
  'tree.medium': tree(12, '#4caf5c'),
  'tree.large': tree(16, '#3f9b4f'),
  'tree.dying': tree(14, '#c9a24a'),
  'tree.dead': object(
    '<path d="M32 118 V90 M32 100 l-8 -8 M32 96 l8 -10" stroke="#7a5230" stroke-width="4" fill="none"/>',
  ),
  'house.church': object(
    '<rect x="14" y="70" width="36" height="50" fill="#f4efe6" stroke="#2d4a3e"/><polygon points="24,70 32,30 40,70" fill="#ff8fab" stroke="#2d4a3e"/>',
  ),
  'house.town-houses': house(36, '#ffd6a5', '#e76f51'),
  'house.statue': object(
    '<rect x="26" y="100" width="12" height="18" fill="#b9b4a8"/><circle cx="32" cy="92" r="7" fill="#b9b4a8"/>',
  ),
  'house.fountain': object(
    '<ellipse cx="32" cy="108" rx="20" ry="8" fill="#6ec6e8" stroke="#8c877c" stroke-width="3"/>',
  ),
  'house.park': object(
    '<rect x="8" y="72" width="48" height="48" rx="10" fill="#7fd17a"/><circle cx="24" cy="92" r="8" fill="#3f9b4f"/>',
  ),
  'house.shops-offices': house(56, '#cdb4db', '#6d597a'),
  'house.old-houses': house(28, '#e9c46a', '#9c6644'),
  'house.cottages': house(24, '#f4a261', '#9c6644'),
  'house.houses': house(32, '#ffe5ec', '#e76f51'),
  'house.flats': house(76, '#bde0fe', '#457b9d'),
  'house.theatre': house(48, '#ffc8dd', '#b5179e'),
  'house.cinema': house(44, '#fdffb6', '#ef476f'),
  'object.unknown': object(
    '<rect x="12" y="76" width="40" height="40" fill="#ff4fd8"/><path d="M12 76 L52 116 M52 76 L12 116" stroke="#fff" stroke-width="4"/>',
  ),
};
for (const slope of [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14])
  sprites[`water.coast.${slope}`] = coast(slope);
for (let bits = 1; bits <= 15; bits++) sprites[`road.${bits}`] = road(bits);
for (let stage = 0; stage <= 2; stage++)
  sprites[`house.construction.${stage}`] = object(
    `<rect x="10" y="${104 - stage * 16}" width="44" height="${16 + stage * 16}" fill="#e9d8a6"/><path d="M10 120 V${88 - stage * 16} M54 120 V${88 - stage * 16} M10 ${96 - stage * 16} H54" stroke="#9c6644" stroke-width="3"/>`,
  );
for (let part = 0; part <= 3; part++)
  sprites[`house.stadium.${part}`] = object(
    `<rect x="0" y="64" width="64" height="64" fill="#7fd17a"/><rect x="0" y="${part < 2 ? 64 : 112}" width="64" height="16" fill="#f4efe6" stroke="#2d4a3e"/>`,
  );
for (let gfx = 0; gfx <= 10; gfx++) {
  const tall = gfx === 1 || gfx === 8;
  const colour = gfx <= 6 ? '#5c5c66' : '#9aa5b1';
  const top = tall ? 20 : 76;
  const sparks =
    gfx === 10
      ? '<path d="M20 70 l8 10 l-6 4 l10 12" stroke="#ffd166" stroke-width="4" fill="none"/>'
      : '';
  sprites[`industry.gfx.${gfx}`] = object(
    `<rect x="${tall ? 22 : 8}" y="${top}" width="${tall ? 20 : 48}" height="${120 - top}" fill="${colour}" stroke="#2d4a3e"/>${sparks}`,
  );
}

const themePath = `${DIR}/theme.json`;
const theme = JSON.parse(readFileSync(themePath, 'utf8'));
for (const [id, body] of Object.entries(sprites)) {
  const file = `sprites/${id.replaceAll('.', '-')}.svg`;
  writeFileSync(`${DIR}/${file}`, body);
  theme.sprites[id] = file;
}
writeFileSync(themePath, `${JSON.stringify(theme, null, 2)}\n`);
```

Run: `node tools/blocks-theme.mjs && npx prettier --write public/themes/blocks/theme.json && npx vitest run src/render` — Expected: all passed (including the 1.1 default-theme coverage test).

- [ ] **Step 4: `MapScene` changes** (no unit test; verified by e2e and screenshots):

- `preload()`: ground ids at 64×64, object ids at 64×`OBJECT_PX_HEIGHT`, same base rule as 1.1.
- `create()`: `ground-atlas` canvas `16 × 64` wide and `ceil(n / 16) × 64` tall, sprite `i` at `atlasCell(i, 64, 64)` (tile index = position in `GROUND_SPRITE_IDS`); `object-atlas` canvas with cells of 64×128 and a named frame per id: `texture.add(id, 0, x, y, 64, 128)`. Only create the canvases if `this.textures.exists(key)` is false.
- Chunks become `{ map, layer, objects: GameObjects.Blitter }`: the blitter is `this.add.blitter(col * CHUNK_PX, row * CHUNK_PX, 'object-atlas').setDepth(1 + row)`, filled with `blitter.create(px - 32, py - OBJECT_PX_HEIGHT, sprite)` for each `chunkObjects(map, col, row)` entry (creation order is draw order; lower chunk rows draw over upper ones). Ground layers stay at depth 0.
- Dirty tiles: update the ground cell and, once per chunk per frame, rebuild that chunk's blitter (`clear()` and re-create).
- Town labels: one `this.add.text` per town at the centre tile (`{ fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#1f2a33', backgroundColor: '#fffaf2', padding: { x: 8, y: 4 } }`, origin `(0.5, 1)`, depth 10000), text `townName(town.nameParts)`.
- `showGame(state, focusTile?)`: store them; on the next `update()` destroy all chunks and labels, take the new state, reset camera bounds to the new map, centre on `focusTile` (tile centre) or the map centre, rebuild labels, then set `data-game-ready="true"` (the constructor's placeholder never sets it).

- [ ] **Step 5: Check** — `npm test && npm run lint && npm run typecheck && npm run test:e2e`; take desktop and phone screenshots of the preview build (`npm run build && npm run preview -- --port 4317 --base /openttd-web/`) with `?seed=1&size=256x256` once Task 12 lands, or the boot world now; look at sea, coast, roads, houses, trees and industries.

- [ ] **Step 6: Commit** — `feat: draw water, roads, trees, houses and industries` (body: R7 — every new sprite goes through the theme contract with placeholder art, and tall objects use one blitter per chunk drawn in row order, so they overlap like a 3/4 view without a sprite object per tile; art direction is block 1.6. `Refs #N`). PR into the block branch.

---

### Task 12: New-game window and background generation

**Files:**

- Create: `src/app/generation.ts`, `src/app/generation.test.ts`, `src/app/start-params.ts`, `src/app/start-params.test.ts`, `src/app/session.test.ts`, `src/ui/NewGame.tsx`, `src/ui/NewGame.test.tsx`, `tests/e2e/new-game.spec.ts`
- Modify: `src/app/session.ts`, `src/app/main.tsx`, `src/ui/session.ts`, `src/ui/App.tsx`, `src/ui/StatusBar.tsx`, `src/ui/StatusBar.test.tsx`, `src/ui/styles.css`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

**Interfaces:**

- Consumes: `generateGame`, `GenerationProgress`, `WorldGenerationError` (Tasks 4, 9), `createEmptyGame`, `hashGameState`, `DEFAULT_GAME_OPTIONS`, `GameOptions` (Task 4), `MapScene.showGame` (Task 11).
- Produces (`generation.ts`): `GENERATION_SLICE_MS = 25`, `runGenerationSlice<T>(gen: Generator<GenerationProgress, T, void>, deadline: number, now: () => number): { done: true; value: T } | { done: false; fraction: number }` (always advances at least one step).
- Produces (`start-params.ts`): `interface StartParams { seed?: number; mapLogX?: number; mapLogY?: number; focus?: { x: number; y: number } }`, `parseStartParams(search: string): StartParams`.
- Produces (`ui/session.ts`): `UiSnapshot` gains `generating: number | null` (0..1), `generationError: 'error.noTownCreated' | null`, `gameOptions: GameOptions`; `UiSession` gains `newGame(options: GameOptions): void`.
- Produces (`app/session.ts`): `interface SessionDeps { locale: Locale; themes: readonly { id: string; name: string }[]; themeId: string; onLocale(locale: Locale): void; onTheme(id: string): void; onNewState(state: GameState): void; clock?: () => number; generate?: (options: GameOptions) => Generator<GenerationProgress, GameState, void> }`, `class GameSession implements UiSession` with `constructor(state: GameState, deps: SessionDeps)`, `get state(): GameState`, `newGame(options)`, `frame(now)`. While generating, `frame` runs a slice (deadline `clock() + GENERATION_SLICE_MS`) and no ticks.
- Produces (`ui/NewGame.tsx`): `parseSeed(text: string): number | null`, `MAP_SIZE_BITS = [6, 7, 8, 9, 10]`, `NewGame({ session, snapshot, onDone })`.

- [ ] **Step 1: i18n keys** — add to `en.json` / `es.json`:

| Key                    | en                                                                      | es                                                                                       |
| ---------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `hud.newGame`          | New game                                                                | Nueva partida                                                                            |
| `newGame.title`        | New game                                                                | Nueva partida                                                                            |
| `newGame.mapX`         | Map size X                                                              | Tamaño del mapa X                                                                        |
| `newGame.mapY`         | Map size Y                                                              | Tamaño del mapa Y                                                                        |
| `newGame.towns`        | Number of towns                                                         | Número de pueblos                                                                        |
| `newGame.towns.0`      | Very low                                                                | Muy pocos                                                                                |
| `newGame.towns.1`      | Low                                                                     | Pocos                                                                                    |
| `newGame.towns.2`      | Normal                                                                  | Normal                                                                                   |
| `newGame.towns.3`      | High                                                                    | Muchos                                                                                   |
| `newGame.industries`   | Industry density                                                        | Densidad de industrias                                                                   |
| `newGame.industries.0` | None                                                                    | Ninguna                                                                                  |
| `newGame.industries.1` | Minimal                                                                 | Mínima                                                                                   |
| `newGame.industries.2` | Very low                                                                | Muy baja                                                                                 |
| `newGame.industries.3` | Low                                                                     | Baja                                                                                     |
| `newGame.industries.4` | Normal                                                                  | Normal                                                                                   |
| `newGame.industries.5` | High                                                                    | Alta                                                                                     |
| `newGame.seed`         | Seed                                                                    | Semilla                                                                                  |
| `newGame.randomSeed`   | Random seed                                                             | Semilla aleatoria                                                                        |
| `newGame.generate`     | Generate                                                                | Generar                                                                                  |
| `newGame.generating`   | Generating world… {percent}%                                            | Generando mundo… {percent} %                                                             |
| `error.noTownCreated`  | Could not place any town on this map. Try another seed or a larger map. | No se pudo colocar ningún pueblo en este mapa. Prueba otra semilla o un mapa más grande. |

- [ ] **Step 2: Write the failing tests**

`src/app/generation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GenerationProgress } from '../sim/world/generate';
import { runGenerationSlice } from './generation';

function* steps(): Generator<GenerationProgress, string, void> {
  yield { fraction: 0.25 };
  yield { fraction: 0.5 };
  yield { fraction: 0.75 };
  return 'world';
}

const tickingClock = (): (() => number) => {
  let now = 0;
  return () => (now += 10);
};

describe('generation slices', () => {
  it('runs steps until the deadline and reports progress', () => {
    const gen = steps();
    expect(runGenerationSlice(gen, 15, tickingClock())).toEqual({ done: false, fraction: 0.5 });
  });

  it('always makes progress and returns the world at the end', () => {
    const gen = steps();
    expect(runGenerationSlice(gen, 0, tickingClock())).toEqual({ done: false, fraction: 0.25 });
    expect(runGenerationSlice(gen, Infinity, tickingClock())).toEqual({
      done: true,
      value: 'world',
    });
  });
});
```

`src/app/start-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseStartParams } from './start-params';

describe('start parameters (ruling R14)', () => {
  it('reads seed, size and focus tile', () => {
    expect(parseStartParams('?seed=42&size=64x128&tile=10,20')).toEqual({
      seed: 42,
      mapLogX: 6,
      mapLogY: 7,
      focus: { x: 10, y: 20 },
    });
  });

  it('ignores invalid values', () => {
    expect(parseStartParams('?seed=-1&size=100x64&tile=a,b')).toEqual({});
    expect(parseStartParams('?seed=4294967296&size=2048x2048')).toEqual({});
    expect(parseStartParams('')).toEqual({});
  });
});
```

`src/app/session.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyGame,
  DEFAULT_GAME_OPTIONS,
  hashGameState,
  type GameOptions,
  type GameState,
} from '../sim/game';
import { WorldGenerationError } from '../sim/world/errors';
import { createGame, type GenerationProgress } from '../sim/world/generate';
import { GameSession, type SessionDeps } from './session';

const OPTIONS: GameOptions = { ...DEFAULT_GAME_OPTIONS, mapLogX: 6, mapLogY: 6, seed: 9 };

const deps = (overrides: Partial<SessionDeps> = {}): SessionDeps => ({
  locale: 'en',
  themes: [],
  themeId: 'blocks',
  onLocale: vi.fn(),
  onTheme: vi.fn(),
  onNewState: vi.fn(),
  clock: () => 0,
  ...overrides,
});

// oxlint-disable-next-line require-yield -- throws before its first step on purpose
function* failing(): Generator<GenerationProgress, GameState, void> {
  throw new WorldGenerationError('error.noTownCreated');
}

function* endless(): Generator<GenerationProgress, GameState, void> {
  for (;;) yield { fraction: 0.5 };
}

const advancingClock = (): (() => number) => {
  let now = 0;
  return () => (now += 100);
};

describe('GameSession world generation', () => {
  it('generates in frames and hands the new world over', () => {
    const onNewState = vi.fn();
    const session = new GameSession(
      createEmptyGame({ mapLogX: 6, mapLogY: 6 }),
      deps({ onNewState }),
    );
    session.newGame(OPTIONS);
    expect(session.getSnapshot().generating).toBe(0);
    session.frame(0);
    expect(onNewState).toHaveBeenCalledOnce();
    expect(hashGameState(session.state)).toBe(hashGameState(createGame(OPTIONS)));
    expect([session.getSnapshot().generating, session.getSnapshot().gameOptions]).toEqual([
      null,
      OPTIONS,
    ]);
  });

  it('lets only the latest request finish (Review Focus 2)', () => {
    const onNewState = vi.fn();
    const session = new GameSession(
      createEmptyGame({ mapLogX: 6, mapLogY: 6 }),
      deps({ onNewState, clock: advancingClock() }),
    );
    session.newGame(OPTIONS);
    session.frame(0);
    const second = { ...OPTIONS, seed: 10 };
    session.newGame(second);
    for (let i = 0; i < 1000 && session.getSnapshot().generating !== null; i++) session.frame(0);
    expect(onNewState).toHaveBeenCalledOnce();
    expect(session.state.options.seed).toBe(10);
  });

  it('keeps the current world and reports why when generation fails (Review Focus 1)', () => {
    const before = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const session = new GameSession(before, deps({ generate: failing }));
    session.newGame(OPTIONS);
    session.frame(0);
    expect(session.state).toBe(before);
    expect([session.getSnapshot().generating, session.getSnapshot().generationError]).toEqual([
      null,
      'error.noTownCreated',
    ]);
  });

  it('does not run game ticks while generating', () => {
    const state = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const session = new GameSession(state, deps({ generate: endless, clock: advancingClock() }));
    session.newGame(OPTIONS);
    session.frame(0);
    session.frame(10_000);
    expect(state.tickCounter).toBe(0);
  });
});
```

`src/ui/NewGame.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_OPTIONS } from '../sim/game';
import { NewGame, parseSeed } from './NewGame';
import type { UiSession, UiSnapshot } from './session';

const snapshot: UiSnapshot = {
  year: 1950,
  month: 0,
  day: 1,
  money: 100000,
  paused: false,
  speed: 'normal',
  locale: 'en',
  themeId: 'blocks',
  themes: [{ id: 'blocks', name: 'Blocks' }],
  generating: null,
  generationError: null,
  gameOptions: { ...DEFAULT_GAME_OPTIONS, seed: 7 },
};

const fakeSession = (): UiSession => ({
  getSnapshot: () => snapshot,
  subscribe: () => () => undefined,
  togglePause: vi.fn(),
  setSpeed: vi.fn(),
  setLocale: vi.fn(),
  setTheme: vi.fn(),
  newGame: vi.fn(),
});

describe('parseSeed (Review Focus 3)', () => {
  it('accepts uint32 integers only', () => {
    expect(
      ['0', '42', '4294967295', '', 'abc', '-1', '4294967296', '1.5', ' 7'].map(parseSeed),
    ).toEqual([0, 42, 4294967295, null, null, null, null, null, null]);
  });
});

describe('NewGame window', () => {
  it('starts from the current options and generates with the chosen ones', () => {
    const session = fakeSession();
    render(<NewGame session={session} snapshot={snapshot} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Map size X'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Map size Y'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Number of towns'), { target: { value: '1' } });
    fireEvent.input(screen.getByLabelText('Seed'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(session.newGame).toHaveBeenCalledWith({
      ...DEFAULT_GAME_OPTIONS,
      mapLogX: 6,
      mapLogY: 7,
      townCount: 1,
      seed: 12345,
    });
  });

  it('disables Generate for a bad seed', () => {
    render(<NewGame session={fakeSession()} snapshot={snapshot} onDone={() => undefined} />);
    fireEvent.input(screen.getByLabelText('Seed'), { target: { value: 'abc' } });
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows progress and generation errors', () => {
    const busy = { ...snapshot, generating: 0.42, generationError: 'error.noTownCreated' as const };
    render(<NewGame session={fakeSession()} snapshot={busy} onDone={() => undefined} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not place any town');
  });
});
```

Update `src/ui/StatusBar.test.tsx`'s snapshot and fake session with the new fields (`generating: null`, `generationError: null`, `gameOptions: DEFAULT_GAME_OPTIONS`, `newGame: vi.fn()`).

Run: `npx vitest run src/app src/ui` — Expected: FAIL (modules and fields missing).

- [ ] **Step 3: Implement `generation.ts`, `start-params.ts`**

```ts
// generation.ts
import type { GenerationProgress } from '../sim/world/generate';

/** Work per animation frame, so a 1024×1024 world never freezes the tab (ruling R8). */
export const GENERATION_SLICE_MS = 25;

export function runGenerationSlice<T>(
  gen: Generator<GenerationProgress, T, void>,
  deadline: number,
  now: () => number,
): { done: true; value: T } | { done: false; fraction: number } {
  for (;;) {
    const step = gen.next();
    if (step.done === true) return { done: true, value: step.value };
    if (now() >= deadline) return { done: false, fraction: step.value.fraction };
  }
}
```

`parseStartParams(search)`: `new URLSearchParams(search)`; `seed` must match `/^\d+$/` and be `<= 0xffffffff`; `size` must match `/^(\d+)x(\d+)$/` with both sides powers of two in 64..1024 (`mapLogX = log2`); `tile` must match `/^(\d+),(\d+)$/`; build the object with only the valid properties (`exactOptionalPropertyTypes`).

- [ ] **Step 4: Session** — refactor `GameSession` to `constructor(state, deps)`; keep the 1.1 behaviour; add:

```ts
  newGame = (options: GameOptions): void => {
    this.generation = (this.deps.generate ?? generateGame)(options); // replaces any running generation
    this.generatingFraction = 0;
    this.generationError = null;
    this.refresh();
  };

  frame(now: number): void {
    if (this.generation !== null) {
      this.stepGeneration();
      return; // no ticks while a world is being generated
    }
    // 1.1 tick pacing unchanged
  }

  private stepGeneration(): void {
    const clock = this.deps.clock ?? (() => performance.now());
    try {
      const result = runGenerationSlice(this.generation!, clock() + GENERATION_SLICE_MS, clock);
      if (!result.done) {
        this.generatingFraction = result.fraction;
      } else {
        this.generation = null;
        this.currentState = result.value;
        this.clock.nextTickAt = 0;
        this.deps.onNewState(result.value);
      }
    } catch (error) {
      if (!(error instanceof WorldGenerationError)) throw error;
      this.generation = null;
      this.generationError = error.key;
    }
    this.refresh();
  }
```

Snapshot adds `generating: this.generation === null ? null : this.generatingFraction`, `generationError`, `gameOptions: this.state.options`. `refresh()` only notifies when the rounded percentage, error or state changed (avoid re-rendering the UI 60×/s for the same number).

- [ ] **Step 5: UI** — `NewGame.tsx`: a form inside the `Panel` (title `newGame.title`): two `<select>`s (`newGame.mapX`, `newGame.mapY`) with options `6..10` labelled `64`…`1024`; `newGame.towns` select (0..3); `newGame.industries` select (0..5); a seed `<input inputMode="numeric">` (`newGame.seed`) with a "Random seed" button (`Math.floor(Math.random() * 2 ** 32)` — UI code, outside `sim/`); "Generate" (`disabled` when `parseSeed` is null or a generation is running) calls `session.newGame({ ...snapshot.gameOptions, mapLogX, mapLogY, townCount, industryDensity, seed })`; the window closes itself (`onDone`) when the generation it started finishes without error; `generationError` renders as `<p role="alert">`. `App.tsx`: a panel state `'settings' | 'newGame' | null`; while `snapshot.generating !== null`, render `<div class="generating" role="status">` with `newGame.generating` and the percentage. `StatusBar.tsx`: a "New game" button (`hud.newGame`) before Settings. `styles.css`: `.generating` centred pill over the map (`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)`), form layout like `.settings`.

- [ ] **Step 6: `main.tsx`**

```tsx
const params = parseStartParams(window.location.search);
const placeholder = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const scene = new MapScene(
  placeholder,
  fallback,
  fallback,
  baseOf(fallback.id),
  baseOf(fallback.id),
);
let focus = params.focus;
const session = new GameSession(placeholder, {
  locale,
  themes: themes.map((t) => ({ id: t.id, name: t.name })),
  themeId: FALLBACK_THEME_ID,
  onLocale,
  onTheme,
  onNewState: (state) => {
    const tile =
      focus !== undefined && focus.x < state.map.sizeX && focus.y < state.map.sizeY
        ? tileXY(state.map, focus.x, focus.y)
        : undefined;
    focus = undefined; // only the first world
    if (tile === undefined) scene.showGame(state);
    else scene.showGame(state, tile);
    document.documentElement.dataset['worldHash'] = hashGameState(state);
  },
});
const options = {
  ...DEFAULT_GAME_OPTIONS,
  seed: params.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!,
};
session.newGame(
  params.mapLogX === undefined || params.mapLogY === undefined
    ? options
    : { ...options, mapLogX: params.mapLogX, mapLogY: params.mapLogY },
);
```

(`onLocale`/`onTheme` are the 1.1 callbacks; Phaser setup unchanged.)

- [ ] **Step 7: e2e** — `tests/e2e/new-game.spec.ts` (runs on both projects):

```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./?seed=1&size=64x64');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('generates a new 64×128 world from the new-game window', async ({ page }) => {
  const html = page.locator('html');
  const first = await html.getAttribute('data-world-hash');
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Map size X').selectOption('6');
  await dialog.getByLabel('Map size Y').selectOption('7');
  await dialog.getByLabel('Seed').fill('12345');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(html).not.toHaveAttribute('data-world-hash', first ?? '');
  await expect(dialog).toBeHidden();
});

test('shows the generating state for a large map', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Map size X').selectOption('10');
  await dialog.getByLabel('Map size Y').selectOption('10');
  await dialog.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByRole('status')).toContainText('Generating world');
});

test('refuses a bad seed', async ({ page }) => {
  await page.getByRole('button', { name: 'New game' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByLabel('Seed').fill('abc');
  await expect(dialog.getByRole('button', { name: 'Generate' })).toBeDisabled();
});
```

Run: `npm test && npm run lint && npm run typecheck && npm run test:e2e` — Expected: all passed on both projects (1.1's `hud.spec.ts` and `camera.spec.ts` keep passing: `data-game-ready` now waits for the first generated world). Screenshot the new-game window on desktop and phone.

- [ ] **Step 8: Commit** — `feat: add the new-game window with background generation` (body: R8 — generation runs in 25 ms slices so even 1024×1024 keeps the page responsive; a new request replaces a running one, and a failed generation keeps the current world (R12); start parameters make e2e and shared worlds reproducible (R14). `Refs #N`). PR into the block branch.

---

### Task 13: Query tool, town and industry windows

**Files:**

- Create: `src/sim/query.ts`, `src/sim/query.test.ts`, `src/render/gesture.ts`, `src/render/gesture.test.ts`, `src/ui/TileInfo.tsx`, `src/ui/TownWindow.tsx`, `src/ui/IndustryWindow.tsx`, `src/ui/windows.test.tsx`, `tests/e2e/query.spec.ts`
- Modify: `src/render/MapScene.ts`, `src/app/session.ts`, `src/app/main.tsx`, `src/ui/session.ts`, `src/ui/App.tsx`, `src/ui/StatusBar.tsx`, `src/ui/i18n/i18n.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`, `src/ui/styles.css`, existing UI test fakes

**Interfaces:**

- Consumes: everything above.
- Produces (`sim/query.ts`): `type TileKind = 'void' | 'grass' | 'rough' | 'rocks' | 'trees' | 'sea' | 'coast' | 'road' | 'house' | 'industry' | 'other'`, `interface TileInfo { tile: number; x: number; y: number; z: number; kind: TileKind; owner: 'none' | 'water' | 'town'; townIndex: number | null; industryIndex: number | null }`, `describeTile(state, t): TileInfo`, `interface TownInfo { index: number; name: string; isCity: boolean; population: number; houses: number; x: number; y: number }`, `townInfo(state, index): TownInfo | null`, `interface IndustryInfo { index: number; type: 'coalMine' | 'powerStation'; townName: string; x: number; y: number }`, `industryInfo(state, index): IndustryInfo | null`.
- Produces (`render/gesture.ts`): `TAP_SLOP_PX = 8`, `LONG_PRESS_MS = 500`, `classifyPress(down: { x: number; y: number; at: number }, up: { x: number; y: number; at: number }, moved: boolean): 'tap' | 'long' | 'drag'`.
- Produces (`MapScene`): constructor gains a last parameter `input: { onTap(tile: number): void; onLongPress(tile: number): void }`; taps and long presses on map tiles call it (a long press fires on a 500 ms timer while the pointer is still down and has not moved).
- Produces (`ui/session.ts`): `type Tool = 'query'`, `type UiWindow = { kind: 'tile'; info: TileInfo; townName: string | null } | { kind: 'town'; info: TownInfo } | { kind: 'industry'; info: IndustryInfo }`; `UiSnapshot` gains `tool: Tool | null`, `window: UiWindow | null`; `UiSession` gains `setTool(tool: Tool | null): void`, `openTown(index: number): void`, `closeWindow(): void`.
- Produces (`app/session.ts`): `tapTile(tile: number, long: boolean): void` — when `long` or the query tool is on: house → town window; industry → industry window; anything else → tile window. Window data is rebuilt from the current state on every refresh (population stays live as houses finish).
- Produces (`i18n.ts`): `formatNumber(locale, n): string`.

- [ ] **Step 1: i18n keys** (en / es):

| Key                     | en                        | es                         |
| ----------------------- | ------------------------- | -------------------------- |
| `tool.query`            | Query tile                | Consultar casilla          |
| `tile.title`            | Land area information     | Información del terreno    |
| `tile.kind.void`        | Map edge                  | Borde del mapa             |
| `tile.kind.grass`       | Grass                     | Hierba                     |
| `tile.kind.rough`       | Rough land                | Terreno accidentado        |
| `tile.kind.rocks`       | Rocks                     | Rocas                      |
| `tile.kind.trees`       | Trees                     | Árboles                    |
| `tile.kind.sea`         | Water                     | Agua                       |
| `tile.kind.coast`       | Coast                     | Costa                      |
| `tile.kind.road`        | Road                      | Carretera                  |
| `tile.kind.house`       | Houses                    | Casas                      |
| `tile.kind.industry`    | Industry                  | Industria                  |
| `tile.kind.other`       | Unknown                   | Desconocido                |
| `tile.owner`            | Owner: {owner}            | Propietario: {owner}       |
| `owner.none`            | None                      | Ninguno                    |
| `owner.water`           | Water                     | Agua                       |
| `tile.location`         | Location: {x} × {y} × {z} | Ubicación: {x} × {y} × {z} |
| `tile.openTown`         | Town window               | Ventana del pueblo         |
| `town.city`             | {name} (City)             | {name} (Ciudad)            |
| `town.population`       | Population: {population}  | Población: {population}    |
| `town.houses`           | Houses: {houses}          | Casas: {houses}            |
| `industry.coalMine`     | Coal Mine                 | Mina de carbón             |
| `industry.powerStation` | Power Station             | Central eléctrica          |
| `industry.name`         | {town} {type}             | {type} de {town}           |
| `industry.location`     | Location: {x} × {y}       | Ubicación: {x} × {y}       |

- [ ] **Step 2: Write the failing tests**

`src/sim/query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from './game';
import { IndustryType } from './industry/industry-specs';
import { makeHouseTile } from './map/house-map';
import { makeIndustry } from './map/industry-map';
import { tileXY } from './map/map';
import { makeRoadNormal, RoadBits } from './map/road-map';
import { makeSea } from './map/water';
import { describeTile, industryInfo, townInfo } from './query';
import { newTown } from './town/town';

describe('query functions for the UI', () => {
  it('describes tiles with their kind, owner and location', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    game.towns.push(newTown(0, tileXY(map, 20, 20), 0, false));
    makeRoadNormal(map, tileXY(map, 20, 20), RoadBits.X, 0);
    makeHouseTile(map, tileXY(map, 21, 20), 0, 0, 3, 0x06, 0);
    makeSea(map, tileXY(map, 5, 5));
    expect(describeTile(game, tileXY(map, 10, 12))).toEqual({
      tile: tileXY(map, 10, 12),
      x: 10,
      y: 12,
      z: 1,
      kind: 'grass',
      owner: 'none',
      townIndex: null,
      industryIndex: null,
    });
    expect(describeTile(game, tileXY(map, 20, 20))).toMatchObject({
      kind: 'road',
      owner: 'town',
      townIndex: 0,
    });
    expect(describeTile(game, tileXY(map, 21, 20))).toMatchObject({
      kind: 'house',
      owner: 'town',
      townIndex: 0,
    });
    expect(describeTile(game, tileXY(map, 5, 5))).toMatchObject({ kind: 'sea', owner: 'water' });
    expect(describeTile(game, tileXY(map, 0, 5))).toMatchObject({ kind: 'void' });
  });

  it('summarises towns and industries', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const town = newTown(0, tileXY(game.map, 20, 30), 0, true);
    town.population = 412;
    town.numHouses = 17;
    game.towns.push(town);
    game.industries.push({
      index: 0,
      type: IndustryType.CoalMine,
      tile: tileXY(game.map, 40, 10),
      width: 3,
      height: 3,
      townIndex: 0,
      layoutIndex: 0,
      productionRate: 15,
      counter: 0,
      randomColour: 0,
      random: 0,
      prodLevel: 16,
    });
    makeIndustry(game.map, tileXY(game.map, 40, 10), 0, 5, 0);
    expect(townInfo(game, 0)).toEqual({
      index: 0,
      name: 'Invenville',
      isCity: true,
      population: 412,
      houses: 17,
      x: 20,
      y: 30,
    });
    expect(industryInfo(game, 0)).toEqual({
      index: 0,
      type: 'coalMine',
      townName: 'Invenville',
      x: 40,
      y: 10,
    });
    expect(describeTile(game, tileXY(game.map, 40, 10))).toMatchObject({
      kind: 'industry',
      industryIndex: 0,
    });
    expect([townInfo(game, 5), industryInfo(game, 5)]).toEqual([null, null]);
  });
});
```

`src/render/gesture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyPress } from './gesture';

const down = { x: 100, y: 100, at: 1000 };

describe('tap, long press and drag (Review Focus 4)', () => {
  it('is a tap when short and still', () => {
    expect(classifyPress(down, { x: 103, y: 104, at: 1200 }, false)).toBe('tap');
  });
  it('is a long press when held still for 500 ms', () => {
    expect(classifyPress(down, { x: 101, y: 100, at: 1500 }, false)).toBe('long');
  });
  it('is a drag once the pointer moved past the slop, even if it came back', () => {
    expect(classifyPress(down, { x: 100, y: 100, at: 1100 }, true)).toBe('drag');
    expect(classifyPress(down, { x: 120, y: 100, at: 1100 }, false)).toBe('drag');
  });
});
```

`src/ui/windows.test.tsx` (happy-dom): `TownWindow` renders the lines `Population: 412` and `Houses: 17` (numbers through `formatNumber`; `App` puts the name, with ` (City)` for cities, in the `Panel` title); `IndustryWindow` renders its name heading `Invenville Coal Mine` and `Location: 40 × 10` in English and `Mina de carbón de Invenville` in Spanish; `TileInfo` for a town road shows `Road`, `Owner: Invenville` and a "Town window" button that calls `onOpenTown(0)`; for grass it shows `Owner: None` and no button.

```tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { IndustryWindow } from './IndustryWindow';
import { TileInfo } from './TileInfo';
import { TownWindow } from './TownWindow';

const TOWN = {
  index: 0,
  name: 'Invenville',
  isCity: true,
  population: 412,
  houses: 17,
  x: 20,
  y: 30,
};
const ROAD = {
  tile: 1300,
  x: 20,
  y: 20,
  z: 1,
  kind: 'road' as const,
  owner: 'town' as const,
  townIndex: 0,
  industryIndex: null,
};
const GRASS = { ...ROAD, kind: 'grass' as const, owner: 'none' as const, townIndex: null };

describe('town and industry windows', () => {
  it('shows population and houses', () => {
    render(<TownWindow locale="en" info={TOWN} />);
    expect(screen.getByText('Population: 412')).toBeTruthy();
    expect(screen.getByText('Houses: 17')).toBeTruthy();
  });

  it('names an industry after its town, in both languages', () => {
    const info = { index: 0, type: 'coalMine' as const, townName: 'Invenville', x: 40, y: 10 };
    const { unmount } = render(<IndustryWindow locale="en" info={info} />);
    expect(screen.getByText('Invenville Coal Mine')).toBeTruthy();
    expect(screen.getByText('Location: 40 × 10')).toBeTruthy();
    unmount();
    render(<IndustryWindow locale="es" info={info} />);
    expect(screen.getByText('Mina de carbón de Invenville')).toBeTruthy();
  });

  it('links a town road to its town', () => {
    const openTown = vi.fn();
    render(<TileInfo locale="en" info={ROAD} townName="Invenville" onOpenTown={openTown} />);
    expect(screen.getByText('Road')).toBeTruthy();
    expect(screen.getByText('Owner: Invenville')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Town window' }));
    expect(openTown).toHaveBeenCalledWith(0);
  });

  it('shows no town link for grass', () => {
    render(<TileInfo locale="en" info={GRASS} townName={null} onOpenTown={() => undefined} />);
    expect(screen.getByText('Owner: None')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Town window' })).toBeNull();
  });
});
```

(Town and industry windows put their name in the `Panel` title, rendered by `App`; the components render the body.)

Run: `npx vitest run src/sim/query.test.ts src/render/gesture.test.ts src/ui` — Expected: FAIL.

- [ ] **Step 3: Implement** —

- `query.ts`: `describeTile` maps tile types to kinds (clear by ground: grass/rough/rocks, fields and others `other`; water: open water `sea`, coast `coast`); owner: water tiles → `water`; town-owned road and house → `town` (with `townIndex = getTownIndex`); else `none`; `z = getTileZ`; `industryIndex` for industry tiles. `townInfo` uses `townName(nameParts)`; `industryInfo` uses the industry's town name, `x`/`y` of `industry.tile`.
- `gesture.ts`: `drag` if `moved` or `max(|dx|, |dy|) > TAP_SLOP_PX`; else `long` if `up.at - down.at >= LONG_PRESS_MS`; else `tap`.
- `MapScene`: on `pointerdown` (single pointer) remember `{ x, y, at: time.now }`, reset `moved`, start a `this.time.delayedCall(LONG_PRESS_MS, …)` that, if the pointer is still down and not moved and not pinching, fires `onLongPress(tileUnder(pointer))` and marks the press as consumed; `pointermove` beyond the slop sets `moved`; a second pointer (pinch) sets `moved`; on `pointerup`, unless consumed, `classifyPress(...) === 'tap'` → `onTap(tileUnder(pointer))`. `tileUnder`: `camera.getWorldPoint` → `worldToTile` → ignore points outside the map → `tileXY`.
- `app/session.ts`: `tool`, `window` (`{ kind, index }` stored, info rebuilt by `buildSnapshot` through the query functions), `setTool`, `openTown`, `closeWindow`, `tapTile`. `main.tsx` passes `{ onTap: (t) => session.tapTile(t, false), onLongPress: (t) => session.tapTile(t, true) }` to `MapScene`.
- UI: `StatusBar` gets a "Query tile" toggle button (`tool.query`, `aria-pressed`); `App` renders `snapshot.window` in a `Panel` (title: `tile.title`, the town title — `town.city` for cities — or `industry.name`) whose close calls `session.closeWindow()`; opening Settings or New game calls `closeWindow()`, and a new `snapshot.window` closes the local panel (one window at a time, as on phones in 1.1). `TileInfo`, `TownWindow`, `IndustryWindow` as tested.

- [ ] **Step 4: e2e** — `tests/e2e/query.spec.ts`. The world is computed in Node from the same seed; the page's `data-world-hash` must match first, so an engine mismatch (R3) fails with a clear message instead of a missed click. Playwright's TypeScript loader resolves the extensionless `src/sim` imports.

```ts
import { expect, test, type Page } from '@playwright/test';
import { hashGameState } from '../../src/sim/game';
import { getIndustryIndex } from '../../src/sim/map/industry-map';
import { getTileType, TileType, tileX, tileY } from '../../src/sim/map/map';
import { getClearGround, ClearGround } from '../../src/sim/map/clear';
import { townName } from '../../src/sim/town/town-names';
import { createGame } from '../../src/sim/world/generate';

const SEED = 7; // Step 5 checks this 64×64 world has a town and an industry; pick another seed if not
const world = createGame({ mapLogX: 6, mapLogY: 6, seed: SEED });
const tiles = Array.from({ length: world.map.size }, (_, t) => t);
const houseTile = tiles.find((t) => getTileType(world.map, t) === TileType.House) ?? -1;
const industryTile = tiles.find((t) => getTileType(world.map, t) === TileType.Industry) ?? -1;
const grassTile =
  tiles.find(
    (t) =>
      getTileType(world.map, t) === TileType.Clear &&
      getClearGround(world.map, t) === ClearGround.Grass &&
      tileX(world.map, t) > 8 &&
      tileY(world.map, t) > 8,
  ) ?? -1;

/** Title of the town window for the town that owns the house tile. */
function townTitle(): string {
  const town = world.towns[world.map.m2[houseTile] ?? 0]!;
  return town.isCity ? `${townName(town.nameParts)} (City)` : townName(town.nameParts);
}

async function openWorld(page: Page, tile: number): Promise<void> {
  await page.goto(
    `./?seed=${SEED}&size=64x64&tile=${tileX(world.map, tile)},${tileY(world.map, tile)}`,
  );
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-world-hash', hashGameState(world));
}

/** Screen point of a tile centre: camera zoom is 1 at start, so screen = world - scroll. */
async function tileCentre(page: Page, tile: number): Promise<{ x: number; y: number }> {
  const game = page.locator('#game');
  const box = (await game.boundingBox())!;
  const scrollX = Number(await game.getAttribute('data-camera-x'));
  const scrollY = Number(await game.getAttribute('data-camera-y'));
  return {
    x: box.x + tileY(world.map, tile) * 64 + 32 - scrollX,
    y: box.y + tileX(world.map, tile) * 64 + 32 - scrollY,
  };
}

async function tapTile(page: Page, isMobile: boolean, tile: number): Promise<void> {
  const { x, y } = await tileCentre(page, tile);
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('the seed gives a world with a house, an industry and inland grass', () => {
  expect([houseTile, industryTile, grassTile].every((t) => t >= 0)).toBe(true);
});

test('querying a house opens its town window', async ({ page, isMobile }) => {
  await openWorld(page, houseTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, houseTile);
  const dialog = page.getByRole('dialog', { name: townTitle() });
  await expect(dialog).toContainText('Population:');
  await expect(dialog).toContainText('Houses:');
});

test('querying an industry opens its industry window', async ({ page, isMobile }) => {
  await openWorld(page, industryTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, industryTile);
  const industry = world.industries[getIndustryIndex(world.map, industryTile)]!;
  await expect(page.getByRole('dialog')).toContainText(
    industry.type === 0 ? 'Coal Mine' : 'Power Station',
  );
});

test('querying grass shows land information', async ({ page, isMobile }) => {
  await openWorld(page, grassTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  await tapTile(page, isMobile, grassTile);
  await expect(page.getByRole('dialog', { name: 'Land area information' })).toContainText('Grass');
});

test('dragging the map with the query tool does not query (Review Focus 4)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'mouse drag');
  await openWorld(page, grassTile);
  await page.getByRole('button', { name: 'Query tile' }).click();
  const { x, y } = await tileCentre(page, grassTile);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y - 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a long press queries without the tool', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Playwright has no touch long-press');
  await openWorld(page, grassTile);
  const { x, y } = await tileCentre(page, grassTile);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Land area information' })).toBeVisible();
});
```

- [ ] **Step 5: Run** — `npm test && npm run lint && npm run typecheck && npm run test:e2e` — Expected: all passed on both projects. If the first e2e test shows seed 7 lacks a town or an industry, change `SEED` and re-run. Screenshot the three windows on desktop and phone.

- [ ] **Step 6: Commit** — `feat: add the query tool and town and industry windows` (body: R8 — the UI reads the world only through `sim/query.ts`; a press is classified once (tap, long press or drag) so panning never opens a window; long press queries without the tool, as the spec's phone gestures say. `Refs #N`). PR into the block branch.

---

### Task 14: Close block 1.2

- [ ] **Step 1: Playtest guide** `docs/game/block-1.2.md` (English, same shape as `block-1.1.md`): preview `https://s-tian86.github.io/openttd-web/preview/block-1-2/`; what is new (generated worlds: sea and coast, rough land, rocks, trees that grow, towns with roads and houses, coal mines and power stations; new-game window; query tool; town and industry windows); what to try on the phone (generate 64×64 — one mine and one power station, the guided size —, 256×256 and 1024×1024 and watch the "Generating world" percentage; non-square sizes; find a town and open its window by querying a house; long-press a tile; open a coal mine and a power station; switch to Español; reuse a seed and check the same world comes back; share `?seed=…&size=…`); not there yet (building, trains, cargo and town growth — blocks 1.3–1.5 —, hills and rivers — Stage 2 —, real art — block 1.6); how to report (issue with label `playtest`).
- [ ] **Step 2: Differences** — check `docs/game/differences.md` has the rows added in Tasks 2, 4, 9 and 10, and nothing else changed behaviour silently.
- [ ] **Step 3: TRACKING** — mark the block 1.2 task lines `[x]` and the block line `[~] 1.2 World — branch stage-1/block-1.2 — awaiting playtest`.
- [ ] **Step 4: Commit, PR into the block branch, merge** (`docs: close block 1.2`); wait for the preview deploy; screenshot `…/preview/block-1-2/?seed=1` on a phone viewport and on desktop.
- [ ] **Step 5: Notify the author** (push notification): preview link + guide link. Start block 1.3 (at most three blocks may wait for a playtest, spec §7).
