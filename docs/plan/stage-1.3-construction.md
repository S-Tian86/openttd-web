# Stage 1.3 — Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player build and demolish like in OpenTTD — rail track with the autorail drag, train depots, rail stations, level crossings over town roads, the bulldozer for single tiles and areas — paying OpenTTD's prices from the company's cash, borrowing from the bank, and seeing a green or red ghost with the total cost before building, on desktop and phone, deployed to a preview URL for the author's playtest.

**Architecture:** `src/sim/` gains the command pipeline of `command.cpp` (pause check, test run, money check, exec run, money subtraction) and one module per OpenTTD command family, each a port of its C++ function with OpenTTD's tile bit layouts: prices (`economy/prices.ts`), loans (`economy/loan.ts`), the bulldozer (`map/clear-tile.ts` = `CmdLandscapeClear` + `CmdClearArea` + the `ClearTile_*` procs; `town/house-removal.ts`, `town/road-removal.ts`), rail (`track/rail-cmd.ts`), depots (`track/depot.ts`), stations (`station/*`). `src/app/` ports the viewport drag machinery (`autorail.ts`) and turns a pointer gesture into one command plus a ghost (`construction.ts`); the session runs the command in test mode while dragging and in exec mode on release (mouse) or on Confirm (touch). `src/render/` draws rail, depots, stations and crossings through new theme sprites and a ghost layer; `src/ui/` adds the construction toolbar, the cost bar with Confirm, OpenTTD-style error messages and the finances (loan) window.

**Tech Stack:** unchanged — TypeScript 7, Vite 8, Phaser 4.2, Preact 11, Vitest 5 (+ happy-dom, @testing-library/preact), Playwright 1.64, oxlint. No new dependencies.

**Spec:** [`stage-1-first-train.md`](stage-1-first-train.md) — §2 (D2, D4, D8, D9), §3, §4 (construction preview, pause rule, themes), §5 (tools, phone gestures, confirm button), §6 block 1.3, §7. Sources (rules, prices, bit layouts, error texts): [`construction.md`](../reference/openttd/construction.md), [`track.md`](../reference/openttd/track.md), [`stations-cargo.md`](../reference/openttd/stations-cargo.md) §4.1–4.3, [`roads.md`](../reference/openttd/roads.md) §3, §4.1–4.3, §4.12–4.13, [`economy.md`](../reference/openttd/economy.md) §4.2, §4.7, §4.8, [`towns-industries.md`](../reference/openttd/towns-industries.md), [`map.md`](../reference/openttd/map.md). The C++ is in `reference/OpenTTD/src` (read it with absolute paths; never `cd` into `reference/`). Each task names the note section and the `file:function` it ports; read both before writing code.

## Global Constraints

Project rules (from blocks 1.1 and 1.2, still binding):

- Everything committed is in English; ported code cites `// Port of <file>:<function>` (OpenTTD 15.3).
- Host: project port **4317**, e2e base `/openttd-web/`, two Playwright projects (`chromium` desktop, `phone` Pixel 7 touch). Local hosts are Ubuntu 20.04 with git 2.25 and use the installed Google Chrome for e2e. Never stop processes by name pattern; stop them by PID.
- `src/sim/` imports nothing from Phaser, DOM, Node, `render/`, `ui/`, `app/`; no `Math.random`, `Date`, timers, `performance` (oxlint + `tsconfig.sim.json`). Test files under `src/sim/` follow the same rules.
- `ui/` never imports `app/`, `render/` or Phaser; `render/` never imports `app/` or `ui/` (lint-enforced). `ui/` may import types, constants and query functions from `sim/`. `app/` may import everything.
- Integer arithmetic in `src/sim/`; C++ integer division truncates (`Math.trunc`), `>>` on money is a floor (`Math.floor(x / 2 ** n)` when `x` may exceed 32 bits). Money is a JS `number` (D8).
- Lint/TS lessons: Phaser through named imports; no helper functions declared inside tests (unicorn/consistent-function-scoping) — module scope only; `toThrow(...)` always with a message or regex; no `.sort()` (use `toSorted`). TS 7 strict with `noUncheckedIndexedAccess` (an index into a `Record`/array is `T | undefined`), `exactOptionalPropertyTypes` (optional properties are omitted, never set to `undefined`; prefer `T | null` fields), `verbatimModuleSyntax` (`import type` for types). `tests/` is type-checked by `tests/tsconfig.json`.
- Workflow (spec §7): the controller creates each task's issue and `feat/…` branch; every task opens its PR **into `stage-1/block-1.3`**. Conventional commits, body explains why, `Refs #N` (the controller fills `N`), no co-authorship trailers.
- No new dependencies. Every user-facing string is an i18n key; `en.json` and `es.json` always have the same keys (Spanish from OpenTTD's `lang/spanish.txt` where it has the string). Town names are proper nouns and are not translated.
- `INVALID_TILE` is `-1` in the port.

Rulings of block 1.2 (still binding, see [`stage-1.2-world.md`](stage-1.2-world.md)): **R1** draws with no effect on a Stage 1 map are not replicated, every draw whose result is stored is kept · **R2** two-level height model, sea from `ConvertGroundTilesIntoWaterTiles` · **R3** TGP floats as in C++ · **R4** `TL_ORIGINAL`, towns do not grow during play · **R5** only normal town road tiles until this block · **R6** coal mines and power stations only · **R7** sprites only through `SPRITE_IDS` and the "blocks" theme; the coverage test keeps passing · **R8** UI reads through `sim/query.ts` · **R9** exact values where the notes give them · **R10** full temperate industry table · **R11** nothing is built on slopes in Stage 1 · **R12** a failed generation keeps the world · **R13** property wording · **R14** `?seed=&size=&tile=` start parameters and `data-world-hash`.

Controller rulings for this block (binding):

- **R15 Town ratings** are not tracked in Stage 1: wherever OpenTTD's gates read the company's per-town rating, use the constant `RATING_INITIAL = 500` and apply no rating change (tree, house and road removal; `CheckIfAuthorityAllowsNewStation`). Listed in `differences.md` (Stage 2 ports ratings).
- **R16** Player rail over a town road stub (one road piece) is allowed with OpenTTD's cost (`CmdBuildSingleRail` crossing branch or the `Auto` clear of a one-piece road); no rating effect (R15).
- **R17** Port OpenTTD's code where it contradicts its comments (D9): the rail-station length-price counter (`CalculateRailStationCost`), the drag `had_success` lag (`CmdRailTrackHelper`), and any similar case a task names. (Crossings are not one of them: R33 decides them.)
- **R18 Station joining:** a new station joins the single adjacent own station, otherwise creates a new one (`station_to_join = NEW_STATION`, `adjacent = false`); distant join and Ctrl adjacent creation are out of scope (listed in `differences.md`). `station_spread = 12`.
- **R19** Both station removal tools ship: the bulldozer removes the whole station (`RemoveRailStation`); the station tool in remove mode removes tiles (`CmdRemoveFromRailStation`, `keep_rail = false`).
- **R20 Touch drags:** map press = finger-down point, release = finger-up point (sub-tile positions included), so the autorail piece for a given start/end matches OpenTTD's mouse semantics; on phones (touch input) the build stays a preview until a Confirm button (spec §4).
- **R21** Clearing sea is allowed at OpenTTD's cost (£7,500); the sea floods flat height-0 tiles again as in OpenTTD (`DoFloodTile` clears whatever stands there as `OWNER_WATER`).
- **R22** Area demolition estimate = the test-phase sum (as OpenTTD's estimate); execution pays tile by tile and stops at the first unaffordable tile, as `CmdClearArea` does.
- **R23** No track reservation (no signals until Stage 3): reservation bits stay 0 and reservation code is not ported.
- **R24** While paused, construction and loan commands are refused (`command_pause_level = 1`) with OpenTTD's error, shown in the UI.
- **R25 Money:** each command's exec deducts its cost from `company.money` after the test-phase `CheckCompanyHasMoney`, exactly as `command.cpp`; error "Not enough cash - requires £X" via i18n with the amount; the loan window (borrow/repay `LOAN_INTERVAL`, Ctrl+click or long press for max/all as in `company_gui.cpp`) per economy.md §4.8. Every charge is booked into `company.yearlyExpenses[0][expenseType]` so block 1.5 only rotates and shows them.

Rulings this plan needed beyond R1–R25 (flagged to the controller):

- **R26 Slopes (extends D4/R11):** rail pieces, depots and station tiles on any non-flat tile are refused with `STR_ERROR_FLAT_LAND_REQUIRED` ("Flat land required") where OpenTTD would add a foundation (coast tiles included); a flat sea tile refuses rail with "... can't build on water" as `CheckRailSlope` does.
- **R27 Company name:** `GenerateCompanyName` is not ported; owner lines show "Your company" / "Tu empresa". Listed in `differences.md`.
- **R28 Clearing limit:** `clear_limit` is ported (burst 4096 tiles, +64 per tick, also while paused, one tile per executed non-`Auto` clear by the company, including nested clears).
- **R29 Station bookkeeping:** stations are rail-only, so `Station::rect` is the `train_station` area (one field, same results). The station `random_bits` draw (`AddFacility`) and the per-tile `GB(Random(), 0, 4)` draws are kept (stored state, R1). `OnTick_Station`'s small-tick counter and big-tick deletion of unused stations are ported now; the rating and acceptance calls they make are block 1.5.
- **R30 Construction input:** with a build tool on, a one-pointer drag (left mouse or one finger) is a construction gesture; two fingers pinch-zoom and pan; right/middle mouse drag pans; long-press query is off while a build tool is on; a mouse hovering shows the single-tile ghost (OpenTTD's autorail highlight); the mouse builds on release (OpenTTD builds depots on press — not observable), touch on Confirm.
- **R31 Ghost colour:** green when the command's test run succeeds and the company can pay (`cost <= 0 || cost <= money`), red otherwise; the cost bar shows the test cost (an estimate for area demolition, R22) or the error that would be shown.
- **R32 Track ground:** `TileLoop_Track` (barren → grass, fences) is ported because it is map state; fences are stored but not drawn until the art block (1.6).
- **R33 Town roads stay (controller decision, D2 binds):** the player cannot remove town roads. The company's bulldozer (single tile and `CmdClearArea`) refuses a town-owned road tile with `STR_ERROR_LOCAL_AUTHORITY_REFUSES_TO_ALLOW_THIS` ("{TOWN} local authority refuses to allow this", param `town`) and leaves it untouched; in an area it is a failed tile (silent unless nothing succeeded). Bulldozing a level crossing removes only the rail, exactly like the remove-rail tool on it (`CmdRemoveSingleRail`, £53 refund): the tile becomes the town's normal road again. Builders' `Auto` clears keep OpenTTD's rules (R16 stub removal for rail stays), and non-company actors (the sea, towns) keep OpenTTD's road removal. Listed in `differences.md` (Stage 2 with town ratings).

New rules for this block:

- **Command shape:** every command is a function `(state, flags, …args) => CommandCost` where `flags` is a `DoFlag` bitmask (`Execute`, `Auto`, `NoWater`, `ForceClearTile`) and nested commands are called directly with the caller's flags, as `Command<>::Do`. Commands issued through `execute` run as the player's company `COMPANY_FIRST = 0`; flooding runs as `OWNER_WATER`. A command on a tile outside the map or a void tile returns `CMD_ERROR` (no message) before anything else (`CommandHelper::Do`), using `isValidTile`.
- **Test mode never mutates:** no map write, no random draw, no money, no pool change unless `flags & DoFlag.Execute`. Every command task has a test that `execute(…, 'test')` leaves `hashGameState` unchanged.
- **Dirty tiles:** every executed map change adds the tile to `state.dirtyTiles`.
- **Prices** come from `state.prices` (never a literal £ amount in `src/sim/` code; tests use literals).
- **Import cycles:** `map/clear-tile.ts` ↔ `track/rail-cmd.ts` ↔ `track/depot.ts` ↔ `station/*` ↔ `town/road-removal.ts` call each other (as OpenTTD's tile procs do). They may only use each other's exports inside functions, never at module top level.
- **Hash:** `hashGameState` covers every new persistent field; empty collections add no bytes, so `GOLDEN_64_SEED_1` is re-pinned once (Task 1) and stays after that.
- **Error keys** live in `ERROR_KEYS` (`src/sim/command/cost.ts`); a UI test fails if `en.json` lacks one. Error params are numbers: `money` (formatted as currency by the UI), `industry` (an industry index, shown by name) and `town` (a town index, shown by name). Every `{placeholder}` in an error string has the name of its param.

## Review Focus

1. **A phone drag that builds the wrong piece, or builds at all before Confirm:** the finger-down and finger-up points must give exactly the piece and end tile OpenTTD's mouse would (R20), a two-finger pinch must never build, and nothing may change until Confirm, which must execute the previewed command. Pinned in Task 8 (`calcRaildirsDrawstyle` values for press/release sub-tile points, incl. the 2×1 and staircase cases), Task 9 (`buildPointerAction` sends two fingers to pinch), Task 10 (session: a touch `end` builds nothing, `confirmBuild` runs the same command; e2e phone drag checks `data-last-command`).
2. **Money going negative through a drag:** a rail drag is all-or-nothing against the total; a demolition area pays tile by tile and stops before the balance would go below zero; repaying the loan never takes more than the cash. Pinned in Task 1 (exact cash allowed, £1 more refused), Task 3 (5-tile drag with £449 refused, nothing built, money unchanged), Task 2 (rocks area with £300 clears two tiles and stops at £0; with £100 fails "requires £150"), Task 11 (repay max with £95,500 leaves £5,500).
3. **Demolishing a town into nothing:** with ratings constant (R15) every house can be bulldozed, but the town's roads cannot (R33), so a town can lose its houses but never be cut into pieces; the town must survive with population 0, no houses, the smallest zones and its church/stadium flags cleared, its roads intact, and its window and the tile loop must keep working. Pinned in Task 2 (clear area over a whole town including a road: the road stays; 1,000 ticks afterwards), Task 4 (bulldozing a crossing leaves the road) and Task 12 (town window shows `Population: 0`).
4. **Building while paused:** every construction and loan command is refused with "Not allowed while paused", nothing changes, and the UI says why; pause itself stays allowed. Pinned in Task 1 (pause levels, loans), Task 10 (session error and red ghost while paused; e2e pause then build), Task 11 (borrow while paused).
5. **A station drag joining the wrong station:** a drag touching two of the company's stations (diagonal neighbours included) must fail "Adjoins more than one existing station", one neighbour must be joined, a station two tiles away must be separate, a join beyond 12 tiles must fail "station too spread out", and building over one's own platform must extend that station. Pinned in Task 6.

---

## File map

| Path                                                                                                                                                                                                                | Responsibility                                                           | Task |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| `src/sim/economy/prices.ts`, `src/sim/economy/loan.ts`, `src/sim/command/cost.ts` (+ tests), `src/sim/economy/company.ts`, `src/sim/command/command.ts`, `src/sim/map/map.ts`, `src/sim/game.ts`                    | Prices, company money, expenses, clearing limit, loans, command pipeline | 1    |
| `src/sim/map/tile-area.ts`, `src/sim/map/clear-tile.ts`, `src/sim/town/house-removal.ts`, `src/sim/town/road-removal.ts` (+ tests), `src/sim/town/house-specs.ts`, `src/sim/map/flood.ts`, `src/sim/world/trees.ts` | Bulldozer: `CmdLandscapeClear`, `CmdClearArea`, natural/house/road procs | 2    |
| `src/sim/track/track.ts`, `src/sim/map/rail-map.ts`, `src/sim/track/rail-cmd.ts` (+ tests)                                                                                                                          | Track geometry, rail tiles, single and drag build/remove, track loop     | 3    |
| `src/sim/map/road-map.ts`, `src/sim/track/rail-cmd.ts`, `src/sim/town/road-removal.ts`, `src/sim/town/town.ts`, `src/sim/track/crossing.test.ts`, `src/render/ground.ts`                                            | Level crossings                                                          | 4    |
| `src/sim/track/depot.ts` (+ test), `src/sim/track/rail-cmd.ts`, `src/sim/game.ts`                                                                                                                                   | Train depots, depot names, follow-up rails                               | 5    |
| `src/sim/map/station-map.ts`, `src/sim/station/station.ts`, `src/sim/station/station-name.ts`, `src/sim/station/build-station.ts` (+ tests), `src/sim/game.ts`                                                      | Rail station tiles, building, joining, naming                            | 6    |
| `src/sim/station/remove-station.ts` (+ test), `src/sim/map/clear-tile.ts`, `src/sim/game.ts`                                                                                                                        | Station removal, unused-station deletion                                 | 7    |
| `src/app/autorail.ts`, `src/app/construction.ts` (+ tests)                                                                                                                                                          | Autorail drag semantics, gesture → command + ghost                       | 8    |
| `src/render/preview.ts`, `src/render/theme.ts`, `src/render/ground.ts`, `src/render/objects.ts`, `src/render/projection.ts`, `src/render/gesture.ts` (+ tests), `src/render/MapScene.ts`, `tools/blocks-theme.mjs`  | Construction sprites, ghost layer, build gestures on the map             | 9    |
| `src/ui/Toolbar.tsx`, `src/ui/BuildBar.tsx`, `src/ui/ErrorMessage.tsx`, `src/ui/errors.ts`, `src/ui/session.ts`, `src/app/session.ts`, `src/app/main.tsx`, `src/ui/App.tsx`, `tests/e2e/*`                          | Construction tools, cost bar, Confirm, errors                            | 10   |
| `src/ui/FinancesWindow.tsx` (+ test), `src/ui/session.ts`, `src/app/session.ts`, `tests/e2e/finances.spec.ts`                                                                                                       | Finances window with the loan                                            | 11   |
| `src/sim/query.ts` (+ test), `src/ui/TileInfo.tsx`, `src/ui/names.ts`, `src/app/session.ts`                                                                                                                         | Query tool for rail, depots, stations, crossings, cost to clear          | 12   |
| `docs/game/block-1.3.md`, `docs/game/differences.md`, `docs/plan/TRACKING.md`                                                                                                                                       | Playtest guide, block close                                              | 13   |

Run every task's unit tests with `npx vitest run <path>`; before each commit run `npm test && npm run lint && npm run typecheck` (all green) and, for tasks touching `app/`, `ui/` or `render/`, `npm run test:e2e`.

Shared test helpers used in many sim tests (put them at module scope of each test file; do not import from another test file):

```ts
import { createEmptyGame, type GameState } from '../game';
import { tileXY } from '../map/map';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 }); // flat grass, density 3, height 1, void border
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
```

---

### Task 1: Prices, company money and the command pipeline

**Files:**

- Create: `src/sim/economy/prices.ts`, `src/sim/economy/prices.test.ts`, `src/sim/command/cost.ts`, `src/sim/economy/loan.ts`, `src/sim/economy/loan.test.ts`
- Modify: `src/sim/economy/company.ts`, `src/sim/map/map.ts`, `src/sim/command/command.ts`, `src/sim/command/command.test.ts`, `src/sim/game.ts`, `src/sim/game.test.ts`, `src/sim/world/generate.test.ts` (golden hash), `src/ui/i18n/en.json`, `src/ui/i18n/es.json`, `src/ui/i18n/i18n.test.ts`

Sources: economy.md §4.2 (`RecomputePrices`), §4.7 (`CheckCompanyHasMoney`, `SubtractMoneyFromAnyCompany`), §4.8 (loans); construction.md §3 (clear limit), §4.7 (pipeline, pause levels). C++: `economy.cpp:RecomputePrices`, `company_cmd.cpp:CheckCompanyHasMoney`, `SubtractMoneyFromAnyCompany`, `UpdateLandscapingLimit`, `misc_cmd.cpp:CmdIncreaseLoan`, `CmdDecreaseLoan`, `command.cpp:CommandHelperBase::InternalExecuteProcessResult`, `IsCommandAllowedWhilePaused`.

**Interfaces:**

- Consumes (1.1/1.2): `GameState`, `newGameState`, `createEmptyGame`, `tick`, `hashGameState` (`game.ts`); `LOAN_INTERVAL`, `INITIAL_LOAN`, `DEFAULT_MAX_LOAN`, `createCompany` (`economy/company.ts`, which has a private `INFLATION_ONE` copy that this task deletes); `execute`, `COMMAND_PAUSE_LEVEL` (`command/command.ts`); `isValidTile` (`map/geometry.ts`).
- Produces (`map/map.ts`): `COMPANY_FIRST = 0x00` (the player's company; single player), `getTileOwner(map, t): number` (`m1 & 0x1f`), `setTileOwner(map, t, owner): void` (keeps `m1` bits 7..5).
- Produces (`economy/prices.ts`): `type PriceName = 'stationValue' | 'buildRail' | 'buildRoad' | 'buildDepotTrain' | 'buildStationRail' | 'buildStationRailLength' | 'buildFoundation' | 'clearGrass' | 'clearRough' | 'clearRocks' | 'clearFields' | 'clearTrees' | 'clearRail' | 'clearDepotTrain' | 'clearStationRail' | 'clearHouse' | 'clearRoad' | 'clearWater'`, `type Prices = Readonly<Record<PriceName, number>>`, `PRICE_BASES: Readonly<Record<PriceName, { start: number; category: 'none' | 'construction' | 'running' }>>`, `INFLATION_ONE = 1 << 16`, `computePrices(constructionCost: number, runningCost: number, inflationPrices: number): Prices`.
- Produces (`economy/company.ts`): `ExpensesType = { Construction: 0, NewVehicles: 1, TrainRun: 2, RoadVehRun: 3, AircraftRun: 4, ShipRun: 5, Property: 6, TrainRevenue: 7, RoadVehRevenue: 8, AircraftRevenue: 9, ShipRevenue: 10, LoanInterest: 11, Other: 12 }` + type, `EXPENSES_END = 13`, `CLEAR_FRAME_BURST = 4096`, `CLEAR_PER_64K_FRAMES = 64 << 16`, `interface CompanyState { money: number; currentLoan: number; maxLoan: number; clearLimit: number; yearlyExpenses: number[][]; infrastructure: { rail: number; station: number } }`, `createCompany(maxLoan: number): CompanyState` (imports `INFLATION_ONE` from `prices.ts`), `economyMaxLoan(maxLoanSetting: number, inflationPrices: number): number`, `checkCompanyHasMoney(c: CompanyState, cost: number): boolean`, `subtractMoneyFromCompany(c: CompanyState, cost: number, expense: ExpensesType): void`, `updateLandscapingLimit(c: CompanyState): void`.
- Produces (`command/cost.ts`): `DoFlag = { None: 0, Execute: 1, Auto: 2, NoWater: 4, ForceClearTile: 8 }`, `ERROR_KEYS` (`as const` array; this task: `'error.notAllowedWhilePaused'`, `'error.notEnoughCash'`, `'error.maximumPermittedLoan'`, `'error.loanAlreadyRepaid'`, `'error.currencyRequired'`), `type ErrorKey`, `interface CommandError { key: ErrorKey; params: Readonly<Record<string, number>> }`, `type CommandCost = { ok: true; cost: number; expense: ExpensesType; extraCash: number } | { ok: false; error: CommandError | null }`, `succeed(cost?: number, expense?: ExpensesType): CommandCost` (defaults `0`, `Construction`, `extraCash: 0`), `fail(key: ErrorKey, params?: Record<string, number>): CommandCost`, `CMD_ERROR: CommandCost` (`{ ok: false, error: null }`), `addCost(total: CommandCost, part: CommandCost): CommandCost` (a failed `part` is returned as is; otherwise costs add, `total`'s expense type kept).
- Produces (`economy/loan.ts`): `type LoanAmount = 'interval' | 'max'`, `cmdIncreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost`, `cmdDecreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost`.
- Produces (`command/command.ts`): `type Command = { type: 'pause'; paused: boolean } | { type: 'increaseLoan'; amount: LoanAmount } | { type: 'decreaseLoan'; amount: LoanAmount }` (later tasks add variants), `type CommandResult = { ok: true; cost: number } | { ok: false; error: CommandError | null }`, `COMMAND_PAUSE_LEVEL = 1`, `pauseLevel(type: Command['type']): number`, `commandTile(command: Command): number | null` (the command's first `TileIndex` parameter, `null` for pause and loans; each later task adds its commands to this exhaustive switch), `execute(state, command, mode: 'test' | 'exec'): CommandResult`. Internally `COMMAND_TYPE: Record<Command['type'], 'serverSetting' | 'moneyManagement' | 'landscapeConstruction'>`, `COMMAND_FLAGS: Record<Command['type'], number>` (the command's own `CommandFlag`s turned into `DoFlag`s: `Auto`, `NoWater`), `NO_TEST: ReadonlySet<Command['type']>` and `run(state, command, flags): CommandCost`.
- Produces (`game.ts`): `GameState.prices: Prices` (derived from the settings, not hashed); `tick` calls `updateLandscapingLimit` at the end of a tick and in the paused branch (`StateGameLoop`); `hashGameState` adds `maxLoan`, `clearLimit`, the 39 `yearlyExpenses` values and both infrastructure counters after `currentLoan`.

- [ ] **Step 1: Write the failing tests**

`src/sim/economy/prices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computePrices, INFLATION_ONE } from './prices';

describe('RecomputePrices (port of economy.cpp)', () => {
  it('gives the default (Low) prices at the start of a game', () => {
    expect(computePrices(0, 0, INFLATION_ONE)).toEqual({
      stationValue: 100,
      buildRail: 75,
      buildRoad: 71,
      buildDepotTrain: 450,
      buildStationRail: 150,
      buildStationRailLength: 135,
      buildFoundation: 187,
      clearGrass: 15,
      clearRough: 30,
      clearRocks: 150,
      clearFields: 375,
      clearTrees: 15,
      clearRail: -53,
      clearDepotTrain: 60,
      clearStationRail: 37,
      clearHouse: 1200,
      clearRoad: 30,
      clearWater: 7500,
    });
  });

  it('rounds toward minus infinity on Medium and High (arithmetic shift)', () => {
    const medium = computePrices(1, 1, INFLATION_ONE);
    const high = computePrices(2, 2, INFLATION_ONE);
    expect([medium.buildRail, medium.clearRail, high.buildRail, high.clearRail]).toEqual([
      100, -70, 112, -79,
    ]);
    expect(high.stationValue).toBe(100); // PCAT_NONE is always ×8 >> 3
  });
});
```

`src/sim/economy/loan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import {
  checkCompanyHasMoney,
  ExpensesType,
  subtractMoneyFromCompany,
  updateLandscapingLimit,
} from './company';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const zeros = (): number[] => Array.from({ length: 13 }, () => 0);

describe('company money (port of company_cmd.cpp)', () => {
  it('starts with £100,000 cash and loan, a £300,000 limit and a full clearing allowance', () => {
    expect(newGame().company).toEqual({
      money: 100000,
      currentLoan: 100000,
      maxLoan: 300000,
      clearLimit: 4096 * 65536,
      yearlyExpenses: [zeros(), zeros(), zeros()],
      infrastructure: { rail: 0, station: 0 },
    });
  });

  it('allows spending exactly the cash and never more (CheckCompanyHasMoney, Review Focus 2)', () => {
    const { company } = newGame();
    company.money = 270;
    expect([270, 271, -53, 0].map((cost) => checkCompanyHasMoney(company, cost))).toEqual([
      true,
      false,
      true,
      true,
    ]);
    company.money = -10;
    expect([0, -5, 1].map((cost) => checkCompanyHasMoney(company, cost))).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('books every charge by expense type (SubtractMoneyFromAnyCompany)', () => {
    const { company } = newGame();
    subtractMoneyFromCompany(company, 450, ExpensesType.Construction);
    subtractMoneyFromCompany(company, -53, ExpensesType.Construction);
    subtractMoneyFromCompany(company, 0, ExpensesType.Other);
    expect(company.money).toBe(99603);
    expect(company.yearlyExpenses[0]![ExpensesType.Construction]).toBe(397);
    expect(company.yearlyExpenses[0]![ExpensesType.Other]).toBe(0);
  });

  it('regains 64 tiles of clearing per tick, up to 4096 (UpdateLandscapingLimit)', () => {
    const { company } = newGame();
    company.clearLimit = 10 << 16;
    updateLandscapingLimit(company);
    expect(company.clearLimit).toBe(74 << 16);
    company.clearLimit = 4090 << 16;
    updateLandscapingLimit(company);
    expect(company.clearLimit).toBe(4096 * 65536);
  });
});

describe('loans (port of misc_cmd.cpp)', () => {
  it('borrows £10,000 a click, or up to the limit (CmdIncreaseLoan)', () => {
    const game = newGame();
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: true,
      cost: 0,
    });
    expect([game.company.money, game.company.currentLoan]).toEqual([110000, 110000]);
    execute(game, { type: 'increaseLoan', amount: 'max' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([300000, 300000]);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.maximumPermittedLoan', params: { money: 300000 } },
    });
    expect(game.company.yearlyExpenses[0]![ExpensesType.Other]).toBe(0); // a loan is not an expense
  });

  it('repays £10,000 a click, or all the cash allows (CmdDecreaseLoan, Review Focus 2)', () => {
    const game = newGame();
    execute(game, { type: 'decreaseLoan', amount: 'interval' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([90000, 90000]);
    game.company.money = 95500;
    game.company.currentLoan = 100000;
    execute(game, { type: 'decreaseLoan', amount: 'max' }, 'exec');
    expect([game.company.money, game.company.currentLoan]).toEqual([5500, 10000]);
    game.company.money = 5000;
    expect(execute(game, { type: 'decreaseLoan', amount: 'max' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.currencyRequired', params: { money: 10000 } },
    });
    game.company.currentLoan = 0;
    expect(execute(game, { type: 'decreaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.loanAlreadyRepaid', params: {} },
    });
  });

  it('refuses loans while paused and changes nothing in test mode (R24)', () => {
    const game = newGame();
    const untouched = hashGameState(game);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'test')).toEqual({
      ok: true,
      cost: 0,
    });
    expect(game.company.currentLoan).toBe(100000);
    expect(hashGameState(game)).toBe(untouched); // test mode changes nothing
    game.paused = true;
    const before = hashGameState(game);
    expect(execute(game, { type: 'increaseLoan', amount: 'interval' }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.notAllowedWhilePaused', params: {} },
    });
    expect(hashGameState(game)).toBe(before);
  });
});
```

`src/sim/command/command.test.ts` — replace the file:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame, hashGameState } from '../game';
import { execute, pauseLevel } from './command';

describe('commands (port of command.cpp)', () => {
  it('pauses and unpauses, and test mode changes nothing', () => {
    const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const before = hashGameState(game);
    expect(execute(game, { type: 'pause', paused: true }, 'test')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(false);
    expect(hashGameState(game)).toBe(before); // test mode changes nothing
    expect(execute(game, { type: 'pause', paused: true }, 'exec')).toEqual({ ok: true, cost: 0 });
    expect(game.paused).toBe(true);
    // Pause is a server setting (level 0): always allowed, even while paused.
    expect(execute(game, { type: 'pause', paused: false }, 'exec').ok).toBe(true);
    expect(game.paused).toBe(false);
  });

  it('uses OpenTTD pause levels: construction 3, money 2, settings 0 (IsCommandAllowedWhilePaused)', () => {
    expect(
      (['pause', 'increaseLoan', 'decreaseLoan'] as const).map((type) => pauseLevel(type)),
    ).toEqual([0, 2, 2]);
  });
});
```

`src/sim/game.test.ts` — in "starts on 1 January 1950 …" replace the company line with `expect([game.company.money, game.company.currentLoan]).toEqual([100000, 100000]);` and add to the `tick` describe:

```ts
it('regains clearing allowance every tick, also while paused (StateGameLoop)', () => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.company.clearLimit = 0;
  tick(game);
  game.paused = true;
  tick(game);
  expect(game.company.clearLimit).toBe(128 << 16);
});
```

`src/ui/i18n/i18n.test.ts` — add (imports `ERROR_KEYS` from `../../sim/command/cost` and `en` from `./en.json`):

```ts
it('translates every simulation error key', () => {
  for (const key of ERROR_KEYS) expect(Object.keys(en)).toContain(key);
});
```

Run: `npx vitest run src/sim src/ui/i18n` — Expected: FAIL (`computePrices` missing, `pauseLevel` missing, company shape differs).

- [ ] **Step 2: Implement `prices.ts`** — port of `economy.cpp:RecomputePrices` without NewGRF multipliers:

```ts
const MULTIPLIER = [6, 8, 9] as const; // difficulty Low / Medium / High

export function computePrices(
  constructionCost: number,
  runningCost: number,
  inflationPrices: number,
): Prices {
  const prices = {} as Record<PriceName, number>;
  for (const [name, base] of Object.entries(PRICE_BASES) as [
    PriceName,
    (typeof PRICE_BASES)[PriceName],
  ][]) {
    const mod =
      base.category === 'construction'
        ? constructionCost
        : base.category === 'running'
          ? runningCost
          : 1;
    // price * {6,8,9}[mod] * inflation_prices, then >> (16 + 3): arithmetic shift = floor
    let price = Math.floor((base.start * MULTIPLIER[mod]! * inflationPrices) / 2 ** 19);
    if (price === 0) price = Math.min(1, Math.max(-1, base.start));
    prices[name] = price;
  }
  return prices;
}
```

`PRICE_BASES` start prices (`table/pricebase.h`): stationValue 100 none; buildRail 100, buildRoad 95, buildDepotTrain 600, buildStationRail 200, buildStationRailLength 180, buildFoundation 250, clearGrass 20, clearRough 40, clearRocks 200, clearFields 500, clearTrees 20, clearRail −70, clearDepotTrain 80, clearStationRail 50, clearHouse 1600, clearRoad 40, clearWater 10000 — all `construction`.

- [ ] **Step 3: Extend `company.ts`, `map.ts` and write `cost.ts`**

- `company.ts`: `import { INFLATION_ONE } from './prices'` and delete the private `const INFLATION_ONE = 1 << 16` (`prices.ts` must not import `company.ts`).
- `createCompany(maxLoan)`: the loan term is `Math.min(economyMaxLoan(INITIAL_LOAN, INFLATION_ONE), maxLoan)` instead of the inline `floor(floor(x * INFLATION_ONE / 65536) / LOAN_INTERVAL) * LOAN_INTERVAL` (same value, one formula); adds `maxLoan`, `clearLimit: CLEAR_FRAME_BURST << 16` (`Company::Company`), `yearlyExpenses` (3 × 13 zeros), `infrastructure: { rail: 0, station: 0 }`.
- `economyMaxLoan(setting, inflation) = Math.floor(Math.floor((setting * inflation) / 65536) / LOAN_INTERVAL) * LOAN_INTERVAL` (`RecomputePrices`).
- `checkCompanyHasMoney(c, cost) = cost <= 0 || cost <= c.money` (`infinite_money` is off).
- `subtractMoneyFromCompany(c, cost, expense)`: `if (cost === 0) return; c.money -= cost; c.yearlyExpenses[0][expense] += cost;` (`cur_economy` arrives in block 1.5).
- `updateLandscapingLimit(c)`: `c.clearLimit = Math.min(c.clearLimit + CLEAR_PER_64K_FRAMES, CLEAR_FRAME_BURST << 16) >>> 0`.

- [ ] **Step 4: Implement `loan.ts`** — port of `misc_cmd.cpp` (economy.md §4.8):

```ts
export function cmdIncreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost {
  const c = state.company;
  if (c.currentLoan >= c.maxLoan) return fail('error.maximumPermittedLoan', { money: c.maxLoan });
  const loan = amount === 'interval' ? LOAN_INTERVAL : c.maxLoan - c.currentLoan;
  if ((flags & DoFlag.Execute) !== 0) {
    c.money += loan;
    c.currentLoan += loan;
  }
  return succeed(0, ExpensesType.Other);
}

export function cmdDecreaseLoan(state: GameState, flags: number, amount: LoanAmount): CommandCost {
  const c = state.company;
  if (c.currentLoan === 0) return fail('error.loanAlreadyRepaid');
  let loan: number;
  if (amount === 'interval') {
    loan = Math.min(c.currentLoan, LOAN_INTERVAL);
  } else {
    loan = Math.max(Math.min(c.currentLoan, c.money), LOAN_INTERVAL);
    loan -= loan % LOAN_INTERVAL;
  }
  if (c.money < loan) return fail('error.currencyRequired', { money: loan });
  if ((flags & DoFlag.Execute) !== 0) {
    c.money -= loan;
    c.currentLoan -= loan;
  }
  return succeed(0, ExpensesType.Other);
}
```

- [ ] **Step 5: Rewrite `command.ts`** — the pipeline of construction.md §4.7 (`InternalPost` → `InternalExecuteProcessResult`):

```ts
const PAUSE_LOOKUP = { serverSetting: 0, moneyManagement: 2, landscapeConstruction: 3 } as const;

export const pauseLevel = (type: Command['type']): number => PAUSE_LOOKUP[COMMAND_TYPE[type]];

export function execute(state: GameState, command: Command, mode: CommandMode): CommandResult {
  // CommandHelper::Do / InternalPost: "do not even think about executing out-of-bounds tile-commands"
  const tile = commandTile(command);
  if (tile !== null && tile !== 0 && !isValidTile(state.map, tile))
    return { ok: false, error: null };
  if (state.paused && pauseLevel(command.type) > COMMAND_PAUSE_LEVEL) {
    return { ok: false, error: { key: 'error.notAllowedWhilePaused', params: {} } };
  }
  const flags = COMMAND_FLAGS[command.type];
  const test = run(state, command, flags);
  if (!test.ok) return { ok: false, error: test.error };
  if (!NO_TEST.has(command.type) && !checkCompanyHasMoney(state.company, test.cost)) {
    return { ok: false, error: { key: 'error.notEnoughCash', params: { money: test.cost } } };
  }
  if (mode === 'test') return { ok: true, cost: test.cost };
  const res = run(state, command, flags | DoFlag.Execute);
  if (!res.ok) return { ok: false, error: res.error };
  if (res.extraCash !== 0 && res.cost === 0) {
    return { ok: false, error: { key: 'error.notEnoughCash', params: { money: res.extraCash } } };
  }
  subtractMoneyFromCompany(state.company, res.cost, res.expense);
  return { ok: true, cost: res.cost };
}
```

`run` is a `switch (command.type)` with an exhaustive `never` default; `pause` → `CmdPause` (exec sets `state.paused`, `succeed(0, ExpensesType.Other)`), loans → `loan.ts`. `COMMAND_TYPE`: pause → `serverSetting`, loans → `moneyManagement`. `COMMAND_FLAGS`: all 0 so far. `NO_TEST`: empty so far.

- [ ] **Step 6: `game.ts`** — `prices: computePrices(0, 0, INFLATION_ONE)` and `company: createCompany(economyMaxLoan(DEFAULT_MAX_LOAN, INFLATION_ONE))` in `newGameState`; in `tick`: `if (state.paused) { updateLandscapingLimit(state.company); return; }` and `updateLandscapingLimit(state.company)` after `onTickTrees(state)`; hash as in Interfaces.

- [ ] **Step 7: i18n** — add to `en.json` / `es.json` (Spanish from `lang/spanish.txt`):

| Key                          | en                                         | es                                                   |
| ---------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `error.notEnoughCash`        | Not enough cash - requires {money}         | No hay suficiente dinero - se necesita {money}       |
| `error.maximumPermittedLoan` | ... maximum permitted loan size is {money} | ... máxima cantidad de préstamo permitida es {money} |
| `error.loanAlreadyRepaid`    | ... no loan to repay                       | ... no hay préstamo que pagar                        |
| `error.currencyRequired`     | ... {money} required                       | ... {money} requerido                                |

- [ ] **Step 8: Run and re-pin** — `npx vitest run src/sim src/ui` — Expected: all pass except `generate.test.ts`'s golden hash (the company fields are now hashed), which fails printing the received hash. Copy the 8 hex digits into `GOLDEN_64_SEED_1`; run again — Expected: all passed. Then `npm test && npm run lint && npm run typecheck && npm run test:e2e` — all green (the query e2e compares hashes computed by the same code).

- [ ] **Step 9: Commit** — `feat: add prices, the money check and loans to the command pipeline` (body: every construction command needs OpenTTD's `_price` table, one test run, one `CheckCompanyHasMoney` on the total and the exec run that pays, as `command.cpp` does (R25); loans are commands too, so the pause levels refuse them while paused (R24); charges are booked by expense type now so block 1.5 only shows them; the clearing limit is company state, so it is ported with it (R28). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 2: The bulldozer — natural ground, water, houses and town roads

**Files:**

- Create: `src/sim/map/tile-area.ts`, `src/sim/map/tile-area.test.ts`, `src/sim/map/clear-tile.ts`, `src/sim/map/clear-tile.test.ts`, `src/sim/town/house-removal.ts`, `src/sim/town/house-removal.test.ts`, `src/sim/town/road-removal.ts`, `src/sim/town/road-removal.test.ts`
- Modify: `src/sim/town/house-specs.ts`, `src/sim/map/flood.ts`, `src/sim/map/water.test.ts`, `src/sim/world/trees.ts`, `src/sim/game.ts`, `src/sim/command/cost.ts`, `src/sim/command/command.ts`, `src/sim/command/command.test.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

Sources: construction.md §4.1–4.4, §4.2.1, §4.2.2, §4.8 (hooks, R15), open questions 1 and 5 (settled by R21, R22); roads.md §4.2. C++: `landscape.cpp:CmdLandscapeClear`, `CmdClearArea`; `tilearea.cpp:OrthogonalTileIterator`, `DiagonalTileArea`, `DiagonalTileIterator::operator++`; `clear_cmd.cpp:ClearTile_Clear`; `tree_cmd.cpp:ClearTile_Trees`; `water_cmd.cpp:ClearTile_Water`, `DoFloodTile`; `industry_cmd.cpp:ClearTile_Industry`; `town_cmd.cpp:ClearTile_Town`, `ClearTownHouse`, `GetHouseNorthPart`; `road_cmd.cpp:ClearTile_Road`, `RemoveRoad` (normal branch), `CheckAllowRemoveRoad`.

**Interfaces:**

- Consumes: Task 1 (`DoFlag`, `CommandCost`, `succeed`, `fail`, `CMD_ERROR`, `addCost`, `COMPANY_FIRST`, `execute`, `state.prices`, `CompanyState.clearLimit`); 1.2: `doClearSquare`, `makeClear`, `getClearGround`, `getClearDensity`, `getTreeCount`, `getWaterTileType`, `isCoastTile`, `makeSea`, `getTileSlopeZ`, `isSlopeWithOneCornerRaised`, `getIndustryIndex`, `getHouseType`, `isHouseCompleted`, `Town`, `updateTownRadius`, `TownFlag`, `HOUSE_SPECS`, `getRoadBits`, `setRoadBits`, `getRoadOwner`, `getTownIndex`, `isNormalRoadTile`, `RoadBits`.
- Produces (`map/tile-area.ts`): `orthogonalTiles(map, corner1: number, corner2: number): number[]` (min/max rectangle, X fastest), `diagonalTiles(map, corner1: number, corner2: number): number[]` (`DiagonalTileIterator`, tiles outside the map skipped), `tileIterator(map, corner1, corner2, diagonal: boolean): number[]` (`TileIterator::Create`).
- Produces (`map/clear-tile.ts`): `landscapeClear(state: GameState, t: number, flags: number, actor: number): CommandCost` (`CmdLandscapeClear`; `actor` is OpenTTD's `_current_company`: `COMPANY_FIRST` or `OWNER_WATER`), `clearArea(state: GameState, flags: number, endTile: number, startTile: number, diagonal: boolean, actor: number): CommandCost` (`CmdClearArea`). Private procs `clearTileClear`, `clearTileTrees`, `clearTileWater`, `clearTileIndustry`; dispatch by tile type (later tasks add Railway and Station cases).
- Produces (`town/house-specs.ts`): `HouseSpec.removalCost: number` (`removal_cost`, 5th `MS` argument), `findHouseSpec(id: number): HouseSpec | undefined` (the one `BY_ID` lookup; the existing `houseSpec(id)` becomes `findHouseSpec(id) ?? <its current throw>`).
- Produces (`town/house-removal.ts`): `getHouseNorthPart(id: number): { id: number; dx: number; dy: number }`, `clearTownHouse(state: GameState, town: Town, t: number): void`, `clearTileTown(state: GameState, t: number, flags: number, actor: number): CommandCost`.
- Produces (`town/road-removal.ts`): `checkAllowRemoveRoad(state: GameState, t: number, remove: number, owner: number, actor: number): CommandCost`, `removeRoad(state: GameState, t: number, flags: number, pieces: number, actor: number): CommandCost` (normal road; Task 4 adds the crossing branch), `clearTileRoad(state: GameState, t: number, flags: number, actor: number): CommandCost` (R33: the company's non-`Auto` clear of a town-owned normal road fails with `error.localAuthorityRefuses`; this task has normal roads only).
- Produces (`map/flood.ts`): `tileLoopWater(state: GameState, t: number, markDirty)` and `tileLoopVoid` now take the state; a flat target is flooded with `landscapeClear(state, target, DoFlag.Execute, OWNER_WATER)` then `makeSea` (any tile type); a sloped target keeps the 1.2 clear/tree behaviour.
- Produces (`command/command.ts`): `{ type: 'landscapeClear'; tile: number }`, `{ type: 'clearArea'; endTile: number; startTile: number; diagonal: boolean }` — both `landscapeConstruction`, flags 0; `clearArea` is in `NO_TEST`; `commandTile`: `tile` / `endTile`.
- Produces (`command/cost.ts`): new keys `'error.buildingMustBeDemolished'`, `'error.cantBuildOnWater'`, `'error.mustRemoveRoadFirst'`, `'error.objectInTheWay'` (param `industry`), `'error.clearingLimitReached'`, `'error.localAuthorityRefuses'` (param `town`, a town index).

- [ ] **Step 1: Write the failing tests**

`src/sim/map/tile-area.test.ts` (values traced from `tilearea.cpp`):

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { tileX, tileXY, tileY } from './map';
import { diagonalTiles, orthogonalTiles } from './tile-area';

const map = createEmptyGame({ mapLogX: 6, mapLogY: 6 }).map;
const xy = (tiles: number[]): [number, number][] =>
  tiles.map((t) => [tileX(map, t), tileY(map, t)]);

describe('tile iterators (port of tilearea.cpp)', () => {
  it('walks a rectangle X first, whatever corners it is given', () => {
    expect(xy(orthogonalTiles(map, tileXY(map, 12, 10), tileXY(map, 10, 11)))).toEqual([
      [10, 10],
      [11, 10],
      [12, 10],
      [10, 11],
      [11, 11],
      [12, 11],
    ]);
  });

  it('walks a diagonal (Ctrl) area in rotated coordinates', () => {
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 10, 12)))).toEqual([
      [10, 10],
      [11, 11],
      [10, 11],
      [9, 11],
      [10, 12],
    ]);
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 12, 12)))).toEqual([
      [10, 10],
      [11, 11],
      [12, 12],
    ]);
    expect(xy(diagonalTiles(map, tileXY(map, 10, 10), tileXY(map, 12, 10)))).toEqual([
      [10, 10],
      [11, 11],
      [11, 10],
      [11, 9],
      [12, 10],
    ]);
  });
});
```

`src/sim/map/clear-tile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { IndustryType } from '../industry/industry-specs';
import { ClearGround, getClearDensity, getClearGround, makeClear } from './clear';
import { clearArea, landscapeClear } from './clear-tile';
import { makeIndustry } from './industry-map';
import { COMPANY_FIRST, getTileType, OWNER_TOWN, tileXY, TileType } from './map';
import { makeTree, TreeGrowth, TreeGround } from './tree-map';
import { makeSea, makeShore } from './water';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const testCost = (g: GameState, t: number): number | null => {
  const r = landscapeClear(g, t, DoFlag.None, COMPANY_FIRST);
  return r.ok ? r.cost : null;
};
const addIndustry = (g: GameState): void => {
  g.industries.push({
    index: 0,
    type: IndustryType.CoalMine,
    tile: at(g, 40, 10),
    width: 4,
    height: 4,
    townIndex: 0,
    layoutIndex: 0,
    productionRate: 15,
    counter: 0,
    randomColour: 0,
    random: 0,
    prodLevel: 16,
  });
  makeIndustry(g.map, at(g, 40, 10), 0, 0, 0);
  makeIndustry(g.map, at(g, 41, 10), 0, 1, 0);
};

