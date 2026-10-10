# Stage 1 — First train: design

> Design of Stage 1, agreed with the author on 2026-10-10. It refines
> [`00-master.md`](00-master.md) §6 Stage 1; where they differ, this document wins for Stage 1
> and the master plan is amended. Each block below gets its own implementation plan,
> `stage-1.N-<name>.md`, written when the block starts.
>
> Sources: the reference notes in [`../reference/openttd/`](../reference/openttd/) (OpenTTD 15.3).

## 1. Goal and success criteria

The core OpenTTD loop, playable in the browser on desktop and phone, faithful to the original:
build a line, run a train, carry cargo, earn money. The author has never played OpenTTD and
learns it block by block.

**Stage 1 is done when**, on a phone, in Spanish, the author can:

1. generate a world from the new-game window;
2. build a coal line from a mine to a power station and a passenger line between two towns;
3. watch the trains run, load and unload;
4. see in the finances window the same amounts OpenTTD would produce (the values pinned by the
   fidelity tests);

and the release is tagged **`v0.1.0`** with a public name and the art direction chosen.

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                | Why                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Random numbers:** port OpenTTD's generator (`core/random_func`) and every formula with its exact probabilities. Games are fully reproducible from seed + commands, but the sequence is **not** guaranteed bit-identical to OpenTTD's. | Fidelity a player feels lives in the formulas; matching OpenTTD's call order everywhere would be costly and fragile.            |
| D2  | **Towns have roads from Stage 1.** Town generation is ported with its roads. Roads belong to towns: the player cannot build or remove them yet. **Level crossings** (rail over a town road) are included.                               | Towns cannot be generated faithfully without roads; without crossings, towns would block every line.                            |
| D3  | **Breakdowns "none"** for Stage 1: no breakdowns, and (through the default `no_servicing_if_no_breakdowns = true`) no automatic servicing.                                                                                              | A real OpenTTD configuration; breakdowns and servicing arrive in Stage 4. Temporary difference.                                 |
| D4  | **OpenTTD's height model from day one.** Tiles store height as in OpenTTD. Stage 1 generates sea at height 0 and land at height 1; coast tiles are slopes. Rail cannot be built on slopes until Stage 2 (foundations).                  | Stage 2 adds hills and building on slopes without changing the map format.                                                      |
| D5  | **Pathfinding:** lowest-cost route using YAPF's base tile and curve costs, honouring `forbid_90_deg = true`. Full YAPF arrives with signals in Stage 3.                                                                                 | Without signals there is one train per connected network (as in OpenTTD), so route choice rarely differs. Temporary difference. |
| D6  | **No signals, as in OpenTTD:** the whole connected network is one block. A train leaves its depot only if no other train is on the network. Trains that meet crash.                                                                     | Faithful behaviour for a network without signals.                                                                               |
| D7  | **New game like OpenTTD:** map size (64–1024 per side), number of towns and industry density, with OpenTTD's defaults (256×256). Only coal mines and power stations exist in Stage 1, generated with OpenTTD's placement rules.         | No invented "starter world"; a 64×64 map gives the guided experience.                                                           |
| D8  | **Money** is a JavaScript integer `number` (exact up to 2⁵³ − 1), not `bigint`. Shifts and divisions reproduce OpenTTD's rounding.                                                                                                      | Far beyond any OpenTTD amount and much faster than `bigint`.                                                                    |
| D9  | **Source quirks:** when OpenTTD's code contradicts its own comment (rail-station length cost counter, cargo reservation precedence, drag-build stop tile, `int32` cast in income), port the **code**.                                   | That is the game people play. Deliberate changes go to `docs/game/differences.md`.                                              |
| D10 | **Currency:** pounds only, as OpenTTD's default. Other display currencies come later.                                                                                                                                                   | Display-only feature; not needed to learn the game.                                                                             |

Temporary differences D3, D4 (rail on slopes), D5 and D10 are listed in
`docs/game/differences.md` when implemented, with the stage that removes them.

## 3. Simulation (`src/sim/`)

One module per OpenTTD subsystem, so each port maps to its source:

| Module               | Responsibility                                                                   | Ports                                          |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `core/`              | Constants, random generator, integer helpers, money                              | `core/random_func`, `economy_type.h`           |
| `time/`              | Ticks, calendar and economy dates, daily/monthly/yearly timers                   | `timer/*`                                      |
| `map/`               | Tile storage in typed arrays (type, height, `m1…m8`), tile index math, tile loop | `map*.h`, `tile_map.h`, `landscape.cpp`        |
| `world/`             | Generation: flat terrain, water, trees, towns with roads, industries             | `genworld`, `town_cmd.cpp`, `industry_cmd.cpp` |
| `track/`             | Track pieces, building/removing rail, depots, level crossings                    | `rail_cmd.cpp`, `table/track_data.h`           |
| `station/`           | Stations, catchment, acceptance, ratings, waiting cargo                          | `station_cmd.cpp`, `cargopacket.*`             |
| `vehicle/`           | Trains, orders, movement, acceleration, pathfinding, crashes                     | `train_cmd.cpp`, `order_cmd.cpp`               |
| `economy/`           | Prices, cargo payment, company finances, loan, interest                          | `economy.cpp`, `misc_cmd.cpp`                  |
| `town/`, `industry/` | Passenger and coal production                                                    | `town_cmd.cpp`, `industry_cmd.cpp`             |
| `command/`           | Command registry; test and exec modes; cost or error                             | `command.cpp`                                  |

