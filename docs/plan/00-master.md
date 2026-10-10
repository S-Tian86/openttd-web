# OpenTTD Web — Master Plan

> Master document: architecture, decisions and roadmap by stage.
> Each stage gets its **own detailed plan, written when the stage starts**. Future stages
> are deliberately not detailed in advance: what we learn building one stage changes the
> design of the next.
>
> Live status: [`TRACKING.md`](TRACKING.md). How we work: [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
>
> **Amendments.** When a decision here changes, it is edited in place and marked
> `AMENDED in #issue (PR #n)` with the reason. This file always states the current truth.

---

## 1. Context and goal

A **faithful web implementation of [OpenTTD](https://github.com/OpenTTD/OpenTTD)**
(itself an open-source remake of *Transport Tycoon Deluxe*), playable in the browser.

- **Faithful gameplay, new look.** Rules, formulas and behaviour follow OpenTTD's source
  code. The graphics are reinterpreted: a top-down 3/4 view in a cute, colourful style
  instead of the original isometric pixel art.
- **Not a direct port.** We do not compile OpenTTD to WebAssembly. We re-implement it in
  TypeScript, porting the simulation logic module by module.
- **Goals, all at once:** fun to play (the author has never played OpenTTD and discovers
  it stage by stage), publishable (GitHub Pages, later itch.io), and portfolio-grade code.
- **Reference version:** OpenTTD **15.3**, cloned locally in `reference/OpenTTD`
  (git-ignored). It is the source of truth for every ported rule.

---

## 2. Architecture decisions

### 2.1 Stack

- **TypeScript 7** in strict mode, **Vite** for dev server and build, **oxlint** for linting.
- **Phaser** renders the map (camera, zoom, input, sprites, tweens). Exact version is
  pinned at bootstrap (Stage 0).
- **HTML/CSS** for the interface (toolbars, windows, finance, vehicle lists). A tycoon is
  UI-heavy; CSS gives rounded, colourful, accessible windows for free.
- **No backend** (see §2.9).

### 2.2 Layers and the dependency rule

```
src/
├── sim/      Pure TypeScript simulation: map, tracks, vehicles, cargo, economy, time.
│             No Phaser, no DOM, no browser APIs. Runs identically in Node and the browser.
├── render/   Phaser scenes: draws sim state, turns pointer input into commands.
├── ui/       HTML/CSS interface: windows, toolbars, dialogs. Issues commands.
└── app/      Bootstrap and wiring: game loop, platform services (storage, clock).
```

- Dependencies point inward: `render/`, `ui/` and `app/` depend on `sim/`; **`sim/` depends
  on nothing**.
- **Game rules never live in `render/` or `ui/`.** The UI only offers what the simulation
  says is legal (see §2.3, test mode).
- The barrier is enforced by tooling, not discipline: a dedicated `tsconfig` for `sim/`
  without DOM types, a lint rule forbidding the imports, and **architecture tests in
  `tests/architecture/` that prove each barrier fails when crossed**.
- Platform services the app needs (storage, wall clock) are interfaces in `sim/` or `app/`,
  with browser adapters outside `sim/`.

### 2.3 Simulation contract

Modelled on OpenTTD's own design, which is what makes its multiplayer and save games work.

- **Commands.** Every player action is a command (`BuildRail`, `BuildStation`,
  `BuildTrain`, `ModifyOrders`, `StartStopVehicle`, `TakeLoan`…), ported from OpenTTD's
  `*_cmd.cpp`. Like the original, each command runs in two modes:
  - **test**: validates and returns the cost or an error, without changing state. The UI
    uses it to preview costs and to disable illegal actions.
  - **exec**: applies the change.
- **Deterministic.** Same initial state + same seed + same command log ⇒ bit-identical
  state. No `Math.random()`, no wall clock and no floating point in game rules.
- **Integer arithmetic**, as in OpenTTD (money, speeds, positions, fixed-point factors).
  Money is a safe integer in the base currency.
- **Seeded RNG stored in the state.** The random cursor lives inside the game state, so a
  snapshot fully determines the future.
- **Time.** A fixed-tick loop: **74 ticks per day** (`timer/timer_game_tick.h`), at
  **27 ms per tick** at normal speed (`gfx_type.h`). Fast-forward runs more ticks per frame.
  Rendering is decoupled from ticks and interpolates between them.
- **World units.** A tile is **16 sub-units** (`tile_type.h`); vehicles move on that
  sub-grid.

### 2.4 Three data layers (never mixed)

1. **Static game data** (read-only at runtime): cargo types, vehicles, industry types,
   house types, price bases, track geometry tables. Ported from OpenTTD's `src/table/*.h`
   into typed TypeScript modules in `sim/data/`, each citing its source table.
   NewGRF is out of scope.
2. **Game state** (mutable, changes every tick): map tiles, companies, vehicles, stations,
   towns, industries, cargo packets, date, RNG cursor. **Plain, serialisable data.** A save
   game is a versioned snapshot of this state.
3. **Metadata** (outside the game loop): accounts, high scores, online sessions.
   **Does not exist yet** — see §2.9.

The map uses **typed arrays** (structure of arrays, as OpenTTD's `m1…m8` tile fields)
instead of one object per tile, so large maps stay fast and cheap to serialise.

### 2.5 Persistence

- Save games are snapshots of layer 2, with a **schema version and migrations** (a save is
  never discarded because the version changed).
- Stored locally in **IndexedDB**; export/import as files.
- **Imported files are untrusted input**: validated against a schema before loading.
- Delivered in Stage 4. Earlier stages are played in one session.

### 2.6 Rendering

- **Top-down 3/4 view.** Game logic stays on OpenTTD's grid; only the drawing changes.
  OpenTTD's X/Y axes map to screen axes; the four short diagonal track pieces per tile are
  drawn at 45°.
- `render/` **reads** state and **never mutates** it. Player input becomes commands.
- Art comes from the active **theme** (§2.12), never from hard-coded files. Until the first
  theme exists, simple placeholder shapes are used.
- **Art direction is decided with mockups** (Stage 1), comparing a couple of options side
  by side. The options that survive become the first built-in themes.
- Terrain height (slopes, foundations) is part of OpenTTD's gameplay. How it is shown in a
  top-down view (shading, contour lines) is decided when height is introduced.

### 2.7 Interface, devices and language

- **Desktop and phone.** The game is playable with mouse and with touch: drag to pan, pinch
  and wheel to zoom, tap to build. The HUD is responsive: toolbars and windows on wide
  screens; a compact bottom bar and sheets on phones. OpenTTD's interface is dense, so each
  window is designed for both from the start, not shrunk afterwards.
- **Translatable from day one.** No user-facing text is written in code: every string is a
  key in a per-locale file (`en` is the source, missing keys fall back to it). Plurals and
  numbers use `Intl`. A test fails if a shipped locale lacks a key that `en` has.
- **English and Spanish ship from day one.** More languages come from the community or
  machine translation, through pull requests. OpenTTD itself ships 60+ translations under
  GPL-2.0; reusing its strings where our UI matches is evaluated in Stage 1.
- No native `alert`/`confirm`; dialogs are our own components.

### 2.8 Fidelity policy

- **The port is the default.** Every module in `sim/` cites the OpenTTD file and function it
  ports, e.g. `// Port of economy.cpp GetTransportedGoodsIncome()`.
- **Fidelity tests** reproduce values computed with OpenTTD's formulas (payment tables,
  acceleration curves, production rates).
- **Every intentional difference is listed in [`../game/differences.md`](../game/differences.md)**
  with its reason. If a behaviour is not listed there, it must match OpenTTD; a mismatch is a
  bug.
- Default settings follow OpenTTD's defaults for a new game.
- Out of scope unless a stage says otherwise: NewGRF, AI scripts (NoAI/GameScript),
  scenario editor, network protocol compatibility with OpenTTD.

### 2.9 No backend (for now)

Stages 0–4 are a **static site**: the whole game runs in the browser, saves live in
IndexedDB. A backend with a database (PostgreSQL) only makes sense with online
multiplayer, cloud saves or leaderboards. Because the simulation is deterministic and
command-driven (§2.3), multiplayer can be added later as lockstep — the same model
OpenTTD uses — without rewriting the simulation.

### 2.10 Security

The attack surface of a static game is small, but it is covered from Stage 0:

- Strict **Content Security Policy**: no `eval`, no inline scripts, no third-party origins.
- **Dependabot**, `npm audit` in CI, GitHub secret scanning.
- Untrusted input (imported saves, URL parameters) is validated at the boundary.
- `SECURITY.md` explains how to report a vulnerability.

### 2.11 License and naming

- **GPL-2.0-or-later**, the same as OpenTTD, because the simulation is ported from its
  source. OpenTTD and Transport Tycoon Deluxe are credited in the README.
- No OpenTTD graphics, sounds or music are used; all art is original.
- `openttd-web` is the working name. The public name is chosen in Stage 1, avoiding
  "OpenTTD" in it.

### 2.12 Themes

The look is pluggable, so anyone can make their own style.

- A **theme** bundles: **UI tokens** (CSS custom properties: colours, radii, fonts, spacing —
  every HUD component reads tokens, never literal values), a **sprite manifest** (logical
  sprite id → SVG/PNG file), and metadata (name, author, license).
- The game never references an image file directly; it asks the active theme for a sprite id.
  A theme missing a sprite falls back to the default theme.
- Built-in themes live in the repository; new ones arrive as pull requests. Loading a theme
  from a user's file at runtime is a later step: it is untrusted input and needs validation
  (§2.10).
- The theme contract is created with the first theme (Stage 1), not before.

---

## 3. Quality

| Check | Tool | Where |
|---|---|---|
| Types | `tsc` (strict) | pre-commit, CI |
| Lint and format | oxlint, Prettier | pre-commit, CI |
| Unit tests of the simulation | Vitest, **test first (TDD)** | CI |
| Fidelity tests | Vitest, values from OpenTTD formulas | CI |
| Golden replay tests | seed + command log ⇒ expected state hash | CI |
| Architecture tests | Vitest, imports crossing barriers must fail | CI |
| End-to-end and visual checks | Playwright on headless Chromium, screenshots | CI and before closing a task |
| Dependencies | `npm audit`, Dependabot | CI, weekly |

`main` is protected: a PR cannot be merged with a red CI.

---

## 4. How we work (summary)

Full detail in [`CONTRIBUTING.md`](../../CONTRIBUTING.md); the `gh-flow` and `close-session`
skills in `.claude/skills/` execute it.

- **Milestones = stages. Issues = tasks**, opened just-in-time for the current block only.
  `TRACKING.md` lists every task with a one-line entry (code, name, status, issue).
- **One branch per issue** → conventional commits focused on *why* (`Refs #N`) → PR with
  `Closes #N` → CI green → merge.
- Everything on GitHub is in English.
- **Each stage ends with a playtest**: the build is deployed, the author plays it following
  a short guide in `docs/game/`, and the feedback becomes issues.
- **Each session ends with a handoff**: clean git, tracking in sync with GitHub, a quality
  log entry (`docs/quality-log.md`) and a self-contained `docs/NEXT-SESSION.md`.

---

## 5. Documentation map

| Document | Purpose |
|---|---|
| `README.md` | What it is, how to run it, how to play, credits |
| `CONTRIBUTING.md` | Workflow: issues, branches, commits, PRs, labels, milestones |
| `CLAUDE.md` | Instructions for the coding agent |
| `SECURITY.md` | Vulnerability reporting |
| `docs/plan/00-master.md` | This file: architecture, decisions, roadmap |
| `docs/plan/TRACKING.md` | Bridge between roadmap and GitHub issues |
| `docs/plan/stage-N-*.md` | Detailed plan of each stage, written when it starts |
| `docs/reference/openttd/` | Notes on each OpenTTD subsystem as read from its source, before porting it |
| `docs/game/` | Player-facing: how each mechanic works, playtest guides, `differences.md` |
| `docs/quality-log.md` | Append-only log: rework, what manual testing caught, missing inputs |
| `docs/NEXT-SESSION.md` | Handoff prompt for a fresh session with no context |

---

## 6. Roadmap

> Task granularity at master level. Each stage's detail is written when it starts.

### Stage 0 — Foundations

**Goal:** an empty but complete project: anyone can clone, run, test and deploy it.

- Public GitHub repository, license, README, CONTRIBUTING, SECURITY, CLAUDE.md.
- Project skills `gh-flow` and `close-session`; issue and PR templates; labels; milestones.
- Vite + TypeScript + Phaser skeleton with the layer structure of §2.2 and its barriers.
- Tooling: ESLint, Prettier, Vitest, Playwright, pre-commit hooks.
- CI (lint, types, tests, build, e2e) and deploy to GitHub Pages; CSP; Dependabot.
- `docs/reference/openttd/` notes for the subsystems Stage 1 needs.

### Stage 1 — First train (`v0.1.0`)

**Goal:** the core OpenTTD loop, playable: build a line, run a train, earn money.

- UI foundations: translations (`en`, `es`) with a language selector, theme contract,
  responsive HUD shell, camera with mouse and touch (pan, zoom).
- Flat generated map: grass, water, trees.
- A few towns producing passengers, one coal mine and one power station.
- Track (the six pieces per tile), stations, depots.
- Trains: buy, orders (go to, load, unload), movement and acceleration, loading.
- Cargo payment, company finances, loan, calendar with pause and fast-forward.
- **Art direction:** mockups, decision, the first built-in theme(s).
- Public name chosen.

### Stage 2 — Living economy

**Goal:** the world reacts to the player.

- Towns that grow and rate the company; industries with production chains and changes.
- Terrain height (slopes, foundations).
- Station ratings and cargo aging as in OpenTTD.

### Stage 3 — More transport

**Goal:** the rest of the transport modes.

- Signals and multiple trains per line; train pathfinding at junctions.
- Roads, buses and trucks; ships and docks; aircraft and airports.
- Bridges and tunnels.

### Stage 4 — Persistence and opponents

**Goal:** long games.

- Save/load (IndexedDB, file import/export with validation).
- Breakdowns, servicing, vehicle aging and replacement.
- Computer-controlled competitors.

### Later (not planned)

Online multiplayer (adds the backend of §2.9), itch.io release, sound and music, loading
community themes from files, more languages.

---

## 7. Open decisions

| Decision | When |
|---|---|
| Art direction (style, palette) | Stage 1, with mockups |
| Public name | Stage 1 |
| Height rendering in top-down view | Stage 2 |
| Opponent behaviour (port of an existing AI or our own) | Stage 4 |