describe('CmdLandscapeClear per tile type (construction.md §4.2)', () => {
  it('charges OpenTTD start prices for natural ground and leaves bare grass', () => {
    const g = newGame();
    makeClear(g.map, at(g, 11, 10), ClearGround.Grass, 0);
    makeClear(g.map, at(g, 12, 10), ClearGround.Rough, 3);
    makeClear(g.map, at(g, 13, 10), ClearGround.Rocks, 3);
    makeTree(g.map, at(g, 14, 10), 0, 2, TreeGrowth.Grown, TreeGround.Grass, 3); // three trees
    const tiles = [10, 11, 12, 13, 14].map((x) => at(g, x, 10));
    expect(tiles.map((t) => testCost(g, t))).toEqual([15, 0, 30, 150, 45]);
    for (const t of tiles) landscapeClear(g, t, DoFlag.Execute, COMPANY_FIRST);
    expect(
      tiles.map((t) => [
        getTileType(g.map, t),
        getClearGround(g.map, t),
        getClearDensity(g.map, t),
      ]),
    ).toEqual(tiles.map(() => [TileType.Clear, ClearGround.Grass, 0]));
  });

  it('charges £7,500 for sea and one-corner coast, £30 for other coast (ClearTile_Water)', () => {
    const g = newGame();
    makeSea(g.map, at(g, 20, 20));
    for (const [x, y] of [
      [31, 30],
      [30, 31],
      [31, 31],
    ] as const)
      g.map.height[at(g, x, y)] = 0;
    makeShore(g.map, at(g, 30, 30)); // only the N corner is raised
    g.map.height[at(g, 41, 41)] = 0;
    g.map.height[at(g, 41, 40)] = 0;
    makeShore(g.map, at(g, 40, 40)); // N and E corners raised
    expect([
      testCost(g, at(g, 20, 20)),
      testCost(g, at(g, 30, 30)),
      testCost(g, at(g, 40, 40)),
    ]).toEqual([7500, 7500, 30]);
  });

  it('refuses water to builders (NoWater) and houses and industries to Auto clears', () => {
    const g = newGame();
    makeSea(g.map, at(g, 20, 20));
    addIndustry(g);
    expect(landscapeClear(g, at(g, 20, 20), DoFlag.NoWater, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.cantBuildOnWater', params: {} },
    });
    expect(landscapeClear(g, at(g, 40, 10), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.objectInTheWay', params: { industry: 0 } },
    });
    // The bulldozer cannot remove an industry either; OpenTTD shows no detail line.
    expect(landscapeClear(g, at(g, 40, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
  });

  it('refuses the map edge with a bare error (CommandHelper::Do)', () => {
    const g = newGame();
    expect(landscapeClear(g, at(g, 0, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
  });

  it('uses one tile of the clearing limit per executed clear, even a free one (R28)', () => {
    const g = newGame();
    makeClear(g.map, at(g, 10, 10), ClearGround.Grass, 0);
    g.company.clearLimit = 1 << 16;
    landscapeClear(g, at(g, 11, 10), DoFlag.None, COMPANY_FIRST); // test: no use
    landscapeClear(g, at(g, 12, 10), DoFlag.Execute | DoFlag.Auto, COMPANY_FIRST); // Auto: no use
    expect(g.company.clearLimit).toBe(1 << 16);
    expect(landscapeClear(g, at(g, 10, 10), DoFlag.Execute, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: 0,
    });
    expect(g.company.clearLimit).toBe(0);
    expect(landscapeClear(g, at(g, 11, 10), DoFlag.None, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.clearingLimitReached', params: {} },
    });
  });
});

describe('CmdClearArea (landscape.cpp)', () => {
  it('pays tile by tile and stops before the cash runs out (R22, Review Focus 2)', () => {
    const g = newGame();
    for (const x of [10, 11, 12]) makeClear(g.map, at(g, x, 10), ClearGround.Rocks, 3);
    const area = {
      type: 'clearArea',
      endTile: at(g, 12, 10),
      startTile: at(g, 10, 10),
      diagonal: false,
    } as const;
    g.company.money = 300;
    const before = hashGameState(g);
    expect(execute(g, area, 'test')).toEqual({ ok: true, cost: 450 }); // the estimate is never refused for money
    expect(hashGameState(g)).toBe(before); // test mode changes nothing
    expect(execute(g, area, 'exec')).toEqual({ ok: true, cost: 300 });
    expect(g.company.money).toBe(0);
    expect([10, 11, 12].map((x) => getClearGround(g.map, at(g, x, 10)))).toEqual([
      ClearGround.Grass,
      ClearGround.Grass,
      ClearGround.Rocks,
    ]);
  });

  it('fails with the price of the first tile when it could pay nothing', () => {
    const g = newGame();
    for (const x of [10, 11, 12]) makeClear(g.map, at(g, x, 10), ClearGround.Rocks, 3);
    g.company.money = 100;
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 12, 10), startTile: at(g, 10, 10), diagonal: false },
        'exec',
      ),
    ).toEqual({ ok: false, error: { key: 'error.notEnoughCash', params: { money: 150 } } });
    expect(g.company.money).toBe(100);
    expect(getClearGround(g.map, at(g, 10, 10))).toBe(ClearGround.Rocks);
  });

  it('skips tiles that fail and reports the last error only when every tile failed', () => {
    const g = newGame();
    addIndustry(g);
    expect(clearArea(g, DoFlag.None, at(g, 41, 10), at(g, 40, 10), false, COMPANY_FIRST)).toEqual({
      ok: false,
      error: null,
    });
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 42, 10), startTile: at(g, 40, 10), diagonal: false },
        'exec',
      ),
    ).toEqual({ ok: true, cost: 15 });
    expect(getTileType(g.map, at(g, 40, 10))).toBe(TileType.Industry);
  });

  it('does not use the company limit when someone else clears (Company::GetIfValid)', () => {
    const g = newGame();
    g.company.clearLimit = 0;
    expect(landscapeClear(g, at(g, 10, 10), DoFlag.Execute, OWNER_TOWN)).toMatchObject({
      ok: true,
      cost: 15,
    });
    expect(g.company.clearLimit).toBe(0);
  });
});
```

`src/sim/town/house-removal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, tick, type GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, getTileType, tileXY, TileType } from '../map/map';
import { isNormalRoadTile, makeRoadNormal, RoadBits } from '../map/road-map';
import { getHouseNorthPart } from './house-removal';
import { newTown, TownFlag } from './town';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const COMPLETED = 3;

/** A town at (20,20) with town houses (0x06, pop 30) at (21,20), a church (0x03, pop 5) at (22,20)
 * and a 2×2 stadium (0x14..0x17, pop 65) at (24..25, 20..21). */
function townWithHouses(): GameState {
  const g = newGame();
  const town = newTown(0, at(g, 20, 20), 0, false);
  g.towns.push(town);
  makeHouseTile(g.map, at(g, 21, 20), 0, 0, COMPLETED, 0x06, 0);
  makeHouseTile(g.map, at(g, 22, 20), 0, 0, COMPLETED, 0x03, 0);
  makeHouseTile(g.map, at(g, 24, 20), 0, 0, COMPLETED, 0x14, 0);
  makeHouseTile(g.map, at(g, 24, 21), 0, 0, COMPLETED, 0x15, 0);
  makeHouseTile(g.map, at(g, 25, 20), 0, 0, COMPLETED, 0x16, 0);
  makeHouseTile(g.map, at(g, 25, 21), 0, 0, COMPLETED, 0x17, 0);
  town.numHouses = 3;
  town.population = 100;
  town.flags = TownFlag.HasChurch | TownFlag.HasStadium;
  return g;
}

describe('demolishing houses (port of town_cmd.cpp:ClearTile_Town)', () => {
  it('charges (£1,200 × removal_cost) >> 8 of the tile it is given', () => {
    const g = townWithHouses();
    const cost = (x: number, y: number): unknown =>
      landscapeClear(g, at(g, x, y), DoFlag.None, COMPANY_FIRST);
    expect([cost(21, 20), cost(22, 20), cost(25, 21)]).toEqual([
      expect.objectContaining({ cost: 375 }),
      expect.objectContaining({ cost: 421 }),
      expect.objectContaining({ cost: 1171 }),
    ]);
  });

  it('refuses houses to builders (Auto)', () => {
    const g = townWithHouses();
    expect(landscapeClear(g, at(g, 21, 20), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.buildingMustBeDemolished', params: {} },
    });
  });

  it('removes a whole stadium from any tile and updates the town (ClearTownHouse)', () => {
    const g = townWithHouses();
    landscapeClear(g, at(g, 25, 21), DoFlag.Execute, COMPANY_FIRST);
    expect(
      [
        [24, 20],
        [24, 21],
        [25, 20],
        [25, 21],
      ].map(([x, y]) => getTileType(g.map, at(g, x!, y!))),
    ).toEqual([TileType.Clear, TileType.Clear, TileType.Clear, TileType.Clear]);
    const town = g.towns[0]!;
    expect([town.population, town.numHouses, town.flags]).toEqual([35, 2, TownFlag.HasChurch]);
  });

  it('estimates a stadium at four tiles in an area but charges one (R22, §4.2.2)', () => {
    const g = townWithHouses();
    const area = {
      type: 'clearArea',
      endTile: at(g, 25, 21),
      startTile: at(g, 24, 20),
      diagonal: false,
    } as const;
    expect(execute(g, area, 'test')).toEqual({ ok: true, cost: 4684 });
    expect(execute(g, area, 'exec')).toEqual({ ok: true, cost: 1171 });
    expect(g.company.money).toBe(100000 - 1171);
  });

  it('leaves a town with no houses alive and ticking (Review Focus 3)', () => {
    const g = townWithHouses();
    makeHouseTile(g.map, at(g, 23, 21), 0, 0, 1, 0x06, 0); // unfinished: no population yet
    makeRoadNormal(g.map, at(g, 23, 20), RoadBits.X, 0); // the town's road inside the area
    g.towns[0]!.numHouses = 4;
    expect(
      execute(
        g,
        { type: 'clearArea', endTile: at(g, 25, 21), startTile: at(g, 21, 20), diagonal: false },
        'exec',
      ).ok,
    ).toBe(true);
    const town = g.towns[0]!;
    expect([town.population, town.numHouses, town.flags, town.squaredZoneRadius]).toEqual([
      0,
      0,
      0,
      [4, 0, 0, 0, 0],
    ]);
    expect(isNormalRoadTile(g.map, at(g, 23, 20))).toBe(true); // houses go, roads stay (R33)
    expect(() => {
      for (let i = 0; i < 1000; i++) tick(g);
    }).not.toThrow();
  });

  it('finds the north tile of multi-tile houses (GetHouseNorthPart)', () => {
    expect([0x08, 0x15, 0x16, 0x17, 0x29, 0x06].map((id) => getHouseNorthPart(id))).toEqual([
      { id: 0x07, dx: 0, dy: -1 },
      { id: 0x14, dx: 0, dy: -1 },
      { id: 0x14, dx: -1, dy: 0 },
      { id: 0x14, dx: -1, dy: -1 },
      { id: 0x28, dx: 0, dy: -1 },
      { id: 0x06, dx: 0, dy: 0 },
    ]);
  });
});
```

`src/sim/town/road-removal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DoFlag } from '../command/cost';
import { createEmptyGame, type GameState } from '../game';
import { landscapeClear } from '../map/clear-tile';
import { execute } from '../command/command';
import { COMPANY_FIRST, getTileType, tileXY, TileType } from '../map/map';
import { getRoadBits, makeRoadNormal, RoadBits } from '../map/road-map';
import { newTown } from './town';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);

