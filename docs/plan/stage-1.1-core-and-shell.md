# Stage 1.1 — Core and shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An empty OpenTTD map you can pan and zoom with mouse or fingers, with the calendar running, pause and speed controls, and the interface in English or Spanish — deployed to a preview URL for the author's playtest.

**Architecture:** The simulation core (`src/sim/`) ports OpenTTD's random generator, map storage, tile loop, dates and command system, and exposes `createGame`, `tick`, `execute`. `src/app/` paces ticks like OpenTTD's video driver and owns a `GameSession`. `src/render/` draws the ground in 32×32-tile chunks with Phaser tilemap layers, using sprites from the active theme. `src/ui/` is a Preact HUD that reads a `UiSession` snapshot and acts through it.

**Tech Stack:** TypeScript 7, Vite 8, Phaser 4.2, Preact 11, Vitest 5 (+ happy-dom, @testing-library/preact for components), Playwright 1.64, oxlint, GitHub Actions, GitHub Pages from a `gh-pages` branch.

**Spec:** [`stage-1-first-train.md`](stage-1-first-train.md) — §2 (D1, D4, D7, D8), §3, §4, §5, §6 block 1.1, §7. Sources: [`../reference/openttd/time.md`](../reference/openttd/time.md), [`../reference/openttd/map.md`](../reference/openttd/map.md), [`../reference/openttd/economy.md`](../reference/openttd/economy.md).

## Global Constraints

- Everything committed is in English; ported code cites `// Port of <file>:<function>` (OpenTTD 15.3).
- Host: git 2.50, Ubuntu 20.04 (local Playwright uses `channel: 'chrome'`), project port **4317**. Never stop processes by name pattern; stop them by PID.
- `src/sim/` imports nothing from Phaser, DOM, Node, `render/`, `ui/`, `app/`; no `Math.random`, `Date`, timers (enforced by oxlint and `tsconfig.sim.json`).
- Integer arithmetic in `src/sim/`; uint32 values are kept in `0..2^32-1` with `>>> 0`.
- `ui/` never imports `app/`; it receives a `UiSession` (defined in `ui/`) that `app/` implements.
- Workflow (spec §7): Task 1 merges into `main`. Then branch `stage-1/block-1.1` is created from `main`; Tasks 2–13 open PRs **into `stage-1/block-1.1`**. Conventional commits, body explains why, `Refs #N`, no co-authorship trailers.
- New dependencies, exact majors: `preact@^11.0.1`; dev: `happy-dom@^20`, `@testing-library/preact@^3.2.4`. Nothing else.
- Every user-facing string is an i18n key; `en.json` and `es.json` always have the same keys.

## Review Focus

1. **Preview deploys must not wipe each other or `main`**: deploying a block preview must keep the root site and other previews; deploying `main` must keep `preview/`. Pinned in Task 1 by `keep_files: true` and a post-deploy check of both URLs.
2. **Phone pinch-zoom must not zoom the page instead of the map**: without `touch-action: none` the browser zooms the whole page. Pinned in Task 9 by an e2e check that `#game` has `touch-action: none`, and by the unit-tested pinch math.
3. **Fast-forward on a slow phone must not freeze the tab**: a long frame would run thousands of ticks. Pinned in Task 6 by `MAX_TICKS_PER_FRAME` and the `ALLOWED_DRIFT` backlog drop, both unit-tested.
4. **Local storage blocked (private mode)**: the language choice must still work for the session. Pinned in Task 10 by a test where storage throws.
5. **A theme missing a sprite**: the map must still draw. Pinned in Task 7 (fallback to `terrain.unknown`, default theme must cover every id) and Task 8 (renderer uses `resolveSprite`).

---

## File map

| Path                                                                                       | Responsibility                                        | Task |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ---- |
| `.github/workflows/deploy.yml`, `CONTRIBUTING.md`, `.claude/skills/gh-flow/SKILL.md`       | Preview deploys, block workflow                       | 1    |
| `src/sim/core/random.ts` (+ test)                                                          | Port of OpenTTD's `Randomizer`                        | 2    |
| `src/sim/map/map.ts`, `src/sim/map/clear.ts`, `src/sim/map/tile-loop.ts` (+ tests)         | Tile storage, clear/void tiles, tile loop             | 3    |
| `src/sim/time/date.ts`, `src/sim/time/clock.ts` (+ tests)                                  | Date arithmetic, calendar and economy clocks          | 4    |
| `src/sim/economy/company.ts`, `src/sim/command/command.ts`, `src/sim/game.ts` (+ tests)    | Company money, command system, game state, tick, hash | 5    |
| `src/app/loop.ts` (+ test), `src/app/session.ts`                                           | Tick pacing, game session                             | 6    |
| `src/render/theme.ts` (+ test), `public/themes/blocks/**`                                  | Theme contract, "blocks" theme                        | 7    |
| `src/render/projection.ts`, `src/render/ground.ts` (+ tests), `src/render/MapScene.ts`     | Projection, ground sprites, chunked map               | 8    |
| `src/render/camera.ts` (+ test), `src/render/MapScene.ts`                                  | Mouse and touch camera                                | 9    |
| `src/ui/i18n/*` (+ test)                                                                   | Translations and formatting                           | 10   |
| `src/ui/*.tsx`, `src/ui/session.ts`, `src/ui/styles.css`, `src/app/main.ts`, `tests/e2e/*` | HUD shell, wiring, e2e                                | 11   |
| `tools/openttd-strings.mjs`, `docs/reference/translations.md`                              | Translation reuse evaluation                          | 12   |
| `docs/game/block-1.1.md`, `docs/plan/TRACKING.md`                                          | Playtest guide, block close                           | 13   |

---

### Task 1: Preview deploys and the block workflow

Merges into **`main`** (it changes how `main` deploys).

**Files:**

- Modify: `.github/workflows/deploy.yml`, `CONTRIBUTING.md`, `.claude/skills/gh-flow/SKILL.md`, `docs/plan/TRACKING.md`

**Interfaces:**

- Produces: `main` deployed to `https://s-tian86.github.io/openttd-web/`; each push to `stage-N/block-N.M` deployed to `…/openttd-web/preview/block-N-M/`; ruleset protecting `stage-*/**` branches.

- [ ] **Step 1: Issue and branch** — issue "Deploy block previews and document the block workflow" (milestone `Stage 1 — First train`, label `infra`); add TRACKING lines for Stage 1.1 tasks; branch `chore/block-previews` from `main`.

- [ ] **Step 2: Replace `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main, 'stage-*/block-*']
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: gh-pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - id: target
        # main → site root; stage-1/block-1.1 → preview/block-1-1
        run: |
          if [ "$GITHUB_REF_NAME" = "main" ]; then
            echo "dir=." >> "$GITHUB_OUTPUT"
          else
            slug=$(echo "$GITHUB_REF_NAME" | sed 's|^stage-[0-9]*/||; s|\.|-|g')
            echo "dir=preview/$slug" >> "$GITHUB_OUTPUT"
          fi
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: dist
          destination_dir: ${{ steps.target.outputs.dir }}
          # Keep the other previews and the root when one target is redeployed.
          keep_files: true
```

- [ ] **Step 3: Block workflow in `CONTRIBUTING.md`** — add after "## Pull requests":

