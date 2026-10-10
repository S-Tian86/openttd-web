# Next session

You are continuing **openttd-web**: a faithful web implementation of OpenTTD 15.3 in
TypeScript, with a new top-down 3/4 look, themes, touch support and English/Spanish from day
one. Talk to the user in Spanish; everything that goes to GitHub is in English.

## Read first

- `CLAUDE.md` — agent rules (sim barrier, fidelity, never `cd` into `reference/`)
- `CONTRIBUTING.md` — workflow; the `gh-flow` skill executes it, `close-session` ends a session
- `docs/plan/00-master.md` — architecture, decisions, roadmap
- `docs/plan/TRACKING.md` — every task and its issue
- `docs/reference/openttd/` — notes on each OpenTTD subsystem Stage 1 ports, and the
  cross-cutting questions in its `README.md`

## Current state

- **Stage 0 — Foundations is closed** (milestone closed). Vite + TypeScript 7 + Phaser 4 app
  with `sim/`, `render/`, `ui/`, `app/`; oxlint + architecture tests enforce the sim barrier;
  Vitest and Playwright (on the production build, served from `/openttd-web/`); CI on every PR;
  `main` protected; every merge deploys to https://s-tian86.github.io/openttd-web/.
- No open branches. The reference clone lives in `reference/OpenTTD` (git-ignored); recreate it
  with the command in `CONTRIBUTING.md` if missing.
- Host facts: git 2.25, Ubuntu 20.04 (local e2e uses Google Chrome), project port 4317.

## Next task

**Design and plan Stage 1 — First train.** Start a brainstorming session with the user from the
master plan's Stage 1 scope and the reference notes:

1. Settle the cross-cutting questions in `docs/reference/openttd/README.md` (random-number
   fidelity, money type, breakdowns, towns without roads, coasts, pathfinding, source quirks).
2. Agree the Stage 1 blocks, including UI foundations (i18n `en`/`es`, theme contract,
   responsive HUD, touch camera) and the art-direction mockups.
3. Write `docs/plan/stage-1-first-train.md`, open the milestone and the first block's issues.

The user chose **subagent-driven execution** for Stage 1 onwards.

## Flow reminder

`gh-flow` for every push/PR/merge: issue → branch → test first → conventional commit in
English explaining why, `Refs #N`, no co-authorship trailers → PR with `Closes #N` → CI green →
merge. When blocked on a user decision: push notification, then keep working on independent
tasks.