describe('town roads and the bulldozer (road_cmd.cpp, R33)', () => {
  it('refuses to demolish a town road and leaves it untouched (D2)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.X, 0);
    makeRoadNormal(g.map, at(g, 20, 22), RoadBits.NE, 0);
    const refused = {
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    };
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 20, 21) }, 'exec')).toEqual(refused);
    expect(landscapeClear(g, at(g, 20, 22), DoFlag.None, COMPANY_FIRST)).toEqual(refused); // even a stub
    expect([getRoadBits(g.map, at(g, 20, 21)), g.company.clearLimit]).toEqual([
      RoadBits.X,
      4096 << 16,
    ]);
  });

  it('skips town roads in an area, silently unless nothing else was cleared', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.X, 0);
    const area = (ex: number) =>
      ({
        type: 'clearArea',
        endTile: at(g, ex, 21),
        startTile: at(g, 20, 21),
        diagonal: false,
      }) as const;
    expect(execute(g, area(21), 'exec')).toEqual({ ok: true, cost: 15 });
    expect(getTileType(g.map, at(g, 20, 21))).toBe(TileType.Road);
    expect(execute(g, area(20), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    });
  });

  it('lets builders remove a one-piece stub only (ClearTile_Road with Auto, R16)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeRoadNormal(g.map, at(g, 20, 21), RoadBits.NE, 0);
    makeRoadNormal(g.map, at(g, 20, 22), RoadBits.X, 0);
    expect(landscapeClear(g, at(g, 20, 21), DoFlag.Auto, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: 30,
    });
    expect(landscapeClear(g, at(g, 20, 22), DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRoadFirst', params: {} },
    });
  });
});
```

In `src/sim/map/water.test.ts` switch every `tileLoopWater(map, …)` / `tileLoopVoid(map, …)` to pass the game state (the tests already build it with `createEmptyGame`), and add:

```ts
it('floods a cleared flat sea tile again (R21, DoFloodTile)', () => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  for (let x = 10; x <= 13; x++)
    for (let y = 10; y <= 13; y++) g.map.height[tileXY(g.map, x, y)] = 0;
  for (let x = 10; x <= 12; x++) for (let y = 10; y <= 12; y++) makeSea(g.map, tileXY(g.map, x, y));
  const centre = tileXY(g.map, 11, 11);
  expect(execute(g, { type: 'landscapeClear', tile: centre }, 'exec')).toEqual({
    ok: true,
    cost: 7500,
  });
  expect(getTileType(g.map, centre)).toBe(TileType.Clear);
  tileLoopWater(g, tileXY(g.map, 11, 10), NOOP);
  expect(isWaterTile(g.map, centre)).toBe(true);
});
```

(Add the imports this needs: `execute` from `../command/command`, `isWaterTile`/`makeSea` from `./water`, `getTileType`/`TileType`/`tileXY` from `./map`.)

Run: `npx vitest run src/sim` — Expected: FAIL (modules missing).

- [ ] **Step 2: Implement `tile-area.ts`** — port of `tilearea.cpp` (construction.md §4.4). Orthogonal: min/max corners, X fastest. Diagonal (`DiagonalTileArea(start=corner1, end=corner2)`, `DiagonalTileIterator::operator++`):

```ts
export function diagonalTiles(map: MapState, corner1: number, corner2: number): number[] {
  const bx = tileX(map, corner1),
    by = tileY(map, corner1);
  let aMax = tileY(map, corner2) + tileX(map, corner2) - by - bx;
  let bMax = tileY(map, corner2) - tileX(map, corner2) - by + bx;
  aMax += aMax > 0 ? 1 : -1; // one-past-the-end
  bMax += bMax > 0 ? 1 : -1;
  const tiles = [corner1];
  let aCur = 0,
    bCur = 0;
  for (;;) {
    let tile = INVALID_TILE;
    do {
      if (aMax === 1 || aMax === -1) {
        aCur = 0; // every second column is empty
        bCur = bMax > 0 ? Math.min(bCur + 2, bMax) : Math.max(bCur - 2, bMax);
      } else {
        aCur += aMax > 0 ? 2 : -2;
        if (aMax > 0 ? aCur >= aMax : aCur <= aMax) {
          aCur = Math.abs(aCur) % 2 !== 0 ? 0 : aMax > 0 ? 1 : -1;
          bCur += bMax > 0 ? 1 : -1;
        }
      }
      const x = bx + Math.trunc((aCur - bCur) / 2);
      const y = by + Math.trunc((bCur + aCur) / 2);
      tile = x < 0 || y < 0 || x >= map.sizeX || y >= map.sizeY ? INVALID_TILE : tileXY(map, x, y);
    } while (tile === INVALID_TILE && bMax !== bCur);
    if (bMax === bCur) return tiles;
    tiles.push(tile);
  }
}
```

- [ ] **Step 3: Implement `clear-tile.ts`** — port of `landscape.cpp`:

```ts
export function landscapeClear(
  state: GameState,
  t: number,
  flags: number,
  actor: number,
): CommandCost {
  if (!isValidTile(state.map, t)) return CMD_ERROR; // CommandHelper::Do: outside the map or void
  // ForceClearTile's water branch needs a house/rail/station on water: unreachable in Stage 1.
  const c = (flags & DoFlag.Auto) !== 0 || actor !== COMPANY_FIRST ? null : state.company;
  if (c !== null && c.clearLimit >>> 16 < 1) return fail('error.clearingLimitReached');
  const cost = clearTileProc(state, t, flags, actor);
  if ((flags & DoFlag.Execute) !== 0 && c !== null) c.clearLimit -= 1 << 16; // even if the tile cost 0
  if ((flags & DoFlag.Execute) !== 0 && cost.ok) state.dirtyTiles.add(t);
  return cost;
}
```

Procs (all `ExpensesType.Construction`; "exec" means `flags & DoFlag.Execute`, then `doClearSquare(map, t, false)`):

- `clearTileClear`: `price = ground === Grass && density === 0 ? 0 : p[{Grass:'clearGrass', Rough:'clearRough', Rocks:'clearRocks', Fields:'clearFields'}[ground]]` (`clear_price_table`).
- `clearTileTrees`: `getTreeCount(map, t) * p.clearTrees` (temperate: no ×4); the rating hook is skipped (R15).
- `clearTileWater`: open water: `NoWater` → `fail('error.cantBuildOnWater')`, else `p.clearWater`; coast: `isSlopeWithOneCornerRaised(slope) ? p.clearWater : p.clearRough`.
- `clearTileIndustry`: `Auto` → `fail('error.objectInTheWay', { industry: getIndustryIndex(map, t) })`; a company → `{ ok: false, error: null }` (`INVALID_STRING_ID`); water → `CMD_ERROR` (unreachable: industries stand at height 1).
- House → `clearTileTown`, Road → `clearTileRoad`; Void → `CMD_ERROR`.

`clearArea` — port of `CmdClearArea` (construction.md §4.3):

```ts
export function clearArea(
  state: GameState,
  flags: number,
  endTile: number,
  startTile: number,
  diagonal: boolean,
  actor: number,
): CommandCost {
  if (startTile < 0 || startTile >= state.map.size) return CMD_ERROR;
  let money = state.company.money; // GetAvailableMoneyForCommand
  let cost = 0;
  let lastError: CommandCost = CMD_ERROR;
  let hadSuccess = false;
  const c = (flags & DoFlag.Auto) !== 0 || actor !== COMPANY_FIRST ? null : state.company;
  let limit = c === null ? 0x7fffffff : c.clearLimit >>> 16;
  const tileFlags = endTile !== startTile ? flags | DoFlag.ForceClearTile : flags;
  for (const t of tileIterator(state.map, endTile, startTile, diagonal)) {
    const ret = landscapeClear(state, t, tileFlags & ~DoFlag.Execute, actor);
    if (!ret.ok) {
      lastError = ret;
      if (c !== null && c.clearLimit >>> 16 < 1) break;
      continue;
    }
    hadSuccess = true;
    if ((flags & DoFlag.Execute) !== 0) {
      money -= ret.cost;
      if (ret.cost > 0 && money < 0)
        return { ok: true, cost, expense: ExpensesType.Construction, extraCash: ret.cost };
      landscapeClear(state, t, tileFlags, actor);
    } else if (ret.cost !== 0 && --limit <= 0) {
      break;
    }
    cost += ret.cost;
  }
  return hadSuccess ? succeed(cost) : lastError;
}
```

- [ ] **Step 4: Houses** — `house-specs.ts`: add `removalCost` to every row (from `table/town_land.h`, 5th `MS` argument; parts carry their head's value): 0x00 150, 0x01 140, 0x02 100, 0x03 90, 0x04 160, 0x06 80, 0x07 180, 0x08 180, 0x09 65, 0x0a 65, 0x0b 60, 0x0c 60, 0x0d 130, 0x0e 110, 0x0f 105, 0x10 107, 0x11 200, 0x12 145, 0x13 155, 0x14–0x17 250, 0x18 70, 0x19 75, 0x1a 71, 0x1b 135, 0x1c 145, 0x1d 132, 0x1e 155, 0x1f 220, 0x20–0x23 250, 0x24 170, 0x27 210, 0x28–0x2b 250. `findHouseSpec(id)` returns `undefined` for ids without a temperate row (e.g. 0x05); rewrite `houseSpec(id)` as `findHouseSpec(id) ?? <the RangeError throw it has today>` (a `const found = findHouseSpec(id); if (found === undefined) throw new RangeError(...); return found;`) so there is one lookup.

`house-removal.ts` — port of `town_cmd.cpp`:

- `getHouseNorthPart(id)`: if `id >= 3`: `findHouseSpec(id - 1)?.size` is `'1x2'` or `'2x2'` → `{ id: id - 1, dx: 0, dy: -1 }`; else `findHouseSpec(id - 2)?.size === '2x2'` → `{ id: id - 2, dx: -1, dy: 0 }`; else `findHouseSpec(id - 3)?.size === '2x2'` → `{ id: id - 3, dx: -1, dy: -1 }`; otherwise `{ id, dx: 0, dy: 0 }` (temperate has no 2×1 houses).
- `clearTileTown(state, t, flags, actor)`: `Auto` → `fail('error.buildingMustBeDemolished')`; cost `Math.floor((p.clearHouse * findHouseSpec(type)!.removalCost) / 256)` (`HouseSpec::GetRemovalCost`); the rating gate passes with `RATING_INITIAL = 500` (largest `remove_rating_decrease` is 300, R15) and no rating change; exec → `clearTownHouse(state, state.towns[getTownIndex(map, t)]!, t)`.
- `clearTownHouse`: move to the north tile; `if (isHouseCompleted(map, north)) town.population -= spec.population`; `town.numHouses--`; church → clear `TownFlag.HasChurch`, else stadium → clear `TownFlag.HasStadium`; `doClearSquare` the north tile, then `(0,1)` for `'1x2'`/`'2x2'`, `(1,0)` and `(1,1)` for `'2x2'`; mark them dirty; `updateTownRadius(town)`. (`RemoveNearbyStations` is block 1.5.)

- [ ] **Step 5: Roads** — `road-removal.ts`, port of `road_cmd.cpp` for normal roads:

- `checkAllowRemoveRoad(state, t, remove, owner, actor)`: `remove === 0` or `actor === OWNER_WATER` or `actor !== COMPANY_FIRST` → ok; `owner === OWNER_NONE` → ok; `owner !== OWNER_TOWN` → company ownership (always ours in Stage 1) → ok; town road: `CheckforTownRating` with rating 500 ≥ 16 (Lenient) passes and `extra_dynamite` is on, so ok without a rating change (R15).
- `removeRoad(state, t, flags, pieces, actor)`: normal road: `pieces &= present`; none → `CMD_ERROR`; `checkAllowRemoveRoad`; exec: `present ^= pieces`; `present === 0` → `doClearSquare`, else `setRoadBits`; mark dirty; cost `popcount(pieces) * p.clearRoad`.
- `clearTileRoad(state, t, flags, actor)`: for the normal-road branch, R33 first — `actor === COMPANY_FIRST && !(flags & Auto) && getRoadOwner(map, t) === OWNER_TOWN` → `fail('error.localAuthorityRefuses', { town: getTownIndex(map, t) })` (D2: the player's bulldozer never removes town roads; the message is OpenTTD's refusal for town roads, `CheckAllowRemoveRoad`); then OpenTTD's code for a normal road: `popcount(bits) === 1 || !(flags & Auto)` → `removeRoad(state, t, flags, bits, actor)`, else `fail('error.mustRemoveRoadFirst')` (so a builder's `Auto` clear still removes a one-piece stub, R16).

- [ ] **Step 6: Flooding and wiring** — `flood.ts`: `doFloodTile(state, target, markDirty)`: sloped targets keep the 1.2 code; a flat target: `if (landscapeClear(state, target, DoFlag.Execute, OWNER_WATER).ok) { makeSea(map, target); markDirty(target); }`. `tileLoopWater`/`tileLoopVoid` take `state` (`state.map` inside); `trees.ts` and the `game.ts` procs pass `state`. `command.ts`: `landscapeClear` → `landscapeClear(state, cmd.tile, flags, COMPANY_FIRST)`, `clearArea` → `clearArea(state, flags, cmd.endTile, cmd.startTile, cmd.diagonal, COMPANY_FIRST)`; both `landscapeConstruction`; `clearArea` ∈ `NO_TEST`. Extend the pause-level test with `(['landscapeClear', 'clearArea'] as const).map(pauseLevel)` → `[3, 3]`.

- [ ] **Step 7: i18n**

| Key                              | en                                           | es                                              |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `error.buildingMustBeDemolished` | Building must be demolished first            | El edificio debe demolerse primero              |
| `error.cantBuildOnWater`         | ... can't build on water                     | ... no se puede construir sobre el agua         |
| `error.mustRemoveRoadFirst`      | Must remove road first                       | Primero se debe retirar la carretera            |
| `error.objectInTheWay`           | {industry} in the way                        | {industry} en medio                             |
| `error.clearingLimitReached`     | ... tile clearing limit reached              | ... límite de casillas despejadas alcanzado     |
| `error.localAuthorityRefuses`    | {town} local authority refuses to allow this | Las autoridades locales de {town} rechazan esto |

- [ ] **Step 8: Run** — `npx vitest run src/sim` — Expected: all passed. `npm test && npm run lint && npm run typecheck` — green.

- [ ] **Step 9: Commit** — `feat: add the bulldozer with OpenTTD's clearing costs` (body: `CmdLandscapeClear` and `CmdClearArea` are the single path every build and the demolish tool use, so the tile procs are ported once with their exact prices; an area estimate is the test sum while the exec pays tile by tile and stops before the cash runs out, as OpenTTD (R22); ratings stay at their initial value, so houses can always go (R15), while town roads are refused with the local authority's message because the player may not remove them (D2, R33); the sea re-floods a cleared tile through the same clear (R21). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 3: Rail track — pieces, drags and the track tile loop

**Files:**

- Create: `src/sim/track/track.ts`, `src/sim/track/track.test.ts`, `src/sim/map/rail-map.ts`, `src/sim/map/rail-map.test.ts`, `src/sim/track/rail-cmd.ts`, `src/sim/track/rail-cmd.test.ts`, `src/sim/track/rail-drag.test.ts`
- Modify: `src/sim/map/clear-tile.ts` (Railway → `clearTileTrack`), `src/sim/command/command.ts`, `src/sim/command/command.test.ts`, `src/sim/command/cost.ts`, `src/sim/game.ts` (Railway tile-loop proc), `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

Sources: track.md §3 (enums, rail tile storage), §4.1–4.7, §4.9, §4.10; construction.md §4.2 (own rail). C++: `rail_map.h:MakeRailNormal`, `MakeRailDepot`; `track_func.h`; `table/track_data.h:_trackdelta`; `rail_cmd.cpp:CmdBuildSingleRail` (`MP_RAILWAY` and default branches), `CmdRemoveSingleRail` (`MP_RAILWAY` branch), `ValidateAutoDrag`, `CmdRailTrackHelper`, `ClearTile_Track`, `TileLoop_Track`, `CheckRailSlope`; `rail.h:RailBuildCost`, `RailClearCost`.

**Interfaces:**

- Consumes: Tasks 1–2 (`landscapeClear`, `DoFlag`, `CommandCost` helpers, `COMPANY_FIRST`, `getTileOwner`, `state.prices`, `company.infrastructure`); 1.2: `DiagDir`, `isValidTile`, `tileOffsByDiagDir`, `isTileFlat`, `getFloodingBehaviour`, `FloodingBehaviour`, `doClearSquare`.
- Produces (`track/track.ts`): `Track = { X: 0, Y: 1, Upper: 2, Lower: 3, Left: 4, Right: 5 }` + type, `TrackBits = { None: 0, X: 1, Y: 2, Upper: 4, Lower: 8, Left: 16, Right: 32, Cross: 3, Horz: 12, Vert: 48, All: 63 }`, `Axis = { X: 0, Y: 1 }` + type, `trackToTrackBits(t: Track): number`, `tracksOverlap(bits: number): boolean`, `isDiagonalTrack(t: Track): boolean`, `diagDirToDiagTrack(d: DiagDir): Track`, `axisToTrack(a: Axis): Track`, `DIAGDIR_REACHES_TRACKS: readonly number[]` (`[0x19, 0x16, 0x25, 0x2a]`, by `DiagDir`), `TRACK_BITS_AT_EDGE: readonly number[]` (`TRACK_BIT_3WAY_NE/SE/SW/NW` = `[0x25, 0x2a, 0x19, 0x16]`), `TRACKDELTA: readonly (readonly [number, number])[]` (16 entries by `Trackdir`), `countBits(bits: number): number`.
- Produces (`map/rail-map.ts`): `RailTileType = { Normal: 0, Signals: 1, Depot: 3 }`, `RailGroundType = { Barren: 0, Grass: 1, FenceNW: 2, FenceSE: 3, FenceSENW: 4, FenceNE: 5, FenceSW: 6, FenceNESW: 7, FenceVert1: 8, FenceVert2: 9, FenceHoriz1: 10, FenceHoriz2: 11 }`, `RAILTYPE_RAIL = 0`, `makeRailNormal(map, t, owner, bits, railType)`, `makeRailDepot(map, t, owner, depotIndex, dir, railType)`, `getRailTileType`, `isPlainRail(map, t)`, `isRailDepotTile(map, t)`, `getTrackBits`, `setTrackBits(map, t, bits)`, `getRailType` (`m8 & 0x3f`), `getRailGroundType` (`m4 & 0xf`), `setRailGroundType(map, t, g)`, `getRailDepotDirection` (`m5 & 3`), `setRailDepotExitDirection(map, t, dir)`, `getDepotIndex` (`m2`).
- Produces (`track/rail-cmd.ts`): `railBuildCost(p: Prices): number`, `railClearCost(p: Prices): number`, `railInfrastructurePieces(bits: number): number`, `checkRailSlope(map, t): CommandCost`, `cmdBuildSingleRail(state, flags, t, track: Track): CommandCost`, `cmdRemoveSingleRail(state, flags, t, track: Track, actor: number): CommandCost`, `validateAutoDrag(trackdir: number, startX: number, startY: number, endX: number, endY: number): number | null`, `cmdRailTrackHelper(state, flags, startTile, endTile, track: Track, remove: boolean): CommandCost`, `railDragPieces(map, startTile, endTile, track: Track): { tile: number; track: Track }[] | null`, `clearTileTrack(state, t, flags, actor): CommandCost`, `tileLoopTrack(state, t, markDirty): void`.
- Produces (`command/command.ts`): `{ type: 'buildRail'; tile: number; track: Track }` (flags `Auto | NoWater`), `{ type: 'removeRail'; tile: number; track: Track }` (`Auto`), `{ type: 'buildRailroadTrack'; endTile: number; startTile: number; track: Track }` (`Auto | NoWater`), `{ type: 'removeRailroadTrack'; endTile: number; startTile: number; track: Track }` (`Auto`) — all `landscapeConstruction`; `commandTile`: `tile` for the single pieces, `endTile` for the drags (the C++ commands take `end_tile` first, so a drag that **ends** on the void edge is refused before anything runs, while one that starts there walks on).
- Produces (`command/cost.ts`): `'error.alreadyBuilt'`, `'error.mustRemoveRailroadTrack'`, `'error.areaIsOwnedByAnother'`, `'error.noRailroadTrack'`, `'error.flatLandRequired'`.

- [ ] **Step 1: Write the failing tests**

`src/sim/track/track.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DiagDir } from '../map/geometry';
import { diagDirToDiagTrack, Track, TrackBits, tracksOverlap } from './track';

describe('track helpers (port of track_func.h)', () => {
  it('knows which piece combinations overlap (TracksOverlap)', () => {
    expect(
      [
        TrackBits.X,
        TrackBits.Cross,
        TrackBits.Horz,
        TrackBits.Vert,
        TrackBits.X | TrackBits.Upper,
        0,
      ].map(tracksOverlap),
    ).toEqual([false, true, false, false, true, false]);
  });
  it('maps a depot exit to its straight track (DiagDirToDiagTrack)', () => {
    expect([DiagDir.NE, DiagDir.SE, DiagDir.SW, DiagDir.NW].map(diagDirToDiagTrack)).toEqual([
      Track.X,
      Track.Y,
      Track.X,
      Track.Y,
    ]);
  });
});
```

`src/sim/map/rail-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../game';
import { DiagDir } from './geometry';
import { getTileOwner, getTileType, TileType, tileXY } from './map';
import {
  getRailDepotDirection,
  getRailTileType,
  getTrackBits,
  isPlainRail,
  isRailDepotTile,
  makeRailDepot,
  makeRailNormal,
  RailTileType,
} from './rail-map';

describe('rail tiles (port of rail_map.h)', () => {
  it('stores plain rail and depots in OpenTTD bit layout', () => {
    const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
    const a = tileXY(map, 10, 10);
    const b = tileXY(map, 11, 10);
    makeRailNormal(map, a, 0, 0b101, 0);
    makeRailDepot(map, b, 0, 7, DiagDir.NW, 0);
    expect([
      getTileType(map, a),
      getTileOwner(map, a),
      map.m5[a],
      getTrackBits(map, a),
      isPlainRail(map, a),
    ]).toEqual([TileType.Railway, 0, 0b101, 0b101, true]);
    expect([
      map.m2[b],
      map.m5[b],
      getRailTileType(map, b),
      getRailDepotDirection(map, b),
      isRailDepotTile(map, b),
      isPlainRail(map, b),
    ]).toEqual([7, 0xc3, RailTileType.Depot, DiagDir.NW, true, false]);
  });
});
```

`src/sim/track/rail-cmd.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { ClearGround, getClearDensity, makeClear } from '../map/clear';
import { landscapeClear } from '../map/clear-tile';
import { tileLoopWater } from '../map/flood';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, getTileType, OWNER_TOWN, tileXY, TileType } from '../map/map';
import { getRailGroundType, getTrackBits, RailGroundType } from '../map/rail-map';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { tileLoopTrack } from './rail-cmd';
import { Track, TrackBits } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const build = (g: GameState, t: number, track: Track) =>
  execute(g, { type: 'buildRail', tile: t, track }, 'exec');

describe('CmdBuildSingleRail / CmdRemoveSingleRail (port of rail_cmd.cpp)', () => {
  it('lays a piece on generated grass for £90 and adds pieces for £75 each', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    const before = hashGameState(g);
    expect(execute(g, { type: 'buildRail', tile: t, track: Track.X }, 'test')).toEqual({
      ok: true,
      cost: 90,
    });
    expect(hashGameState(g)).toBe(before); // test mode changes nothing
    expect(build(g, t, Track.X)).toEqual({ ok: true, cost: 90 });
    expect([getTileType(g.map, t), getTrackBits(g.map, t), getRailGroundType(g.map, t)]).toEqual([
      TileType.Railway,
      TrackBits.X,
      RailGroundType.Barren,
    ]);
    expect(build(g, t, Track.Y)).toEqual({ ok: true, cost: 75 });
    expect([g.company.money, g.company.infrastructure.rail]).toEqual([100000 - 165, 4]);
  });

  it('combines all six pieces on one flat tile and counts overlapping pieces squared', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    const counts = [Track.X, Track.Y, Track.Upper, Track.Lower, Track.Left, Track.Right].map(
      (track) => {
        build(g, t, track);
        return g.company.infrastructure.rail;
      },
    );
    expect(counts).toEqual([1, 4, 9, 16, 25, 36]);
    expect(getTrackBits(g.map, t)).toBe(TrackBits.All);
    expect(build(g, t, Track.X)).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
  });

  it('clears trees and rough land as part of the price', () => {
    const g = newGame();
    makeTree(g.map, at(g, 10, 10), 0, 1, TreeGrowth.Grown, TreeGround.Grass, 3); // two trees
    makeClear(g.map, at(g, 11, 10), ClearGround.Rough, 3);
    makeClear(g.map, at(g, 12, 10), ClearGround.Grass, 0);
    expect(
      [10, 11, 12].map((x) =>
        execute(g, { type: 'buildRail', tile: at(g, x, 10), track: Track.X }, 'test'),
      ),
    ).toEqual([105, 105, 75].map((cost) => ({ ok: true, cost })));
  });

  it('refuses houses, water, slopes and the map edge (R26)', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    makeSea(g.map, at(g, 30, 30));
    g.map.height[at(g, 41, 41)] = 0; // tile (40,40) gets a lowered S corner
    const test = (t: number) => execute(g, { type: 'buildRail', tile: t, track: Track.X }, 'test');
    expect([
      test(at(g, 21, 20)),
      test(at(g, 30, 30)),
      test(at(g, 40, 40)),
      test(at(g, 0, 10)),
    ]).toEqual([
      { ok: false, error: { key: 'error.buildingMustBeDemolished', params: {} } },
      { ok: false, error: { key: 'error.cantBuildOnWater', params: {} } },
      { ok: false, error: { key: 'error.flatLandRequired', params: {} } },
      { ok: false, error: null },
    ]);
  });

  it('refunds £53 per removed piece and leaves bare grass after the last one', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    build(g, t, Track.Y);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([getTrackBits(g.map, t), g.company.infrastructure.rail]).toEqual([TrackBits.Y, 1]);
    execute(g, { type: 'removeRail', tile: t, track: Track.Y }, 'exec');
    expect([
      getTileType(g.map, t),
      getClearDensity(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([TileType.Clear, 0, 0]);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.Y }, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.noRailroadTrack', params: {} },
    });
  });

  it('is bulldozed with every piece refunded, but never cleared by builders (ClearTile_Track)', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    build(g, t, Track.Y);
    expect(landscapeClear(g, t, DoFlag.None, COMPANY_FIRST)).toMatchObject({
      ok: true,
      cost: -106,
    });
    expect(landscapeClear(g, t, DoFlag.Auto, COMPANY_FIRST)).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRailroadTrack', params: {} },
    });
    expect(landscapeClear(g, t, DoFlag.Auto, OWNER_TOWN)).toEqual({
      ok: false,
      error: { key: 'error.areaIsOwnedByAnother', params: {} },
    });
  });

  it('grows grass and then fences on edges without track (TileLoop_Track, R32)', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    build(g, t, Track.X);
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.Grass); // was barren: no fences yet
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.FenceSENW); // grass neighbours belong to nobody
    build(g, at(g, 10, 11), Track.Y); // our own rail on the SE side
    tileLoopTrack(g, t, NOOP);
    expect(getRailGroundType(g.map, t)).toBe(RailGroundType.FenceNW);
  });

  it('is washed away when built on a cleared sea tile (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    build(g, at(g, 11, 11), Track.X);
    expect(g.company.infrastructure.rail).toBe(1);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), g.company.infrastructure.rail]).toEqual([true, 0]);
  });
});
```

`src/sim/track/rail-drag.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, type GameState } from '../game';
import { makeHouseTile } from '../map/house-map';
import { getTileType, tileX, tileXY, tileY, TileType } from '../map/map';
import { getTrackBits } from '../map/rail-map';
import { newTown } from '../town/town';
import { railDragPieces } from './rail-cmd';
import { Track } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const drag = (g: GameState, sx: number, sy: number, ex: number, ey: number, track: Track) =>
  ({
    type: 'buildRailroadTrack',
    endTile: at(g, ex, ey),
    startTile: at(g, sx, sy),
    track,
  }) as const;
const pieces = (g: GameState, sx: number, sy: number, ex: number, ey: number, track: Track) =>
  railDragPieces(g.map, at(g, sx, sy), at(g, ex, ey), track)?.map((p) => [
    tileX(g.map, p.tile),
    tileY(g.map, p.tile),
    p.track,
  ]) ?? null;

describe('drag building (port of rail_cmd.cpp:CmdRailTrackHelper / ValidateAutoDrag)', () => {
  it('walks straight lines either way and staircases for corner pieces', () => {
    const g = newGame();
    expect(pieces(g, 14, 10, 10, 10, Track.X)).toEqual([
      [14, 10, 0],
      [13, 10, 0],
      [12, 10, 0],
      [11, 10, 0],
      [10, 10, 0],
    ]);
    expect(pieces(g, 10, 10, 13, 12, Track.Left)).toEqual([
      [10, 10, 4],
      [11, 10, 5],
      [11, 11, 4],
      [12, 11, 5],
      [12, 12, 4],
      [13, 12, 5],
    ]);
    expect(pieces(g, 10, 10, 12, 13, Track.X)).toBeNull();
    expect(pieces(g, 10, 10, 12, 12, Track.Upper)).toBeNull();
  });

  it('builds a 5-tile line for £450 when the cash is exactly £450', () => {
    const g = newGame();
    g.company.money = 450;
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 450 });
    expect(g.company.money).toBe(0);
  });

  it('builds nothing when the cash is £1 short of the whole drag (Review Focus 2)', () => {
    const g = newGame();
    g.company.money = 449;
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.notEnoughCash', params: { money: 450 } },
    });
    expect([g.company.money, getTileType(g.map, at(g, 10, 10))]).toEqual([449, TileType.Clear]);
  });

  it('skips obstacles at the start and stops at the first one after built track', () => {
    const g = newGame();
    g.towns.push(newTown(0, at(g, 20, 20), 0, false));
    makeHouseTile(g.map, at(g, 10, 10), 0, 0, 3, 0x06, 0);
    makeHouseTile(g.map, at(g, 13, 10), 0, 0, 3, 0x06, 0);
    expect(execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 180 });
    expect(getTileType(g.map, at(g, 14, 10))).toBe(TileType.Clear);
  });

  it('counts "already built" as success one tile late, as the code does (R17)', () => {
    const g = newGame();
    execute(g, drag(g, 10, 10, 11, 10, Track.X), 'exec');
    expect(execute(g, drag(g, 10, 10, 11, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 0 });
    expect(execute(g, drag(g, 10, 10, 10, 10, Track.X), 'exec')).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
    expect(execute(g, drag(g, 12, 10, 11, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 90 });
  });

  it('skips the void edge at the start of a drag and refuses a drag that ends on it (CommandHelper::Do)', () => {
    const g = newGame();
    expect(execute(g, drag(g, 0, 10, 3, 10, Track.X), 'exec')).toEqual({ ok: true, cost: 270 });
    expect(getTileType(g.map, at(g, 0, 10))).toBe(TileType.Void);
    expect(execute(g, drag(g, 3, 11, 0, 11, Track.X), 'exec')).toEqual({ ok: false, error: null });
    expect(getTileType(g.map, at(g, 3, 11))).toBe(TileType.Clear);
  });

  it('removes along a drag for a refund, and fails over empty land', () => {
    const g = newGame();
    execute(g, drag(g, 10, 10, 14, 10, Track.X), 'exec');
    const remove = {
      type: 'removeRailroadTrack',
      endTile: at(g, 14, 10),
      startTile: at(g, 10, 10),
      track: Track.X,
    } as const;
    expect(execute(g, remove, 'exec')).toEqual({ ok: true, cost: -265 });
    expect(getTrackBits(g.map, at(g, 12, 10))).toBe(0);
    expect(execute(g, remove, 'exec')).toEqual({
      ok: false,
      error: { key: 'error.noRailroadTrack', params: {} },
    });
  });
});
```

Extend `command.test.ts`'s pause-level test with `(['buildRail', 'removeRail', 'buildRailroadTrack', 'removeRailroadTrack'] as const).map(pauseLevel)` → `[3, 3, 3, 3]`.

Run: `npx vitest run src/sim` — Expected: FAIL (modules missing).

- [ ] **Step 2: Implement `track.ts` and `rail-map.ts`** as in Interfaces. `TRACKDELTA` (`table/track_data.h:_trackdelta`): `[[-1,0],[0,1],[-1,0],[0,1],[1,0],[0,1],[0,0],[0,0],[1,0],[0,-1],[0,-1],[1,0],[0,-1],[-1,0],[0,0],[0,0]]`. `tracksOverlap(bits)`: `countBits(bits) >= 2 && bits !== TrackBits.Horz && bits !== TrackBits.Vert`. `makeRailNormal`: `resetTileKeepingHeight`, `setTileType(Railway)`, `m1 = owner`, `m5 = (RailTileType.Normal << 6) | bits`, `m8 = railType` (`m2`, `m3`, `m4`, `m6`, `m7` stay 0, so the ground is Barren). `makeRailDepot`: the same with `m2 = depotIndex`, `m5 = (RailTileType.Depot << 6) | dir`.

- [ ] **Step 3: Implement `rail-cmd.ts`** — port of `rail_cmd.cpp` (track.md §4.2–4.10):

```ts
export const railBuildCost = (p: Prices): number => Math.floor((p.buildRail * 8) / 8); // RAILTYPE_RAIL cost_multiplier 8, >> 3
export const railClearCost = (p: Prices): number =>
  Math.max(p.clearRail, Math.trunc((-railBuildCost(p) * 3) / 4)); // max(-53, -56) = -53