```markdown
## Block branches (from Stage 1)

Each block of a stage has a branch, `stage-N/block-N.M`, created from the previous block's
branch (the first block from `main`). Task PRs target the **block branch**. Branches matching
`stage-*/**` are protected by a ruleset: changes only through PRs with the `check` status green.

- Every push to a block branch deploys a preview to
  `https://s-tian86.github.io/openttd-web/preview/block-N-M/`.
- When a block is complete, the author gets the preview link and its playtest guide
  (`docs/game/block-N.M.md`), and work continues on the next block.
- Playtest fixes go to the tested block's branch; then a PR **merges** (never rebases) that
  branch into each later block branch.
- An approved block merges into `main` through a PR, in order.
- At most three completed blocks may wait for a playtest.
```

- [ ] **Step 4: Block branches in `.claude/skills/gh-flow/SKILL.md`** — in "## 2. Branch", replace the code block with:

````markdown
```bash
BASE=main                          # or the current block branch, e.g. stage-1/block-1.1
git checkout "$BASE" && git pull --ff-only
git checkout -b <type>/<short-description>   # feat fix chore docs refactor test
```

During a stage, `BASE` is the current block branch and every PR targets it
(`gh pr create --base "$BASE"`). See CONTRIBUTING "Block branches".
````

and in "## 4. Pull request" change `gh pr create --base main` to `gh pr create --base "$BASE"`; in "## 5. Merge" change `git checkout main` to `git checkout "$BASE"`.

- [ ] **Step 5: Commit, PR to `main`, merge after green CI** (message: `chore: deploy block previews and document the block workflow`, body explains that playtests must not block progress and previews need their own URL; `Refs #N`).

- [ ] **Step 6: Switch Pages to the `gh-pages` branch and protect block branches**

```bash
gh run watch $(gh run list --workflow Deploy --branch main --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
gh api -X PUT repos/S-Tian86/openttd-web/pages -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/'
gh api -X POST repos/S-Tian86/openttd-web/rulesets --input - <<'JSON'
{
  "name": "block branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/stage-*/**"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": true, "required_status_checks": [{ "context": "check" }] } }
  ]
}
JSON
```

- [ ] **Step 7: Create the block branch and verify both URLs**

```bash
git checkout main && git pull --ff-only
git checkout -b stage-1/block-1.1 && git push -u origin stage-1/block-1.1
gh run watch $(gh run list --workflow Deploy --branch stage-1/block-1.1 --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
curl -s -o /dev/null -w "%{http_code}\n" https://s-tian86.github.io/openttd-web/                    # 200
curl -s -o /dev/null -w "%{http_code}\n" https://s-tian86.github.io/openttd-web/preview/block-1-1/  # 200
```

Expected: both 200 (Pages may take ~1 minute after the deploy run).

---

### Task 2: Random generator

**Files:**

- Create: `src/sim/core/random.ts`, `src/sim/core/random.test.ts`

**Interfaces:**

- Produces: `interface Randomizer { state0: number; state1: number }`, `createRandomizer(seed: number): Randomizer`, `nextRandom(r: Randomizer): number`, `randomRange(r: Randomizer, limit: number): number`, `scaleToLimit(value: number, limit: number): number`, `chance16I(a: number, b: number, r: number): boolean`.

- [ ] **Step 1: Write the failing test** — vectors computed independently with Python from `core/random_func.cpp`:

```ts
import { describe, expect, it } from 'vitest';
import { chance16I, createRandomizer, nextRandom, randomRange, scaleToLimit } from './random';

// Fidelity: OpenTTD 15.3 core/random_func.cpp, vectors computed independently.
describe('Randomizer (port of core/random_func.cpp)', () => {
  it.each([
    [0, [4294967295, 3217329428, 536870911, 451640374, 2599350048]],
    [1, [536870911, 3750006036, 1602748415, 981167158, 3129923872]],
    [12345, [536872454, 3515126559, 4023459891, 1208093797, 4215375298]],
  ])('seed %i produces the OpenTTD sequence', (seed, expected) => {
    const r = createRandomizer(seed);
    expect(Array.from({ length: 5 }, () => nextRandom(r))).toEqual(expected);
  });

  it('keeps the state OpenTTD has after five draws', () => {
    const r = createRandomizer(12345);
    for (let i = 0; i < 5; i++) nextRandom(r);
    expect([r.state0, r.state1]).toEqual([247503572, 4215375298]);
  });

  it('scales to a limit exactly, even for 32-bit limits', () => {
    const values = [536872454, 3515126559, 4023459891, 1208093797, 4215375298];
    expect(values.map((v) => scaleToLimit(v, 100))).toEqual([12, 81, 93, 28, 98]);
    expect(values.map((v) => scaleToLimit(v, 0xffffffff))).toEqual([
      536872453, 3515126558, 4023459890, 1208093796, 4215375297,
    ]);
    expect(values.map((v) => scaleToLimit(v, 1000003))).toEqual([
      125000, 818431, 936787, 281282, 981471,
    ]);
  });

  it('draws a range from the generator', () => {
    const r = createRandomizer(12345);
    expect(Array.from({ length: 5 }, () => randomRange(r, 100))).toEqual([12, 81, 93, 28, 98]);
  });

  it('evaluates Chance16I like OpenTTD', () => {
    const values = [536872454, 3515126559, 4023459891, 1208093797, 4215375298];
    expect(values.map((v) => chance16I(1, 3, v))).toEqual([true, false, true, true, false]);
  });
});
```

Run: `npx vitest run src/sim/core/random.test.ts` — Expected: FAIL, cannot resolve `./random`.

- [ ] **Step 2: Implement**

```ts
/** Generator state. Port of core/random_func.hpp:Randomizer (two uint32 words). */
export interface Randomizer {
  state0: number;
  state1: number;
}

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Port of core/random_func.cpp:Randomizer::SetSeed. */
export function createRandomizer(seed: number): Randomizer {
  const s = seed >>> 0;
  return { state0: s, state1: s };
}

/** Port of core/random_func.cpp:Randomizer::Next. Returns a uint32. */
export function nextRandom(r: Randomizer): number {
  const s = r.state0;
  const t = r.state1;
  r.state0 = (s + rotr((t ^ 0x1234567f) >>> 0, 7) + 1) >>> 0;
  r.state1 = (rotr(s, 3) - 1) >>> 0;
  return r.state1;
}

/**
 * (value * limit) >> 32 without losing precision: the 64-bit product is split in 16-bit
 * halves. Port of core/random_func.hpp:ScaleToLimit.
 */
export function scaleToLimit(value: number, limit: number): number {
  const high = value >>> 16;
  const low = value & 0xffff;
  return Math.floor((high * limit + Math.floor((low * limit) / 65536)) / 65536);
}

/** Random number in [0, limit). Port of core/random_func.hpp:RandomRange. */
export function randomRange(r: Randomizer, limit: number): number {
  return scaleToLimit(nextRandom(r), limit);
}

/** True with probability a/b, using the low 16 bits of r. Port of core/random_func.hpp:Chance16I. */
export function chance16I(a: number, b: number, r: number): boolean {
  return Math.floor(((r & 0xffff) * b + Math.floor(b / 2)) / 65536) < a;
}
```

Run: `npx vitest run src/sim/core/random.test.ts` — Expected: 7 passed.

- [ ] **Step 3: Commit** — `feat: port OpenTTD's random generator` (body: D1 — same generator and formulas, reproducible games; the split multiplication keeps `ScaleToLimit` exact in doubles. `Refs #N`). PR into `stage-1/block-1.1`.

---

### Task 3: Map storage and the tile loop

**Files:**

- Create: `src/sim/map/map.ts`, `src/sim/map/clear.ts`, `src/sim/map/tile-loop.ts`, `src/sim/map/map.test.ts`, `src/sim/map/tile-loop.test.ts`

**Interfaces:**

- Produces (`map.ts`): `TileType` (const object: `Clear 0, Railway 1, Road 2, House 3, Trees 4, Station 5, Water 6, Void 7, Industry 8, TunnelBridge 9, Object 10`), `MIN_MAP_SIZE_BITS = 6`, `MAX_MAP_SIZE_BITS = 12`, `interface MapState { logX; logY; sizeX; sizeY; size; type: Uint8Array; height: Uint8Array; m1: Uint8Array; m2: Uint16Array; m3: Uint8Array; m4: Uint8Array; m5: Uint8Array; m6: Uint8Array; m7: Uint8Array; m8: Uint16Array; tileLoopTile: number }`, `createMap(logX, logY): MapState`, `tileXY(map, x, y)`, `tileX(map, t)`, `tileY(map, t)`, `getTileType(map, t): TileType`, `setTileType(map, t, type)`, `isInnerTile(map, t): boolean` (freeform edges), `makeVoid(map, t)`.
- Produces (`clear.ts`): `ClearGround` (`Grass 0, Rough 1, Rocks 2, Fields 3, Desert 5`), `makeClear(map, t, ground, density)`, `getClearGround(map, t)`, `getClearDensity(map, t)`, `tileLoopClear(map, t, markDirty: (t: number) => void)`.
- Produces (`tile-loop.ts`): `TILE_LOOP_FEEDBACKS`, `runTileLoop(map, tickCounter, procs: TileLoopProcs)`, `type TileLoopProcs = Partial<Record<TileType, (t: number) => void>>`.

- [ ] **Step 1: Write the failing tests**

`src/sim/map/map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ClearGround, getClearDensity, getClearGround, makeClear, tileLoopClear } from './clear';
import {
  createMap,
  getTileType,
  isInnerTile,
  makeVoid,
  setTileType,
  TileType,
  tileX,
  tileXY,
  tileY,
} from './map';

describe('map storage (port of map_func.h, tile_map.h)', () => {
  it('allocates power-of-two sizes from 64 to 4096', () => {
    const map = createMap(8, 6);
    expect([map.sizeX, map.sizeY, map.size]).toEqual([256, 64, 16384]);
    expect(map.m2).toBeInstanceOf(Uint16Array);
    expect(() => createMap(5, 8)).toThrow();
    expect(() => createMap(8, 13)).toThrow();
  });

  it('converts between tile index and coordinates', () => {
    const map = createMap(8, 8);
    const t = tileXY(map, 10, 20);
    expect(t).toBe((20 << 8) + 10);
    expect([tileX(map, t), tileY(map, t)]).toEqual([10, 20]);
  });

  it('stores the tile type in the high nibble', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 5, 5);
    setTileType(map, t, TileType.Trees);
    expect(map.type[t]).toBe(TileType.Trees << 4);
    expect(getTileType(map, t)).toBe(TileType.Trees);
  });

  it('treats both border rows and columns as outside with freeform edges', () => {
    const map = createMap(6, 6);
    expect(isInnerTile(map, tileXY(map, 0, 5))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 5, 0))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 63, 5))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 5, 63))).toBe(false);
    expect(isInnerTile(map, tileXY(map, 1, 1))).toBe(true);
  });

  it('makes void and clear tiles with OpenTTD bit layouts', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 2);
    expect(getTileType(map, t)).toBe(TileType.Clear);
    expect(map.m1[t]).toBe(0x10); // OWNER_NONE
    expect(map.m5[t]).toBe((ClearGround.Grass << 2) | 2);
    expect([getClearGround(map, t), getClearDensity(map, t)]).toEqual([ClearGround.Grass, 2]);
    makeVoid(map, t);
    expect(getTileType(map, t)).toBe(TileType.Void);
    expect(map.height[t]).toBe(0);
  });
});

describe('TileLoop_Clear (port of clear_cmd.cpp)', () => {
  it('grows grass one density step every 8 visits and marks the tile dirty', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 0);
    const dirty: number[] = [];
    for (let i = 0; i < 7; i++) tileLoopClear(map, t, (d) => dirty.push(d));
    expect(getClearDensity(map, t)).toBe(0);
    tileLoopClear(map, t, (d) => dirty.push(d));
    expect(getClearDensity(map, t)).toBe(1);
    expect(dirty).toEqual([t]);
  });

  it('leaves full grass alone', () => {
    const map = createMap(6, 6);
    const t = tileXY(map, 3, 3);
    makeClear(map, t, ClearGround.Grass, 3);
    for (let i = 0; i < 20; i++) tileLoopClear(map, t, () => undefined);
    expect(getClearDensity(map, t)).toBe(3);
  });
});
```

`src/sim/map/tile-loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMap, TileType } from './map';
import { runTileLoop } from './tile-loop';

describe('RunTileLoop (port of landscape.cpp)', () => {
  it('visits tiles in OpenTTD LFSR order, size/256 per tick', () => {
    const map = createMap(6, 6); // 4096 tiles → 16 per tick
    const visited: number[] = [];
    runTileLoop(map, 1, { [TileType.Clear]: (t) => visited.push(t) });
    expect(visited.slice(0, 6)).toEqual([1, 3471, 2888, 1444, 722, 361]);
    expect(visited).toHaveLength(16);
  });

  it('visits every tile exactly once per 256 ticks, tile 0 on counter % 256 == 0', () => {
    const map = createMap(6, 6);
    const counts = new Map<number, number>();
    const visit = (t: number): void => void counts.set(t, (counts.get(t) ?? 0) + 1);
    for (let counter = 1; counter <= 256; counter++) {
      runTileLoop(map, counter, { [TileType.Clear]: visit });
    }
    expect(counts.size).toBe(4096);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
  });
});
```

Run: `npx vitest run src/sim/map` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `map.ts`**

```ts
/** Port of tile_type.h:TileType. */
export const TileType = {
  Clear: 0,
  Railway: 1,
  Road: 2,
  House: 3,
  Trees: 4,
  Station: 5,
  Water: 6,
  Void: 7,
  Industry: 8,
  TunnelBridge: 9,
  Object: 10,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Port of map_type.h. */
export const MIN_MAP_SIZE_BITS = 6;
export const MAX_MAP_SIZE_BITS = 12;

/** Owner values used on tiles. Port of company_type.h. */
export const OWNER_TOWN = 0x0f;
export const OWNER_NONE = 0x10;
export const OWNER_WATER = 0x11;

/** Tile storage as parallel typed arrays. Port of map_func.h:Tile (TileBase + TileExtended). */
export interface MapState {
  logX: number;
  logY: number;
  sizeX: number;
  sizeY: number;
  size: number;
  type: Uint8Array;
  height: Uint8Array;
  m1: Uint8Array;
  m2: Uint16Array;
  m3: Uint8Array;
  m4: Uint8Array;
  m5: Uint8Array;
  m6: Uint8Array;
  m7: Uint8Array;
  m8: Uint16Array;
  /** LFSR state of the tile loop; never 0. Port of landscape.cpp:_cur_tileloop_tile. */
  tileLoopTile: number;
}

/** Port of map.cpp:Map::Allocate. */
export function createMap(logX: number, logY: number): MapState {
  for (const bits of [logX, logY]) {
    if (!Number.isInteger(bits) || bits < MIN_MAP_SIZE_BITS || bits > MAX_MAP_SIZE_BITS) {
      throw new RangeError(`Map size bits must be ${MIN_MAP_SIZE_BITS}..${MAX_MAP_SIZE_BITS}`);
    }
  }
  const sizeX = 1 << logX;
  const sizeY = 1 << logY;
  const size = sizeX * sizeY;
  return {
    logX,
    logY,
    sizeX,
    sizeY,
    size,
    type: new Uint8Array(size),
    height: new Uint8Array(size),
    m1: new Uint8Array(size),
    m2: new Uint16Array(size),
    m3: new Uint8Array(size),
    m4: new Uint8Array(size),
    m5: new Uint8Array(size),
    m6: new Uint8Array(size),
    m7: new Uint8Array(size),
    m8: new Uint16Array(size),
    tileLoopTile: 1,
  };
}

/** Port of map_func.h:TileXY. */
export const tileXY = (map: MapState, x: number, y: number): number => (y << map.logX) + x;
/** Port of map_func.h:TileX. */
export const tileX = (map: MapState, t: number): number => t & (map.sizeX - 1);
/** Port of map_func.h:TileY. */
export const tileY = (map: MapState, t: number): number => t >>> map.logX;

/** Port of tile_map.h:GetTileType. */
export const getTileType = (map: MapState, t: number): TileType => (map.type[t]! >>> 4) as TileType;

/** Port of tile_map.h:SetTileType (keeps the low nibble). */
export function setTileType(map: MapState, t: number, type: TileType): void {
  map.type[t] = (map.type[t]! & 0x0f) | (type << 4);
}

/** Port of tile_map.h:IsInnerTile with freeform edges (the default). */
export function isInnerTile(map: MapState, t: number): boolean {
  const x = tileX(map, t);
  const y = tileY(map, t);
  return x < map.sizeX - 1 && y < map.sizeY - 1 && x > 0 && y > 0;
}

function clearTile(map: MapState, t: number): void {
  map.type[t] = 0;
  map.height[t] = 0;
  map.m1[t] = 0;
  map.m2[t] = 0;
  map.m3[t] = 0;
  map.m4[t] = 0;
  map.m5[t] = 0;
  map.m6[t] = 0;
  map.m7[t] = 0;
  map.m8[t] = 0;
}

/** Port of void_map.h:MakeVoid. */
export function makeVoid(map: MapState, t: number): void {
  clearTile(map, t);
  setTileType(map, t, TileType.Void);
}

/** Exposed for tile makers in other modules: reset every field but height. */
export function resetTileKeepingHeight(map: MapState, t: number): void {
  const h = map.height[t]!;
  clearTile(map, t);
  map.height[t] = h;
}
```

- [ ] **Step 3: Implement `clear.ts`**

```ts
import {
  getTileType,
  OWNER_NONE,
  resetTileKeepingHeight,
  setTileType,
  TileType,
  type MapState,
} from './map';

/** Port of clear_map.h:ClearGround. */
export const ClearGround = { Grass: 0, Rough: 1, Rocks: 2, Fields: 3, Desert: 5 } as const;
export type ClearGround = (typeof ClearGround)[keyof typeof ClearGround];

/** Port of clear_map.h:MakeClear. m5 = ground << 2 | density; counter in bits 7..5. */
export function makeClear(map: MapState, t: number, ground: ClearGround, density: number): void {
  resetTileKeepingHeight(map, t);
  setTileType(map, t, TileType.Clear);
  map.m1[t] = OWNER_NONE;
  map.m5[t] = (ground << 2) | density;
}

export const getClearGround = (map: MapState, t: number): ClearGround =>
  ((map.m5[t]! >>> 2) & 0x7) as ClearGround;
export const getClearDensity = (map: MapState, t: number): number => map.m5[t]! & 0x3;
const getClearCounter = (map: MapState, t: number): number => (map.m5[t]! >>> 5) & 0x7;
const setClearCounter = (map: MapState, t: number, c: number): void => {
  map.m5[t] = (map.m5[t]! & 0x1f) | (c << 5);
};

/** Grass growth only (temperate, Stage 1). Port of clear_cmd.cpp:TileLoop_Clear. */
export function tileLoopClear(map: MapState, t: number, markDirty: (t: number) => void): void {
  if (getTileType(map, t) !== TileType.Clear) return;
  if (getClearGround(map, t) !== ClearGround.Grass) return;
  const density = getClearDensity(map, t);
  if (density === 3) return;
  const counter = getClearCounter(map, t);
  if (counter < 7) {
    setClearCounter(map, t, counter + 1);
    return;
  }
  setClearCounter(map, t, 0);
  map.m5[t] = (map.m5[t]! & ~0x3) | (density + 1);
  markDirty(t);
}
```

- [ ] **Step 4: Implement `tile-loop.ts`**

```ts
import { getTileType, type MapState, type TileType } from './map';

/** Galois LFSR feedbacks indexed by logX + logY - 12. Port of landscape.cpp:RunTileLoop. */
export const TILE_LOOP_FEEDBACKS = [
  0xd8f, 0x1296, 0x2496, 0x4357, 0x8679, 0x1030e, 0x206cd, 0x403fe, 0x807b8, 0x1004b2, 0x2006a8,
  0x4004b2, 0x800b87,
] as const;

export type TileLoopProcs = Partial<Record<TileType, (t: number) => void>>;

/**
 * Visits size/256 tiles per tick in pseudo-random order, and tile 0 when the (already
 * incremented) tick counter is a multiple of 256. Port of landscape.cpp:RunTileLoop.
 */
export function runTileLoop(map: MapState, tickCounter: number, procs: TileLoopProcs): void {
  const feedback = TILE_LOOP_FEEDBACKS[map.logX + map.logY - 12]!;
  let count = 1 << (map.logX + map.logY - 8);
  let tile = map.tileLoopTile;
  if (tickCounter % 256 === 0) {
    procs[getTileType(map, 0)]?.(0);
    count--;
  }
  while (count-- > 0) {
    procs[getTileType(map, tile)]?.(tile);
    tile = ((tile >>> 1) ^ (-(tile & 1) & feedback)) >>> 0;
  }
  map.tileLoopTile = tile;
}
```

Run: `npx vitest run src/sim/map` — Expected: all passed. Then `npm run lint && npm run typecheck`.

- [ ] **Step 5: Commit** — `feat: port map storage and the tile loop` (body: same field layout as OpenTTD so later ports map field for field; LFSR order kept per D1. `Refs #N`). PR into the block branch.

---

### Task 4: Dates and clocks

**Files:**

- Create: `src/sim/time/date.ts`, `src/sim/time/clock.ts`, `src/sim/time/date.test.ts`, `src/sim/time/clock.test.ts`

**Interfaces:**

- Produces (`date.ts`): `DAY_TICKS` re-export from `../core/constants`, `DEF_START_YEAR = 1950`, `isLeapYear(y)`, `dateAtStartOfYear(y)`, `convertDateToYMD(date): { year: number; month: number; day: number }` (month 0..11, day 1..31), `convertYMDToDate(year, month, day): number`.
- Produces (`clock.ts`): `interface DateState { date: number; dateFract: number; year: number; month: number }`, `createDateState(startYear: number): DateState`, `advanceDate(d: DateState): { newDay: boolean; newMonth: boolean; newYear: boolean }`.

- [ ] **Step 1: Write the failing tests**

`src/sim/time/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { convertDateToYMD, convertYMDToDate, dateAtStartOfYear, isLeapYear } from './date';

// Fidelity: date numbers computed independently (day 0 = 0000-01-01, year 0 leap).
describe('date arithmetic (port of timer_game_common.cpp)', () => {
  it('applies Gregorian leap years', () => {
    expect([1900, 1950, 1952, 2000].map(isLeapYear)).toEqual([false, false, true, true]);
  });

  it.each([
    [1950, 0, 1, 712223],
    [1950, 1, 1, 712254],
    [1950, 2, 1, 712282],
    [1950, 11, 31, 712587],
    [1951, 0, 1, 712588],
    [2000, 1, 29, 730544],
    [2000, 2, 1, 730545],
    [1900, 2, 1, 694020],
  ])('%i-%i-%i is day %i, both ways', (year, month, day, date) => {
    expect(convertYMDToDate(year, month, day)).toBe(date);
    expect(convertDateToYMD(date)).toEqual({ year, month, day });
  });

  it('knows the start of 1920 and 1950', () => {
    expect(dateAtStartOfYear(1920)).toBe(701265);
    expect(dateAtStartOfYear(1950)).toBe(712223);
  });
});
```

`src/sim/time/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceDate, createDateState } from './clock';

describe('clock (port of TimerManager<TimerGameCalendar>::Elapsed)', () => {
  it('starts on 1 January of the starting year', () => {
    expect(createDateState(1950)).toEqual({ date: 712223, dateFract: 0, year: 1950, month: 0 });
  });

  it('advances one day every 74 ticks', () => {
    const d = createDateState(1950);
    for (let i = 0; i < 73; i++) expect(advanceDate(d).newDay).toBe(false);
    expect(advanceDate(d)).toEqual({ newDay: true, newMonth: false, newYear: false });
    expect([d.date, d.dateFract]).toEqual([712224, 0]);
  });

  it('reports new months and years', () => {
    const d = createDateState(1950);
    let months = 0;
    let years = 0;
    for (let i = 0; i < 365 * 74; i++) {
      const r = advanceDate(d);
      if (r.newMonth) months++;
      if (r.newYear) years++;
    }
    expect([months, years, d.year, d.month]).toEqual([12, 1, 1951, 0]);
  });
});
```

Run: `npx vitest run src/sim/time` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `date.ts`**

```ts
export { DAY_TICKS } from '../core/constants';

/** Port of timer_game_common.h: DEF_START_YEAR. */
export const DEF_START_YEAR = 1950;

/** Cumulative days before each month in a leap year. Port of timer_game_common.cpp:_accum_days_for_month. */
const ACCUM_DAYS_FOR_MONTH = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] as const;
const ACCUM_MAR = 60;

/** Port of TimerGame::IsLeapYear. */
export const isLeapYear = (y: number): boolean => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const daysInYear = (y: number): number => (isLeapYear(y) ? 366 : 365);

/** Port of TimerGame::DateAtStartOfYear. */
export function dateAtStartOfYear(y: number): number {
  if (y === 0) return 0;
  const p = y - 1;
  return 365 * y + Math.floor(p / 4) - Math.floor(p / 100) + Math.floor(p / 400) + 1;
}

/** Port of timer_game_common.cpp:CalendarConvertDateToYMD. Month 0..11, day 1..31. */
export function convertDateToYMD(date: number): { year: number; month: number; day: number } {
  let year = 400 * Math.floor(date / (365 * 400 + 97));
  let rem = date % (365 * 400 + 97);
  if (rem >= 365 * 100 + 25) {
    year += 100;
    rem -= 365 * 100 + 25;
    year += 100 * Math.floor(rem / (365 * 100 + 24));
    rem %= 365 * 100 + 24;
  }
  if (!isLeapYear(year) && rem >= 365 * 4) {
    year += 4;
    rem -= 365 * 4;
  }
  year += 4 * Math.floor(rem / (365 * 4 + 1));
  rem %= 365 * 4 + 1;
  while (rem >= daysInYear(year)) {
    rem -= daysInYear(year);
    year++;
  }
  if (!isLeapYear(year) && rem >= ACCUM_MAR - 1) rem++;
  let month = 11;
  while (ACCUM_DAYS_FOR_MONTH[month]! > rem) month--;
  return { year, month, day: rem - ACCUM_DAYS_FOR_MONTH[month]! + 1 };
}

/** Port of timer_game_common.cpp:CalendarConvertYMDToDate. */
export function convertYMDToDate(year: number, month: number, day: number): number {
  let days = ACCUM_DAYS_FOR_MONTH[month]! + day - 1;
  if (!isLeapYear(year) && days >= ACCUM_MAR) days--;
  return dateAtStartOfYear(year) + days;
}
```

- [ ] **Step 3: Implement `clock.ts`**

```ts
import { DAY_TICKS } from '../core/constants';
import { convertDateToYMD, convertYMDToDate } from './date';

/** One clock (calendar or economy). Port of TimerGameCalendar / TimerGameEconomy state. */
export interface DateState {
  date: number;
  dateFract: number;
  year: number;
  month: number;
}

export function createDateState(startYear: number): DateState {
  return { date: convertYMDToDate(startYear, 0, 1), dateFract: 0, year: startYear, month: 0 };
}

/**
 * Advances one tick. Year and month are updated before the caller fires its timers.
 * Port of timer_game_calendar.cpp:TimerManager<TimerGameCalendar>::Elapsed (calendar mode,
 * 12 minutes per year); the economy clock is identical in calendar timekeeping.
 */
export function advanceDate(d: DateState): {
  newDay: boolean;
  newMonth: boolean;
  newYear: boolean;
} {
  d.dateFract++;
  if (d.dateFract < DAY_TICKS) return { newDay: false, newMonth: false, newYear: false };
  d.dateFract = 0;
  d.date++;
  const ymd = convertDateToYMD(d.date);
  const newMonth = ymd.month !== d.month;
  const newYear = ymd.year !== d.year;
  d.month = ymd.month;
  d.year = ymd.year;
  return { newDay: true, newMonth, newYear };
}
```

Run: `npx vitest run src/sim/time` — Expected: all passed.

- [ ] **Step 4: Commit** — `feat: port OpenTTD dates and clocks` (body: calendar and economy kept as two states so wallclock mode can come later, as time.md recommends. `Refs #N`). PR into the block branch.

---

### Task 5: Company money, commands and the game state

**Files:**

- Create: `src/sim/economy/company.ts`, `src/sim/command/command.ts`, `src/sim/game.ts`, `src/sim/game.test.ts`, `src/sim/command/command.test.ts`

**Interfaces:**

- Consumes: Tasks 2–4.
- Produces (`company.ts`): `LOAN_INTERVAL = 10000`, `INITIAL_LOAN = 100000`, `DEFAULT_MAX_LOAN = 300000`, `interface CompanyState { money: number; currentLoan: number }`, `createCompany(maxLoan: number): CompanyState`.
- Produces (`command.ts`): `type Command = { type: 'pause'; paused: boolean }`, `type CommandMode = 'test' | 'exec'`, `type CommandResult = { ok: true; cost: number } | { ok: false; error: string }` (error is an i18n key), `COMMAND_PAUSE_LEVEL = 1`, `execute(state: GameState, command: Command, mode: CommandMode): CommandResult`.
- Produces (`game.ts`): `interface GameOptions { mapLogX: number; mapLogY: number; seed: number; startingYear: number }`, `DEFAULT_GAME_OPTIONS` (8, 8, 0, 1950), `interface GameState { options; random: Randomizer; map: MapState; tickCounter: number; calendar: DateState; economy: DateState; paused: boolean; company: CompanyState; dirtyTiles: Set<number> }`, `createGame(options?: Partial<GameOptions>): GameState`, `tick(state): void`, `takeDirtyTiles(state): number[]`, `hashGameState(state): string` (8 hex digits, excludes `dirtyTiles`).

- [ ] **Step 1: Write the failing tests**

`src/sim/game.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getClearDensity } from './map/clear';
import { getTileType, TileType, tileXY } from './map/map';
import { createGame, hashGameState, takeDirtyTiles, tick } from './game';

describe('createGame', () => {
  it('builds a flat grass world at height 1 with a void border (FlatEmptyWorld)', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const { map } = game;
    expect(getTileType(map, tileXY(map, 0, 10))).toBe(TileType.Void);
    expect(getTileType(map, tileXY(map, 63, 10))).toBe(TileType.Void);
    const inner = tileXY(map, 10, 10);
    expect(getTileType(map, inner)).toBe(TileType.Clear);
    expect(map.height[inner]).toBe(1);
    expect(getClearDensity(map, inner)).toBe(3);
  });

  it('starts on 1 January 1950 with the initial loan as cash (DoStartupNewCompany)', () => {
    const game = createGame();
    expect(game.calendar).toEqual({ date: 712223, dateFract: 0, year: 1950, month: 0 });
    expect(game.economy).toEqual(game.calendar);
    expect(game.company).toEqual({ money: 100000, currentLoan: 100000 });
  });
});

describe('tick (port of openttd.cpp:StateGameLoop)', () => {
  it('advances both clocks and the tick counter', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    for (let i = 0; i < 74; i++) tick(game);
    expect([game.tickCounter, game.calendar.date, game.economy.date]).toEqual([74, 712224, 712224]);
  });

  it('does nothing while paused', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    game.paused = true;
    const before = hashGameState(game);
    tick(game);
    expect(hashGameState(game)).toBe(before);
  });

  it('reports tiles changed by the tile loop once', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const t = tileXY(game.map, 10, 10);
    game.map.m5[t] = 0; // bare grass, counter 0
    for (let i = 0; i < 256 * 8; i++) tick(game);
    expect(takeDirtyTiles(game)).toContain(t);
    expect(takeDirtyTiles(game)).toEqual([]);
  });
});

describe('determinism', () => {
  it('produces the same hash for the same seed and ticks', () => {
    const run = (): string => {
      const game = createGame({ mapLogX: 6, mapLogY: 6, seed: 42 });
      for (let i = 0; i < 74 * 40; i++) tick(game);
      return hashGameState(game);
    };
    expect(run()).toBe(run());
    expect(run()).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes the hash when the state changes', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    const before = hashGameState(game);
    tick(game);
    expect(hashGameState(game)).not.toBe(before);
  });
});
```

`src/sim/command/command.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { execute } from './command';

describe('commands (port of command.cpp)', () => {
  it('pauses and unpauses, and test mode changes nothing', () => {
    const game = createGame({ mapLogX: 6, mapLogY: 6 });
    expect(execute(game, { type: 'pause', paused: true }, 'test')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(false);
    expect(execute(game, { type: 'pause', paused: true }, 'exec')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(true);
    // Pause is a server setting (level 0): always allowed, even while paused.
    expect(execute(game, { type: 'pause', paused: false }, 'exec').ok).toBe(true);
    expect(game.paused).toBe(false);
  });
});
```

Run: `npx vitest run src/sim/game.test.ts src/sim/command` — Expected: FAIL, modules not found.

- [ ] **Step 2: Implement `company.ts`**

```ts
/** Port of economy_type.h. */
export const LOAN_INTERVAL = 10000;
export const INITIAL_LOAN = 100000;
/** difficulty.max_loan default (difficulty_settings.ini), before inflation. */
export const DEFAULT_MAX_LOAN = 300000;
/** inflation_prices starts at 1.0 in 16.16 fixed point (economy.cpp:InitializeEconomy). */
const INFLATION_ONE = 1 << 16;

export interface CompanyState {
  money: number;
  currentLoan: number;
}

/** Port of company_cmd.cpp:DoStartupNewCompany (money part): cash = loan = initial loan. */
export function createCompany(maxLoan: number): CompanyState {
  const loan = Math.min(
    Math.floor(Math.floor((INITIAL_LOAN * INFLATION_ONE) / 65536) / LOAN_INTERVAL) * LOAN_INTERVAL,
    maxLoan,
  );
  return { money: loan, currentLoan: loan };
}
```

- [ ] **Step 3: Implement `game.ts`**

```ts
import { createRandomizer, type Randomizer } from './core/random';
import { createCompany, DEFAULT_MAX_LOAN, type CompanyState } from './economy/company';
import { ClearGround, makeClear, tileLoopClear } from './map/clear';
import { createMap, isInnerTile, makeVoid, TileType, type MapState } from './map/map';
import { runTileLoop } from './map/tile-loop';
import { advanceDate, createDateState, type DateState } from './time/clock';
import { DEF_START_YEAR } from './time/date';

export interface GameOptions {
  mapLogX: number;
  mapLogY: number;
  seed: number;
  startingYear: number;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  mapLogX: 8,
  mapLogY: 8,
  seed: 0,
  startingYear: DEF_START_YEAR,
};

export interface GameState {
  options: GameOptions;
  random: Randomizer;
  map: MapState;
  /** Port of TimerGameTick::counter. */
  tickCounter: number;
  calendar: DateState;
  economy: DateState;
  paused: boolean;
  company: CompanyState;
  /** Tiles to redraw (port of MarkTileDirtyByTile). Transient: not part of the hash. */
  dirtyTiles: Set<number>;
}

/** Flat land at height 1, void border. Port of heightmap.cpp:FlatEmptyWorld (flat height 1). */
export function createGame(options: Partial<GameOptions> = {}): GameState {
  const opts = { ...DEFAULT_GAME_OPTIONS, ...options };
  const map = createMap(opts.mapLogX, opts.mapLogY);
  for (let t = 0; t < map.size; t++) {
    if (isInnerTile(map, t)) {
      map.height[t] = 1;
      makeClear(map, t, ClearGround.Grass, 3);
    } else {
      makeVoid(map, t);
    }
  }
  return {
    options: opts,
    random: createRandomizer(opts.seed),
    map,
    tickCounter: 0,
    calendar: createDateState(opts.startingYear),
    economy: createDateState(opts.startingYear),
    paused: false,
    company: createCompany(DEFAULT_MAX_LOAN),
    dirtyTiles: new Set(),
  };
}

/** One game tick, in OpenTTD's order. Port of openttd.cpp:StateGameLoop. */
export function tick(state: GameState): void {
  if (state.paused) return;
  advanceDate(state.calendar);
  advanceDate(state.economy);
  state.tickCounter++;
  const markDirty = (t: number): void => void state.dirtyTiles.add(t);
  runTileLoop(state.map, state.tickCounter, {
    [TileType.Clear]: (t) => tileLoopClear(state.map, t, markDirty),
  });
}

/** Returns the tiles to redraw since the last call and forgets them. */
export function takeDirtyTiles(state: GameState): number[] {
  const tiles = [...state.dirtyTiles];
  state.dirtyTiles.clear();
  return tiles;
}

/** FNV-1a (32-bit) over the whole persistent state. Used by replay tests. */
export function hashGameState(state: GameState): string {
  let h = 0x811c9dc5;
  const byte = (b: number): void => {
    h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0;
  };
  const num = (n: number): void => {
    const s = String(n);
    for (let i = 0; i < s.length; i++) byte(s.charCodeAt(i));
    byte(0x2c);
  };
  const { map } = state;
  for (const arr of [map.type, map.height, map.m1, map.m3, map.m4, map.m5, map.m6, map.m7]) {
    for (let i = 0; i < arr.length; i++) byte(arr[i]!);
  }
  for (const arr of [map.m2, map.m8]) {
    for (let i = 0; i < arr.length; i++) {
      byte(arr[i]!);
      byte(arr[i]! >>> 8);
    }
  }
  const o = state.options;
  [o.mapLogX, o.mapLogY, o.seed, o.startingYear].forEach(num);
  [state.random.state0, state.random.state1, map.tileLoopTile, state.tickCounter].forEach(num);
  for (const d of [state.calendar, state.economy])
    [d.date, d.dateFract, d.year, d.month].forEach(num);
  [state.paused ? 1 : 0, state.company.money, state.company.currentLoan].forEach(num);
  return h.toString(16).padStart(8, '0');
}
```

- [ ] **Step 4: Implement `command.ts`**

```ts
import type { GameState } from '../game';

export type Command = { type: 'pause'; paused: boolean };
export type CommandMode = 'test' | 'exec';
export type CommandResult = { ok: true; cost: number } | { ok: false; error: string };

/** construction.command_pause_level default: no construction while paused (time.md §4.8). */
export const COMMAND_PAUSE_LEVEL = 1;

/** Level per command type. Port of command.cpp:IsCommandAllowedWhilePaused. */
const PAUSE_LEVEL: Record<Command['type'], number> = {
  pause: 0, // CommandType::ServerSetting
};

/** Runs a command in test or exec mode. Port of command.cpp:Command<>::Do (single player). */
export function execute(state: GameState, command: Command, mode: CommandMode): CommandResult {
  if (state.paused && PAUSE_LEVEL[command.type] > COMMAND_PAUSE_LEVEL) {
    return { ok: false, error: 'error.notAllowedWhilePaused' };
  }
  switch (command.type) {
    case 'pause':
      // Port of misc_cmd.cpp:CmdPause (PauseMode::Normal only).
      if (mode === 'exec') state.paused = command.paused;
      return { ok: true, cost: 0 };
  }
}
```

Run: `npm test` — Expected: all passed. `npm run lint && npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat: add game state, tick order and the command system` (body: tick follows StateGameLoop; commands follow OpenTTD's test/exec split so the UI can preview costs; the hash pins determinism. `Refs #N`). PR into the block branch.

---

### Task 6: Tick pacing and the game session

**Files:**

- Create: `src/app/loop.ts`, `src/app/loop.test.ts`, `src/app/session.ts`

**Interfaces:**

- Consumes: `GameState`, `tick`, `execute` (Task 5); `UiSession`, `UiSnapshot`, `GameSpeed`, `Locale` from `src/ui/session.ts` (created here, used by Task 11).
- Produces (`loop.ts`): `MILLISECONDS_PER_TICK` re-export, `ALLOWED_DRIFT = 5`, `MAX_TICKS_PER_FRAME = 32`, `SPEED_PERCENT: Record<GameSpeed, number>` (`normal 100, x2 200, x4 400, fast 2500`), `gameIntervalMs(paused: boolean, speedPercent: number): number`, `interface LoopClock { nextTickAt: number }`, `ticksDue(clock: LoopClock, now: number, intervalMs: number): number`.
- Produces (`src/ui/session.ts`, interface only): `type GameSpeed = 'normal' | 'x2' | 'x4' | 'fast'`, `type Locale = 'en' | 'es'`, `interface UiSnapshot { year: number; month: number; day: number; money: number; paused: boolean; speed: GameSpeed; locale: Locale; themeId: string; themes: readonly { id: string; name: string }[] }`, `interface UiSession { getSnapshot(): UiSnapshot; subscribe(listener: () => void): () => void; togglePause(): void; setSpeed(speed: GameSpeed): void; setLocale(locale: Locale): void; setTheme(id: string): void }`.
- Produces (`session.ts`): `class GameSession implements UiSession` with `constructor(state: GameState, locale: Locale, themes: readonly { id: string; name: string }[], themeId: string, onLocale: (l: Locale) => void, onTheme: (id: string) => void)`, `frame(now: number): void` (runs due ticks, notifies on change), `readonly state: GameState`.

- [ ] **Step 1: Write `src/ui/session.ts`** (the interface above, no logic) and the failing test `src/app/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_DRIFT,
  gameIntervalMs,
  MAX_TICKS_PER_FRAME,
  SPEED_PERCENT,
  ticksDue,
} from './loop';

describe('pacing (port of video_driver.cpp:GameLoop and GetGameInterval)', () => {
  it('uses 27 ms per tick at normal speed and when paused', () => {
    expect(gameIntervalMs(false, SPEED_PERCENT.normal)).toBe(27);
    expect(gameIntervalMs(true, SPEED_PERCENT.fast)).toBe(27);
    expect(gameIntervalMs(false, SPEED_PERCENT.fast)).toBeCloseTo(1.08);
  });

  it('runs one tick per elapsed interval', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 0, 27)).toBe(1);
    expect(ticksDue(clock, 26, 27)).toBe(0);
    expect(ticksDue(clock, 81, 27)).toBe(3);
    expect(clock.nextTickAt).toBe(108);
  });

  it('drops a backlog older than ALLOWED_DRIFT intervals', () => {
    const clock = { nextTickAt: 0 };
    const ticks = ticksDue(clock, 10_000, 27);
    expect(ticks).toBeLessThanOrEqual(ALLOWED_DRIFT + 1);
    expect(clock.nextTickAt).toBeGreaterThan(10_000);
  });

  it('never runs more than MAX_TICKS_PER_FRAME in one frame', () => {
    const clock = { nextTickAt: 0 };
    expect(ticksDue(clock, 100, 1.08)).toBe(MAX_TICKS_PER_FRAME);
  });
});
```

Run: `npx vitest run src/app` — Expected: FAIL, `./loop` not found.

- [ ] **Step 2: Implement `loop.ts`**

```ts
import type { GameSpeed } from '../ui/session';
export { MILLISECONDS_PER_TICK } from '../sim/core/constants';
import { MILLISECONDS_PER_TICK } from '../sim/core/constants';

/** Port of video_driver.hpp:ALLOWED_DRIFT. */
export const ALLOWED_DRIFT = 5;
/** Keeps a slow frame from running thousands of ticks (browser-only guard). */
export const MAX_TICKS_PER_FRAME = 32;

/** Game speed in percent (OpenTTD's _game_speed); 2500 is the default fast-forward limit. */
export const SPEED_PERCENT: Record<GameSpeed, number> = {
  normal: 100,
  x2: 200,
  x4: 400,
  fast: 2500,
};

/** Port of video_driver.hpp:GetGameInterval, in milliseconds. */
export function gameIntervalMs(paused: boolean, speedPercent: number): number {
  if (paused) return MILLISECONDS_PER_TICK;
  return (MILLISECONDS_PER_TICK * 100) / speedPercent;
}

export interface LoopClock {
  nextTickAt: number;
}

/** Ticks to run now. Port of video_driver.cpp:VideoDriver::GameLoop, called until caught up. */
export function ticksDue(clock: LoopClock, now: number, intervalMs: number): number {
  let ticks = 0;
  while (now >= clock.nextTickAt && ticks < MAX_TICKS_PER_FRAME) {
    clock.nextTickAt += intervalMs;
    if (clock.nextTickAt < now - ALLOWED_DRIFT * intervalMs) clock.nextTickAt = now;
    ticks++;
  }
  return ticks;
}
```

Run: `npx vitest run src/app` — Expected: 4 passed.

- [ ] **Step 3: Implement `session.ts`**

```ts
import { execute } from '../sim/command/command';
import { tick, type GameState } from '../sim/game';
import { convertDateToYMD } from '../sim/time/date';
import type { GameSpeed, Locale, UiSession, UiSnapshot } from '../ui/session';
import { gameIntervalMs, SPEED_PERCENT, ticksDue, type LoopClock } from './loop';

/** Owns the game state, runs ticks on time and feeds the UI. */
export class GameSession implements UiSession {
  private readonly listeners = new Set<() => void>();
  private readonly clock: LoopClock = { nextTickAt: 0 };
  private speed: GameSpeed = 'normal';
  private snapshot: UiSnapshot;

  constructor(
    readonly state: GameState,
    private locale: Locale,
    private readonly themes: readonly { id: string; name: string }[],
    private themeId: string,
    private readonly onLocale: (locale: Locale) => void,
    private readonly onTheme: (id: string) => void,
  ) {
    this.snapshot = this.buildSnapshot();
  }

  getSnapshot = (): UiSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  togglePause = (): void => {
    execute(this.state, { type: 'pause', paused: !this.state.paused }, 'exec');
    this.refresh();
  };

  setSpeed = (speed: GameSpeed): void => {
    this.speed = speed;
    this.refresh();
  };

  setLocale = (locale: Locale): void => {
    this.locale = locale;
    this.onLocale(locale);
    this.refresh();
  };

  setTheme = (id: string): void => {
    this.themeId = id;
    this.onTheme(id);
    this.refresh();
  };

  /** Called every animation frame. Re-renders the UI only when something visible changed. */
  frame(now: number): void {
    const interval = gameIntervalMs(this.state.paused, SPEED_PERCENT[this.speed]);
    const ticks = ticksDue(this.clock, now, interval);
    for (let i = 0; i < ticks; i++) tick(this.state);
    if (
      this.state.calendar.date !== this.lastDate ||
      this.state.company.money !== this.snapshot.money
    ) {
      this.refresh();
    }
  }

  private lastDate = -1;

  private buildSnapshot(): UiSnapshot {
    const { year, month, day } = convertDateToYMD(this.state.calendar.date);
    this.lastDate = this.state.calendar.date;
    return {
      year,
      month,
      day,
      money: this.state.company.money,
      paused: this.state.paused,
      speed: this.speed,
      locale: this.locale,
      themeId: this.themeId,
      themes: this.themes,
    };
  }

  private refresh(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }
}
```

The snapshot changes identity only when something visible changed (date, money, pause, speed, locale, theme), so Preact re-renders at most once per game day at normal speed.

- [ ] **Step 4: Commit** — `feat: pace ticks like OpenTTD and add the game session` (body: OpenTTD's interval and drift rule keep game speed honest; the per-frame cap protects slow phones; the session hides the sim from the UI behind `UiSession`. `Refs #N`). PR into the block branch.

---

### Task 7: Theme contract and the "blocks" theme

**Files:**

- Create: `src/render/theme.ts`, `src/render/theme.test.ts`, `public/themes/blocks/theme.json`, `public/themes/blocks/tokens.css`, `public/themes/blocks/sprites/*.svg`, `public/themes/index.json`

**Interfaces:**

- Produces: `SPRITE_IDS` (readonly tuple: `'terrain.void'`, `'terrain.grass.0'`…`'terrain.grass.3'`, `'terrain.unknown'`), `type SpriteId`, `interface Theme { id: string; name: string; author: string; license: string; tokens: string; sprites: Partial<Record<SpriteId, string>> }`, `parseTheme(json: unknown): Theme` (throws `Error` with a message naming the bad field), `resolveSprite(theme: Theme, fallback: Theme, id: SpriteId): string` (path relative to the theme folder, falls back to `fallback`, then to `terrain.unknown`), `THEMES_INDEX_PATH = 'themes/index.json'`.

- [ ] **Step 1: Write the failing test** (`src/render/theme.test.ts`):

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTheme, resolveSprite, SPRITE_IDS } from './theme';

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

describe('theme contract', () => {
  const blocks = parseTheme(read('public/themes/blocks/theme.json'));

  it('the default theme provides every sprite the game requests, and the files exist', () => {
    for (const id of SPRITE_IDS) {
      const file = blocks.sprites[id];
      expect(file, id).toBeDefined();
      expect(existsSync(`public/themes/blocks/${file}`), file).toBe(true);
    }
    expect(existsSync(`public/themes/blocks/${blocks.tokens}`)).toBe(true);
  });

  it('lists the built-in themes in the index', () => {
    expect(read('public/themes/index.json')).toEqual([{ id: 'blocks', path: 'themes/blocks/' }]);
  });

  it('rejects malformed themes with the bad field named', () => {
    expect(() => parseTheme({ id: 'x' })).toThrow(/name/);
    expect(() => parseTheme({ ...blocks, sprites: { 'terrain.grass.0': 7 } })).toThrow(/sprites/);
    expect(() => parseTheme({ ...blocks, sprites: { 'not.a.sprite': 'a.svg' } })).toThrow(
      /not\.a\.sprite/,
    );
    expect(() => parseTheme({ ...blocks, tokens: '../evil.css' })).toThrow(/tokens/);
  });

  it('falls back to the default theme, then to the unknown sprite', () => {
    const partial = parseTheme({ ...blocks, id: 'partial', sprites: {} });
    expect(resolveSprite(partial, blocks, 'terrain.grass.3')).toBe(
      blocks.sprites['terrain.grass.3'],
    );
    const empty = parseTheme({ ...blocks, id: 'empty', sprites: { 'terrain.unknown': 'u.svg' } });
    expect(resolveSprite(empty, empty, 'terrain.void')).toBe('u.svg');
  });
});
```

Run: `npx vitest run src/render/theme.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `src/render/theme.ts`**

```ts
/** Every logical sprite the game draws in block 1.1. Grows with each block. */
export const SPRITE_IDS = [
  'terrain.void',
  'terrain.grass.0',
  'terrain.grass.1',
  'terrain.grass.2',
  'terrain.grass.3',
  'terrain.unknown',
] as const;
export type SpriteId = (typeof SPRITE_IDS)[number];

export const THEMES_INDEX_PATH = 'themes/index.json';

export interface Theme {
  id: string;
  name: string;
  author: string;
  license: string;
  tokens: string;
  sprites: Partial<Record<SpriteId, string>>;
}

const SPRITE_ID_SET: ReadonlySet<string> = new Set(SPRITE_IDS);
/** Files stay inside the theme folder: no absolute paths, no "..", no URLs. */
const SAFE_PATH = /^(?!.*\.\.)[a-z0-9][a-z0-9._/-]*$/i;

function requireString(obj: Record<string, unknown>, field: string, path = false): string {
  const value = obj[field];
  if (typeof value !== 'string' || value === '' || (path && !SAFE_PATH.test(value))) {
    throw new Error(`Invalid theme field "${field}"`);
  }
  return value;
}

/** Validates an untrusted theme.json (master plan §2.10, §2.12). */
export function parseTheme(json: unknown): Theme {
  if (typeof json !== 'object' || json === null) throw new Error('Invalid theme: not an object');
  const obj = json as Record<string, unknown>;
  const id = requireString(obj, 'id');
  const name = requireString(obj, 'name');
  const author = requireString(obj, 'author');
  const license = requireString(obj, 'license');
  const tokens = requireString(obj, 'tokens', true);
  const sprites = obj['sprites'];
  if (typeof sprites !== 'object' || sprites === null)
    throw new Error('Invalid theme field "sprites"');
  const parsed: Partial<Record<SpriteId, string>> = {};
  for (const [id, file] of Object.entries(sprites)) {
    if (!SPRITE_ID_SET.has(id)) throw new Error(`Invalid theme sprite id "${id}"`);
    if (typeof file !== 'string' || !SAFE_PATH.test(file))
      throw new Error(`Invalid theme field "sprites.${id}"`);
    parsed[id as SpriteId] = file;
  }
  return { id, name, author, license, tokens, sprites: parsed };
}

/** The file for a sprite: the theme's, else the fallback theme's, else "terrain.unknown". */
export function resolveSprite(theme: Theme, fallback: Theme, id: SpriteId): string {
  return (
    theme.sprites[id] ??
    fallback.sprites[id] ??
    theme.sprites['terrain.unknown'] ??
    fallback.sprites['terrain.unknown'] ??
    ''
  );
}
```

- [ ] **Step 3: Write the "blocks" theme**

`public/themes/index.json`:

```json
[{ "id": "blocks", "path": "themes/blocks/" }]
```

`public/themes/blocks/theme.json`:

```json
{
  "id": "blocks",
  "name": "Blocks",
  "author": "openttd-web",
  "license": "GPL-2.0-or-later",
  "tokens": "tokens.css",
  "sprites": {
    "terrain.void": "sprites/void.svg",
    "terrain.grass.0": "sprites/grass-0.svg",
    "terrain.grass.1": "sprites/grass-1.svg",
    "terrain.grass.2": "sprites/grass-2.svg",
    "terrain.grass.3": "sprites/grass-3.svg",
    "terrain.unknown": "sprites/unknown.svg"
  }
}
```

Sprites are 64×64 SVGs. `grass-N.svg` (fill from bare to full green; a 1-px lighter border shows the grid so panning is visible):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#8fd18a"/>
  <rect x="0.5" y="0.5" width="63" height="63" fill="none" stroke="#a9e0a4" stroke-width="1"/>
</svg>
```

Fills: `grass-0` `#c9b38a`, `grass-1` `#b7c98a`, `grass-2` `#a3d18a`, `grass-3` `#8fd18a`. `void.svg`: solid `#1f2a33`. `unknown.svg`: magenta `#ff4fd8` with a white diagonal cross (visible on purpose).

`public/themes/blocks/tokens.css`:

```css
:root {
  --color-background: #bfe6c8;
  --color-panel: #fffaf2;
  --color-panel-border: #2d4a3e;
  --color-text: #2d4a3e;
  --color-accent: #ff8fab;
  --color-accent-text: #ffffff;
  --radius: 14px;
  --space: 8px;
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --touch-target: 44px;
}
```

Run: `npx vitest run src/render/theme.test.ts` — Expected: all passed.

- [ ] **Step 4: Commit** — `feat: add the theme contract and the blocks theme` (body: art comes only from themes, validated as untrusted input; the placeholder art is itself a theme so the contract is exercised from day one. `Refs #N`). PR into the block branch.

---

### Task 8: Chunked map rendering

**Files:**

- Create: `src/render/projection.ts`, `src/render/ground.ts`, `src/render/projection.test.ts`, `src/render/ground.test.ts`, `src/render/MapScene.ts`
- Delete: `src/render/BootScene.ts` (replaced by `MapScene`; keep its `data-game-ready` signal)

**Interfaces:**

- Consumes: `GameState`, `takeDirtyTiles` (Task 5), `Theme`, `resolveSprite`, `SPRITE_IDS` (Task 7).
- Produces (`projection.ts`): `TILE_PX = 64`, `CHUNK_TILES = 32`, `tileToWorld(x, y): { px: number; py: number }` (screen column = tile y, row = tile x), `worldToTile(px, py): { x: number; y: number }`, `chunkOfTile(x, y): { col: number; row: number }`, `visibleChunks(view: { x: number; y: number; width: number; height: number }, mapSizeX: number, mapSizeY: number): { col: number; row: number }[]` (one chunk margin, clamped to the map).
- Produces (`ground.ts`): `groundSprite(map: MapState, t: number): SpriteId`.
- Produces (`MapScene.ts`): `class MapScene extends Phaser.Scene` with `constructor(session: GameSession, theme: Theme, fallback: Theme, themeBase: string, fallbackBase: string)`; sets `data-game-ready="true"` on `<html>` after the first frame.

- [ ] **Step 1: Write the failing tests**

`src/render/projection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chunkOfTile, tileToWorld, visibleChunks, worldToTile } from './projection';

describe('top-down projection', () => {
  // OpenTTD's +x runs south-west and +y south-east; rotating the iso view by 45° puts
  // +x down and +y right, keeping (0,0) — the north corner — at the top-left.
  it('maps tile y to columns and tile x to rows', () => {
    expect(tileToWorld(3, 5)).toEqual({ px: 320, py: 192 });
    expect(worldToTile(320 + 10, 192 + 63)).toEqual({ x: 3, y: 5 });
  });

  it('groups tiles in 32×32 chunks', () => {
    expect(chunkOfTile(40, 70)).toEqual({ col: 2, row: 1 });
  });

  it('lists the visible chunks with one chunk of margin on every side', () => {
    const middle = visibleChunks({ x: 4096, y: 4096, width: 2048, height: 2048 }, 256, 256);
    expect(middle).toHaveLength(9);
    expect(middle).toContainEqual({ col: 1, row: 1 });
    expect(middle).toContainEqual({ col: 3, row: 3 });
  });

  it('clamps the margin to the map', () => {
    const corner = visibleChunks({ x: 0, y: 0, width: 2048, height: 2048 }, 256, 256);
    expect(corner).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ]);
  });
});
```

`src/render/ground.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGame } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { groundSprite } from './ground';

describe('ground sprites', () => {
  it('picks void, grass by density, and unknown otherwise', () => {
    const { map } = createGame({ mapLogX: 6, mapLogY: 6 });
    expect(groundSprite(map, tileXY(map, 0, 0))).toBe('terrain.void');
    const t = tileXY(map, 5, 5);
    expect(groundSprite(map, t)).toBe('terrain.grass.3');
    map.m5[t] = 1;
    expect(groundSprite(map, t)).toBe('terrain.grass.1');
    map.type[t] = 3 << 4; // house: not drawn by the ground layer yet
    expect(groundSprite(map, t)).toBe('terrain.unknown');
  });
});
```

Run: `npx vitest run src/render` — Expected: FAIL.

- [ ] **Step 2: Implement `projection.ts` and `ground.ts`**

```ts
// projection.ts
export const TILE_PX = 64;
export const CHUNK_TILES = 32;
const CHUNK_PX = TILE_PX * CHUNK_TILES;

export const tileToWorld = (x: number, y: number): { px: number; py: number } => ({
  px: y * TILE_PX,
  py: x * TILE_PX,
});

export const worldToTile = (px: number, py: number): { x: number; y: number } => ({
  x: Math.floor(py / TILE_PX),
  y: Math.floor(px / TILE_PX),
});

export const chunkOfTile = (x: number, y: number): { col: number; row: number } => ({
  col: Math.floor(y / CHUNK_TILES),
  row: Math.floor(x / CHUNK_TILES),
});

export function visibleChunks(
  view: { x: number; y: number; width: number; height: number },
  mapSizeX: number,
  mapSizeY: number,
): { col: number; row: number }[] {
  const maxCol = mapSizeY / CHUNK_TILES - 1;
  const maxRow = mapSizeX / CHUNK_TILES - 1;
  const c0 = Math.max(0, Math.floor(view.x / CHUNK_PX) - 1);
  const c1 = Math.min(maxCol, Math.floor((view.x + view.width - 1) / CHUNK_PX) + 1);
  const r0 = Math.max(0, Math.floor(view.y / CHUNK_PX) - 1);
  const r1 = Math.min(maxRow, Math.floor((view.y + view.height - 1) / CHUNK_PX) + 1);
  const chunks: { col: number; row: number }[] = [];
  for (let row = r0; row <= r1; row++)
    for (let col = c0; col <= c1; col++) chunks.push({ col, row });
  return chunks;
}
```

```ts
// ground.ts
import { getClearDensity, getClearGround, ClearGround } from '../sim/map/clear';
import { getTileType, TileType, type MapState } from '../sim/map/map';
import type { SpriteId } from './theme';

export function groundSprite(map: MapState, t: number): SpriteId {
  switch (getTileType(map, t)) {
    case TileType.Void:
      return 'terrain.void';
    case TileType.Clear:
      if (getClearGround(map, t) === ClearGround.Grass) {
        return `terrain.grass.${getClearDensity(map, t)}` as SpriteId;
      }
      return 'terrain.unknown';
    default:
      return 'terrain.unknown';
  }
}
```

Run: `npx vitest run src/render` — Expected: all passed.

- [ ] **Step 3: Implement `MapScene.ts`**

Behaviour (no unit test: verified by e2e in Task 11 and a screenshot):

- `preload()`: for every `SPRITE_IDS` entry, `this.load.svg(id, base + resolveSprite(theme, fallback, id), { width: TILE_PX, height: TILE_PX })`, where `base` is `themeBase` if the theme defines the sprite, else `fallbackBase`.
- `create()`: build a canvas texture `ground-atlas` of `TILE_PX * SPRITE_IDS.length` × `TILE_PX`, drawing sprite `i` at `x = i * TILE_PX` from `this.textures.get(id).getSourceImage()`; `refresh()` it. Set camera bounds to the map (`mapSizeY * TILE_PX` × `mapSizeX * TILE_PX`) and center it. Keep a `Map<string, { map: Phaser.Tilemaps.Tilemap; layer: Phaser.Tilemaps.TilemapLayer }>` of live chunks keyed `"col,row"`.
- `update()`: (a) compute `visibleChunks(camera.worldView, …)`; create missing chunks (`this.make.tilemap({ width: 32, height: 32, tileWidth: 64, tileHeight: 64 })`, `addTilesetImage('ground', 'ground-atlas', 64, 64, 0, 0)`, `createBlankLayer('g', tileset, col * 2048, row * 2048)`, fill each cell with `SPRITE_IDS.indexOf(groundSprite(map, t))`); destroy chunks no longer visible; (b) for each tile from `takeDirtyTiles(state)`, update its cell if its chunk is live; (c) after the first update, set `document.documentElement.dataset['gameReady'] = 'true'`.
- Cell → tile: in chunk `(col,row)`, cell `(cx, cy)` is tile `x = row * 32 + cy`, `y = col * 32 + cx` (inverse of `tileToWorld`).

- [ ] **Step 4: Commit** — `feat: draw the map in chunks from the active theme` (body: only visible 32×32 chunks exist, so large maps fit on phones; the top-down axes keep OpenTTD's north corner at the top-left. `Refs #N`). PR into the block branch. (The app is wired in Task 11; until then `main.ts` may construct `MapScene` with a fresh `GameSession` and the blocks theme so the build stays runnable.)

---

### Task 9: Mouse and touch camera

**Files:**

- Create: `src/render/camera.ts`, `src/render/camera.test.ts`
- Modify: `src/render/MapScene.ts`, `src/ui/styles.css`

**Interfaces:**

- Produces: `MIN_ZOOM = 0.25`, `MAX_ZOOM = 2`, `clampZoom(z: number): number`, `wheelZoom(zoom: number, deltaY: number): number` (each 100 px of wheel = ×1.2 or ÷1.2, clamped), `pinchZoom(startZoom: number, startDistance: number, distance: number): number` (clamped).
- `MapScene` writes `data-camera-x`, `data-camera-y`, `data-camera-zoom` on `#game` whenever they change (rounded to 2 decimals) — used by e2e.

- [ ] **Step 1: Failing test** (`src/render/camera.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, pinchZoom, wheelZoom } from './camera';

describe('camera math', () => {
  it('clamps zoom', () => {
    expect([clampZoom(0.1), clampZoom(1), clampZoom(9)]).toEqual([MIN_ZOOM, 1, MAX_ZOOM]);
  });

  it('zooms by 1.2 per 100 px of wheel, scrolling up zooms in', () => {
    expect(wheelZoom(1, -100)).toBeCloseTo(1.2);
    expect(wheelZoom(1, 100)).toBeCloseTo(1 / 1.2);
    expect(wheelZoom(MAX_ZOOM, -100)).toBe(MAX_ZOOM);
  });

  it('scales zoom with the distance between two fingers', () => {
    expect(pinchZoom(1, 100, 150)).toBeCloseTo(1.5);
    expect(pinchZoom(1, 100, 10)).toBe(MIN_ZOOM);
  });
});
```

Run: `npx vitest run src/render/camera.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `camera.ts`**

```ts
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const wheelZoom = (zoom: number, deltaY: number): number =>
  clampZoom(zoom * Math.pow(1.2, -deltaY / 100));

export const pinchZoom = (startZoom: number, startDistance: number, distance: number): number =>
  clampZoom((startZoom * distance) / startDistance);
```

- [ ] **Step 3: Input in `MapScene`**

- `this.input.addPointer(1)` (two touches).
- One pointer down and moving: `camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom`, same for y.
- Two pointers down: on start store `startZoom` and `startDistance` (`Phaser.Math.Distance.Between`); on move apply `pinchZoom` around the midpoint.
- Wheel: `this.input.on('wheel', (pointer, _objs, _dx, dy) => zoomAt(pointer.x, pointer.y, wheelZoom(camera.zoom, dy)))`.
- `zoomAt(sx, sy, z)`: `const before = camera.getWorldPoint(sx, sy); camera.setZoom(z); camera.preRender(); const after = camera.getWorldPoint(sx, sy); camera.scrollX += before.x - after.x; camera.scrollY += before.y - after.y;`
- Add to `src/ui/styles.css`: `#game { touch-action: none; }` so the browser does not zoom the page.

- [ ] **Step 4: Commit** — `feat: pan and zoom the map with mouse and fingers` (body: zoom keeps the point under the cursor or fingers fixed; `touch-action: none` hands pinch gestures to the game. `Refs #N`). PR into the block branch.

---

### Task 10: Translations and formatting

**Files:**

- Create: `src/ui/i18n/en.json`, `src/ui/i18n/es.json`, `src/ui/i18n/i18n.ts`, `src/ui/i18n/i18n.test.ts`
- Modify: `tsconfig.json` (`"resolveJsonModule": true`)

**Interfaces:**

- Produces: `type MessageKey = keyof typeof en`, `LOCALES: readonly Locale[]` (`['en', 'es']`), `detectLocale(languages: readonly string[]): Locale`, `loadLocale(storage: Pick<Storage, 'getItem'> | undefined, languages: readonly string[]): Locale`, `saveLocale(storage: Pick<Storage, 'setItem'> | undefined, locale: Locale): void` (never throws), `translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string`, `formatMoney(locale: Locale, pounds: number): string`, `formatDate(locale: Locale, year: number, month: number, day: number): string`, `LOCALE_STORAGE_KEY = 'openttd-web.locale'`.

- [ ] **Step 1: Write the locale files**

`en.json`:

```json
{
  "hud.pause": "Pause",
  "hud.resume": "Resume",
  "hud.speed": "Game speed",
  "hud.speed.normal": "Normal speed",
  "hud.speed.x2": "Double speed",
  "hud.speed.x4": "Four times speed",
  "hud.speed.fast": "Fast forward",
  "hud.money": "Money",
  "hud.date": "Date",
  "hud.settings": "Settings",
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "panel.close": "Close",
  "language.en": "English",
  "language.es": "Español",
  "error.notAllowedWhilePaused": "Not allowed while paused"
}
```

`es.json`: same keys — "Pausa", "Reanudar", "Velocidad del juego", "Velocidad normal", "Velocidad doble", "Velocidad cuádruple", "Avance rápido", "Dinero", "Fecha", "Ajustes", "Ajustes", "Idioma", "Tema", "Cerrar", "English", "Español", "No permitido en pausa".

- [ ] **Step 2: Failing test** (`src/ui/i18n/i18n.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import { detectLocale, formatDate, formatMoney, loadLocale, saveLocale, translate } from './i18n';

describe('translations', () => {
  it('ships Spanish with exactly the English keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates', () => {
    expect(translate('es', 'settings.title')).toBe('Ajustes');
    expect(translate('en', 'hud.pause')).toBe('Pause');
  });

  it('detects Spanish from any es-* browser language, English otherwise', () => {
    expect(detectLocale(['es-CL', 'en'])).toBe('es');
    expect(detectLocale(['fr-FR'])).toBe('en');
  });

  it('remembers the choice, and survives storage that throws', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    saveLocale(storage, 'es');
    expect(loadLocale(storage, ['en'])).toBe('es');
    const broken = {
      getItem: (): string => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('blocked');
      },
    };
    expect(() => saveLocale(broken, 'es')).not.toThrow();
    expect(loadLocale(broken, ['es-AR'])).toBe('es');
  });

  it('formats pounds without decimals and dates in the locale', () => {
    expect(formatMoney('en', 100000)).toBe('£100,000');
    expect(formatMoney('es', 100000)).toMatch(/100\.000\s?£/);
    expect(formatDate('en', 1950, 0, 1)).toMatch(/1950/);
    expect(formatDate('es', 1950, 0, 1)).toMatch(/ene/);
  });
});
```

Run: `npx vitest run src/ui/i18n` — Expected: FAIL.

- [ ] **Step 3: Implement `i18n.ts`**

```ts
import en from './en.json';
import es from './es.json';
import type { Locale } from '../session';

export type MessageKey = keyof typeof en;
export const LOCALES: readonly Locale[] = ['en', 'es'];
export const LOCALE_STORAGE_KEY = 'openttd-web.locale';
const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, es };

export function detectLocale(languages: readonly string[]): Locale {
  return languages.some((l) => l.toLowerCase().startsWith('es')) ? 'es' : 'en';
}

export function loadLocale(
  storage: Pick<Storage, 'getItem'> | undefined,
  languages: readonly string[],
): Locale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Storage blocked (private mode): fall back to the browser language.
  }
  return detectLocale(languages);
}

export function saveLocale(storage: Pick<Storage, 'setItem'> | undefined, locale: Locale): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies to this session.
  }
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const text = MESSAGES[locale][key] ?? MESSAGES.en[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}

export function formatMoney(locale: Locale, pounds: number): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'es', {
    style: 'currency',
    currency: 'GBP',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(pounds);
}

export function formatDate(locale: Locale, year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month, day));
}
```

Run: `npx vitest run src/ui/i18n` — Expected: all passed.

- [ ] **Step 4: Commit** — `feat: add English and Spanish translations` (body: no user-facing text in code; Spanish must keep every English key; storage failures never break the language switch. `Refs #N`). PR into the block branch.

---

### Task 11: HUD shell and app wiring

**Files:**

- Create: `src/ui/App.tsx`, `src/ui/StatusBar.tsx`, `src/ui/Panel.tsx`, `src/ui/Settings.tsx`, `src/ui/useSnapshot.ts`, `src/ui/StatusBar.test.tsx`, `src/app/theme-loader.ts`, `tests/e2e/hud.spec.ts`, `tests/e2e/camera.spec.ts`
- Modify: `src/app/main.ts`, `index.html`, `src/ui/styles.css`, `tsconfig.json`, `package.json`, `playwright.config.ts`, `vitest.config.ts`

**Interfaces:**

- Consumes: everything above.
- Produces: `App({ session }: { session: UiSession })`; `#ui` overlay; `loadThemes(): Promise<{ themes: Theme[]; fallback: Theme }>` and `applyTokens(theme: Theme, base: string)` in `theme-loader.ts` (sets `<link id="theme-tokens">`).

- [ ] **Step 1: Dependencies and config**

```bash
npm install preact@^11.0.1
npm install -D happy-dom@^20 @testing-library/preact@^3.2.4
```

`tsconfig.json`: add `"jsx": "react-jsx"`, `"jsxImportSource": "preact"`, `"resolveJsonModule": true` (if not added in Task 10). `vitest.config.ts`: include `src/**/*.test.tsx`. `index.html`: add `<div id="ui"></div>` after `#game`.

- [ ] **Step 2: Failing component test** (`src/ui/StatusBar.test.tsx`):

```tsx
// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { UiSession, UiSnapshot } from './session';
import { StatusBar } from './StatusBar';

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
};

function fakeSession(s: UiSnapshot): UiSession {
  return {
    getSnapshot: () => s,
    subscribe: () => () => undefined,
    togglePause: vi.fn(),
    setSpeed: vi.fn(),
    setLocale: vi.fn(),
    setTheme: vi.fn(),
  };
}

describe('StatusBar', () => {
  it('shows date and money in the current language', () => {
    render(
      <StatusBar
        session={fakeSession(snapshot)}
        snapshot={snapshot}
        onSettings={() => undefined}
      />,
    );
    expect(screen.getByText('£100,000')).toBeTruthy();
    expect(screen.getByText(/1950/)).toBeTruthy();
  });

  it('pauses and changes speed through the session', () => {
    const session = fakeSession(snapshot);
    render(<StatusBar session={session} snapshot={snapshot} onSettings={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fast forward' }));
    expect(session.togglePause).toHaveBeenCalled();
    expect(session.setSpeed).toHaveBeenCalledWith('fast');
  });
});
```

Run: `npx vitest run src/ui/StatusBar.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Components**

- `useSnapshot(session)`: `useState(session.getSnapshot())` + `useEffect(() => session.subscribe(() => set(session.getSnapshot())), [session])`.
- `StatusBar({ session, snapshot, onSettings })`: `<header class="status-bar">` with the formatted date (`aria-label` = `hud.date`), money (`hud.money`), a pause button (`aria-pressed={paused}`, label `hud.pause` / `hud.resume`), four speed buttons (`aria-pressed` on the active one, labels `hud.speed.*`), and a settings button (`hud.settings`). Every label through `translate(snapshot.locale, …)`.
- `Panel({ title, onClose, children, closeLabel })`: `<section class="panel" role="dialog" aria-label={title}>` with a header and a close button. CSS decides the look: floating window at ≥ 768 px, bottom sheet below.
- `Settings({ session, snapshot })`: language `<select>` (options `language.en`, `language.es`) calling `setLocale`, theme `<select>` from `snapshot.themes` calling `setTheme`.
- `App({ session })`: status bar + settings panel toggle.
- `src/ui/styles.css`: `#ui { position: fixed; inset: 0; pointer-events: none; font-family: var(--font); color: var(--color-text); }`, children with `pointer-events: auto`; `.status-bar` top bar on wide screens, bottom bar under `@media (max-width: 767px)` with `padding-bottom: env(safe-area-inset-bottom)`; buttons `min-width/min-height: var(--touch-target)`; `.panel` rules for both layouts using the tokens.

Run: `npx vitest run src/ui` — Expected: all passed.

- [ ] **Step 4: Wire `src/app/main.ts`**

1. `const { themes, fallback } = await loadThemes()` (fetch `themes/index.json`, then each `theme.json` through `parseTheme`; skip a theme that fails to parse, but never the fallback `blocks`).
2. `const locale = loadLocale(localStorage-or-undefined, navigator.languages)`; set `document.documentElement.lang = locale`.
3. `const state = createGame()`; `const session = new GameSession(state, locale, themes.map(t => ({ id: t.id, name: t.name })), 'blocks', onLocale, onTheme)` where `onLocale` saves the locale and sets `lang`, and `onTheme` applies tokens (sprites switch on reload, acceptable for block 1.1).
4. Start Phaser with `new MapScene(session, theme, fallback, base, fallbackBase)`; `render(<App session={session} />, document.getElementById('ui')!)` (`main.ts` → `main.tsx`; update `index.html`).
5. `requestAnimationFrame` loop calling `session.frame(performance.now())`.

Wrap `localStorage` access in `try/catch` (accessing it can throw).

- [ ] **Step 5: e2e on desktop and phone** — `playwright.config.ts`: add a project `phone` (`devices['Pixel 7']`, `hasTouch: true`, `isMobile: true`, same `channel` rule as desktop). `tests/e2e/hud.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('shows the starting date and money', async ({ page }) => {
  await expect(page.getByLabel('Money')).toHaveText('£100,000');
  await expect(page.getByLabel('Date')).toContainText('1950');
});

test('the calendar runs and can be paused', async ({ page }) => {
  const date = page.getByLabel('Date');
  const start = await date.textContent();
  await expect(date).not.toHaveText(start ?? '', { timeout: 6000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await date.textContent();
  await page.waitForTimeout(2500);
  await expect(date).toHaveText(paused ?? '');
});

test('switches to Spanish', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
});
```

`tests/e2e/camera.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('hands touch gestures to the game', async ({ page }) => {
  await expect(page.locator('#game')).toHaveCSS('touch-action', 'none');
});

test('drag pans and wheel zooms (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  const game = page.locator('#game');
  const x0 = await game.getAttribute('data-camera-x');
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 5 });
  await page.mouse.up();
  await expect(game).not.toHaveAttribute('data-camera-x', x0 ?? '');
  const z0 = await game.getAttribute('data-camera-zoom');
  await page.mouse.wheel(0, -300);
  await expect(game).not.toHaveAttribute('data-camera-zoom', z0 ?? '');
});
```

Keep `boot.spec.ts` (both projects). Run: `npm run test:e2e` — Expected: all passed on both projects. Take screenshots on desktop and phone and look at them.

- [ ] **Step 6: Commit** — `feat: add the HUD shell for desktop and phone` (body: date, money, pause, speed and settings; one markup, two layouts; the UI only talks to `UiSession`. `Refs #N`). PR into the block branch.

---

### Task 12: Evaluate reusing OpenTTD translations

Research spike; output is a report, the script is kept as a tool.

**Files:**

- Create: `tools/openttd-strings.mjs`, `docs/reference/translations.md`

- [ ] **Step 1: Script** — `node tools/openttd-strings.mjs <path-to-reference/OpenTTD/src/lang>` reads `english.txt` and every other `*.txt`, and for each English string in a candidate list (the values of our `en.json`) finds OpenTTD string ids whose English text matches case-insensitively, then reports, per language, how many of our keys have a translation. Lines in OpenTTD lang files look like `STR_GAME_OPTIONS_CAPTION                                         :Game Options`; skip `##` metadata and `{...}` control codes. No dependencies.

- [ ] **Step 2: Report** `docs/reference/translations.md`: coverage table (languages × matched keys), examples of exact matches, and a recommendation: reuse (with GPL attribution and a generated mapping file) if most HUD strings match, otherwise keep `en`/`es` and revisit with the larger UI of block 1.3.

- [ ] **Step 3: Commit** — `docs: evaluate reusing OpenTTD translations`. PR into the block branch.

---

### Task 13: Close block 1.1

- [ ] **Step 1: Playtest guide** `docs/game/block-1.1.md` (English): what is new (empty map, calendar, pause and speed, language and theme settings), what to try on the phone (drag, pinch, speeds, Spanish), what is not there yet, and how to report findings (an issue with label `playtest`).
- [ ] **Step 2: TRACKING** — mark block 1.1 tasks `[x]`.
- [ ] **Step 3: Commit, PR into the block branch, merge**; wait for the preview deploy; screenshot `…/preview/block-1-1/` on a phone viewport.
- [ ] **Step 4: Notify the author** (push notification): preview link + guide link. Start block 1.2.
