# Block 1.3 playtest guide

Preview: https://s-tian86.github.io/openttd-web/preview/block-1-3/

Open it on your phone. Everything here is meant to be tried with your fingers. For a world
with coal mines and a power station close together, use for example
`?seed=7&size=64x64`.

## Controls

The construction toolbar: ╪ railway track, ▤ railway station, ⌂ train depot, ✖ demolish,
⌫ remove (with track or station), ↕ ↔ station orientation, ↑ → ↓ ← depot exit, £ finances.
A tool stays on after building; press its button again to turn it off.
Hover over any icon button to see its name; on a phone, tapping it shows the name too.

With a mouse, as in OpenTTD (defaults; Settings changes them):

| Action                 | How                                                         |
| ---------------------- | ----------------------------------------------------------- |
| Move the map           | Drag with the right button, or the arrow keys (Shift: fast) |
| Zoom                   | Scroll wheel                                                |
| Use the tool, or query | Left button                                                 |
| Drop the tool          | Esc, or a right click without dragging                      |

Settings has OpenTTD's viewport scroll behaviour (which button moves the map, and whether the
mouse stays in place), the function of the scroll wheel (zoom, scroll, off) and its speed, and
how long to hover before a tooltip shows (or "Right click" to show it while holding the right
button).

With fingers: one finger moves the map, or uses the tool when one is on; two fingers zoom and
move the map; a long press queries a tile.

## What is new

- Rail track with OpenTTD's autorail: a drag lays one straight line, along a tile row or
  diagonally (a zigzag of corner pieces). To turn, start a new drag where the line ends. A
  click without dragging lays one piece chosen by where you click: near a corner of the tile
  it is a corner piece, the curve that joins a straight line to a diagonal or turns it.
- A drag that hits an obstacle builds up to it, as in OpenTTD; the ghost shows the part past
  the obstacle in red.
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

- [ ] Build a line from a coal mine towards a power station: a straight drag, a diagonal drag,
      and a corner piece to turn between them.
- [ ] Drag a line across a house or an industry: the ghost turns red past it, and only the
      green part is built.
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