export const railInfrastructurePieces = (bits: number): number =>
  tracksOverlap(bits) ? countBits(bits) ** 2 : countBits(bits);

/** Port of rail_cmd.cpp:CheckRailSlope for Stage 1 (R26: no foundations). */
export function checkRailSlope(map: MapState, t: number): CommandCost {
  if (!isTileFlat(map, t)) return fail('error.flatLandRequired');
  if (getFloodingBehaviour(map, t) !== FloodingBehaviour.None)
    return fail('error.cantBuildOnWater');
  return succeed(0);
}

export function cmdBuildSingleRail(
  state: GameState,
  flags: number,
  t: number,
  track: Track,
): CommandCost {
  const { map } = state;
  if (!isValidTile(map, t) || track < 0 || track > 5) return CMD_ERROR;
  const exec = (flags & DoFlag.Execute) !== 0;
  const bit = trackToTrackBits(track);
  let cost = succeed(0);
  if (getTileType(map, t) === TileType.Railway) {
    if (getTileOwner(map, t) !== COMPANY_FIRST) return CMD_ERROR; // CheckTileOwnership: single player
    if (!isPlainRail(map, t)) return landscapeClear(state, t, flags, COMPANY_FIRST); // the depot's error
    const bits = getTrackBits(map, t);
    if ((bits | bit) === bits) return fail('error.alreadyBuilt'); // CheckTrackCombination
    // EnsureNoTrainOnTrack: no trains until block 1.4
    cost = addCost(cost, checkRailSlope(map, t));
    if (!cost.ok) return cost;
    if (exec) {
      setRailGroundType(map, t, RailGroundType.Barren);
      setTrackBits(map, t, bits | bit);
      state.company.infrastructure.rail +=
        railInfrastructurePieces(bits | bit) - railInfrastructurePieces(bits);
    }
  } else {
    // (Task 4 inserts the MP_ROAD level-crossing branch here.)
    cost = addCost(cost, checkRailSlope(map, t));
    if (!cost.ok) return cost;
    cost = addCost(cost, landscapeClear(state, t, flags, COMPANY_FIRST));
    if (!cost.ok) return cost;
    if (exec) {
      makeRailNormal(map, t, COMPANY_FIRST, bit, RAILTYPE_RAIL);
      state.company.infrastructure.rail++;
    }
  }
  if (exec) state.dirtyTiles.add(t);
  return addCost(cost, succeed(railBuildCost(state.prices)));
}
```

`cmdRemoveSingleRail(state, flags, t, track, actor)` (`MP_RAILWAY` branch): `!isValidTile` or bad track → `CMD_ERROR`; not a Railway tile → `fail('error.noRailroadTrack')`; `!isPlainRail` → `fail('error.noRailroadTrack')`; ownership checked unless `actor === OWNER_WATER`; `(bits & bit) === 0` → `fail('error.noRailroadTrack')`; cost `railClearCost`; exec: the tile owner's (`state.company`) `infrastructure.rail` loses `pieces(bits) - pieces(bits ^ bit)`; `bits ^= bit`; `bits === 0` → `doClearSquare(map, t, false)` else `setTrackBits`; mark dirty.

`validateAutoDrag(trackdir, x, y, ex, ey)` and `cmdRailTrackHelper(state, flags, startTile, endTile, track, remove)` — port line by line of the C++ quoted in track.md §4.6, keeping the order of the `had_success` update (R17):

```ts
const errorKey = (c: CommandCost): ErrorKey | null =>
  c.ok || c.error === null ? null : c.error.key; // module scope

const pieces = railDragPieces(state.map, startTile, endTile, track); // validateAutoDrag + the TRACKDELTA walk, once
if (pieces === null) return CMD_ERROR;
let hadSuccess = false;
let lastError: CommandCost = CMD_ERROR;
let total = succeed(0);
for (const piece of pieces) {
  const ret = remove
    ? cmdRemoveSingleRail(state, flags, piece.tile, piece.track, COMPANY_FIRST)
    : cmdBuildSingleRail(state, flags, piece.tile, piece.track);
  if (!remove && errorKey(lastError) === 'error.alreadyBuilt') hadSuccess = true;
  if (!ret.ok) {
    lastError = ret;
    if (errorKey(lastError) !== 'error.alreadyBuilt' && !remove && hadSuccess) break;
  } else {
    hadSuccess = true;
    total = addCost(total, ret);
  }
}
return hadSuccess ? total : lastError;
```

`railDragPieces(map, start, end, track)` is the only place with the walk: `validateAutoDrag(track, sx, sy, ex, ey)` (`TrackToTrackdir(track) === track`; `null` → return `null`), then from `startTile` push `{ tile, track: (td & 7) as Track }`, stop after `endTile`, else `tile += tileDiffXY(map, TRACKDELTA[td]![0], TRACKDELTA[td]![1])` and `if ((td & 7) > 1) td ^= 1` (toggle UPPER/LOWER, LEFT/RIGHT). `cmdRailTrackHelper` iterates these pieces with the same `hadSuccess`/`lastError` updates, in the same order and with the same early `break` (R17), so its result is unchanged; the ghost of Task 9 draws the same pieces.

`clearTileTrack(state, t, flags, actor)` (`ClearTile_Track`): `Auto` → owner ≠ `actor` → `fail('error.areaIsOwnedByAnother')`, plain → `fail('error.mustRemoveRailroadTrack')`, else `fail('error.buildingMustBeDemolished')`; plain rail → for each set bit, lowest first (`RemoveFirstTrack`): `addCost(cost, cmdRemoveSingleRail(state, flags, t, track, actor))`, returning the first failure; depot → `CMD_ERROR` until Task 5 adds `removeTrainDepot`.

`tileLoopTrack(state, t, markDirty)` (`TileLoop_Track`, temperate): `newGround = Grass`; if plain rail and `oldGround !== Barren`: for each `DiagDir` `d` with `(bits & TRACK_BITS_AT_EDGE[d]) === 0`, fence `d` when the neighbour is invalid, a house, an industry, a road, or `getTileOwner(neighbour) !== getTileOwner(t)`; map the fence set `{}`→Grass, `{NE}`→FenceNE, `{SE}`→FenceSE, `{SW}`→FenceSW, `{NW}`→FenceNW, `{NE,SW}`→FenceNESW, `{SE,NW}`→FenceSENW, `{NE,SE}`→FenceVert1, `{NE,NW}`→FenceHoriz2, `{SE,SW}`→FenceHoriz1, `{SW,NW}`→FenceVert2; set and `markDirty` only when it changed.

- [ ] **Step 4: Wire** — `clear-tile.ts`: Railway → `clearTileTrack`; `game.ts`: `[TileType.Railway]: (t) => tileLoopTrack(state, t, markDirty)`; `command.ts`: `buildRail` → `cmdBuildSingleRail(state, flags, c.tile, c.track)`, `removeRail` → `cmdRemoveSingleRail(state, flags, c.tile, c.track, COMPANY_FIRST)`, `buildRailroadTrack` → `cmdRailTrackHelper(state, flags, c.startTile, c.endTile, c.track, false)`, `removeRailroadTrack` → the same with `true`. `ground.ts` keeps returning `terrain.unknown` for rail until Task 9.

- [ ] **Step 5: i18n**

| Key                             | en                                   | es                                            |
| ------------------------------- | ------------------------------------ | --------------------------------------------- |
| `error.alreadyBuilt`            | ... already built                    | ... ya construido                             |
| `error.mustRemoveRailroadTrack` | Must remove railway track first      | Primero se debe retirar la vía de ferrocarril |
| `error.areaIsOwnedByAnother`    | ... area is owned by another company | ... el área es propiedad de otra empresa      |
| `error.noRailroadTrack`         | ... there is no railway track        | ... no hay ferrocarril                        |
| `error.flatLandRequired`        | Flat land required                   | Se requiere terreno llano                     |

- [ ] **Step 6: Run** — `npx vitest run src/sim` — Expected: all passed; `npm test && npm run lint && npm run typecheck` green.

- [ ] **Step 7: Commit** — `feat: build and remove rail track like OpenTTD` (body: single pieces and drags go through `CmdBuildSingleRail`/`CmdRailTrackHelper` so every combination, the clearing costs, the £53 refund and the drag's skip-then-stop rule match OpenTTD, including the one-tile lag of "already built" the code has (R17); a drag is checked against the cash as a whole (R25); slopes are refused until foundations arrive (R26); the track tile loop is ported because ground and fences are map state (R32). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 4: Level crossings over town roads

**Files:**

- Create: `src/sim/track/crossing.test.ts`
- Modify: `src/sim/map/road-map.ts`, `src/sim/map/road-map.test.ts`, `src/sim/track/rail-cmd.ts`, `src/sim/town/road-removal.ts`, `src/sim/town/town.ts`, `src/render/ground.ts`

Sources: roads.md §3 (field table: on a crossing `m1` is the rail owner and `m7` the road owner), §3.3 (`MakeRoadCrossing`), §4.1–4.3, §4.5 (town helpers see a crossing as a straight road), §4.12 (barred state needs trains: block 1.4), §4.13; construction.md §4.2 (crossing row). C++: `road_map.h:MakeRoadCrossing`, `GetRoadOwner`, `GetCrossingRoadAxis`, `GetCrossingRoadBits`, `GetCrossingRailTrack`; `rail_cmd.cpp:CmdBuildSingleRail` (`case MP_ROAD`), `CmdRemoveSingleRail` (`case MP_ROAD`); `road_cmd.cpp:ClearTile_Road` (`Crossing`), `RemoveRoad` (`Crossing`); `town_cmd.cpp:ClosestTownFromTile`, `GetTownRoadBits`.

**Interfaces:**

- Consumes: Tasks 1–3 (`cmdBuildSingleRail`, `cmdRemoveSingleRail`, `removeRoad`, `clearTileRoad`, `makeRailNormal`, `Track`, `Axis`, `axisToTrack`, `trackToTrackBits`, `countBits`, `railClearCost`); 1.2 road helpers.
- Produces (`map/road-map.ts`): `LEVELCROSSING_TRACKBIT_FACTOR = 2`, `makeRoadCrossing(map, t, roadOwner: number, railOwner: number, roadAxis: Axis, railType: number, townIndex: number): void`, `isLevelCrossingTile(map, t): boolean`, `getCrossingRoadAxis(map, t): Axis` (`m5 & 1`), `getCrossingRoadBits(map, t): number` (`RoadBits.X` for axis X, else `RoadBits.Y`), `getCrossingRailTrack(map, t): Track` (the other axis), `getCrossingRailBits(map, t): number`, `hasTownOwnedRoad(map, t): boolean`; `getRoadOwner` now reads `m7` on crossings (`GB(IsNormalRoadTile(t) ? m1 : m7, 0, 5)`); `getTownRoadBits` returns `getCrossingRoadBits` on crossings.
- Produces (`track/rail-cmd.ts`): `roadBuildCost(p: Prices): number` (`(p.buildRoad * 8) >> 3` = 71); the `MP_ROAD` branches of `cmdBuildSingleRail` and `cmdRemoveSingleRail`.
- Produces (`town/road-removal.ts`): the `Crossing` branches of `removeRoad` and `clearTileRoad`; the company's bulldozer on a crossing removes only the rail (R33): `cmdRemoveSingleRail(state, flags, t, getCrossingRailTrack(map, t), actor)`. The crossing dispatch comes first in `clearTileRoad`; Task 2's R33 refusal applies to normal roads only.
- Produces (`town/town.ts`): `closestTownFromTile` returns the tile's town for any road tile with a town-owned road (normal or crossing).
- Produces (`render/ground.ts`): a crossing draws its straight road sprite (`road.10` / `road.5`) until Task 9.

- [ ] **Step 1: Write the failing tests**

`src/sim/track/crossing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, type GameState } from '../game';
import { COMPANY_FIRST, getTileOwner, getTileType, OWNER_TOWN, tileXY, TileType } from '../map/map';
import { getTrackBits } from '../map/rail-map';
import {
  getCrossingRailBits,
  getRoadBits,
  getRoadOwner,
  getRoadside,
  getTownIndex,
  getTownRoadBits,
  isLevelCrossingTile,
  isNormalRoadTile,
  makeRoadNormal,
  RoadBits,
  Roadside,
} from '../map/road-map';
import { closestTownFromTile, newTown } from '../town/town';
import { tileLoopRoad } from '../town/town-roads';
import { Track, TrackBits } from './track';

const newGame = (): GameState => createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
/** A town at (20,20) owning a road with `bits` at (20,40). */
function withRoad(bits: number): { g: GameState; t: number } {
  const g = newGame();
  g.towns.push(newTown(0, at(g, 20, 20), 0, false));
  const t = at(g, 20, 40);
  makeRoadNormal(g.map, t, bits, 0);
  return { g, t };
}
const rail = (g: GameState, t: number, track: Track, mode: 'test' | 'exec' = 'exec') =>
  execute(g, { type: 'buildRail', tile: t, track }, mode);

describe('level crossings (port of rail_cmd.cpp case MP_ROAD, roads.md §4.1)', () => {
  it('turns a straight town road into a crossing for the price of the rail', () => {
    const { g, t } = withRoad(RoadBits.Y);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 75 });
    expect([
      isLevelCrossingTile(g.map, t),
      getTileOwner(g.map, t),
      getRoadOwner(g.map, t),
      getTownIndex(g.map, t),
      getCrossingRailBits(g.map, t),
      getRoadside(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, COMPANY_FIRST, OWNER_TOWN, 0, TrackBits.X, Roadside.Barren, 2]);
  });

  it('completes a one-piece stub across the rail for £75 + £71 (R16)', () => {
    const { g, t } = withRoad(RoadBits.NW);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 146 });
    expect(getTownRoadBits(g.map, t)).toBe(RoadBits.Y);
  });

  it('replaces a one-piece stub along the rail for £30 + £75 (R16)', () => {
    const { g, t } = withRoad(RoadBits.NE);
    expect(rail(g, t, Track.X)).toEqual({ ok: true, cost: 105 });
    expect([getTileType(g.map, t), getTrackBits(g.map, t)]).toEqual([
      TileType.Railway,
      TrackBits.X,
    ]);
  });

  it('refuses roads that run along the rail or branch', () => {
    for (const [bits, track] of [
      [RoadBits.X, Track.X],
      [RoadBits.X | RoadBits.SE, Track.Y],
    ] as const) {
      const { g, t } = withRoad(bits);
      expect(rail(g, t, track, 'test')).toEqual({
        ok: false,
        error: { key: 'error.mustRemoveRoadFirst', params: {} },
      });
    }
  });

  it('allows one track per crossing', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(rail(g, t, Track.X, 'test')).toEqual({
      ok: false,
      error: { key: 'error.alreadyBuilt', params: {} },
    });
    expect(rail(g, t, Track.Y, 'test')).toEqual({
      ok: false,
      error: { key: 'error.mustRemoveRoadFirst', params: {} },
    });
  });

  it('gives the town its road back when the rail is removed, for a £53 refund', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(execute(g, { type: 'removeRail', tile: t, track: Track.X }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([
      isNormalRoadTile(g.map, t),
      getRoadBits(g.map, t),
      getRoadOwner(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, RoadBits.Y, OWNER_TOWN, 0]);
  });

  it('loses only its rail to the bulldozer, for a £53 refund (R33, D2)', () => {
    const { g, t } = withRoad(RoadBits.Y);
    rail(g, t, Track.X);
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'test')).toEqual({
      ok: true,
      cost: -53,
    });
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'exec')).toEqual({
      ok: true,
      cost: -53,
    });
    expect([
      isNormalRoadTile(g.map, t),
      getRoadBits(g.map, t),
      getRoadOwner(g.map, t),
      getTownIndex(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([true, RoadBits.Y, OWNER_TOWN, 0, 0]);
    expect(g.company.clearLimit).toBe((4096 - 1) << 16); // one executed clear (R28)
    // The town road left behind is refused like any other (Review Focus 3).
    expect(execute(g, { type: 'landscapeClear', tile: t }, 'test')).toEqual({
      ok: false,
      error: { key: 'error.localAuthorityRefuses', params: { town: 0 } },
    });
  });

  it('still belongs to its town for the town helpers (roads.md §4.5)', () => {
    const { g, t } = withRoad(RoadBits.Y);
    g.towns.push(newTown(1, at(g, 21, 41), 1, false)); // closer by distance
    rail(g, t, Track.X);
    expect(closestTownFromTile(g, t, Infinity)?.index).toBe(0);
    tileLoopRoad(g, t, NOOP); // edge zone: barren → grass, as on any town road
    expect(getRoadside(g.map, t)).toBe(Roadside.Grass);
  });
});
```

Add to `src/sim/map/road-map.test.ts`:

```ts
it('stores a crossing like MakeRoadCrossing (roads.md §3.3)', () => {
  const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const t = tileXY(map, 10, 10);
  makeRoadCrossing(map, t, OWNER_TOWN, 0, Axis.Y, 0, 3);
  expect([
    map.m1[t],
    map.m2[t],
    map.m3[t],
    map.m4[t],
    map.m5[t],
    map.m6[t],
    map.m7[t],
    map.m8[t],
  ]).toEqual([0, 3, 0xf0, 0, 0x41, 0, 0x0f, 0xfc0]);
  expect([getCrossingRoadBits(map, t), getCrossingRailBits(map, t), getRoadOwner(map, t)]).toEqual([
    RoadBits.Y,
    TrackBits.X,
    OWNER_TOWN,
  ]);
});
```

Run: `npx vitest run src/sim` — Expected: FAIL.

- [ ] **Step 2: Implement the road-map helpers** — `makeRoadCrossing`: `resetTileKeepingHeight`, `setTileType(Road)`, `m1 = railOwner`, `m2 = townIndex`, `m3 = OWNER_TOWN << 4` (tram owner as stored), `m4 = ROADTYPE_ROAD`, `m5 = (RoadTileType.Crossing << 6) | roadAxis`, `m6 = 0` (roadside barren), `m7 = roadOwner`, `m8 = (INVALID_ROADTYPE << 6) | railType`. `getRailType` of `rail-map.ts` (`m8 & 0x3f`) reads a crossing's rail type too.

- [ ] **Step 3: Rail commands** — in `cmdBuildSingleRail`, before the default branch (port of `case MP_ROAD`; flat by R11, `crossing_with_competitor` true, no vehicles, road works or one-way roads in Stage 1):

```ts
if (getTileType(map, t) === TileType.Road) {
  if (isNormalRoadTile(map, t)) {
    const road = getRoadBits(map, t);
    if (
      (track === Track.X && (road & RoadBits.X) === 0) ||
      (track === Track.Y && (road & RoadBits.Y) === 0)
    ) {
      const newPieces = road !== RoadBits.None ? 2 - countBits(road) : 0;
      const crossing = succeed(newPieces * roadBuildCost(state.prices));
      if (exec) {
        makeRoadCrossing(
          map,
          t,
          getRoadOwner(map, t),
          COMPANY_FIRST,
          track === Track.X ? Axis.Y : Axis.X,
          RAILTYPE_RAIL,
          getTownIndex(map, t),
        );
        state.company.infrastructure.rail += LEVELCROSSING_TRACKBIT_FACTOR; // UpdateLevelCrossing: no trains, never barred
        state.dirtyTiles.add(t);
      }
      return addCost(crossing, succeed(railBuildCost(state.prices)));
    }
  }
  if (isLevelCrossingTile(map, t) && getCrossingRailBits(map, t) === bit)
    return fail('error.alreadyBuilt');
  // fall through to the default branch
}
```

In `cmdRemoveSingleRail` (`case MP_ROAD`): not a crossing or other rail bits → `fail('error.noRailroadTrack')`; ownership unless `OWNER_WATER`; cost `railClearCost`; exec: `infrastructure.rail -= LEVELCROSSING_TRACKBIT_FACTOR`, `makeRoadNormal(map, t, getCrossingRoadBits(map, t), getTownIndex(map, t))` (roads are town-owned in Stage 1), dirty.

- [ ] **Step 4: Road removal and town helpers** — `clearTileRoad` crossing (dispatch on `isLevelCrossingTile` **before** Task 2's R33 town-road refusal, which applies to normal roads only: `getRoadOwner` reads `m7` = `OWNER_TOWN` on a crossing, but the refusal must not fire there, or the company's bulldozer would be refused instead of removing the rail): `Auto` → `fail('error.mustRemoveRoadFirst')`; the company (R33, D2) → `cmdRemoveSingleRail(state, flags, t, getCrossingRailTrack(map, t), actor)` (rail only, £53 refund, the tile is the town's normal road again); other actors (the sea, towns: OpenTTD's code, unreachable on Stage 1 maps) → `ret = removeRoad(state, t, flags, getCrossingRoadBits(map, t), actor)`, and on success with exec `landscapeClear(state, t, flags, actor)` with its cost ignored; return `ret`. `removeRoad` crossing: `pieces & ~crossingRoadBits` → `CMD_ERROR`; `checkAllowRemoveRoad(state, t, pieces, getRoadOwner(map, t), actor)`; exec: `makeRailNormal(map, t, getTileOwner(map, t), getCrossingRailBits(map, t), getRailType(map, t))`, `infrastructure.rail -= LEVELCROSSING_TRACKBIT_FACTOR - 1`, dirty; cost `2 * p.clearRoad`. `closestTownFromTile`: `type === House || (type === Road && getRoadTileType(map, t) !== RoadTileType.Depot && hasTownOwnedRoad(map, t))` → the tile's town.

- [ ] **Step 5: Run** — `npx vitest run src/sim` — all passed; `npm test && npm run lint && npm run typecheck` green.

- [ ] **Step 6: Commit** — `feat: cross town roads with level crossings` (body: the player's rail over a straight town road, or over a stub, becomes a crossing with OpenTTD's cost, owner fields and infrastructure count (R16); the bulldozer only takes the crossing's rail back (£53 refund), because the player may not remove town roads (D2, R33); town helpers keep treating a crossing as their straight road, so the roadside loop and the closest town stay right. `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 5: Train depots

**Files:**

- Create: `src/sim/track/depot.ts`, `src/sim/track/depot.test.ts`, `src/sim/core/pool.ts`
- Modify: `src/sim/track/rail-cmd.ts` (`clearTileTrack` depot branch), `src/sim/game.ts` (`depots`, hash), `src/sim/command/command.ts`, `src/sim/command/command.test.ts`