**Public surface:** `createGame(options, seed)`, `tick(state)`, `execute(state, command, mode)`
and read-only query functions for the UI. State is mutated in place (as in OpenTTD) and stays
serialisable and deterministic. The simulation reports the tiles it changed each tick
(OpenTTD's `MarkTileDirty`) so the renderer redraws only those.

**Tests:** unit tests per module, test first; **fidelity tests** with values computed from the
original formulas (e.g. 50 passengers over 20 tiles in 10 days pay £381, 50 t of coal £719);
**replay tests** — same seed and same commands give the same state hash.

## 4. Game loop and rendering

**Loop (`app/`):** fixed tick of 27 ms times the game speed: pause, ×1, ×2, ×4 and fast-forward
up to 25× (OpenTTD's default limit). As in OpenTTD, a backlog of more than 5 ticks is dropped.
Rendering runs at display rate, decoupled from ticks, and interpolates vehicle positions.
Pausing follows `command_pause_level = 1`: no construction while paused; vehicle and order
commands are allowed.

**Map (`render/`):**

- Drawn in **chunks of 32×32 tiles**, only the visible ones, redrawn when a tile in them is
  dirty — so a 1024×1024 map runs on a phone.
- Top-down 3/4 view: ground on the grid; buildings and trees taller than their tile, depth-sorted
  top to bottom.
- **Vehicles are one top-down sprite rotated to their direction**, instead of OpenTTD's eight
  drawings per vehicle.
- **Construction preview:** while dragging, every tile is checked in test mode; a green or red
  ghost track shows the total cost. On phones the build is confirmed with a button.

**Themes** (master plan §2.12):

- A theme is `theme.json` (name, author, license), a CSS tokens file for the interface, and a
  map from logical sprite id to SVG/PNG file (`terrain.grass`, `rail.x`, `house.flats`,
  `train.kirby-paul-tank`, …). Missing sprites fall back to the default theme.
- **The Stage 1 placeholder art is the first theme, "blocks"** (simple shapes), so the contract
  is exercised from day one. A test checks the default theme provides every sprite id the game
  requests.

## 5. Interface, phone and languages

**Technology:** **Preact** for the HTML interface. The UI reads through query functions and acts
only through commands.

**Screens:** status bar (date, money, pause/speed); tools (build rail, station, depot, demolish,
query tile); windows: new game, depot (buy engines and wagons, start), train (state, cargo,
profit), orders, station (waiting cargo, rating, acceptance), finances (yearly table, loan + / −),
town, industry, settings (language, theme).

**Phone:**

- Below **768 px** wide, tools move to a bottom bar and each window opens as a bottom sheet, one
  at a time. Wider screens get a top toolbar and draggable floating windows, as in OpenTTD.
- Touch targets of at least 44 px; safe-area insets respected.
- Gestures: one-finger drag pans, pinch zooms, tap builds or selects, long-press queries.
- End-to-end tests also run with a touch-emulating phone profile.

**Languages:**

- `en.json` is the source and `es.json` ships from day one; `t(key, params)` uses `Intl` for
  plurals, numbers and money. The initial language is the browser's; the choice is remembered
  (local storage, a per-viewer convenience).
- A test fails if a shipped locale lacks a key that `en` has.
- **Reusing OpenTTD translations** is evaluated in block 1.1: a script maps our keys to
  equivalent strings in OpenTTD's language files. If the yield is good, more languages ship;
  otherwise Stage 1 keeps `en` and `es`.

## 6. Blocks

Each block ends with something to play on a phone and a short guide in `docs/game/`.

| Block                     | Builds                                                                                                                                                                                                                   | The author plays                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **1.1 Core and shell**    | Preview deploys and the block workflow; sim core (random, time, map, commands); game loop; chunked map rendering; camera (mouse and touch); theme contract and "blocks" theme; i18n; responsive HUD (date, money, speed) | An empty map to pan and zoom with fingers; the calendar running; switching language |
| **1.2 World**             | Generation (water, trees, towns with roads, mines and power stations); new-game window; query tool; town and industry windows                                                                                            | Generating and exploring worlds of different sizes                                  |
| **1.3 Construction**      | Rail, stations, depots, level crossings, demolition, costs, loan                                                                                                                                                         | Building networks and running out of money                                          |
| **1.4 Trains**            | Depot window, buying, orders, movement, acceleration, pathfinding, crashes                                                                                                                                               | Watching trains run — and crash                                                     |
| **1.5 Cargo and economy** | Town and industry production, station ratings, loading and unloading, payment, running costs, interest, finances table                                                                                                   | **The whole game:** earning money with coal and passengers                          |
| **1.6 Art and release**   | Art mockups, chosen themes, public name, player guide, `v0.1.0`                                                                                                                                                          | The first publishable version                                                       |

## 7. Workflow: chained block branches

So the agent never waits for a playtest:

```
main ─────────────────────────────────●─────────────●──── (a block merges when approved)
  └─ stage-1/block-1.1 ──●──●──●──fix─┘             │
               └─ stage-1/block-1.2 ──●──●──merge 1.1──●─┘
                                 └─ stage-1/block-1.3 …
```

1. Each block has a branch, `stage-1/block-1.N`, created from the previous block's branch. Every
   task still follows `gh-flow` (issue, `feat/…` branch, PR with green CI), but its PRs target
   the **block branch**.
2. When a block is complete it is deployed to its **preview URL**,
   `https://s-tian86.github.io/openttd-web/preview/block-1-N/`; the author is notified with the
   link and the playtest guide, and the agent starts the next block.
3. Playtest findings are fixed on the tested block's branch (unless a later block already fixed
   them), then that branch is **merged** (not rebased) into the next ones. Rebasing branches made
   of merged PRs would replay commits and repeat conflicts.
4. An approved block merges into `main` through a PR with green CI, in order.
5. **At most three completed blocks may wait for a playtest.** With block N the last approved,
   the agent may finish N+1 to N+3 and waits for N+1's playtest before starting N+4. Meanwhile it
   does work that depends on no playtest: Stage 2 reference notes, deferred minors, tooling.
6. When the agent needs a decision, it sends a push notification and keeps working on
   independent tasks.

`main` keeps serving the last approved version at the site root. Block 1.1 starts by moving the
deploy to a `gh-pages` branch that holds `main` at the root and each block branch under
`preview/`, and by updating `CONTRIBUTING.md` and `gh-flow` for block branches.

Execution: one implementation plan per block, executed with subagents (an implementer and a
reviewer per task, a final review of the block).

## 8. Out of scope for Stage 1

Signals, full YAPF, roads and road vehicles for the player, ships, aircraft, bridges, tunnels,
hills and building on slopes, town growth and ratings, other industries and production changes,
breakdowns and servicing, save/load, AI competitors, other currencies, sound.
