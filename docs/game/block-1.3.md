# Block 1.3 playtest guide

Preview: https://s-tian86.github.io/openttd-web/preview/block-1-3/

Open it on your phone. Everything here is meant to be tried with your fingers. For a world
with coal mines and a power station close together, use for example
`?seed=7&size=64x64`.

## What is new

- Rail track with the autorail drag: drag diagonally and the track follows as a staircase.
- Rail stations (build, extend, join, rename by OpenTTD's rules) and train depots.
- Level crossings where track meets a town road.
- The bulldozer, for single tiles and for areas: natural ground, trees, houses, rail,
  stations, depots and sea tiles.
- The cost ghost and the cost bar while you drag, and error messages when something is refused.
- Phone flow: drag, see the ghost and its cost, then press Build or Confirm. Pinching or
  panning keeps a pending build.
- The finances window (the £ button): money, loan, borrow and repay. Ctrl or a long press
  borrows or repays everything.
- The query tool now describes rail, depots, stations and crossings.

## What to try on the phone

- [ ] Build a line from a coal mine towards a power station. Drag diagonally and watch the
      staircase.
- [ ] Build a station of 1×5 and extend it.
- [ ] Build a depot facing the track and see the extra pieces it adds.
- [ ] Cross a town road with track, then bulldoze the crossing: only the rail goes.
- [ ] Try to bulldoze a town road: the local authority refuses.
- [ ] Build over a one-piece road stub (a short stub of road is replaced).
- [ ] Demolish a house, then demolish all the houses of a whole town.
- [ ] Demolish a station, then build a new one next to the emptied one: it revives with the
      old name.
- [ ] Try to build while paused.
- [ ] Build with too little money, then borrow in the finances window.
- [ ] Repay with a long press on the repay button.
- [ ] Clear a sea tile and watch the water come back.
- [ ] Query each new tile (rail, depot, station, crossing).
- [ ] Pinch and pan with a build pending: the pending build stays.

## Not there yet

Trains (block 1.4), cargo, income, the finances table and interest (block 1.5), town ratings
(Stage 2) and real art (block 1.6). Please do not report them as bugs. The full list of
deliberate differences is in [differences.md](differences.md). Known minor issues are
collected in issue #119.

## How to report

Open an issue with the label `playtest`, or just tell the agent. Include your phone model and
browser.