Sources: track.md §4.8, §4.9; construction.md §4.6 (depot tool, `CcRailDepot` table), §4.2 (depot row). C++: `rail_cmd.cpp:CmdBuildTrainDepot`, `RemoveTrainDepot`; `town.h:MakeDefaultName` (lowest unused `town_cn` among the town's depots); `strings.cpp` (`{TOWN} Train Depot` / `{TOWN} Train Depot #{town_cn + 1}`); `rail_gui.cpp:CcRailDepot`, `PlaceExtraDepotRail`, `_place_depot_extra_track`, `_place_depot_extra_dir`.

**Interfaces:**

- Consumes: Tasks 1–4 (`landscapeClear`, `makeRailDepot`, `isRailDepotTile`, `getRailDepotDirection`, `setRailDepotExitDirection`, `getDepotIndex`, `railBuildCost`, `isPlainRail`, `getTrackBits`, `getRailTileType`, `DIAGDIR_REACHES_TRACKS`, `Track`); 1.2 `closestTownFromTile`, `tileOffsByDiagDir`, `isValidTile`.
- Produces (`track/depot.ts`): `interface Depot { index: number; xy: number; townIndex: number; townCn: number; buildDate: number }`, `cmdBuildTrainDepot(state, flags, t, dir: DiagDir): CommandCost`, `removeTrainDepot(state, t, flags, actor): CommandCost`, `depotExtraRail(state, depotTile: number, dir: DiagDir, step: 0 | 1 | 2): { tile: number; track: Track } | null` (one `PlaceExtraDepotRail` call of `CcRailDepot`, read from the current state).
- Produces (`core/pool.ts`): `lowestFreeSlot<T>(pool: readonly (T | null)[]): number` (first `null` slot, else `pool.length` — OpenTTD's pools reuse the lowest free index).
- Produces (`game.ts`): `GameState.depots: (Depot | null)[]` (OpenTTD's pool: a new depot takes the lowest free index); hashed per slot (`-1` for an empty slot; nothing when the array is empty).
- Produces (`command/command.ts`): `{ type: 'buildTrainDepot'; tile: number; dir: DiagDir }` (`Auto | NoWater`, `landscapeConstruction`; `commandTile`: `tile`).

- [ ] **Step 1: Write the failing test** — `src/sim/track/depot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { getClearDensity } from '../map/clear';
import { tileLoopWater } from '../map/flood';
import { DiagDir } from '../map/geometry';
import { makeHouseTile } from '../map/house-map';
import { getTileType, tileXY, TileType } from '../map/map';
import { getRailDepotDirection, isRailDepotTile } from '../map/rail-map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { depotExtraRail } from './depot';
import { Track } from './track';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const depot = (g: GameState, t: number, dir: DiagDir, mode: 'test' | 'exec' = 'exec') =>
  execute(g, { type: 'buildTrainDepot', tile: t, dir }, mode);

describe('train depots (port of rail_cmd.cpp:CmdBuildTrainDepot)', () => {
  it('costs £450 + £75 + clearing and is named after the closest town', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    const before = hashGameState(g);
    expect(depot(g, t, DiagDir.NW, 'test')).toEqual({ ok: true, cost: 540 });
    expect(hashGameState(g)).toBe(before);
    expect(depot(g, t, DiagDir.NW)).toEqual({ ok: true, cost: 540 });
    expect([
      isRailDepotTile(g.map, t),
      g.map.m5[t],
      g.map.m2[t],
      g.company.infrastructure.rail,
    ]).toEqual([true, 0xc3, 0, 1]);
    expect(g.depots).toEqual([
      { index: 0, xy: t, townIndex: 0, townCn: 0, buildDate: g.calendar.date },
    ]);
  });

  it('numbers depots per town and reuses freed numbers and slots (MakeDefaultName)', () => {
    const g = newGame();
    depot(g, at(g, 22, 22), DiagDir.NW);
    depot(g, at(g, 24, 24), DiagDir.NW);
    expect(g.depots.map((d) => d?.townCn)).toEqual([0, 1]);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 22, 22) }, 'exec')).toEqual({
      ok: true,
      cost: 60,
    });
    expect(g.depots[0]).toBeNull();
    depot(g, at(g, 26, 26), DiagDir.NW);
    expect([g.depots[0]?.xy, g.depots[0]?.townCn]).toEqual([at(g, 26, 26), 0]);
  });

  it('rotates its own depot for £525 and charges nothing for the same direction', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    depot(g, t, DiagDir.NW);
    expect(depot(g, t, DiagDir.NE)).toEqual({ ok: true, cost: 525 });
    expect(getRailDepotDirection(g.map, t)).toBe(DiagDir.NE);
    expect(depot(g, t, DiagDir.NE)).toEqual({ ok: true, cost: 0 });
    expect(g.company.infrastructure.rail).toBe(1);
  });

  it('refuses slopes, water, houses and track (R26)', () => {
    const g = newGame();
    g.map.height[at(g, 41, 41)] = 0;
    makeSea(g.map, at(g, 30, 30));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    execute(g, { type: 'buildRail', tile: at(g, 10, 10), track: Track.X }, 'exec');
    expect(
      [at(g, 40, 40), at(g, 30, 30), at(g, 21, 20), at(g, 10, 10)].map((t) =>
        depot(g, t, DiagDir.NW, 'test'),
      ),
    ).toEqual([
      { ok: false, error: { key: 'error.flatLandRequired', params: {} } },
      { ok: false, error: { key: 'error.cantBuildOnWater', params: {} } },
      { ok: false, error: { key: 'error.buildingMustBeDemolished', params: {} } },
      { ok: false, error: { key: 'error.mustRemoveRailroadTrack', params: {} } },
    ]);
  });

  it('is bulldozed for £60 and refused to builders (RemoveTrainDepot, ClearTile_Track)', () => {
    const g = newGame();
    const t = at(g, 22, 22);
    depot(g, t, DiagDir.NW);
    expect(execute(g, { type: 'buildRail', tile: t, track: Track.Y }, 'test')).toEqual({
      ok: false,
      error: { key: 'error.buildingMustBeDemolished', params: {} },
    });
    execute(g, { type: 'landscapeClear', tile: t }, 'exec');
    expect([
      getTileType(g.map, t),
      getClearDensity(g.map, t),
      g.company.infrastructure.rail,
    ]).toEqual([TileType.Clear, 0, 0]);
  });

  it('proposes the follow-up rails of CcRailDepot from the tile in front of the exit', () => {
    const g = newGame();
    const t = at(g, 10, 10);
    depot(g, t, DiagDir.NW); // exit towards (10,9)
    execute(g, { type: 'buildRail', tile: at(g, 10, 9), track: Track.X }, 'exec');
    expect(([0, 1, 2] as const).map((step) => depotExtraRail(g, t, DiagDir.NW, step))).toEqual([
      { tile: at(g, 10, 9), track: Track.Right },
      null,
      { tile: at(g, 10, 9), track: Track.Lower },
    ]);
    const h = newGame();
    depot(h, at(h, 10, 10), DiagDir.NW);
    execute(h, { type: 'buildRail', tile: at(h, 10, 9), track: Track.Y }, 'exec');
    expect(
      ([0, 1, 2] as const).map((step) => depotExtraRail(h, at(h, 10, 10), DiagDir.NW, step)),
    ).toEqual([null, { tile: at(h, 10, 9), track: Track.Y }, null]);
    depot(h, at(h, 10, 8), DiagDir.SE); // another depot across: no straight piece
    expect(depotExtraRail(h, at(h, 10, 10), DiagDir.NW, 1)).toBeNull();
  });

  it('is washed away on a cleared sea tile (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    depot(g, at(g, 11, 11), DiagDir.NW);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), g.depots[0], g.company.infrastructure.rail]).toEqual(
      [true, null, 0],
    );
  });
});
```

Extend `command.test.ts`'s pause-level test with `pauseLevel('buildTrainDepot')` → `3`.

Run: `npx vitest run src/sim/track/depot.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `depot.ts`**:

```ts
export function cmdBuildTrainDepot(
  state: GameState,
  flags: number,
  t: number,
  dir: DiagDir,
): CommandCost {
  const { map } = state;
  if (!isValidTile(map, t) || dir < 0 || dir > 3) return CMD_ERROR;
  if (!isTileFlat(map, t)) return fail('error.flatLandRequired'); // R26: no foundations
  let cost = succeed(0);
  const rotate = isRailDepotTile(map, t) && getRailType(map, t) === RAILTYPE_RAIL;
  if (rotate) {
    if (dir === getRailDepotDirection(map, t)) return succeed(0);
  } else {
    cost = addCost(cost, landscapeClear(state, t, flags, COMPANY_FIRST));
    if (!cost.ok) return cost;
  }
  if ((flags & DoFlag.Execute) !== 0) {
    if (rotate) {
      setRailDepotExitDirection(map, t, dir);
    } else {
      const index = lowestFreeSlot(state.depots);
      const depot: Depot = {
        index,
        xy: t,
        townIndex: 0,
        townCn: 0,
        buildDate: state.calendar.date,
      };
      makeRailDepot(map, t, COMPANY_FIRST, index, dir, RAILTYPE_RAIL);
      makeDefaultName(state, depot); // town = ClosestTownFromTile(xy, UINT_MAX); lowest unused town_cn
      state.depots[index] = depot;
      state.company.infrastructure.rail++;
    }
    state.dirtyTiles.add(t);
  }
  return addCost(cost, succeed(state.prices.buildDepotTrain + railBuildCost(state.prices)));
}
```

```ts
/** Port of town.h:MakeDefaultName for depots. Stage 1 always has a town (R12). */
function makeDefaultName(state: GameState, depot: Depot): void {
  depot.townIndex = closestTownFromTile(state, depot.xy, Infinity)!.index;
  const used = new Set(
    state.depots
      .filter((d) => d !== null && d !== depot && d.townIndex === depot.townIndex)
      .map((d) => d!.townCn),
  );
  let cn = 0;
  while (used.has(cn)) cn++;
  depot.townCn = cn;
}
```

A water tile is refused by the nested `landscapeClear` (`NoWater`). `removeTrainDepot(state, t, flags, actor)`: ownership unless `OWNER_WATER`; no vehicles yet; exec: `infrastructure.rail--`, `state.depots[getDepotIndex(map, t)] = null`, `doClearSquare`, dirty; cost `p.clearDepotTrain`. `clearTileTrack`'s depot branch calls it.

`depotExtraRail(state, depotTile, dir, step)` — port of `CcRailDepot` / `PlaceExtraDepotRail`:

```ts
const EXTRA_TRACK = [
  Track.Left,
  Track.Upper,
  Track.Upper,
  Track.Right,
  Track.X,
  Track.Y,
  Track.X,
  Track.Y,
  Track.Lower,
  Track.Left,
  Track.Right,
  Track.Lower,
];
const EXTRA_DIR = [
  DiagDir.SE,
  DiagDir.SW,
  DiagDir.SE,
  DiagDir.SW,
  DiagDir.SW,
  DiagDir.NW,
  DiagDir.NE,
  DiagDir.SE,
  DiagDir.NW,
  DiagDir.NE,
  DiagDir.NW,
  DiagDir.NE,
];
// tile = depotTile + offset(dir); null unless it is a Railway tile
// step 1 is skipped when tile + offset(dir) is a valid rail depot tile ("double depot")
// PlaceExtraDepotRail: depot → null; signals → null; (bits & DIAGDIR_REACHES_TRACKS[EXTRA_DIR[dir + 4 * step]]) === 0 → null
// otherwise { tile, track: EXTRA_TRACK[dir + 4 * step] }
```

- [ ] **Step 3: Wire** — `game.ts`: `depots: []` in `newGameState`; hash after the industries: for each slot `d === null ? num(-1) : [d.index, d.xy, d.townIndex, d.townCn, d.buildDate].forEach(num)`. `command.ts`: `buildTrainDepot`. `ground.ts`/`objects.ts` stay as they are until Task 9.

- [ ] **Step 4: Run** — `npx vitest run src/sim` — all passed; `npm test && npm run lint && npm run typecheck` green (the golden hash is unchanged: no depots in a new world).

- [ ] **Step 5: Commit** — `feat: build, rotate and remove train depots` (body: `CmdBuildTrainDepot` with OpenTTD's £450 + track price, rotation of an existing depot and per-town depot numbering, and `RemoveTrainDepot` for the bulldozer and the sea (R21); the follow-up pieces of `CcRailDepot` are exposed step by step so the session can post them as separate commands, like the original callback. `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 6: Rail stations — building, joining and naming

**Files:**

- Create: `src/sim/map/station-map.ts`, `src/sim/station/station.ts`, `src/sim/station/station-name.ts`, `src/sim/station/station-name.test.ts`, `src/sim/station/build-station.ts`, `src/sim/station/build-station.test.ts`
- Modify: `src/sim/map/clear-tile.ts` (Station case), `src/sim/game.ts` (`stations`, hash), `src/sim/command/command.ts`, `src/sim/command/command.test.ts`, `src/sim/command/cost.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

Sources: stations-cargo.md §3 (BaseStation/Station fields), §4.1, §4.2 (note: woods and lakeside **do** apply on Stage 1 maps — trees and sea exist; valley/heights apply to a station on a cleared height-0 tile); construction.md §4.6. C++: `station_cmd.cpp:CmdBuildRailStation`, `CalculateRailStationCost`, `CheckFlatLandRailStation`, `CheckBuildableTile`, `FindJoiningBaseStation`, `GetStationAround`, `BuildStationPart`, `CanExpandRailStation`, `GenerateStationName`, `CountMapSquareAround`, `CMSAMine`, `CMSAWater`, `CMSATree`, `RailStationTileLayout::Iterator::operator*`; `station.cpp:Station::AddFacility`; `station_map.h:MakeStation`, `MakeRailStation`, `SetStationTileRandomBits`.

**Interfaces:**

- Consumes: Tasks 1–5 (`landscapeClear`, `cmdRemoveSingleRail`, `isPlainRail`, `getTrackBits`, `railBuildCost`, `lowestFreeSlot`, `Axis`, `Track`, `orthogonalTiles`); 1.2: `closestTownFromTile`, `tileAddWrap`, `distanceMax`, `distanceFromEdge`, `getTileZ`, `isTileFlat`, `isWaterTile`, `getIndustryIndex`, `IndustryType`, `nextRandom`.
- Produces (`map/station-map.ts`): `StationType = { Rail: 0 }`, `makeRailStation(map, t, owner, stationIndex, axis: Axis, section: number, railType): void` (`MakeStation` + `SetRailType`: `m1 = owner | (WaterClass.Invalid << 5)`, `m2 = stationIndex`, `m3 = m4 = 0`, `m5 = section + axis`, `m6 = StationType.Rail << 3`, `m7 = 0`, `m8 = railType`), `isRailStationTile(map, t)`, `getStationIndex(map, t)` (`m2`), `getStationGfx(map, t)` (`m5`), `getRailStationAxis(map, t): Axis` (`m5 & 1`), `getStationTileRandomBits(map, t)` (`m3 >> 4`), `setStationTileRandomBits(map, t, bits)`.
- Produces (`station/station.ts`): `StationFacility = { Train: 1 }`, `interface TileArea { tile: number; w: number; h: number }`, `interface Station { index: number; xy: number; townIndex: number; nameKind: StationNameKind; owner: number; trainStation: TileArea | null; facilities: number; deleteCtr: number; buildDate: number; randomBits: number }`, `STATION_SPREAD = 12`, `isInUse(st: Station): boolean`, `tileBelongsToRailStation(map, st, t): boolean`.
- Produces (`station/station-name.ts`): `type StationNameKind = 'town' | 'north' | 'south' | 'east' | 'west' | 'central' | 'transfer' | 'halt' | 'valley' | 'heights' | 'woods' | 'lakeside' | 'exchange' | 'mines' | 'annexe' | 'sidings' | 'branch' | 'upper' | 'lower' | 'fallback'`, `STATION_NAME_KINDS: readonly StationNameKind[]` (that order; used by the hash), `generateStationName(state, st: Station, t: number): StationNameKind`.
- Produces (`station/build-station.ts`): `railStationLayout(numTracks: number, platLength: number): number[]` (sections by position, platform after platform), `cmdBuildRailStation(state, flags, tileOrg, axis: Axis, numTracks: number, platLength: number): CommandCost`.
- Produces (`game.ts`): `GameState.stations: (Station | null)[]`, hashed per slot after the depots (`-1` for an empty slot).
- Produces (`command/command.ts`): `{ type: 'buildRailStation'; tile: number; axis: Axis; numTracks: number; platLength: number }` (`Auto | NoWater`, `landscapeConstruction`; `commandTile`: `tile`; `station_to_join = NEW_STATION`, `adjacent = false`, R18).
- Produces (`command/cost.ts`): `'error.adjoinsMoreThanOne'`, `'error.stationTooSpreadOut'`, `'error.mustDemolishRailroad'`.
- Produces (`map/clear-tile.ts`): Station tiles: `Auto` → `fail('error.mustDemolishRailroad')`; otherwise `CMD_ERROR` until Task 7 replaces it with `clearTileStation`.

- [ ] **Step 1: Write the failing tests**

`src/sim/station/build-station.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { DoFlag } from '../command/cost';
import { nextRandom } from '../core/random';
import { createEmptyGame, hashGameState, type GameState } from '../game';
import { ClearGround, makeClear } from '../map/clear';
import { landscapeClear } from '../map/clear-tile';
import { makeHouseTile } from '../map/house-map';
import { COMPANY_FIRST, tileX, tileXY } from '../map/map';
import { getStationGfx, getStationTileRandomBits } from '../map/station-map';
import { makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis, Track } from '../track/track';
import { railStationLayout } from './build-station';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const station = (
  g: GameState,
  x: number,
  y: number,
  axis: Axis,
  numTracks: number,
  platLength: number,
  mode: 'test' | 'exec' = 'exec',
) => execute(g, { type: 'buildRailStation', tile: at(g, x, y), axis, numTracks, platLength }, mode);
const ERR = (key: string) => ({ ok: false, error: { key, params: {} } });

describe('CmdBuildRailStation costs and layout (station_cmd.cpp)', () => {
  it('charges the platform-length price by its odd counter, not once per platform (R17)', () => {
    const g = newGame();
    const before = hashGameState(g);
    expect(station(g, 22, 30, Axis.X, 1, 5, 'test')).toEqual({ ok: true, cost: 1605 }); // 5 × (150 + 75 + 15) + 3 × 135
    expect(station(g, 22, 40, Axis.Y, 2, 3, 'test')).toEqual({ ok: true, cost: 1845 }); // 6 × 240 + 3 × 135
    expect(hashGameState(g)).toBe(before);
    for (let x = 22; x <= 26; x++) makeClear(g.map, at(g, x, 30), ClearGround.Grass, 0);
    expect(station(g, 22, 30, Axis.X, 1, 5, 'test')).toEqual({ ok: true, cost: 1530 });
  });

  it("lays out OpenTTD's default tiles (RailStationTileLayout)", () => {
    expect([
      railStationLayout(1, 5),
      railStationLayout(2, 3),
      railStationLayout(1, 1),
      railStationLayout(3, 1),
    ]).toEqual([[0, 0, 2, 0, 0], [4, 4, 4, 6, 6, 6], [2], [0, 2, 0]]);
    const g = newGame();
    station(g, 30, 30, Axis.Y, 2, 3);
    expect(
      [
        [30, 30],
        [30, 32],
        [31, 30],
        [31, 32],
      ].map(([x, y]) => getStationGfx(g.map, at(g, x!, y!))),
    ).toEqual([5, 5, 7, 7]);
  });

  it('creates a station named after its town and keeps its random draws (R29)', () => {
    const g = newGame();
    const copy = { ...g.random };
    const draws = [0, 1, 2, 3].map(() => nextRandom(copy));
    expect(station(g, 22, 20, Axis.X, 1, 3)).toEqual({ ok: true, cost: 3 * 240 + 2 * 135 });
    expect(g.stations).toEqual([
      {
        index: 0,
        xy: at(g, 22, 20),
        townIndex: 0,
        nameKind: 'town',
        owner: COMPANY_FIRST,
        trainStation: { tile: at(g, 22, 20), w: 3, h: 1 },
        facilities: 1,
        deleteCtr: 0,
        buildDate: g.calendar.date,
        randomBits: draws[0]! & 0xffff,
      },
    ]);
    expect([22, 23, 24].map((x) => getStationTileRandomBits(g.map, at(g, x, 20)))).toEqual(
      draws.slice(1).map((d) => d & 0xf),
    );
    expect(g.random).toEqual(copy);
    expect(g.company.infrastructure).toEqual({ rail: 3, station: 3 });
  });

  it('extends its own platform without charging the tiles already there', () => {
    const g = newGame();
    station(g, 22, 20, Axis.X, 1, 3);
    expect(station(g, 21, 20, Axis.X, 1, 5)).toEqual({ ok: true, cost: 750 });
    expect([g.stations.length, g.stations[0]!.trainStation]).toEqual([
      1,
      { tile: at(g, 21, 20), w: 5, h: 1 },
    ]);
    expect(g.company.infrastructure).toEqual({ rail: 5, station: 5 });
  });

  it('charges a rotated tile as new, and overbuilds one aligned rail piece for a refund', () => {
    const g = newGame();
    station(g, 22, 20, Axis.X, 1, 1);
    expect(station(g, 22, 20, Axis.Y, 1, 1, 'test')).toEqual({ ok: true, cost: 360 });
    execute(g, { type: 'buildRail', tile: at(g, 30, 30), track: Track.X }, 'exec');
    execute(g, { type: 'buildRail', tile: at(g, 32, 30), track: Track.Y }, 'exec');
    expect(station(g, 30, 30, Axis.X, 1, 1, 'test')).toEqual({ ok: true, cost: 307 }); // -53 + 150 + 75 + 135
    expect(station(g, 32, 30, Axis.X, 1, 1, 'test')).toEqual(ERR('error.mustRemoveRailroadTrack'));
  });

  it('refuses slopes, water, houses, oversize drags; builders cannot clear it (R26)', () => {
    const g = newGame();
    g.map.height[at(g, 41, 41)] = 0;
    makeSea(g.map, at(g, 30, 30));
    makeHouseTile(g.map, at(g, 21, 20), 0, 0, 3, 0x06, 0);
    expect([
      station(g, 40, 40, Axis.X, 1, 1, 'test'),
      station(g, 30, 30, Axis.X, 1, 1, 'test'),
      station(g, 21, 20, Axis.X, 1, 1, 'test'),
    ]).toEqual([
      ERR('error.flatLandRequired'),
      ERR('error.cantBuildOnWater'),
      ERR('error.buildingMustBeDemolished'),
    ]);
    expect(station(g, 10, 10, Axis.X, 1, 13, 'test')).toEqual({ ok: false, error: null });
    station(g, 10, 30, Axis.X, 1, 1);
    expect(landscapeClear(g, at(g, 10, 30), DoFlag.Auto, COMPANY_FIRST)).toEqual(
      ERR('error.mustDemolishRailroad'),
    );
    expect(execute(g, { type: 'buildRail', tile: at(g, 10, 30), track: Track.Y }, 'test')).toEqual(
      ERR('error.mustDemolishRailroad'),
    );
  });
});

describe('joining stations (FindJoiningBaseStation, R18, Review Focus 5)', () => {
  it('joins the single neighbour, also diagonally', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 23, 30, Axis.X, 1, 1);
    station(g, 24, 31, Axis.X, 1, 1);
    expect([g.stations.length, g.stations[0]!.trainStation]).toEqual([
      1,
      { tile: at(g, 22, 30), w: 3, h: 2 },
    ]);
  });

  it('builds a separate station two tiles away', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 24, 30, Axis.X, 1, 1);
    expect(g.stations.map((s) => s?.index)).toEqual([0, 1]);
  });

  it('refuses a drag that touches two of its stations', () => {
    const g = newGame();
    station(g, 22, 30, Axis.X, 1, 1);
    station(g, 25, 30, Axis.X, 1, 1);
    const before = hashGameState(g);
    expect(station(g, 23, 30, Axis.X, 1, 2)).toEqual(ERR('error.adjoinsMoreThanOne'));
    expect(hashGameState(g)).toBe(before);
  });

  it('refuses a join that would spread the station over more than 12 tiles', () => {
    const g = newGame();
    station(g, 10, 30, Axis.X, 1, 12);
    expect(tileX(g.map, g.stations[0]!.trainStation!.tile)).toBe(10);
    expect(station(g, 22, 30, Axis.X, 1, 1, 'test')).toEqual(ERR('error.stationTooSpreadOut'));
  });
});
```

`src/sim/station/station-name.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, type GameState } from '../game';
import { IndustryType } from '../industry/industry-specs';
import { makeIndustry } from '../map/industry-map';
import { tileXY } from '../map/map';
import { makeTree, TreeGround, TreeGrowth } from '../map/tree-map';
import { makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis } from '../track/track';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const nameOf = (g: GameState, x: number, y: number): string | undefined => {
  execute(
    g,
    { type: 'buildRailStation', tile: at(g, x, y), axis: Axis.X, numTracks: 1, platLength: 1 },
    'exec',
  );
  return g.stations.at(-1)?.nameKind;
};

describe('GenerateStationName (station_cmd.cpp)', () => {
  it('uses the town name, then Central, then the free directions', () => {
    const g = newGame();
    expect([nameOf(g, 22, 20), nameOf(g, 16, 20), nameOf(g, 30, 30), nameOf(g, 5, 5)]).toEqual([
      'town',
      'central',
      'south',
      'north',
    ]);
  });

  it('names a station next to a coal mine "Mines"', () => {
    const g = newGame();
    g.industries.push({
      index: 0,
      type: IndustryType.CoalMine,
      tile: at(g, 40, 10),
      width: 4,
      height: 4,
      townIndex: 0,
      layoutIndex: 0,
      productionRate: 15,
      counter: 0,
      randomColour: 0,
      random: 0,
      prodLevel: 16,
    });
    makeIndustry(g.map, at(g, 40, 10), 0, 0, 0);
    makeIndustry(g.map, at(g, 41, 10), 0, 1, 0);
    expect(nameOf(g, 42, 12)).toBe('mines');
  });

  it('names stations by eight trees "Woods" and by five sea tiles near the edge "Lakeside"', () => {
    const g = newGame();
    for (let x = 27; x <= 30; x++)
      for (const y of [37, 38])
        makeTree(g.map, at(g, x, y), 0, 0, TreeGrowth.Grown, TreeGround.Grass, 3);
    expect(nameOf(g, 30, 40)).toBe('woods');
    for (let x = 8; x <= 12; x++) makeSea(g.map, at(g, x, 38));
    expect(nameOf(g, 10, 40)).toBe('lakeside');
  });
});
```

Extend `command.test.ts`'s pause-level test with `pauseLevel('buildRailStation')` → `3`.

Run: `npx vitest run src/sim/station` — Expected: FAIL.

- [ ] **Step 2: Map and station records** — `station-map.ts`, `station.ts` as in Interfaces. `tileBelongsToRailStation(map, st, t) = isRailStationTile(map, t) && getStationIndex(map, t) === st.index`.

- [ ] **Step 3: Implement `build-station.ts`** — port of `station_cmd.cpp` (stations-cargo.md §4.1):

```ts
/** Port of RailStationTileLayout::Iterator::operator* for stations without a NewGRF spec. */
export function railStationLayout(numTracks: number, platLength: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < numTracks * platLength; p++) {
    if (platLength === 1) out.push(p === Math.trunc((numTracks - 1) / 2) ? 2 : 0);
    else if (p < platLength && numTracks % 2 === 1)
      out.push(p === Math.trunc((platLength - 1) / 2) ? 2 : 0);
    else if (platLength > 4 && (p % platLength === 0 || p % platLength === platLength - 1))
      out.push(0);
    else out.push(Math.trunc(p / platLength) % 2 === numTracks % 2 ? 4 : 6);
  }
  return out;
}
```

`cmdBuildRailStation(state, flags, tileOrg, axis, numTracks, platLength)`, in the C++ order:

1. `CheckIfAuthorityAllowsNewStation`: rating 500 > `RATING_VERYPOOR` (R15) → allowed (comment only).
2. `!isValidTile(tileOrg)`, `axis` not 0/1, `platLength === 0 || numTracks === 0` → `CMD_ERROR`; `(w, h) = axis === X ? (platLength, numTracks) : (numTracks, platLength)`; `tileAddWrap(map, tileOrg, w - 1, h - 1) === INVALID_TILE` → `CMD_ERROR`; `w > STATION_SPREAD || h > STATION_SPREAD` → `CMD_ERROR`.
3. `CalculateRailStationCost` over `orthogonalTiles(area)` (X fastest), with `allowedZ = { z: -1 }` and `est = { index: -1 }`:

```ts
let lengthPriceReady = true;
let tracknum = 0;
let cost = succeed(0);
for (const t of orthogonalTiles(map, area.tile, tileXY(map, x + w - 1, y + h - 1))) {
  const ret = checkFlatLandRailStation(state, t, allowedZ, flags, axis, est);
  if (!ret.ok) return ret;
  if (tracknum === numTracks) {
    lengthPriceReady = true;
    tracknum = 0;
  } else {
    tracknum++;
  } // the code, not the comment (R17)
  if (!isRailStationTile(map, t) || getRailStationAxis(map, t) !== axis) {
    cost = addCost(cost, ret);
    cost = addCost(cost, succeed(p.buildStationRail + railBuildCost(p)));
    if (lengthPriceReady) {
      cost = addCost(cost, succeed(p.buildStationRailLength));
      lengthPriceReady = false;
    }
  }
}
```

`checkFlatLandRailStation` (`CheckFlatLandRailStation` + `CheckBuildableTile`): non-flat → `fail('error.flatLandRequired')` (R26); `allowedZ.z < 0` → set to `getTileZ`, else different → `fail('error.flatLandRequired')`; a station tile: (only rail stations exist) `est.index === -1` → take its index, another index → `fail('error.adjoinsMoreThanOne')`, cost 0; plain rail with exactly one track equal to `axis === X ? Track.X : Track.Y` → `cmdRemoveSingleRail(state, flags, t, track, COMPANY_FIRST)`; anything else → `landscapeClear(state, t, flags, COMPANY_FIRST)`.

4. `FindJoiningBaseStation(est, NEW_STATION, adjacent = false)`: `est.index >= 0` → that station; else `getStationAround`: scan the area expanded by one tile (clamped to the map like `TileArea::Expand`) for station tiles of company-owned stations; a second distinct index → `fail('error.adjoinsMoreThanOne')`.
5. `BuildStationPart` (`reuse = false`): a found station must be ours (always); with no station and `Execute`: `index = lowestFreeSlot(state.stations)`, `{ index, xy: area.tile, townIndex: closestTownFromTile(state, area.tile, Infinity)!.index, nameKind: 'town' /* replaced next */, owner: COMPANY_FIRST, trainStation: null, facilities: 0, deleteCtr: 0, buildDate: state.calendar.date, randomBits: 0 }`, stored, then `nameKind = generateStationName(state, st, area.tile)`.
6. `CanExpandRailStation` when the station already has a `trainStation`: the union rectangle; `w` or `h` > 12 → `fail('error.stationTooSpreadOut')`; the area becomes the union. (`rect.BeforeAddRect(ADD_TEST)` is the same check on the same rectangle, R29.)
7. Execute: `st.trainStation = area`; `AddFacility(Train, area.tile)`: if `facilities === 0` then `st.xy = area.tile` and `st.randomBits = nextRandom(state.random) & 0xffff`; `facilities |= Train`; `owner`; `buildDate`. Then for track `i` (step `trackDelta` = `(0,1)` for axis X, `(1,0)` for axis Y) and platform position `j` (step `tileDelta` = `(1,0)` for X, `(0,1)` for Y), layout index `i * platLength + j`: an existing rail station tile gives back `infrastructure.rail--`, `infrastructure.station--`; `makeRailStation(map, tile, COMPANY_FIRST, st.index, axis, layout[k], RAILTYPE_RAIL)`; `setStationTileRandomBits(map, tile, nextRandom(state.random) & 0xf)`; `infrastructure.rail++`, `infrastructure.station++`; dirty. (`AfterStationTileSetChange` = catchment and acceptance: block 1.5.)

`generateStationName(state, st, t)` — port of `GenerateStationName` for `STATIONNAMING_RAIL`:

```ts
const town = state.towns[st.townIndex]!;
const used = new Set<StationNameKind>();
for (const s of state.stations)
  if (s !== null && s !== st && s.townIndex === st.townIndex && s.nameKind !== 'fallback')
    used.add(s.nameKind);
// The industry spiral is skipped: default industries name no station (station_name = STR_UNDEFINED).
const free = (k: StationNameKind): boolean => !used.has(k);
if (free('mines') && countMapSquareAround(state, t, isMineTile) >= 2) return 'mines'; // CMSAMine: coal mines
if (distanceMax(map, t, town.xy) < 8) {
  if (free('town')) return 'town';
  if (free('central')) return 'central';
}
if (
  free('lakeside') &&
  distanceFromEdge(map, t) < 20 &&
  countMapSquareAround(state, t, (s, u) => isWaterTile(s.map, u)) >= 5
)
  return 'lakeside';
if (
  free('woods') &&
  countMapSquareAround(state, t, (s, u) => getTileType(s.map, u) === TileType.Trees) >= 8
)
  return 'woods';
const z = getTileZ(map, t),
  z2 = getTileZ(map, town.xy);
if (z < z2 && free('valley')) return 'valley';
if (z > z2 && free('heights')) return 'heights';
if (tileX(map, t) < tileX(map, town.xy)) {
  used.add('south');
  used.add('west');
} else {
  used.add('north');
  used.add('east');
}
if (tileY(map, t) < tileY(map, town.xy)) {
  used.add('south');
  used.add('east');
} else {
  used.add('north');
  used.add('west');
}
for (const k of [
  'north',
  'south',
  'east',
  'west',
  'transfer',
  'halt',
  'exchange',
  'annexe',
  'sidings',
  'branch',
  'upper',
  'lower',
] as const)
  if (free(k)) return k;
return 'fallback';
```

`countMapSquareAround(state, t, pred)` scans `dx, dy ∈ [-3, 3]` with `tileAddWrap`; `isMineTile` = an industry tile whose industry is a `CoalMine` (extractive, non-liquid cargo).

- [ ] **Step 4: Wire** — `game.ts`: `stations: []`, hash `[s.index, s.xy, s.townIndex, STATION_NAME_KINDS.indexOf(s.nameKind), s.owner, ts?.tile ?? -1, ts?.w ?? 0, ts?.h ?? 0, s.facilities, s.deleteCtr, s.buildDate, s.randomBits]` per slot. `command.ts`: `buildRailStation`. `clear-tile.ts`: Station as in Interfaces.

- [ ] **Step 5: i18n**

| Key                          | en                                                  | es                                                     |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `error.adjoinsMoreThanOne`   | Adjoins more than one existing station/loading area | Contigua a más de una estación/zona de carga existente |
| `error.stationTooSpreadOut`  | ... station too spread out                          | ... estación demasiado extendida                       |
| `error.mustDemolishRailroad` | Must demolish railway station first                 | Primero debe demolerse la estación de trenes           |

- [ ] **Step 6: Run** — `npx vitest run src/sim` — all passed; `npm test && npm run lint && npm run typecheck` green.

- [ ] **Step 7: Commit** — `feat: build rail stations that join and name like OpenTTD` (body: `CmdBuildRailStation` with its cost counter as coded (R17), flat-land and overbuild rules, the single-neighbour join and the 12-tile spread (R18), and `GenerateStationName` per town; the station's and tiles' random bits are drawn as in OpenTTD because they are stored (R29). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 7: Removing stations and deleting unused ones

**Files:**

- Create: `src/sim/station/remove-station.ts`, `src/sim/station/remove-station.test.ts`
- Modify: `src/sim/map/clear-tile.ts` (Station → `clearTileStation`), `src/sim/game.ts` (`onTickStation` in `tick`), `src/sim/command/command.ts`, `src/sim/command/command.test.ts`, `src/sim/command/cost.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

Sources: construction.md §4.2 (station row), §4.6 (remove tool); stations-cargo.md §4.10 (deletion after 8 big ticks). C++: `station_cmd.cpp:ClearTile_Station`, `RemoveRailStation` (both overloads), `RemoveFromRailBaseStation`, `CmdRemoveFromRailStation`, `MakeStationAreaSmaller`, `UpdateStationSignCoord`, `DeleteStationIfEmpty`, `OnTick_Station`, `StationHandleSmallTick`, `StationHandleBigTick`.

