# Quality log

Append-only. One entry per session, written by the `close-session` skill. Its value is the series:
a process change needs the same phase flagged in three entries, and changes one variable at a time.

Each entry answers:

1. Rework: in which phase did the error enter?
2. What did manual testing find that the pipeline did not?
3. Did a phase need information that should have come from the previous one?

## 2026-10-10 — Stage 0 (foundations)

1. **Rework, and where it entered.**
   - **Plan:** it assumed a host that can run lint-staged 17 (git ≥ 2.32) and Playwright's
     Chromium (not Ubuntu 20.04); host facts were never collected. The unanchored `reference/`
     ignore pattern also hid `docs/reference/`.
   - **Plan (test design):** two Review Focus guards could not fail — fixtures outside `src/sim/`
     never exercised the sim glob, and e2e served from `/` instead of a sub-path. Found by the
     final review, fixed in #15.
   - **Implementation:** a missing favicon (caught by the e2e test, as intended).
   - **Execution:** a pattern-based `pkill` stopped another project's preview server; it was
     restarted. Processes are now stopped by PID only.
2. **Found manually that the pipeline did not:** nothing yet — the author has not playtested
   Stage 0. The independent reviewer found the two guards above.
3. **Missing input from a previous phase:** the plan needed the host environment (git version,
   OS, ports in use), which the design phase did not collect. Next plans list the host facts in
   their Global Constraints.

## 2026-10-10 — Stage 1, block 1.1 (core and shell)

Written after the fact (#123): the close-session steps did not run when the block closed.

1. **Rework, and where it entered.**
   - **Plan:** `chance16I` lacked the uint32 wrap of the C++ (caught in Task 2 against the
     source). `ticksDue` applied OpenTTD's per-call drift rule once per browser frame, which
     throttled fast-forward; Task 6 redesigned it. The dispatch allowed a plain-English error
     string against the i18n global constraint (Task 11).
   - **Plan (ruling):** the Task 6 redesign still dropped real time on frames slower than
     100 ms. CI caught it a block later (#79).
   - **Plan (environment):** the `stage-*/**` ruleset also blocks creating block branches;
     gh-flow gained a disable/re-enable step.
   - **Implementation, caught by the final review (#46):** a pinch or double-tap on the HUD
     zoomed the whole page on phones; an unused translation key. **Plan:** preview deploys
     could cancel each other, and the ui/render/app layering was not in the lint rules.
2. **Found manually that the pipeline did not:** nothing yet. The block awaits the playtest.
3. **Missing input from a previous phase:** the plan needed the GitHub ruleset's behaviour
   on branch creation, which the design phase did not check.

## 2026-10-10 — Stage 1, block 1.2 (world)

Written after the fact (#123).

1. **Rework, and where it entered.**
   - **Plan (test design):** two Review Focus e2e tests could pass vacuously (no world-hash
     check for the 64×128 size, no positive control that a drag moved the camera). Found by
     the final review (#82).
   - **Implementation, caught by the final review (#82):** any exception froze the game loop
     with the progress pill stuck; the new-game window closed itself when opened during the
     startup generation; the lint import patterns matched `./App` case-insensitively; density-0
     grass read "Grass" where OpenTTD says "Bare land".
   - **Implementation (Task 13):** a long press was dropped when the hold timer ran after the
     release on a busy page. CI flaked on it in block 1.3 (#89).
   - **Process:** Task 6 was written tests and code in one pass (no recorded RED); accepted
     because the tests were the plan's verbatim.
2. **Found manually that the pipeline did not:** nothing yet. The block awaits the playtest.
3. **Missing input from a previous phase:** none recorded.

## 2026-10-10 — Stage 1, block 1.3 (construction)

Written after the fact (#123).

1. **Rework, and where it entered.**
   - **Spec vs plan:** the plan's first R33 let the bulldozer remove town roads, against D2;
     rejected and amended before Task 1.
   - **Plan, caught by the pre-flight scan (11 findings, fixed in #92 before Task 1):** the
     town-road refusal would also have refused level crossings; files typecheck needed were
     missing from two task lists; a wrong placeholder name; four places that duplicated logic.
   - **Plan, caught by task reviews:** `addCost` wording kept the last error (C++ keeps the
     first; Task 1); the rail slope check ran flat-land before water, giving the wrong message
     on coasts (Task 3); R18 turned off OpenTTD's reuse of a deleted station's sign (Task 7).
   - **Plan (test design):** a join-scan test half could not fail (Task 6).
   - **Implementation:** `isRailDepotTile` lacked the tile-type check, so a tile with four trees
     read as a depot and the rotate path charged £525 for nothing (Task 5, critical); untested
     autorail branches (Task 8, 26 traced cases added); a stale long-press flag swallowed the
     next click (Task 11); the land-info refund wording (Task 12).
   - **Implementation, caught by the final review (#117):** a pinch discarded the pending phone
     Confirm; the error message hid under open panels below 1090 px; no test that tool options
     reach the command; a depot with no towns threw after mutating the map.
   - **Execution:** an implementer left a hung `cat >` heredoc shell that could have overwritten
     a test; it was stopped by PID and the implementer prompt now forbids background and stdin
     commands.
2. **Found manually that the pipeline did not:** nothing yet. The block awaits the playtest.
3. **Missing input from a previous phase:**
   - The reference note covered the station command but not the GUI that calls it; the
     reuse depends on the argument `station_gui.cpp` sends.
   - The plan's Global Constraints still listed git 2.25. Host facts need refreshing at
     each plan.

**Series check:** "Plan (test design): a test that cannot fail" now appears in three entries
(Stage 0, block 1.2, block 1.3). That meets the rule for one process change, to be agreed with
the user before block 1.4's plan.
