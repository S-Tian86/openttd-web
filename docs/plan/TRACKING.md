# OpenTTD Web — Tracking

> **The bridge between the roadmap and GitHub.** Scope and decisions live in
> [`00-master.md`](00-master.md) and each stage plan; live status lives in
> [Issues](https://github.com/S-Tian86/openttd-web/issues) and
> [Milestones](https://github.com/S-Tian86/openttd-web/milestones).

**Thin-line rule:** one line per task — status, code, name, issue. Nothing else. A line is
edited twice in its life: when the issue is created and when it closes. Content goes in
the issue.

- Issues are opened **just-in-time**, for the current block only. Future tasks stay visible
  here as _(to create)_.
- Legend: `[ ]` pending · `[~]` in progress · `[x]` done.

## Stage 0 — Foundations · milestone `Stage 0 — Foundations`

- [x] 0.1 Repository bootstrap — _(direct to main)_
- [x] 0.2 Contribution workflow and project skills — #1
- [x] 0.3 App scaffold with layered structure — #2
- [x] 0.4 Lint, formatting and sim/ barrier — #3
- [x] 0.5 End-to-end smoke test — #4
- [x] 0.6 CI, deploy and security baseline — #5
- [x] 0.7 OpenTTD reference notes for Stage 1 — #6
- [x] 0.7b Pin sim glob and sub-path guards (review) — #15
- [x] 0.8 Close Stage 0 — #7

## Stage 1 — First train · milestone `Stage 1 — First train`

- [x] 1.0 Stage 1 design spec — #20
- [~] 1.1 Core and shell — branch stage-1/block-1.1 — awaiting playtest
  - [x] 1.1.1 Preview deploys and block workflow — #22
  - [x] 1.1.2 Random generator — #24
  - [x] 1.1.3 Map storage and the tile loop — #26
  - [x] 1.1.4 Dates and clocks — #28
  - [x] 1.1.5 Company money, commands and the game state — #30
  - [x] 1.1.6 Tick pacing and the game session — #32
  - [x] 1.1.7 Theme contract and the "blocks" theme — #34
  - [x] 1.1.8 Chunked map rendering — #36
  - [x] 1.1.9 Mouse and touch camera — #38
  - [x] 1.1.10 Translations and formatting — #40
  - [x] 1.1.11 HUD shell and app wiring — #42
  - [x] 1.1.12 Evaluate reusing OpenTTD translations — #44
  - [x] 1.1.13 Close block 1.1 — #48
- [~] 1.2 World — branch stage-1/block-1.2 — awaiting playtest
  - [x] 1.2.0 Reference notes and block plan — #51
  - [x] 1.2.1 Map geometry and slopes — #53
  - [x] 1.2.2 TerraGenesis land mask — #55
  - [x] 1.2.3 Sea, shore and the water tile loop — #57
  - [x] 1.2.4 World generation pipeline — #59
  - [x] 1.2.5 Trees — #61
  - [x] 1.2.6 Town roads, towns and zones — #63
  - [x] 1.2.7 Houses — #65
  - [x] 1.2.8 Town growth walk — #67
  - [x] 1.2.9 Town names and town generation — #69
  - [x] 1.2.10 Coal mines and power stations — #71
  - [x] 1.2.11 Drawing the world — #73
  - [x] 1.2.12 New-game window and background generation — #75
  - [x] 1.2.13 Query tool, town and industry windows — #77
  - [x] 1.2.14 Close block 1.2 — #84
- [ ] 1.3 Construction — branch stage-1/block-1.3
  - [x] 1.3.0 Reference notes and block plan — #87
  - [x] 1.3.1 Prices, company money and the command pipeline — #93
  - [x] 1.3.2 The bulldozer — natural ground, water, houses and town roads — #95
  - [x] 1.3.3 Rail track — pieces, drags and the track tile loop — #97
  - [x] 1.3.4 Level crossings over town roads — #99
  - [x] 1.3.5 Train depots — #101
  - [x] 1.3.6 Rail stations — building, joining and naming — #103
  - [ ] 1.3.7 Removing stations and deleting unused ones
  - [ ] 1.3.8 Autorail drags and gesture → command planning
  - [ ] 1.3.9 Drawing construction and build gestures on the map
  - [ ] 1.3.10 Construction tools, cost bar, Confirm and error messages
  - [ ] 1.3.11 Finances window with the loan
  - [ ] 1.3.12 Query tool for rail, depots, stations and crossings
  - [ ] 1.3.13 Close block 1.3
- [ ] 1.4 Trains — _(to create)_
- [ ] 1.5 Cargo and economy — _(to create)_
- [ ] 1.6 Art and release — _(to create)_