**Interfaces:**

- Consumes: Task 6 (`Station`, `isInUse`, `tileBelongsToRailStation`, `isRailStationTile`, `getStationIndex`, `StationFacility`); Task 2 (`orthogonalTiles`); `doClearSquare`.
- Produces (`station/remove-station.ts`): `removeFromRailStation(state, flags, start: number, end: number, actor: number): CommandCost` (`CmdRemoveFromRailStation` with `keep_rail = false`, R19), `clearTileStation(state, t, flags, actor): CommandCost` (`ClearTile_Station`), `onTickStation(state): void` (`OnTick_Station` without rating, acceptance and animation, which are block 1.5).
- Produces (`command/command.ts`): `{ type: 'removeFromRailStation'; start: number; end: number }` (flags 0, `landscapeConstruction`; `commandTile`: `start`).
- Produces (`command/cost.ts`): `'error.noStation'`.
- Produces (`game.ts`): `tick` runs `onTickStation(state)` after `onTickTrees(state)` (`CallLandscapeTick` order: town, trees, station, industry).

- [ ] **Step 1: Write the failing test** — `src/sim/station/remove-station.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { execute } from '../command/command';
import { createEmptyGame, hashGameState, tick, type GameState } from '../game';
import { getClearDensity } from '../map/clear';
import { tileLoopWater } from '../map/flood';
import { getTileType, tileXY, TileType } from '../map/map';
import { isWaterTile, makeSea } from '../map/water';
import { newTown } from '../town/town';
import { Axis } from '../track/track';
import { isInUse } from './station';

const newGame = (): GameState => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  return g;
};
const at = (g: GameState, x: number, y: number): number => tileXY(g.map, x, y);
const NOOP = (): void => undefined;
const build = (g: GameState, x: number, y: number, platLength: number) =>
  execute(
    g,
    { type: 'buildRailStation', tile: at(g, x, y), axis: Axis.X, numTracks: 1, platLength },
    'exec',
  );
const removePart = (g: GameState, x1: number, x2: number, y: number) =>
  execute(g, { type: 'removeFromRailStation', start: at(g, x1, y), end: at(g, x2, y) }, 'exec');

describe('removing stations (station_cmd.cpp)', () => {
  it('bulldozes the whole station for £37 a tile with no rail refund', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    expect(execute(g, { type: 'landscapeClear', tile: at(g, 24, 30) }, 'test')).toEqual({
      ok: true,
      cost: 185,
    });
    execute(g, { type: 'landscapeClear', tile: at(g, 24, 30) }, 'exec');
    expect(
      [22, 26].map((x) => [getTileType(g.map, at(g, x, 30)), getClearDensity(g.map, at(g, x, 30))]),
    ).toEqual([
      [TileType.Clear, 0],
      [TileType.Clear, 0],
    ]);
    const st = g.stations[0]!;
    expect([isInUse(st), st.trainStation, st.facilities, g.company.infrastructure]).toEqual([
      false,
      null,
      0,
      { rail: 0, station: 0 },
    ]);
  });

  it('removes part of a platform for £37 a tile and shrinks the station (R19)', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    expect(removePart(g, 22, 23, 30)).toEqual({ ok: true, cost: 74 });
    expect([g.stations[0]!.trainStation, g.stations[0]!.xy]).toEqual([
      { tile: at(g, 24, 30), w: 3, h: 1 },
      at(g, 24, 30),
    ]);
    removePart(g, 25, 25, 30); // a middle tile leaves the area as it is
    expect(g.stations[0]!.trainStation).toEqual({ tile: at(g, 24, 30), w: 3, h: 1 });
    expect(removePart(g, 30, 32, 40)).toEqual({
      ok: false,
      error: { key: 'error.noStation', params: {} },
    });
  });

  it('counts small ticks 0..184 while the station is in use (StationHandleSmallTick)', () => {
    const g = newGame();
    build(g, 22, 30, 1);
    for (let i = 0; i < 184; i++) tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(184);
    tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(0);
  });

  it('deletes an unused station on its eighth big tick and frees its name (StationHandleBigTick)', () => {
    const g = newGame();
    build(g, 22, 20, 1);
    execute(g, { type: 'landscapeClear', tile: at(g, 22, 20) }, 'exec');
    build(g, 16, 20, 1);
    expect(g.stations[1]!.nameKind).toBe('central'); // "town" is still held by the unused station
    for (let i = 0; i < 1999; i++) tick(g);
    expect(g.stations[0]!.deleteCtr).toBe(7);
    tick(g); // tick 2000 = (counter + index 0) % 250 === 0 for the eighth time
    expect(g.stations[0]).toBeNull();
    build(g, 22, 24, 1);
    expect([g.stations[0]!.index, g.stations[0]!.nameKind]).toEqual([0, 'town']);
  });

  it('leaves the world untouched in test mode', () => {
    const g = newGame();
    build(g, 22, 30, 5);
    const before = hashGameState(g);
    execute(g, { type: 'removeFromRailStation', start: at(g, 22, 30), end: at(g, 26, 30) }, 'test');
    expect(hashGameState(g)).toBe(before);
  });

  it('loses a platform tile to the sea (R21)', () => {
    const g = newGame();
    for (let x = 10; x <= 13; x++) for (let y = 10; y <= 13; y++) g.map.height[at(g, x, y)] = 0;
    makeSea(g.map, at(g, 11, 10));
    build(g, 11, 11, 1);
    tileLoopWater(g, at(g, 11, 10), NOOP);
    expect([isWaterTile(g.map, at(g, 11, 11)), isInUse(g.stations[0]!)]).toEqual([true, false]);
  });
});
```

Extend `command.test.ts`'s pause-level test with `pauseLevel('removeFromRailStation')` → `3`.

Run: `npx vitest run src/sim/station` — Expected: FAIL.

- [ ] **Step 2: Implement `remove-station.ts`** — port of `station_cmd.cpp`:

- `removeFromRailBaseStation(state, tiles, flags, actor)` (module-private; `removal_cost = p.clearStationRail`, `keep_rail = false`): for each tile that `isRailStationTile` and whose station exists: (ownership unless `OWNER_WATER`; no vehicles yet) `quantity++`; exec: `infrastructure.rail--`, `doClearSquare(map, t, false)`, `infrastructure.station--`, add the station to `affected`, dirty. `quantity === 0` → `fail('error.noStation')`. For each affected station: `trainStation = makeStationAreaSmaller(...)` (port of `MakeStationAreaSmaller`: shrink each side while it has no tile of the station, restart after each shrink; a zero-size area becomes `null`), then `updateStationSignCoord` (clamp `xy` into `trainStation`; nothing when `null`), and if `trainStation === null`: `facilities &= ~StationFacility.Train` and `deleteStationIfEmpty` (`deleteCtr = 0` when not in use). Return `succeed(quantity * p.clearStationRail)`.
- `removeFromRailStation(state, flags, start, end, actor)`: `start`/`end` outside the map → `CMD_ERROR`; tiles = `orthogonalTiles(map, start, end)`.
- `clearTileStation(state, t, flags, actor)`: `Auto` → `fail('error.mustDemolishRailroad')`; `actor === OWNER_WATER` → `removeFromRailStation(state, DoFlag.Execute, t, t, actor)` (the sea takes one tile, `RemoveRailStation(TileIndex)`); otherwise `RemoveRailStation(st, flags)`: for each tile of a **copy** of `st.trainStation` taken before the loop (the area shrinks while tiles go) that belongs to the station, `removeFromRailBaseStation(state, [tile], flags, actor)` separately, adding the costs and returning the first failure.
- `onTickStation(state)`: for each station slot in index order: **small tick** — if in use, `deleteCtr = deleteCtr + 1 >= 185 ? 0 : deleteCtr + 1` (the rating update at 0 is block 1.5); **big tick** — when `(state.tickCounter + index) % 250 === 0`: not in use → `if (++deleteCtr >= 8) state.stations[index] = null`; in use → nothing yet (acceptance, block 1.5).

- [ ] **Step 3: Wire** — `clear-tile.ts` Station → `clearTileStation`; `command.ts` `removeFromRailStation` → `removeFromRailStation(state, flags, cmd.start, cmd.end, COMPANY_FIRST)`; `game.ts` tick.

- [ ] **Step 4: i18n** — `error.noStation`: en `... there is no station here`, es `... no hay ninguna estación aquí`.

- [ ] **Step 5: Run** — `npx vitest run src/sim` — all passed; `npm test && npm run lint && npm run typecheck` green.

