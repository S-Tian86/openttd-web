# Quality log

Append-only. One entry per session, written by the `close-session` skill. Its value is the series:
a process change needs the same phase flagged in three entries, and changes one variable at a time.

Each entry answers:

1. Rework: in which phase did the error enter?
2. What did manual testing find that the pipeline did not?
3. Did a phase need information that should have come from the previous one?
