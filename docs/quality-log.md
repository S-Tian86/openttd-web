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