- [ ] **Step 6: Commit** — `feat: remove rail stations whole or tile by tile` (body: the bulldozer removes the whole station at £37 a tile and the station tool's remove mode takes single tiles, both as OpenTTD (R19); an emptied station stays until its eighth big tick, holding its name, so the next station's name matches OpenTTD's (R29); the sea removes one platform tile at a time (R21). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 8: Autorail drags and gesture → command planning

**Files:**

- Create: `src/app/autorail.ts`, `src/app/autorail.test.ts`, `src/app/construction.ts`, `src/app/construction.test.ts`
- Modify: `src/render/projection.ts`, `src/render/projection.test.ts`

Sources: construction.md §3 (drag state: `selstart` is the press tile's origin, `_tile_fract_coords` the press sub-tile point), §4.3–4.6 (demolish `VPM_X_AND_Y`, autorail `VPM_RAILDIRS`, station `VPM_X_AND_Y_LIMITED`, depot click), §4.5 "Notes for a touch port". C++: `viewport.cpp:CalcRaildirsDrawstyle` (the `VPM_RAILDIRS` part, not the forced-direction tools), `Check2x1AutoRail`, `GetAutorailHT`, `VpSelectTilesWithMethod` (`VPM_X_AND_Y_LIMITED` clamp; `sizelimit` is a `uint8_t`, so the remove-station limit −1 is 255); `table/autorail.h:_autorail_piece`; `rail_gui.cpp:HandleAutodirPlacement`, `HandleStationPlacement`, `PlaceRail_Station`; `terraform_gui.cpp:GUIPlaceProcDragXY`.

**Interfaces:**

- Consumes: Tasks 1–7 (`Command`, `railDragPieces`, `tileIterator`, `orthogonalTiles`, `Track`, `Axis`, `STATION_SPREAD`); 1.2 `DiagDir`, `tileXY`, `TILE_PX`.
- Produces (`render/projection.ts`): `TILE_UNITS = 16` (OpenTTD world units per tile, `TILE_SIZE`), `interface OttdPoint { x: number; y: number }` (OpenTTD world units: `x` along the tile X axis, so a point is in tile `(x >> 4, y >> 4)`), `worldToOttd(px: number, py: number): OttdPoint` (`{ x: Math.floor(py / 4), y: Math.floor(px / 4) }`, since a 64-px tile is 16 units and screen x is tile y).
- Produces (`app/autorail.ts`): `AUTORAIL_PIECE: readonly (readonly Track[])[]` (`[fx][fy]`), `autorailPiece(p: OttdPoint): Track`, `check2x1AutoRail(mode: 0 | 1 | 2 | 3, press: OttdPoint, end: OttdPoint): Track`, `interface RailDrawstyle { line: boolean; track: Track; end: OttdPoint }`, `calcRaildirsDrawstyle(press: OttdPoint, cursor: OttdPoint): RailDrawstyle` (`line: false` = `HT_RAIL`, one piece on the end tile; `true` = `HT_LINE`), `limitedAreaEnd(press: OttdPoint, cursor: OttdPoint, sizeLimit: number): OttdPoint`, `REMOVE_STATION_SIZE_LIMIT = 255`.
- Produces (`app/construction.ts`): `type BuildTool = 'rail' | 'station' | 'depot' | 'demolish'`, `interface BuildOptions { remove: boolean; stationAxis: Axis; depotDir: DiagDir }`, `type BuildHeader = 'header.cantBuildRail' | 'header.cantRemoveRail' | 'header.cantBuildStation' | 'header.cantRemoveStationPart' | 'header.cantBuildDepot' | 'header.cantClearArea'`, `interface PlannedBuild { command: Command; header: BuildHeader; rails: readonly { tile: number; track: Track }[]; tiles: readonly number[] }`, `planBuild(map: MapState, tool: BuildTool, options: BuildOptions, press: OttdPoint, current: OttdPoint, ctrl: boolean): PlannedBuild | null` (`null` when either point is outside the map, as OpenTTD ignores a release outside it).

- [ ] **Step 1: Write the failing tests** (values traced through `viewport.cpp` with the press at the centre of tile (10,10) unless stated)

`src/app/autorail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { OttdPoint } from '../render/projection';
import { Track } from '../sim/track/track';
import { calcRaildirsDrawstyle, limitedAreaEnd } from './autorail';

const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const style = (press: OttdPoint, cursor: OttdPoint): [boolean, Track, number, number] => {
  const s = calcRaildirsDrawstyle(press, cursor);
  return [s.line, s.track, s.end.x >> 4, s.end.y >> 4];
};

describe('autorail (port of viewport.cpp:CalcRaildirsDrawstyle, Review Focus 1)', () => {
  it('picks the single piece from the release point inside the press tile (_autorail_piece)', () => {
    const press = P(10, 10);
    expect(
      [
        [2, 2],
        [2, 7],
        [8, 2],
        [12, 2],
        [12, 12],
        [2, 12],
      ].map(([fx, fy]) => style(press, P(10, 10, fx, fy))),
    ).toEqual([
      [false, Track.Upper, 10, 10],
      [false, Track.X, 10, 10],
      [false, Track.Y, 10, 10],
      [false, Track.Left, 10, 10],
      [false, Track.Lower, 10, 10],
      [false, Track.Right, 10, 10],
    ]);
  });

  it('draws straight lines along X and Y', () => {
    expect([
      style(P(10, 10), P(14, 10)),
      style(P(10, 10), P(10, 13)),
      style(P(10, 10), P(7, 10)),
      style(P(10, 10), P(14, 11)),
    ]).toEqual([
      [true, Track.X, 14, 10],
      [true, Track.Y, 10, 13],
      [true, Track.X, 7, 10],
      [true, Track.X, 14, 10], // w > 2h: snapped to the press row
    ]);
  });

  it('uses both press and release sub-tile points for two-tile drags (Check2x1AutoRail)', () => {
    expect(style(P(10, 10), P(11, 10))).toEqual([true, Track.X, 11, 10]);
    expect(style(P(10, 10, 13, 2), P(11, 10, 2, 13))).toEqual([true, Track.Left, 11, 10]);
  });

  it('snaps diagonal drags to a staircase end tile', () => {
    expect([
      style(P(10, 10), P(13, 12)),
      style(P(10, 10), P(13, 11)),
      style(P(10, 10), P(12, 12, 3, 9)),
      style(P(10, 10), P(12, 12, 9, 3)),
    ]).toEqual([
      [true, Track.Left, 13, 12],
      [true, Track.Left, 12, 11],
      [true, Track.Right, 12, 12],
      [true, Track.Left, 12, 12],
    ]);
  });

  it('limits a station drag to 12 tiles each way (VPM_X_AND_Y_LIMITED)', () => {
    const end = limitedAreaEnd(P(10, 10, 3, 3), P(30, 10), 12);
    expect([end.x >> 4, end.y >> 4]).toEqual([21, 10]);
    const back = limitedAreaEnd(P(10, 10, 3, 3), P(1, 10, 0, 0), 12);
    expect([back.x >> 4, back.y >> 4]).toEqual([1, 10]);
  });
});
```

`src/app/construction.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { OttdPoint } from '../render/projection';
import { createEmptyGame } from '../sim/game';
import { DiagDir } from '../sim/map/geometry';
import { tileXY } from '../sim/map/map';
import { Axis, Track } from '../sim/track/track';
import { planBuild, type BuildOptions } from './construction';

const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const T = (x: number, y: number): number => tileXY(map, x, y);
const OPTIONS: BuildOptions = { remove: false, stationAxis: Axis.X, depotDir: DiagDir.NW };

describe('planBuild: one gesture, one command (rail_gui.cpp, terraform_gui.cpp)', () => {
  it('turns a rail drag into CMD_BUILD_RAILROAD_TRACK with its ghost pieces', () => {
    const plan = planBuild(map, 'rail', OPTIONS, P(10, 10), P(14, 10), false)!;
    expect([plan.command, plan.header, plan.rails.length, plan.tiles]).toEqual([
      { type: 'buildRailroadTrack', endTile: T(14, 10), startTile: T(10, 10), track: Track.X },
      'header.cantBuildRail',
      5,
      [],
    ]);
  });

  it('turns a click into CMD_BUILD_SINGLE_RAIL, and removes in remove mode', () => {
    expect(planBuild(map, 'rail', OPTIONS, P(10, 10), P(10, 10, 2, 7), false)).toEqual({
      command: { type: 'buildRail', tile: T(10, 10), track: Track.X },
      header: 'header.cantBuildRail',
      rails: [{ tile: T(10, 10), track: Track.X }],
      tiles: [],
    });
    expect(
      planBuild(map, 'rail', { ...OPTIONS, remove: true }, P(10, 10), P(14, 10), false)?.command,
    ).toEqual({
      type: 'removeRailroadTrack',
      endTile: T(14, 10),
      startTile: T(10, 10),
      track: Track.X,
    });
  });

  it('sizes a station from the dragged rectangle and the chosen axis (HandleStationPlacement)', () => {
    expect(planBuild(map, 'station', OPTIONS, P(10, 10, 3, 3), P(30, 10), false)?.command).toEqual({
      type: 'buildRailStation',
      tile: T(10, 10),
      axis: Axis.X,
      numTracks: 1,
      platLength: 12,
    });
    const y = planBuild(
      map,
      'station',
      { ...OPTIONS, stationAxis: Axis.Y },
      P(12, 11),
      P(10, 10),
      false,
    )!;
    expect([y.command, y.tiles.length]).toEqual([
      { type: 'buildRailStation', tile: T(10, 10), axis: Axis.Y, numTracks: 3, platLength: 2 },
      6,
    ]);
    expect(
      planBuild(map, 'station', { ...OPTIONS, remove: true }, P(10, 10), P(12, 10), false)?.command,
    ).toEqual({
      type: 'removeFromRailStation',
      start: T(10, 10),
      end: T(12, 10),
    });
  });

  it('places a depot where the pointer is, facing the chosen exit', () => {
    expect(planBuild(map, 'depot', OPTIONS, P(10, 10), P(11, 12), false)).toEqual({
      command: { type: 'buildTrainDepot', tile: T(11, 12), dir: DiagDir.NW },
      header: 'header.cantBuildDepot',
      rails: [],
      tiles: [T(11, 12)],
    });
  });

  it('demolishes the dragged area, diagonally with Ctrl (CMD_CLEAR_AREA)', () => {
    const plan = planBuild(map, 'demolish', OPTIONS, P(10, 10), P(11, 11), false)!;
    expect([plan.command, plan.tiles.length]).toEqual([
      { type: 'clearArea', endTile: T(11, 11), startTile: T(10, 10), diagonal: false },
      4,
    ]);
    expect(planBuild(map, 'demolish', OPTIONS, P(10, 10), P(10, 12), true)?.tiles.length).toBe(5);
  });

  it('ignores gestures that start or end outside the map', () => {
    expect(planBuild(map, 'rail', OPTIONS, P(10, 10), { x: -3, y: 40 }, false)).toBeNull();
    expect(planBuild(map, 'demolish', OPTIONS, { x: 40, y: 64 * 16 }, P(10, 10), false)).toBeNull();
  });
});
```

Add to `src/render/projection.test.ts`:

```ts
it('converts world pixels to OpenTTD world units (16 per tile, screen x = tile y)', () => {
  expect(worldToOttd(12 * 64 + 35, 10 * 64 + 9)).toEqual({ x: 10 * 16 + 2, y: 12 * 16 + 8 });
});
```

Run: `npx vitest run src/app src/render` — Expected: FAIL.

- [ ] **Step 2: Implement `autorail.ts`** — port of `viewport.cpp` / `table/autorail.h`. `AUTORAIL_PIECE` rows by `fx` (`U` = Upper, `D` = Lower, `L` = Left, `R` = Right): rows 0–5 `UUUUUUXXXXRRRRRR`; row 6 `YYYYYYXXXYYYYYYY`; row 7 `YYYYYYYXYYYYYYYY`; row 8 `YYYYYYYYXYYYYYYY`; row 9 `YYYYYYYXXXYYYYYY`; rows 10–15 `LLLLLLXXXXDDDDDD` (copy from `_autorail_piece`, `HT_DIR_HU` = Upper, `HT_DIR_HL` = Lower, `HT_DIR_VL` = Left, `HT_DIR_VR` = Right).

```ts
export function check2x1AutoRail(mode: 0 | 1 | 2 | 3, press: OttdPoint, end: OttdPoint): Track {
  const fxpy = (press.x & 15) + (press.y & 15);
  const fxmy = (press.x & 15) - (press.y & 15);
  const sxpy = (end.x & 15) + (end.y & 15);
  const sxmy = (end.x & 15) - (end.y & 15);
  switch (mode) {
    case 0:
      return fxpy >= 20 && sxpy <= 12 ? Track.Lower : fxmy < -3 && sxmy > 3 ? Track.Right : Track.Y;
    case 1:
      return fxmy > 3 && sxmy < -3 ? Track.Left : fxpy <= 12 && sxpy >= 20 ? Track.Upper : Track.Y;
    case 2:
      return fxmy > 3 && sxmy < -3 ? Track.Left : fxpy >= 20 && sxpy <= 12 ? Track.Lower : Track.X;
    case 3:
      return fxmy < -3 && sxmy > 3 ? Track.Right : fxpy <= 12 && sxpy >= 20 ? Track.Upper : Track.X;
  }
}

export function calcRaildirsDrawstyle(press: OttdPoint, cursor: OttdPoint): RailDrawstyle {
  const sx = press.x & ~15; // _thd.selstart: the press tile's origin (VpStartPlaceSizing)
  const sy = press.y & ~15;
  let { x, y } = cursor;
  const dx = sx - (x & ~15);
  const dy = sy - (y & ~15);
  const w = Math.abs(dx) + 16;
  const h = Math.abs(dy) + 16;
  let track: Track;
  let line = true;
  if (sx >> 4 === x >> 4 && sy >> 4 === y >> 4) {
    line = false;
    track = autorailPiece(cursor); // the release point, not the press point
  } else if (h === 16) {
    track =
      dx === 16
        ? check2x1AutoRail(3, press, cursor)
        : dx === -16
          ? check2x1AutoRail(2, press, cursor)
          : Track.X;
    y = sy;
  } else if (w === 16) {
    track =
      dy === 16
        ? check2x1AutoRail(1, press, cursor)
        : dy === -16
          ? check2x1AutoRail(0, press, cursor)
          : Track.Y;
    x = sx;
  } else if (w > h * 2) {
    track = Track.X;
    y = sy;
  } else if (h > w * 2) {
    track = Track.Y;
    x = sx;
  } else {
    // the four "complicated direction" cases of CalcRaildirsDrawstyle, verbatim (d === 0 first, then d > 0 / d < 0)
  }
  return { line, track, end: { x, y } };
}
```

Port the last branch line by line from `viewport.cpp` (construction.md §4.5 shows it): `d = w - h`; south (`x > sx && y > sy`): `d === 0` → `(x & 15) > (y & 15) ? Left : Right`, `d > 0` → `x = sx + h; Left`, else `y = sy + w; Right`; west (`x > sx`, `y <= sy`): `d === 0` → `(x & 15) + (y & 15) >= 16 ? Lower : Upper`, `d > 0` → `x = sx + h; Lower`, else `y = sy - w; Upper`; east (`x <= sx`, `y > sy`): `d === 0` → same test as west, `d > 0` → `x = sx - h; Upper`, else `y = sy + w; Lower`; north: `d === 0` → same test as south, `d > 0` → `x = sx - h; Right`, else `y = sy - w; Left`. Note the C++ compares the **unmasked** cursor `x`/`y` with `sx`/`sy`.

`limitedAreaEnd(press, cursor, sizeLimit)`: `limit = (sizeLimit - 1) * 16`; `{ x: sx + clamp(cursor.x - sx, -limit, limit), y: sy + clamp(cursor.y - sy, -limit, limit) }` with `sx`/`sy` the press tile origin.

- [ ] **Step 3: Implement `construction.ts`**

```ts
export function planBuild(
  map: MapState,
  tool: BuildTool,
  options: BuildOptions,
  press: OttdPoint,
  current: OttdPoint,
  ctrl: boolean,
): PlannedBuild | null {
  if (!insideMap(map, press) || !insideMap(map, current)) return null;
  const startTile = ottdTile(map, press);
  switch (tool) {
    case 'rail': {
      const s = calcRaildirsDrawstyle(press, current); // HandleAutodirPlacement
      const endTile = ottdTile(map, s.end);
      if (!s.line) {
        return {
          command: {
            type: options.remove ? 'removeRail' : 'buildRail',
            tile: endTile,
            track: s.track,
          },
          header: options.remove ? 'header.cantRemoveRail' : 'header.cantBuildRail',
          rails: [{ tile: endTile, track: s.track }],
          tiles: [],
        };
      }
      return {
        command: {
          type: options.remove ? 'removeRailroadTrack' : 'buildRailroadTrack',
          endTile,
          startTile,
          track: s.track,
        },
        header: options.remove ? 'header.cantRemoveRail' : 'header.cantBuildRail',
        rails: railDragPieces(map, startTile, endTile, s.track) ?? [],
        tiles: [],
      };
    }
    case 'station': {
      const end = limitedAreaEnd(
        press,
        current,
        options.remove ? REMOVE_STATION_SIZE_LIMIT : STATION_SPREAD,
      );
      const endTile = ottdTile(map, end);
      const tiles = orthogonalTiles(map, startTile, endTile);
      if (options.remove)
        return {
          command: { type: 'removeFromRailStation', start: startTile, end: endTile },
          header: 'header.cantRemoveStationPart',
          rails: [],
          tiles,
        };
      // HandleStationPlacement: numtracks = ta.w, platlength = ta.h, swapped for AXIS_X
      const w = Math.abs(tileX(map, endTile) - tileX(map, startTile)) + 1;
      const h = Math.abs(tileY(map, endTile) - tileY(map, startTile)) + 1;
      const [numTracks, platLength] = options.stationAxis === Axis.X ? [h, w] : [w, h];
      return {
        command: {
          type: 'buildRailStation',
          tile: tiles[0]!,
          axis: options.stationAxis,
          numTracks,
          platLength,
        },
        header: 'header.cantBuildStation',
        rails: [],
        tiles,
      };
    }
    case 'depot': {
      const tile = ottdTile(map, current);
      return {
        command: { type: 'buildTrainDepot', tile, dir: options.depotDir },
        header: 'header.cantBuildDepot',
        rails: [],
        tiles: [tile],
      };
    }
    case 'demolish': {
      const endTile = ottdTile(map, current); // GUIPlaceProcDragXY: CMD_CLEAR_AREA(end, start, Ctrl)
      return {
        command: { type: 'clearArea', endTile, startTile, diagonal: ctrl },
        header: 'header.cantClearArea',
        rails: [],
        tiles: tileIterator(map, endTile, startTile, ctrl),
      };
    }
  }
}
```

`insideMap(map, p) = p.x >= 0 && p.y >= 0 && p.x < map.sizeX * 16 && p.y < map.sizeY * 16`; `ottdTile(map, p) = tileXY(map, p.x >> 4, p.y >> 4)`.

- [ ] **Step 4: Run** — `npx vitest run src/app src/render` — all passed; `npm test && npm run lint && npm run typecheck` green.

- [ ] **Step 5: Commit** — `feat: port the autorail drag and plan one command per gesture` (body: the piece and end tile of a rail drag are a pure function of the press tile, the press sub-tile point and the release point, as in `CalcRaildirsDrawstyle`, so a finger-down/finger-up pair gives exactly what OpenTTD's mouse would (R20); station, depot and demolish gestures map to the same commands as OpenTTD's tools, and the plan also returns the ghost to draw. `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 9: Drawing construction and build gestures on the map

**Files:**

- Create: `src/render/preview.ts`, `src/render/preview.test.ts`
- Modify: `src/render/theme.ts`, `src/render/ground.ts`, `src/render/ground.test.ts`, `src/render/objects.ts`, `src/render/objects.test.ts`, `src/render/gesture.ts`, `src/render/gesture.test.ts`, `src/render/MapScene.ts`, `src/app/main.tsx`, `tools/blocks-theme.mjs`, `public/themes/blocks/theme.json`, `public/themes/blocks/sprites/*.svg` (generated)

Sources: spec §4 (map, construction preview, themes), §5 (phone gestures); ruling R7 (sprites only through the theme contract), R30, R31, R32.

**Interfaces:**

- Consumes: Tasks 3–8 (`getRailGroundType`, `RailGroundType`, `isPlainRail`, `isRailDepotTile`, `getTrackBits`, `getRailDepotDirection`, `isRailStationTile`, `getStationGfx`, `isLevelCrossingTile`, `getCrossingRoadAxis`, `Track`, `Axis`, `OttdPoint`, `worldToOttd`); 1.2 `MapScene`, `MapInput`, `chunkObjects`, `tileToWorld`, `TILE_PX`.
- Produces (`render/theme.ts`): `GROUND_SPRITE_IDS` += `'station.platform.x'`, `'station.platform.y'`, `'crossing.x'`, `'crossing.y'`; `OBJECT_SPRITE_IDS` += `'rail.track.x'`, `'rail.track.y'`, `'rail.track.upper'`, `'rail.track.lower'`, `'rail.track.left'`, `'rail.track.right'`, `'depot.rail.ne'`, `'depot.rail.se'`, `'depot.rail.sw'`, `'depot.rail.nw'`, `'station.building.x'`, `'station.building.y'`, `'station.roof.x'`, `'station.roof.y'`.
- Produces (`render/ground.ts`): rail and depot tiles → `terrain.grass.0` while the rail ground is Barren, else `terrain.grass.3` (fences are not drawn, R32); rail station → `station.platform.x|y` by axis; level crossing → `crossing.x|y` by **road** axis.
- Produces (`render/objects.ts`): `RAIL_TRACK_SPRITES: readonly SpriteId[]` (by `Track`); plain rail → one flat sprite per track bit, in `Track` order; depot → `depot.rail.{ne,se,sw,nw}` by exit; station → `station.building.{x,y}` for section 2, `station.roof.{x,y}` for sections 4 and 6, nothing for section 0.
- Produces (`render/preview.ts`): `interface MapPreview { ok: boolean; rails: readonly { tile: number; track: Track }[]; tiles: readonly number[] }`, `PREVIEW_OK_COLOUR = 0x2fbf71`, `PREVIEW_BAD_COLOUR = 0xe5484d`, `TRACK_SEGMENTS: readonly (readonly [number, number, number, number])[]` (by `Track`, tile pixels: X `[32,0,32,64]`, Y `[0,32,64,32]`, Upper `[32,0,0,32]`, Lower `[64,32,32,64]`, Left `[0,32,32,64]`, Right `[32,0,64,32]`), `interface PreviewShapes { colour: number; lines: { x1: number; y1: number; x2: number; y2: number }[]; rects: { x: number; y: number; w: number; h: number }[] }`, `previewShapes(map: MapState, preview: MapPreview): PreviewShapes` (world pixels).
- Produces (`render/gesture.ts`): `interface BuildGesture { phase: 'hover' | 'move' | 'end' | 'cancel'; press: OttdPoint; current: OttdPoint; touch: boolean; ctrl: boolean }`, `buildPointerAction(p: { button: number; touch: boolean; pointers: number }): 'build' | 'pan' | 'pinch'` (two pointers → pinch; touch or left button → build; other buttons → pan).
- Produces (`render/MapScene.ts`): `MapInput.onBuildGesture(g: BuildGesture): void`; `MapScene.setBuildMode(on: boolean): void`; `MapScene.showPreview(preview: MapPreview | null): void`.

- [ ] **Step 1: Write the failing tests**

`src/render/preview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createEmptyGame } from '../sim/game';
import { tileXY } from '../sim/map/map';
import { Track } from '../sim/track/track';
import { PREVIEW_BAD_COLOUR, PREVIEW_OK_COLOUR, previewShapes } from './preview';

const { map } = createEmptyGame({ mapLogX: 6, mapLogY: 6 });

describe('construction ghost (spec §4, R31)', () => {
  it('draws rail pieces as segments between tile edges, in world pixels', () => {
    const shapes = previewShapes(map, {
      ok: true,
      rails: [
        { tile: tileXY(map, 10, 12), track: Track.X },
        { tile: tileXY(map, 10, 12), track: Track.Left },
      ],
      tiles: [],
    });
    expect(shapes).toEqual({
      colour: PREVIEW_OK_COLOUR,
      lines: [
        { x1: 800, y1: 640, x2: 800, y2: 704 }, // NE edge (top) to SW edge (bottom)
        { x1: 768, y1: 672, x2: 800, y2: 704 }, // NW edge (left) to SW edge (bottom)
      ],
      rects: [],
    });
  });

  it('fills whole tiles in red when the build would fail', () => {
    expect(previewShapes(map, { ok: false, rails: [], tiles: [tileXY(map, 3, 5)] })).toEqual({
      colour: PREVIEW_BAD_COLOUR,
      lines: [],
      rects: [{ x: 320, y: 192, w: 64, h: 64 }],
    });
  });
});
```

Add to `src/render/gesture.test.ts`:

```ts
describe('pointers while a build tool is on (R30, Review Focus 1)', () => {
  it('builds with the left button or one finger, pans with other buttons, pinches with two fingers', () => {
    expect([
      buildPointerAction({ button: 0, touch: false, pointers: 1 }),
      buildPointerAction({ button: 2, touch: false, pointers: 1 }),
      buildPointerAction({ button: 1, touch: false, pointers: 1 }),
      buildPointerAction({ button: 0, touch: true, pointers: 1 }),
      buildPointerAction({ button: 0, touch: true, pointers: 2 }),
    ]).toEqual(['build', 'pan', 'pan', 'build', 'pinch']);
  });
});
```

Add to `src/render/ground.test.ts` and `src/render/objects.test.ts`:

```ts
it('draws rail ground, station platforms and crossings', () => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const at = (x: number, y: number): number => tileXY(g.map, x, y);
  g.towns.push(newTown(0, at(20, 20), 0, false)); // stations and depots are named after a town
  execute(g, { type: 'buildRail', tile: at(5, 5), track: Track.X }, 'exec');
  execute(
    g,
    { type: 'buildRailStation', tile: at(10, 5), axis: Axis.Y, numTracks: 1, platLength: 1 },
    'exec',
  );
  makeRoadNormal(g.map, at(15, 5), RoadBits.Y, 0);
  execute(g, { type: 'buildRail', tile: at(15, 5), track: Track.X }, 'exec');
  expect([
    groundSprite(g.map, at(5, 5)),
    groundSprite(g.map, at(10, 5)),
    groundSprite(g.map, at(15, 5)),
  ]).toEqual(['terrain.grass.0', 'station.platform.y', 'crossing.y']);
  tileLoopTrack(g, at(5, 5), () => undefined);
  expect(groundSprite(g.map, at(5, 5))).toBe('terrain.grass.3');
});
```

```ts
it('draws one flat sprite per track piece, depots by exit and station buildings by section', () => {
  const g = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  g.towns.push(newTown(0, tileXY(g.map, 20, 20), 0, false));
  const at = (x: number, y: number): number => tileXY(g.map, x, y);
  execute(g, { type: 'buildRail', tile: at(5, 5), track: Track.Y }, 'exec');
  execute(g, { type: 'buildRail', tile: at(5, 5), track: Track.Upper }, 'exec');
  execute(g, { type: 'buildTrainDepot', tile: at(6, 5), dir: DiagDir.SW }, 'exec');
  execute(
    g,
    { type: 'buildRailStation', tile: at(10, 5), axis: Axis.X, numTracks: 2, platLength: 3 },
    'exec',
  );
  expect(objectSprites(g.map, at(5, 5)).map((o) => o.sprite)).toEqual([
    'rail.track.y',
    'rail.track.upper',
  ]);
  expect(objectSprites(g.map, at(6, 5)).map((o) => o.sprite)).toEqual(['depot.rail.sw']);
  expect(objectSprites(g.map, at(10, 5)).map((o) => o.sprite)).toEqual(['station.roof.x']); // 2×3 layout: sections 4 and 6
  execute(
    g,
    { type: 'buildRailStation', tile: at(10, 20), axis: Axis.Y, numTracks: 1, platLength: 1 },
    'exec',
  );
  expect(objectSprites(g.map, at(10, 20)).map((o) => o.sprite)).toEqual(['station.building.y']);
});
```

(Add the imports these need: `execute`, `Track`, `Axis`, `DiagDir`, `newTown`, `makeRoadNormal`, `RoadBits`, `tileLoopTrack`.)

Run: `npx vitest run src/render` — Expected: FAIL.

- [ ] **Step 2: Implement `theme.ts`, `ground.ts`, `objects.ts`, `preview.ts`, `gesture.ts`** as in Interfaces. `previewShapes`: a tile `(x, y)` has its top-left at world pixel `(y * 64, x * 64)` (`tileToWorld`); a segment `[a, b, c, d]` becomes `{ x1: px + a, y1: py + b, x2: px + c, y2: py + d }`; a tile becomes `{ x: px, y: py, w: 64, h: 64 }`.

- [ ] **Step 3: Placeholder art** — extend `tools/blocks-theme.mjs` (keep existing entries; simple original shapes; ground 64×64, objects 64×128 with the footprint in the bottom 64 px; screen corners N top-left, E top-right, S bottom-right, W bottom-left, so the NE edge is the top, SE the right, SW the bottom, NW the left):

```js
const TRACK_SEG = {
  x: [32, 0, 32, 64],
  y: [0, 32, 64, 32],
  upper: [32, 0, 0, 32],
  lower: [64, 32, 32, 64],
  left: [0, 32, 32, 64],
  right: [32, 0, 64, 32],
};
const rails = ([x1, y1, x2, y2], dy = 0) =>
  `<line x1="${x1}" y1="${y1 + dy}" x2="${x2}" y2="${y2 + dy}" stroke="#9c6644" stroke-width="16" stroke-linecap="square"/>` +
  `<line x1="${x1}" y1="${y1 + dy}" x2="${x2}" y2="${y2 + dy}" stroke="#4a4f57" stroke-width="10" stroke-linecap="square"/>` +
  `<line x1="${x1}" y1="${y1 + dy}" x2="${x2}" y2="${y2 + dy}" stroke="#9c6644" stroke-width="4" stroke-linecap="square"/>`;
for (const [name, seg] of Object.entries(TRACK_SEG))
  sprites[`rail.track.${name}`] = object(rails(seg, 64));
sprites['station.platform.x'] = tile(
  '#cfc8b8',
  `<rect x="4" y="0" width="16" height="64" fill="#e8e2d4"/><rect x="44" y="0" width="16" height="64" fill="#e8e2d4"/>${rails(TRACK_SEG.x)}`,
);
sprites['station.platform.y'] = tile(
  '#cfc8b8',
  `<rect x="0" y="4" width="64" height="16" fill="#e8e2d4"/><rect x="0" y="44" width="64" height="16" fill="#e8e2d4"/>${rails(TRACK_SEG.y)}`,
);
sprites['crossing.x'] = tile(
  '#8fd18a',
  `<rect x="22" y="0" width="20" height="64" fill="#8a8d91"/>${rails(TRACK_SEG.y)}<rect x="22" y="22" width="20" height="20" fill="#f4efe6" opacity="0.6"/>`,
);
sprites['crossing.y'] = tile(
  '#8fd18a',
  `<rect x="0" y="22" width="64" height="20" fill="#8a8d91"/>${rails(TRACK_SEG.x)}<rect x="22" y="22" width="20" height="20" fill="#f4efe6" opacity="0.6"/>`,
);
const DOOR = {
  ne: [22, 74, 20, 10],
  se: [50, 86, 10, 20],
  sw: [22, 112, 20, 10],
  nw: [4, 86, 10, 20],
};
for (const [dir, [x, y, w, h]] of Object.entries(DOOR))
  sprites[`depot.rail.${dir}`] = object(
    `<rect x="8" y="70" width="48" height="48" fill="#d9a066" stroke="#2d4a3e" stroke-width="2"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2d2d2d"/>`,
  );
sprites['station.building.x'] = object(
  `<rect x="2" y="84" width="16" height="40" fill="#f4efe6" stroke="#2d4a3e"/><rect x="0" y="78" width="20" height="8" fill="#e76f51"/>`,
);
sprites['station.building.y'] = object(
  `<rect x="12" y="66" width="40" height="16" fill="#f4efe6" stroke="#2d4a3e"/><rect x="8" y="60" width="48" height="8" fill="#e76f51"/>`,
);
sprites['station.roof.x'] = object(
  '<rect x="2" y="64" width="16" height="64" fill="#457b9d" opacity="0.7"/><rect x="46" y="64" width="16" height="64" fill="#457b9d" opacity="0.7"/>',
);
sprites['station.roof.y'] = object(
  '<rect x="0" y="66" width="64" height="16" fill="#457b9d" opacity="0.7"/><rect x="0" y="110" width="64" height="16" fill="#457b9d" opacity="0.7"/>',
);
```

Run `node tools/blocks-theme.mjs`; the theme coverage test (`src/render/theme.test.ts`) must pass.

- [ ] **Step 4: `MapScene` changes** (no unit test; covered by the Task 10 e2e and screenshots):

- `MapInput` gains `onBuildGesture(g: BuildGesture): void`; `src/app/main.tsx` builds the `MapInput` literal, so it passes `onBuildGesture: () => undefined` until Task 10 (typecheck fails otherwise).
- `this.ghost = this.add.graphics().setDepth(9000)` (under the town labels at 10000); `showPreview(p)`: `ghost.clear()`, then for `previewShapes(map, p)`: `lineStyle(12, colour, 0.8)` + `lineBetween` per line, `fillStyle(colour, 0.35)` + `fillRect` per rect. `applyPending` clears it.
- `setBuildMode(on)`: stores the flag; turning it off sends `cancel` for a gesture in progress.
- `this.input.mouse?.disableContextMenu()` so a right-drag pans.
- `pointerdown` with build mode on: `action = buildPointerAction({ button: pointer.button, touch: pointer.wasTouch, pointers: <pointers down> })`; `'build'` → remember `{ pointerId, press: ottdUnder(pointer), touch }` and send `{ phase: 'move', press, current: press }`; `'pinch'` → send `cancel` for a gesture in progress, start the pinch (1.2 code); `'pan'` → remember a pan with no tap. No long-press timer while build mode is on (R30). In build mode the build pointer's `pointerup` sends `end` and returns before `classifyPress`, so neither a tap nor a long press is reported (R30). Note: since PR #91, `pointerup` itself reports a long press for an unconsumed press held ≥500 ms, so the early return is required. Build mode off: the 1.2 code unchanged.
- `pointermove`: the build pointer → `{ phase: 'move', current: ottdUnder(pointer) }`, no panning; pinch → zoom (1.2) **and** pan by the movement of the two-finger midpoint; a pan → scroll; a mouse with no button down in build mode → `{ phase: 'hover', press: p, current: p }`.
- `pointerup` of the build pointer → `{ phase: 'end', press, current: ottdUnder(pointer) }`.
- `ottdUnder(pointer)`: `const w = camera.getWorldPoint(pointer.x, pointer.y); return worldToOttd(w.x, w.y);` (outside the map is fine: `planBuild` returns `null`); `ctrl = (pointer.event as MouseEvent | undefined)?.ctrlKey === true`.

- [ ] **Step 5: Run** — `npm test && npm run lint && npm run typecheck && npm run test:e2e` — all green (no behaviour visible yet: nothing sets build mode until Task 10).

- [ ] **Step 6: Commit** — `feat: draw rail, depots, stations and crossings, and a build ghost` (body: every new sprite goes through the theme contract with placeholder art (R7); track pieces are flat object sprites so any of the 63 combinations is drawn from six; the ghost is one graphics layer coloured by the command's test result (R31); with a build tool on, one pointer builds, two fingers pinch and pan, and other mouse buttons pan, so a phone can still move the map (R30). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 10: Construction tools, cost bar, Confirm and error messages

**Files:**

- Create: `src/ui/Toolbar.tsx`, `src/ui/BuildBar.tsx`, `src/ui/ErrorMessage.tsx`, `src/ui/errors.ts`, `src/ui/testing.ts`, `src/ui/construction.test.tsx`, `tests/e2e/helpers.ts`, `tests/e2e/construction.spec.ts`
- Modify: `src/ui/session.ts`, `src/app/session.ts`, `src/app/session.test.ts`, `src/app/main.tsx`, `src/ui/App.tsx`, `src/ui/App.test.tsx`, `src/ui/StatusBar.test.tsx`, `src/ui/NewGame.test.tsx`, `src/ui/styles.css`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`, `tests/e2e/query.spec.ts`

Sources: spec §4 (preview, pause), §5 (tools, phone layout and gestures); construction.md §4.5–4.7 (tools, error header + detail, `errmsg_duration` 5 s, persistent tools, depot default `DIAGDIR_NW`, station axis default X); rulings R20, R24, R25, R30, R31.

**Interfaces:**

- Consumes: Task 8 (`planBuild`, `PlannedBuild`, `BuildTool`, `BuildOptions`), Task 9 (`BuildGesture`, `MapPreview`, `MapScene.setBuildMode`, `MapScene.showPreview`, `MapInput.onBuildGesture`), Task 5 (`depotExtraRail`), `execute`, `industryInfo`, `ERROR_KEYS`, `checkCompanyHasMoney` (`sim/economy/company.ts`; `app/` may import `sim/`).
- Produces (`ui/session.ts`): `type Tool = 'query' | 'rail' | 'station' | 'depot' | 'demolish'`, `isBuildTool(tool: Tool | null): tool is 'rail' | 'station' | 'depot' | 'demolish'`, `interface UiCommandError { key: ErrorKey; money: number | null; industry: IndustryInfo | null; town: string | null }`, `interface UiPreview { ok: boolean; cost: number; error: UiCommandError | null; needsConfirm: boolean }`, `type ErrorHeader = 'header.cantBuildRail' | 'header.cantRemoveRail' | 'header.cantBuildStation' | 'header.cantRemoveStationPart' | 'header.cantBuildDepot' | 'header.cantClearArea' | 'header.cantBorrow' | 'header.cantRepay'`, `interface UiError { header: ErrorHeader; detail: UiCommandError | null }`; `UiSnapshot` gains `removeMode: boolean`, `stationAxis: Axis`, `depotDir: DiagDir`, `preview: UiPreview | null`, `error: UiError | null`; `UiSession` gains `setRemoveMode(on: boolean)`, `setStationAxis(axis: Axis)`, `setDepotDir(dir: DiagDir)`, `confirmBuild()`, `cancelBuild()`, `dismissError()`.
- Produces (`app/session.ts`): `GameSession.buildGesture(g: BuildGesture): void`; `SessionDeps` gains `onPreview?(preview: MapPreview | null): void` and `onExecuted?(command: Command, cost: number): void`; `toUiError(state: GameState, error: CommandError | null): UiCommandError | null`.
- Produces (`ui/errors.ts`): `errorText(locale: Locale, e: UiCommandError): string` (`money` formatted with `formatMoney`, `industry` with `industryName`, `town` as the town name).
- Produces (`ui/testing.ts`): `BASE_SNAPSHOT: UiSnapshot`, `fakeSession(snapshot?: Partial<UiSnapshot>): UiSession` (every method a `vi.fn`); the three existing UI tests switch to it.
- Produces (`ui/`): `Toolbar` (`{ session, snapshot }`), `BuildBar` (`{ session, snapshot }`), `ErrorMessage` (`{ session, snapshot }`, `ERROR_MESSAGE_MS = 5000`).
- Produces (`app/main.tsx`): `<html data-last-command="…" data-last-cost="…">` after every executed construction command (e2e readiness signal, like `data-world-hash`).

- [ ] **Step 1: i18n keys** (Spanish from `lang/spanish.txt` where OpenTTD has the string):

| Key                            | en                                      | es                                             |
| ------------------------------ | --------------------------------------- | ---------------------------------------------- |
| `toolbar.label`                | Construction                            | Construcción                                   |
| `tool.rail`                    | Build railway track                     | Construir vías de ferrocarril                  |
| `tool.station`                 | Build railway station                   | Construir estación de tren                     |
| `tool.depot`                   | Build train depot                       | Construir depósito de trenes                   |
| `tool.demolish`                | Demolish                                | Demoler                                        |
| `tool.remove`                  | Remove                                  | Retirar                                        |
| `build.orientation`            | Orientation                             | Orientación                                    |
| `build.axisX`                  | Platforms along X                       | Andenes a lo largo de X                        |
| `build.axisY`                  | Platforms along Y                       | Andenes a lo largo de Y                        |
| `build.dir.ne`                 | Exit north-east                         | Salida noreste                                 |
| `build.dir.se`                 | Exit south-east                         | Salida sureste                                 |
| `build.dir.sw`                 | Exit south-west                         | Salida suroeste                                |
| `build.dir.nw`                 | Exit north-west                         | Salida noroeste                                |
| `build.estimatedCost`          | Estimated Cost: {money}                 | Coste estimado: {money}                        |
| `build.estimatedIncome`        | Estimated Income: {money}               | Ingreso estimado: {money}                      |
| `build.confirm`                | Build                                   | Construir                                      |
| `build.cancel`                 | Cancel                                  | Cancelar                                       |
| `header.cantBuildRail`         | Can't build railway track here...       | No se pueden construir ferrocarriles aquí...   |
| `header.cantRemoveRail`        | Can't remove railway track from here... | No se pueden retirar ferrocarriles aquí...     |
| `header.cantBuildStation`      | Can't build railway station here...     | No se puede construir estación de tren aquí... |
| `header.cantRemoveStationPart` | Can't remove part of station...         | No se puede retirar parte de la estación...    |
| `header.cantBuildDepot`        | Can't build train depot here...         | No se puede construir depósito aquí...         |
| `header.cantClearArea`         | Can't clear this area...                | No se puede despejar esta zona...              |
| `header.cantBorrow`            | Can't borrow any more money...          | No se puede incrementar el préstamo...         |
| `header.cantRepay`             | Can't repay loan...                     | No es posible pagar préstamo...                |

- [ ] **Step 2: Write the failing tests**

Add to `src/app/session.test.ts` (module scope helpers):

```ts
import type { MapPreview } from '../render/preview';
import type { BuildGesture } from '../render/gesture';
import type { OttdPoint } from '../render/projection';
import { execute, type Command } from '../sim/command/command';
import { getTrackBits } from '../sim/map/rail-map';
import { Track, TrackBits } from '../sim/track/track';

const P = (tx: number, ty: number, fx = 8, fy = 8): OttdPoint => ({
  x: tx * 16 + fx,
  y: ty * 16 + fy,
});
const gesture = (
  phase: BuildGesture['phase'],
  press: OttdPoint,
  current: OttdPoint,
  touch = false,
): BuildGesture => ({ phase, press, current, touch, ctrl: false });
const builder = (overrides: Partial<SessionDeps> = {}): GameSession => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.towns.push(newTown(0, tileXY(game.map, 20, 20), 0, false));
  return new GameSession(game, deps(overrides));
};
const DRAG: Command = {
  type: 'buildRailroadTrack',
  endTile: 14 + (10 << 6),
  startTile: 10 + (10 << 6),
  track: Track.X,
}; // tileXY(64-wide map, x, 10)

describe('GameSession construction (R20, R25, R31)', () => {
  it('previews a mouse drag with its cost and builds on release', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onPreview, onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().preview).toEqual({
      ok: true,
      cost: 450,
      error: null,
      needsConfirm: false,
    });
    expect(onPreview.mock.lastCall?.[0]).toMatchObject({ ok: true, tiles: [] });
    expect(onPreview.mock.lastCall?.[0]?.rails).toHaveLength(5);
    session.buildGesture(gesture('end', P(10, 10), P(14, 10)));
    expect([session.state.company.money, session.getSnapshot().preview]).toEqual([99550, null]);
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onExecuted).toHaveBeenCalledWith(DRAG, 450);
  });

  it('keeps a finger drag as a preview until Confirm, then builds exactly that (Review Focus 1)', () => {
    const onExecuted = vi.fn<(c: Command, cost: number) => void>();
    const session = builder({ onExecuted });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10), true));
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    expect([session.state.company.money, session.getSnapshot().preview?.needsConfirm]).toEqual([
      100000,
      true,
    ]);
    session.confirmBuild();
    expect(session.state.company.money).toBe(99550);
    expect(onExecuted.mock.calls).toEqual([[DRAG, 450]]);
  });

  it('cancels a pending preview without building', () => {
    const session = builder();
    session.setTool('rail');
    session.buildGesture(gesture('end', P(10, 10), P(14, 10), true));
    session.cancelBuild();
    session.confirmBuild(); // nothing pending any more
    expect([session.state.company.money, session.getSnapshot().preview]).toEqual([100000, null]);
  });

  it('says why nothing is built while paused (R24, Review Focus 4)', () => {
    const session = builder();
    session.togglePause();
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    const paused = { key: 'error.notAllowedWhilePaused', money: null, industry: null, town: null };
    expect(session.getSnapshot().preview).toEqual({
      ok: false,
      cost: 0,
      error: paused,
      needsConfirm: false,
    });
    session.buildGesture(gesture('end', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().error).toEqual({ header: 'header.cantBuildRail', detail: paused });
    expect(session.state.company.money).toBe(100000);
    session.dismissError();
    expect(session.getSnapshot().error).toBeNull();
  });

  it('turns the ghost red and names the amount when the cash is short (R31)', () => {
    const session = builder();
    session.state.company.money = 449;
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    expect(session.getSnapshot().preview).toEqual({
      ok: false,
      cost: 0,
      error: { key: 'error.notEnoughCash', money: 450, industry: null, town: null },
      needsConfirm: false,
    });
  });

  it('adds the follow-up rails after a depot (CcRailDepot)', () => {
    const session = builder();
    execute(
      session.state,
      { type: 'buildRail', tile: tileXY(session.state.map, 10, 9), track: Track.X },
      'exec',
    );
    session.setTool('depot'); // exit NW by default (InitializeRailGui)
    session.buildGesture(gesture('end', P(10, 10), P(10, 10)));
    expect(getTrackBits(session.state.map, tileXY(session.state.map, 10, 9))).toBe(
      TrackBits.X | TrackBits.Right | TrackBits.Lower,
    );
    expect(session.state.company.money).toBe(100000 - 90 - 540 - 75 - 75);
  });

  it('does nothing, silently, for a drag that ends on the map edge (InternalPost)', () => {
    const session = builder();
    session.setTool('rail');
    session.buildGesture(gesture('end', P(3, 10), P(0, 10)));
    expect([session.state.company.money, session.getSnapshot().error]).toEqual([100000, null]);
  });

  it('clears the ghost when the tool changes', () => {
    const onPreview = vi.fn<(p: MapPreview | null) => void>();
    const session = builder({ onPreview });
    session.setTool('rail');
    session.buildGesture(gesture('move', P(10, 10), P(14, 10)));
    session.setTool('station');
    expect([session.getSnapshot().preview, onPreview.mock.lastCall?.[0]]).toEqual([null, null]);
    expect([session.getSnapshot().stationAxis, session.getSnapshot().depotDir]).toEqual([0, 3]);
  });
});
```

`src/ui/construction.test.tsx` (happy-dom):

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuildBar } from './BuildBar';
import { ErrorMessage, ERROR_MESSAGE_MS } from './ErrorMessage';
import { BASE_SNAPSHOT, fakeSession } from './testing';
import { Toolbar } from './Toolbar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('construction toolbar', () => {
  it('toggles tools and shows each tool its options', () => {
    const session = fakeSession();
    const { rerender } = render(<Toolbar session={session} snapshot={BASE_SNAPSHOT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build railway track' }));
    expect(session.setTool).toHaveBeenCalledWith('rail');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    rerender(<Toolbar session={session} snapshot={{ ...BASE_SNAPSHOT, tool: 'station' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(session.setRemoveMode).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Platforms along Y' }));
    expect(session.setStationAxis).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Build railway station' }));
    expect(session.setTool).toHaveBeenLastCalledWith(null);
    rerender(<Toolbar session={session} snapshot={{ ...BASE_SNAPSHOT, tool: 'depot' }} />);
    expect(
      screen.getByRole('button', { name: 'Exit north-west' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Exit north-east' }));
    expect(session.setDepotDir).toHaveBeenCalledWith(0);
  });
});

describe('cost bar', () => {
  it('shows the estimate, or the income of a removal', () => {
    const preview = { ok: true, cost: 450, error: null, needsConfirm: false };
    const { rerender } = render(
      <BuildBar session={fakeSession()} snapshot={{ ...BASE_SNAPSHOT, preview }} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Estimated Cost: £450');
    expect(screen.queryByRole('button', { name: 'Build' })).toBeNull();
    rerender(
      <BuildBar
        session={fakeSession()}
        snapshot={{ ...BASE_SNAPSHOT, preview: { ...preview, cost: -265 } }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Estimated Income: £265');
  });

  it('asks a touch user to confirm, and shows a failing reason in Spanish', () => {
    const session = fakeSession();
    const preview = {
      ok: false,
      cost: 0,
      error: { key: 'error.notEnoughCash' as const, money: 450, industry: null, town: null },
      needsConfirm: true,
    };
    render(<BuildBar session={session} snapshot={{ ...BASE_SNAPSHOT, locale: 'es', preview }} />);
    expect(screen.getByRole('status').textContent).toMatch(
      /No hay suficiente dinero - se necesita 450\s£/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Construir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(session.confirmBuild).toHaveBeenCalledOnce();
    expect(session.cancelBuild).toHaveBeenCalledOnce();
  });
});

describe('error message (error_gui.cpp)', () => {
  it('shows header and detail and closes after 5 seconds or a click', () => {
    vi.useFakeTimers();
    const session = fakeSession();
    const error = {
      header: 'header.cantBuildRail' as const,
      detail: {
        key: 'error.notAllowedWhilePaused' as const,
        money: null,
        industry: null,
        town: null,
      },
    };
    render(<ErrorMessage session={session} snapshot={{ ...BASE_SNAPSHOT, error }} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Can't build railway track here...");
    expect(alert.textContent).toContain('Not allowed while paused');
    vi.advanceTimersByTime(ERROR_MESSAGE_MS);
    fireEvent.click(alert);
    expect(session.dismissError).toHaveBeenCalledTimes(2);
  });
});
```

`tests/e2e/construction.spec.ts` (move `openWorld`/`tileCentre` from `query.spec.ts` into `tests/e2e/helpers.ts` with the world as a parameter, and use them in both specs):

```ts
import { expect, test, type Page } from '@playwright/test';
import { getTileType, TileType, tileXY, type MapState } from '../../src/sim/map/map';
import { isTileFlat } from '../../src/sim/map/slope';
import { createGame } from '../../src/sim/world/generate';
import { lastCommand, mouseDrag, openWorld, tileCentre, touchDrag } from './helpers';

const SEED = 7;
const world = createGame({ mapLogX: 6, mapLogY: 6, seed: SEED });

/** First run of `length` flat clear tiles along X, away from the edge (or -1). */
function findRun(map: MapState, length: number): number {
  for (let y = 6; y < map.sizeY - 6; y++) {
    for (let x = 6; x < map.sizeX - 6 - length; x++) {
      const tiles = Array.from({ length }, (_, i) => tileXY(map, x + i, y));
      if (tiles.every((t) => getTileType(map, t) === TileType.Clear && isTileFlat(map, t)))
        return tiles[0]!;
    }
  }
  return -1;
}
const gbp = (n: number): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(n);

const A = findRun(world.map, 5);
const C = A + 2; // two tiles further along X
const E = A + 4;

async function gestureAndConfirm(
  page: Page,
  isMobile: boolean,
  from: number,
  to: number,
): Promise<void> {
  const a = await tileCentre(page, world, from);
  const b = await tileCentre(page, world, to);
  if (isMobile) {
    await touchDrag(page, a, b);
    const confirm = page.getByRole('button', { name: 'Build', exact: true });
    await expect(confirm).toBeVisible();
    expect(await lastCommand(page)).toBeNull(); // nothing until Confirm (R20)
    await confirm.tap();
  } else {
    await mouseDrag(page, a, b);
  }
}

test('the seed has five flat clear tiles in a row', () => {
  expect(A).toBeGreaterThanOrEqual(0);
});

test('a rail drag builds the piece OpenTTD would and charges for it (Review Focus 1)', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  await gestureAndConfirm(page, isMobile, A, E);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'buildRailroadTrack', endTile: E, startTile: A, track: 0 });
  const cost = Number(await page.locator('html').getAttribute('data-last-cost'));
  expect(cost).toBeGreaterThanOrEqual(5 * 75);
  await expect(page.getByLabel('Money')).toHaveText(gbp(100000 - cost));
});

