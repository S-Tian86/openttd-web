# OpenTTD reference notes

What each OpenTTD subsystem does, **as read from its source** (OpenTTD 15.3,
`reference/OpenTTD/src`), written before porting it. A note is the bridge between the C++
code and our TypeScript port.

Every note follows this template:

1. **Purpose** — what the subsystem does in the game, in two or three sentences.
2. **Source files** — paths and the key functions, with one line each.
3. **State** — the data it keeps (fields, types, units).
4. **Rules and formulas** — the behaviour, as pseudo-code with the original constants, citing
   `file:function` for each.
5. **Defaults** — the default settings of a new game that affect it.
6. **Stage 1 needs** — what must be ported now.
7. **Skipped** — what is left out and why (NewGRF callbacks, later stages).
8. **Open questions** — what the source left ambiguous, instead of guessing.

| Note                                       | Subsystem                                              |
| ------------------------------------------ | ------------------------------------------------------ |
| [time.md](time.md)                         | Ticks, days, calendar and economy dates                |
| [map.md](map.md)                           | Map size, tile types, tile storage                     |
| [track.md](track.md)                       | Track bits, building and removing rail                 |
| [trains.md](trains.md)                     | Train consist, movement, acceleration, depots          |
| [orders.md](orders.md)                     | Orders and their flags                                 |
| [stations-cargo.md](stations-cargo.md)     | Stations, catchment, cargo packets, loading, ratings   |
| [economy.md](economy.md)                   | Prices, payment, loan, interest, company finances      |
| [towns-industries.md](towns-industries.md) | Passenger generation, coal mine production, acceptance |

## Cross-cutting questions for the Stage 1 design

Several notes raise the same decisions. They are settled in the Stage 1 brainstorming, not in
the notes:

1. **Random-number fidelity.** Must the port reproduce OpenTTD's exact `Random()` call order
   (map generation, tile loop, ratings, cargo truncation), or is a seeded generator with the
   same distributions enough? (time, map, stations-cargo, economy, towns-industries)
2. **Money type.** `bigint`, or `number` with 64-bit saturation and rounding-down shifts
   emulated? (economy)
3. **Breakdowns and servicing.** The default is "reduced" breakdowns, which sends trains to a
   depot every 150 days; Stage 1 has no breakdowns. Behave as "none" until Stage 4? (trains,
   orders)
4. **Towns without roads.** Town generation needs road tiles. Add a passive town-road tile or a
   road-less placement rule? (towns-industries)
5. **Coasts on a flat map.** Water at height 0 makes neighbouring land sloped. Keep OpenTTD
   heights or use a flat water type until Stage 2? (map)
6. **Pathfinding without signals.** Port YAPF's cost model or a simpler shortest path, and keep
   track reservation? (trains)
7. **Quirks in the source.** Several notes found behaviour that contradicts a comment or looks
   accidental (rail station length cost counter, cargo reservation precedence, drag-build stop
   tile, int32 cast in income). Policy: port the code's behaviour, list it in
   `docs/game/differences.md` only if we deliberately change it.