test('a station drag builds one platform along X', async ({ page, isMobile }) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway station' }).click();
  await gestureAndConfirm(page, isMobile, A, C);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'buildRailStation', tile: A, axis: 0, numTracks: 1, platLength: 3 });
});

test('a depot faces north-west by default and the bulldozer clears a tile', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build train depot' }).click();
  await gestureAndConfirm(page, isMobile, A, A);
  await expect.poll(() => lastCommand(page)).toEqual({ type: 'buildTrainDepot', tile: A, dir: 3 });
  await page.getByRole('button', { name: 'Demolish' }).click();
  await gestureAndConfirm(page, isMobile, E, E);
  await expect
    .poll(() => lastCommand(page))
    .toEqual({ type: 'clearArea', endTile: E, startTile: E, diagonal: false });
});

test('building while paused explains why and builds nothing (Review Focus 4)', async ({
  page,
  isMobile,
}) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Build railway track' }).click();
  await gestureAndConfirm(page, isMobile, A, A);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText("Can't build railway track here...");
  await expect(alert).toContainText('Not allowed while paused');
  expect(await lastCommand(page)).toBeNull();
});
```

`tests/e2e/helpers.ts` provides `openWorld(page, world, seed, tile)` (the 1.2 body with `size=${sizeX}x${sizeY}`), `tileCentre(page, world, tile)` (1.2 body), `mouseDrag(page, from, to)` (`mouse.move`, `down`, `move` in 8 steps, `up`), `touchDrag(page, from, to)` (CDP `Input.dispatchTouchEvent`: `touchStart` at `from`, six `touchMove`s to `to`, `touchEnd`, as the 1.2 pinch test does with one point), `lastCommand(page)` (`JSON.parse` of `data-last-command`, or `null`).

Run: `npx vitest run src/app src/ui` — Expected: FAIL.

- [ ] **Step 3: Session** — `app/session.ts` (state: `removeMode = false`, `stationAxis = Axis.X`, `depotDir = DiagDir.NW` (`InitializeRailGui`), `preview`, `pending: PlannedBuild | null`, `error`):

```ts
buildGesture = (g: BuildGesture): void => {
  const tool = this.tool;
  if (!isBuildTool(tool) || g.phase === 'cancel') return this.cancelBuild();
  const plan = planBuild(this.state.map, tool, this.buildOptions(), g.press, g.current, g.ctrl);
  if (plan === null) return this.cancelBuild();
  const test = execute(this.state, plan.command, 'test');
  const ok = test.ok && checkCompanyHasMoney(this.state.company, test.cost); // R31 (`clearArea` is NO_TEST, so `execute` does not check the cash)
  this.deps.onPreview?.({ ok, rails: plan.rails, tiles: plan.tiles });
  if (g.phase === 'hover') return;
  const preview: UiPreview = { ok, cost: test.ok ? test.cost : 0, error: test.ok ? null : toUiError(this.state, test.error), needsConfirm: false };
  if (g.phase === 'move') {
    this.pending = null;
    this.preview = preview;
    this.refresh();
  } else if (g.touch) {
    this.pending = plan; // R20: a finger lifts, the build waits for Confirm
    this.preview = { ...preview, needsConfirm: true };
    this.refresh();
  } else {
    this.runBuild(plan);
  }
};

confirmBuild = (): void => {
  if (this.pending !== null) this.runBuild(this.pending);
};

private runBuild(plan: PlannedBuild): void {
  this.clearBuild();
  const result = execute(this.state, plan.command, 'exec');
  const tile = commandTile(plan.command);
  if (!result.ok && result.error === null && tile !== null && !isValidTile(this.state.map, tile)) {
    // InternalPost refuses a command on an off-map/void first tile silently: no error window.
  } else if (!result.ok) {
    this.error = { header: plan.header, detail: toUiError(this.state, result.error) };
  } else {
    this.deps.onExecuted?.(plan.command, result.cost);
    if (plan.command.type === 'buildTrainDepot') {
      const { tile, dir } = plan.command;
      for (const step of [0, 1, 2] as const) {
        const extra = depotExtraRail(this.state, tile, dir, step); // CcRailDepot: separate commands, errors silent
        if (extra !== null) execute(this.state, { type: 'buildRail', tile: extra.tile, track: extra.track }, 'exec');
      }
    }
  }
  this.refresh();
}
```

`cancelBuild` = `clearBuild()` (pending and preview `null`, `onPreview(null)`) + `refresh()`; `setTool`, `setRemoveMode`, `setStationAxis`, `setDepotDir` also `clearBuild()`. `toUiError`: `error === null ? null : { key, money: params['money'] ?? null, industry: params['industry'] === undefined ? null : industryInfo(state, params['industry']), town: params['town'] === undefined ? null : townInfo(state, params['town'])?.name ?? null }`. The query tool stays as in 1.2 (a tap only queries when `tool === 'query'`).

- [ ] **Step 4: UI** — `Toolbar.tsx`: `<nav class="toolbar" aria-label={t('toolbar.label')}>` with four `aria-pressed` tool buttons (glyphs `╪`, `▤`, `⌂`, `✖`) toggling `setTool(tool | null)`; for rail or station a `tool.remove` toggle; for station (not removing) a `role="group"` labelled `build.orientation` with `build.axisX`/`build.axisY`; for depot four `build.dir.*` buttons (glyphs `↖`, `↗`, `↘`, `↙` for NE, SE, SW, NW as seen on screen: NE = up, SE = right, SW = down, NW = left). `BuildBar.tsx`: `null` without a preview; else `<div class={'build-bar ' + (ok ? 'ok' : 'bad')} role="status">` with `errorText` when there is an error, else `build.estimatedCost`/`build.estimatedIncome` (`formatMoney(Math.abs(cost))`), plus `build.confirm`/`build.cancel` buttons when `needsConfirm`. `ErrorMessage.tsx`: `<div class="error-message" role="alert" onClick={dismiss}>` with `t(header)` and the detail; `useEffect` starts a `window.setTimeout(session.dismissError, ERROR_MESSAGE_MS)` per error and clears it. `App.tsx` renders `Toolbar`, `BuildBar`, `ErrorMessage`. `styles.css`: desktop — toolbar as a row under the status bar, cost bar and error centred near the top; below 768 px — toolbar as a second bottom row above the status bar (safe-area inset kept), cost bar above it; all buttons ≥ 44 px; `.build-bar.ok` green text, `.bad` red.

- [ ] **Step 5: `main.tsx`** — pass `onBuildGesture: (g) => session.buildGesture(g)` to `MapScene`; session deps `onPreview: (p) => scene.showPreview(p)` and `onExecuted: (command, cost) => { const html = document.documentElement; html.dataset['lastCommand'] = JSON.stringify(command); html.dataset['lastCost'] = String(cost); }`; `session.subscribe(() => scene.setBuildMode(isBuildTool(session.getSnapshot().tool)))`.

- [ ] **Step 6: Run** — `npm test && npm run lint && npm run typecheck && npm run test:e2e` — Expected: all passed on both projects. If the seed has no 5-tile run, pick another seed for this spec and say so in the commit body. Build the preview (`npm run build && npm run preview -- --port 4317 --base /openttd-web/`), lay a line with a station, a depot and a crossing on desktop and on a phone viewport, and look at the screenshots: track pieces, ghost colours, cost bar, Confirm button, error message.

- [ ] **Step 7: Commit** — `feat: add the construction tools with cost preview and confirm` (body: the session runs each gesture's command in test mode to colour the ghost and show the cost (R31), builds on mouse release like OpenTTD and on Confirm for touch (R20), shows OpenTTD's error header and detail, including "Not allowed while paused" (R24), and posts the depot's follow-up rails as separate commands like `CcRailDepot`; `data-last-command` lets e2e check the exact command a phone gesture produced. `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 11: Finances window with the loan

**Files:**

- Create: `src/ui/FinancesWindow.tsx`, `src/ui/FinancesWindow.test.tsx`, `tests/e2e/finances.spec.ts`
- Modify: `src/ui/session.ts`, `src/ui/testing.ts`, `src/app/session.ts`, `src/app/session.test.ts`, `src/ui/App.tsx`, `src/ui/Toolbar.tsx`, `src/ui/construction.test.tsx`, `src/ui/styles.css`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`

Sources: economy.md §4.8 (commands, GUI: click = one `LOAN_INTERVAL`, Ctrl+click = max); spec §5 (finances window: loan + / −; the yearly table is block 1.5); R24, R25. C++: `company_gui.cpp` (`WID_CF_INCREASE_LOAN`, `WID_CF_REPAY_LOAN`: `_ctrl_pressed ? LoanCommand::Max : LoanCommand::Interval`, headers `STR_ERROR_CAN_T_BORROW_ANY_MORE_MONEY`, `STR_ERROR_CAN_T_REPAY_LOAN`).

**Interfaces:**

- Consumes: Task 1 (`increaseLoan`/`decreaseLoan` commands, `LOAN_INTERVAL`), Task 10 (`UiError`, `toUiError`, `ErrorMessage`, `testing.ts`).
- Produces (`ui/session.ts`): `UiSnapshot` gains `loan: number`, `maxLoan: number`; `UiSession` gains `changeLoan(action: 'borrow' | 'repay', all: boolean): void`.
- Produces (`ui/FinancesWindow.tsx`): `FinancesWindow({ locale, money, loan, maxLoan, onLoan }: { locale: Locale; money: number; loan: number; maxLoan: number; onLoan(action: 'borrow' | 'repay', all: boolean): void })`, `LOAN_LONG_PRESS_MS = 500`.
- Produces (`ui/Toolbar.tsx`): a required `onFinances: () => void` prop and a "Finances" button (`£`, `hud.finances`); `App` opens a `'finances'` panel (one window at a time, as the other panels). The Task 10 `Toolbar` renders in `construction.test.tsx` pass `onFinances={() => undefined}`.

- [ ] **Step 1: i18n keys**

| Key                | en                                            | es                                             |
| ------------------ | --------------------------------------------- | ---------------------------------------------- |
| `hud.finances`     | Finances                                      | Finanzas                                       |
| `finances.title`   | Finances                                      | Finanzas                                       |
| `finances.balance` | Bank Balance: {money}                         | Saldo bancario: {money}                        |
| `finances.loan`    | Loan: {money}                                 | Préstamo: {money}                              |
| `finances.maxLoan` | Maximum Loan: {money}                         | Préstamo Máximo: {money}                       |
| `finances.borrow`  | Borrow {money}                                | Pedir Préstamo {money}                         |
| `finances.repay`   | Repay {money}                                 | Pagar Préstamo {money}                         |
| `finances.hint`    | Ctrl+click or long press: as much as possible | Ctrl+clic o pulsación larga: lo máximo posible |

- [ ] **Step 2: Write the failing tests**

`src/ui/FinancesWindow.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinancesWindow, LOAN_LONG_PRESS_MS } from './FinancesWindow';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('finances window (company_gui.cpp)', () => {
  it('shows cash, loan and limit, and borrows one step or as much as possible', () => {
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    render(
      <FinancesWindow locale="en" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    for (const text of ['Bank Balance: £100,000', 'Loan: £100,000', 'Maximum Loan: £300,000'])
      expect(screen.getByText(text)).toBeTruthy();
    const borrow = screen.getByRole('button', { name: 'Borrow £10,000' });
    fireEvent.click(borrow);
    fireEvent.click(borrow, { ctrlKey: true });
    expect(onLoan.mock.calls).toEqual([
      ['borrow', false],
      ['borrow', true],
    ]);
  });

  it('repays everything on a long press, without a second step from the click that follows', () => {
    vi.useFakeTimers();
    const onLoan = vi.fn<(action: 'borrow' | 'repay', all: boolean) => void>();
    render(
      <FinancesWindow locale="es" money={100000} loan={100000} maxLoan={300000} onLoan={onLoan} />,
    );
    const repay = screen.getByRole('button', { name: /Pagar Préstamo 10\.000\s£/ });
    fireEvent.pointerDown(repay);
    vi.advanceTimersByTime(LOAN_LONG_PRESS_MS);
    fireEvent.pointerUp(repay);
    fireEvent.click(repay);
    expect(onLoan.mock.calls).toEqual([['repay', true]]);
  });
});
```

Add to `src/app/session.test.ts`:

```ts
describe('GameSession loan (economy.md §4.8)', () => {
  it('borrows and repays through commands and shows the loan', () => {
    const session = builder();
    session.changeLoan('borrow', false);
    expect([
      session.getSnapshot().money,
      session.getSnapshot().loan,
      session.getSnapshot().maxLoan,
    ]).toEqual([110000, 110000, 300000]);
    session.changeLoan('borrow', true);
    expect(session.getSnapshot().loan).toBe(300000);
    session.state.company.money = 95500;
    session.state.company.currentLoan = 100000;
    session.changeLoan('repay', true); // never more than the cash (Review Focus 2)
    expect([session.state.company.money, session.state.company.currentLoan]).toEqual([5500, 10000]);
  });

  it('refuses the loan while paused with OpenTTD headers (R24, Review Focus 4)', () => {
    const session = builder();
    session.togglePause();
    session.changeLoan('borrow', false);
    expect(session.getSnapshot().error).toEqual({
      header: 'header.cantBorrow',
      detail: { key: 'error.notAllowedWhilePaused', money: null, industry: null, town: null },
    });
    expect(session.getSnapshot().loan).toBe(100000);
  });
});
```

`tests/e2e/finances.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
});

test('borrows £10,000 and repays everything', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Finances' }).click();
  const dialog = page.getByRole('dialog', { name: 'Finances' });
  await dialog.getByRole('button', { name: 'Borrow £10,000' }).click();
  await expect(page.getByLabel('Money')).toHaveText('£110,000');
  await expect(dialog).toContainText('Loan: £110,000');
  const repay = dialog.getByRole('button', { name: 'Repay £10,000' });
  if (isMobile) {
    const box = (await repay.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(700); // long press = all (R25)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await repay.click({ modifiers: ['Control'] });
  }
  await expect(dialog).toContainText('Loan: £0');
  await expect(page.getByLabel('Money')).toHaveText('£0');
});
```

Run: `npx vitest run src/ui src/app` — Expected: FAIL.

- [ ] **Step 3: Implement** — `GameSession.changeLoan(action, all)`: `execute(state, { type: action === 'borrow' ? 'increaseLoan' : 'decreaseLoan', amount: all ? 'max' : 'interval' }, 'exec')`; on failure `error = { header: action === 'borrow' ? 'header.cantBorrow' : 'header.cantRepay', detail: toUiError(...) }`; `refresh()`. Snapshot `loan = company.currentLoan`, `maxLoan = company.maxLoan`. `FinancesWindow`: three lines, two buttons labelled with `formatMoney(LOAN_INTERVAL)`, the hint; each button: `onPointerDown` starts `window.setTimeout(() => { longPressed = true; onLoan(action, true); }, LOAN_LONG_PRESS_MS)`; `onPointerUp`/`onPointerLeave` clear the timer; `onClick(e)`: if `longPressed`, reset and ignore, else `onLoan(action, e.ctrlKey)` (refs per button, no state). `App`: `'finances'` panel with `Panel` title `finances.title`; `testing.ts`: `BASE_SNAPSHOT` gains `loan: 100000`, `maxLoan: 300000`, `fakeSession` gains `changeLoan`.

- [ ] **Step 4: Run** — `npm test && npm run lint && npm run typecheck && npm run test:e2e` — all passed on both projects.

- [ ] **Step 5: Commit** — `feat: add the finances window with the bank loan` (body: borrowing and repaying go through `CmdIncreaseLoan`/`CmdDecreaseLoan`, so the £10,000 steps, the £300,000 limit, "repay all" never taking more than the cash and the pause refusal are OpenTTD's (R24, R25); a long press stands in for Ctrl+click on phones; the yearly expense table joins this window in block 1.5. `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 12: Query tool for rail, depots, stations and crossings

**Files:**

- Create: `src/ui/names.ts`
- Modify: `src/sim/query.ts`, `src/sim/query.test.ts`, `src/ui/TileInfo.tsx`, `src/ui/windows.test.tsx`, `src/ui/session.ts` (tile window), `src/app/session.ts`, `src/ui/App.tsx`, `src/ui/App.test.tsx`, `src/ui/i18n/en.json`, `src/ui/i18n/es.json`, `tests/e2e/construction.spec.ts`

Sources: OpenTTD's land area information window (`misc_gui.cpp:LandInfoWindow`: tile description, owners, "Cost to clear" from a test run of `CMD_LANDSCAPE_CLEAR`); `GetTileDesc_Track`, `GetTileDesc_Station`, `GetTileDesc_Road`; `strings.cpp` station and depot names; stations-cargo.md §4.2 name strings; R27.

**Interfaces:**

- Consumes: Tasks 1–7 (`landscapeClear`, `DoFlag`, `COMPANY_FIRST`, `isPlainRail`, `isRailDepotTile`, `getDepotIndex`, `isRailStationTile`, `getStationIndex`, `isLevelCrossingTile`, `Station`, `Depot`, `StationNameKind`).
- Produces (`sim/query.ts`): `TileKind` += `'rail' | 'depot' | 'station' | 'crossing'`; `TileInfo.owner: 'none' | 'water' | 'town' | 'company'`; `TileInfo` gains `stationIndex: number | null`, `depotIndex: number | null`, `costToClear: number | null` (the company's test run of `landscapeClear`; `null` when it fails, OpenTTD's "N/A"); a crossing has `owner: 'company'` (the rail) and `townIndex` (the road's town); `interface StationInfo { index: number; townName: string; nameKind: StationNameKind }`, `stationInfo(state, index): StationInfo | null`; `interface DepotInfo { index: number; townName: string; townCn: number }`, `depotInfo(state, index): DepotInfo | null`.
- Produces (`ui/session.ts`): the tile window becomes `{ kind: 'tile'; info: TileInfo; townName: string | null; station: StationInfo | null; depot: DepotInfo | null }`.
- Produces (`ui/names.ts`): `stationName(locale, info: StationInfo): string` (`station.name.<kind>` with `{town}`, and `{number}` = station index for `fallback`), `depotName(locale, info: DepotInfo): string` (`depot.name` when `townCn === 0`, else `depot.nameSerial` with `number = townCn + 1`).

- [ ] **Step 1: i18n keys** — `station.name.<kind>` for the 20 kinds (en from `lang/english.txt`, es from `lang/spanish.txt`, `{STRING1}` → `{town}`, `{NUM}` → `{number}`): town `{town}` / `{town}`; north `{town} North` / `{town} Norte`; south `{town} South` / `{town} Sur`; east `{town} East` / `{town} Este`; west `{town} West` / `{town} Oeste`; central `{town} Central` / `{town} Central`; transfer `{town} Transfer` / `{town} Transferencia`; halt `{town} Halt` / `{town} Parada`; valley `{town} Valley` / `Valle de {town}`; heights `{town} Heights` / `Cumbres de {town}`; woods `{town} Woods` / `Arboleda de {town}`; lakeside `{town} Lakeside` / `Lago de {town}`; exchange `{town} Exchange` / `{town} Intercambio`; mines `{town} Mines` / `Minas de {town}`; annexe `{town} Annexe` / `{town} Anexo`; sidings `{town} Sidings` / `Proximidades de {town}`; branch `{town} Branch` / `Ramal de {town}`; upper `Upper {town}` / `{town} Alto`; lower `Lower {town}` / `{town} Bajo`; fallback `{town} Station #{number}` / `{town} Estación #{number}`. Plus:

| Key                  | en                           | es                                   |
| -------------------- | ---------------------------- | ------------------------------------ |
| `depot.name`         | {town} Train Depot           | {town} Depósito de trenes            |
| `depot.nameSerial`   | {town} Train Depot #{number} | {town} Depósito de Trenes #{number}  |
| `tile.kind.rail`     | Railway track                | Vía de ferrocarril                   |
| `tile.kind.depot`    | Railway train depot          | Depósito de trenes de ferrocarril    |
| `tile.kind.station`  | Railway station              | Estación de trenes                   |
| `tile.kind.crossing` | Road/rail level crossing     | Paso a nivel                         |
| `owner.company`      | Your company                 | Tu empresa                           |
| `tile.railOwner`     | Railway owner: {owner}       | Propietario del ferrocarril: {owner} |
| `tile.roadOwner`     | Road owner: {owner}          | Propietario de la carretera: {owner} |
| `tile.costToClear`   | Cost to clear: {money}       | Coste de despeje: {money}            |
| `tile.costToClearNA` | Cost to clear: N/A           | Coste de despeje: N/D                |

- [ ] **Step 2: Write the failing tests** — in `src/sim/query.test.ts`, the 1.2 expectations gain `stationIndex: null, depotIndex: null` and `costToClear` (grass at density 3: `15`; a town road: `null` — refused, R33; a house `0x06`: `375`; sea: `7500`; void: `null`), and add:

```ts
it('describes rail, depots, stations and crossings with their cost to clear', () => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  const at = (x: number, y: number): number => tileXY(game.map, x, y);
  game.towns.push(newTown(0, at(20, 20), 0, false));
  execute(game, { type: 'buildRail', tile: at(10, 10), track: Track.X }, 'exec');
  execute(game, { type: 'buildTrainDepot', tile: at(12, 10), dir: DiagDir.NW }, 'exec');
  execute(
    game,
    { type: 'buildRailStation', tile: at(14, 10), axis: Axis.X, numTracks: 1, platLength: 2 },
    'exec',
  );
  makeRoadNormal(game.map, at(20, 30), RoadBits.Y, 0);
  execute(game, { type: 'buildRail', tile: at(20, 30), track: Track.X }, 'exec');
  expect(describeTile(game, at(10, 10))).toEqual({
    tile: at(10, 10),
    x: 10,
    y: 10,
    z: 1,
    kind: 'rail',
    owner: 'company',
    townIndex: null,
    industryIndex: null,
    stationIndex: null,
    depotIndex: null,
    costToClear: -53,
  });
  expect(describeTile(game, at(12, 10))).toMatchObject({
    kind: 'depot',
    owner: 'company',
    depotIndex: 0,
    costToClear: 60,
  });
  expect(describeTile(game, at(15, 10))).toMatchObject({
    kind: 'station',
    owner: 'company',
    stationIndex: 0,
    costToClear: 74,
  });
  expect(describeTile(game, at(20, 30))).toMatchObject({
    kind: 'crossing',
    owner: 'company',
    townIndex: 0,
    costToClear: -53,
  });
  expect(stationInfo(game, 0)).toEqual({ index: 0, townName: 'Invenville', nameKind: 'north' });
  expect(depotInfo(game, 0)).toEqual({ index: 0, townName: 'Invenville', townCn: 0 });
  expect([stationInfo(game, 3), depotInfo(game, 3)]).toEqual([null, null]);
});

it('keeps a town with no houses left describable (Review Focus 3)', () => {
  const game = createEmptyGame({ mapLogX: 6, mapLogY: 6 });
  game.towns.push(newTown(0, tileXY(game.map, 20, 30), 0, true));
  expect(townInfo(game, 0)).toMatchObject({ population: 0, houses: 0 });
});
```

`src/ui/windows.test.tsx` — add:

```tsx
it('names stations and depots and shows the owners of a crossing', () => {
  const base = { ...ROAD, townIndex: null, stationIndex: null, depotIndex: null, costToClear: 74 };
  const { unmount } = render(
    <TileInfo
      locale="en"
      info={{ ...base, kind: 'station', owner: 'company', stationIndex: 0 }}
      townName={null}
      station={{ index: 0, townName: 'Invenville', nameKind: 'north' }}
      depot={null}
      onOpenTown={() => undefined}
    />,
  );
  for (const text of [
    'Railway station',
    'Invenville North',
    'Owner: Your company',
    'Cost to clear: £74',
  ])
    expect(screen.getByText(text)).toBeTruthy();
  unmount();
  render(
    <TileInfo
      locale="es"
      info={{ ...base, kind: 'crossing', owner: 'company', townIndex: 0, costToClear: null }}
      townName="Invenville"
      station={null}
      depot={null}
      onOpenTown={() => undefined}
    />,
  );
  for (const text of [
    'Paso a nivel',
    'Propietario del ferrocarril: Tu empresa',
    'Propietario de la carretera: Invenville',
    'Coste de despeje: N/D',
  ])
    expect(screen.getByText(text)).toBeTruthy();
});

it('numbers the second depot of a town', () => {
  expect([
    depotName('en', { index: 0, townName: 'Invenville', townCn: 0 }),
    depotName('en', { index: 1, townName: 'Invenville', townCn: 1 }),
  ]).toEqual(['Invenville Train Depot', 'Invenville Train Depot #2']);
});

it('shows Population: 0 for a town whose houses were all demolished (Review Focus 3)', () => {
  render(<TownWindow locale="en" info={{ ...TOWN, population: 0, houses: 0 }} />);
  expect(screen.getByText('Population: 0')).toBeTruthy();
});
```

(The existing `ROAD`/`GRASS` fixtures gain `stationIndex: null, depotIndex: null, costToClear: null` / `15`, and existing `TileInfo` renders pass `station={null} depot={null}`.)

Add to `tests/e2e/construction.spec.ts`:

```ts
test('querying built track shows it belongs to the player', async ({ page, isMobile }) => {
  await openWorld(page, world, SEED, A);
  await page.getByRole('button', { name: 'Build railway track' }).click();
  await gestureAndConfirm(page, isMobile, A, E);
  await expect.poll(() => lastCommand(page)).not.toBeNull();
  await page.getByRole('button', { name: 'Query tile' }).click();
  const { x, y } = await tileCentre(page, world, C);
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  const dialog = page.getByRole('dialog', { name: 'Land area information' });
  await expect(dialog).toContainText('Railway track');
  await expect(dialog).toContainText('Owner: Your company');
});
```

Run: `npx vitest run src/sim/query.test.ts src/ui` — Expected: FAIL.

- [ ] **Step 3: Implement** — `query.ts`: Railway → `isRailDepotTile` ? `'depot'` (with `depotIndex = getDepotIndex`) : `'rail'`; Station → `'station'` (`stationIndex`); Road → crossing ? `'crossing'` (owner `'company'`, `townIndex = getTownIndex`) : `'road'`; owner `'company'` when `getTileOwner === COMPANY_FIRST` on rail, depot and station tiles; `costToClear`: `const r = landscapeClear(state, t, DoFlag.None, COMPANY_FIRST); r.ok ? r.cost : null` (void: `null` before calling). `stationInfo`/`depotInfo` read the pools (`null` for an empty or missing slot) and `townName(town.nameParts)`. `app/session.ts` `buildWindow` adds `station`/`depot` from the tile's indices. `TileInfo.tsx`: kind line; the station or depot name (`names.ts`); owners — crossing: `tile.railOwner` (company) and `tile.roadOwner` (town name); others: `tile.owner` with `owner.company` for the company (R27); location; `tile.costToClear` (`formatMoney`, negative for a refund) or `tile.costToClearNA`; the town button as before.

- [ ] **Step 4: Run** — `npm test && npm run lint && npm run typecheck && npm run test:e2e` — all passed on both projects.

- [ ] **Step 5: Commit** — `feat: query rail, depots, stations and crossings` (body: the land information shows what OpenTTD's does for the new tiles — kind, station or depot name in the player's language, rail and road owners of a crossing, and the cost to clear from a test run of the bulldozer, the number a player needs before demolishing; the player's company is "Your company" until company names exist (R27). `Refs #N`). PR into `stage-1/block-1.3`.

---

### Task 13: Close block 1.3

- [ ] **Step 1: Playtest guide** `docs/game/block-1.3.md` (English, same shape as `block-1.2.md`): preview `https://s-tian86.github.io/openttd-web/preview/block-1-3/`; what is new (building track with the autorail drag, stations, depots, level crossings over town roads, the bulldozer for tiles and areas, the cost ghost and cost bar, Confirm on the phone, error messages, the finances window with the loan, the query tool on the new tiles); what to try on the phone (build a line from a coal mine towards a power station — use `?seed=…&size=64x64`; drag diagonally and watch the staircase; build a station of 1×5 and extend it; build a depot facing the track and see the extra pieces; cross a town road and bulldoze the crossing (only the rail goes); demolish a house and a station; try to bulldoze a town road (the local authority refuses); try to build while paused; run out of money, then borrow; repay with a long press; clear a sea tile and watch the water come back; query each new tile); not there yet (trains — block 1.4 —, cargo, income, the finances table and interest — block 1.5 —, town ratings — Stage 2 —, real art — block 1.6); how to report (issue with label `playtest`).
- [ ] **Step 2: Differences** — add rows to `docs/game/differences.md` and amend "Building on slopes":

| Area               | OpenTTD                                                                  | openttd-web                                                                                     | Why                                               |
| ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Town ratings       | Each town rates each company; demolition and stations need it            | Ratings stay at the initial 500 and never change: houses can always be demolished               | R15: Stage 2 ports ratings                        |
| Town roads         | The bulldozer removes town roads and level crossings (rating permitting) | Town roads cannot be removed by the player; bulldozing a crossing removes only the rail         | D2 / R33: Stage 2 with town ratings               |
| Joining stations   | Ctrl builds a separate adjacent station; distant join window             | A new station joins the single adjacent station or is new; no distant join                      | R18: simpler tool for Stage 1                     |
| Building on slopes | Foundations                                                              | Rail, depots and stations need flat land ("Flat land required"); towns and industries as before | D4 / R26: Stage 2 adds foundations                |
| Company name       | "{Town} Transport" and a manager face                                    | "Your company"                                                                                  | R27: company names arrive with company management |
| Track fences       | Drawn                                                                    | Stored but not drawn                                                                            | R32: art block 1.6                                |
| Building by touch  | Mouse only; Shift shows the cost                                         | Finger down/up are press/release; a Confirm button; the ghost and cost bar show while dragging  | R20, R30, R31; spec §4                            |

- [ ] **Step 3: TRACKING** — mark the block 1.3 task lines `[x]` (1.3.0 reference notes and plan, 1.3.1–1.3.13) and the block line `[~] 1.3 Construction — branch stage-1/block-1.3 — awaiting playtest`.
- [ ] **Step 4: Commit, PR into the block branch, merge** (`docs: close block 1.3`); wait for the preview deploy; screenshot `…/preview/block-1-3/?seed=7&size=64x64` with a short line, a station, a depot and a crossing on a phone viewport and on desktop.
- [ ] **Step 5: Notify the author** (push notification): preview link + guide link. Start block 1.4 (at most three blocks may wait for a playtest, spec §7).
