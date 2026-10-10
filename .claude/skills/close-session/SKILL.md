---
name: close-session
description: Session close / handoff for openttd-web. Verifies nothing is left uncommitted, that TRACKING.md and GitHub issues agree, appends the quality log, updates docs and Engram memory, and writes docs/NEXT-SESSION.md as a prompt for a fresh session with NO context. Use when finishing a work session.
---

# Session close (handoff)

Run in order and **report each step** to the user (in Spanish).

## 1. Repository

- `git status` must be clean. Changes from the current task → finish them through `gh-flow`.
  Loose or doubtful changes → ask the user first.
- `git config user.email` → `sebastian.elias.riquelme@gmail.com`.
- If a work branch exists: is its PR merged? Sync: `git checkout main && git pull --ff-only`.

## 2. Tracking

Compare, do not assume:

```bash
gh issue list -R S-Tian86/openttd-web --state all --limit 100 --json number,title,state
```

- Every issue has its line in `TRACKING.md`; every `#N` there exists on GitHub.
- Closed ↔ `[x]`; open branch or PR ↔ `[~]`; otherwise `[ ]`.

## 3. Quality log

Append to `docs/quality-log.md` (never rewrite: its value is the series). Three questions:

1. Was there rework? In which phase did the error **enter** (spec, plan, implementation), not
   where it showed up?
2. What did the user find manually that the pipeline did not?
3. Did a phase need information that should have come from the previous one?

If all three are "nothing", write that: a clean batch is data too. Do not change the process
from one entry: the same phase must be flagged in three entries, and one variable changes at a time.

## 4. Documentation

- The active stage plan: decisions and bugs found.
- `docs/plan/00-master.md`: amend in place if a master decision changed.
- `docs/game/`: mechanics the user can now play; `differences.md` if a deliberate difference appeared.
- `CONTRIBUTING.md` if the workflow changed.

## 5. Memory (Engram, in Spanish)

- One conclusion per memory; the title states the verdict, not the topic.
- Sweep: merged PRs, the quality-log entry, changed docs, and user answers that closed a
  question without touching any file.
- If the MCP fails, use the CLI from the repo root:
  `engram save "<title>" "<content>" --type <type> --project openttd-web`.
- Search for what you saved with the words of someone who was not here; fix it if it is not found.
- `mem_session_summary` (or CLI equivalent) before finishing.

## 6. Continuity prompt

Overwrite `docs/NEXT-SESSION.md` (English) with a **self-contained** prompt for a fresh session:

- What the project is; pointers to `CLAUDE.md`, `CONTRIBUTING.md`, `00-master.md`, `TRACKING.md`
  and the active stage plan.
- Current state: stage and block, branch, last merged PR, open issues of the block.
- The next concrete task (code and issue) and how to start it.
- Flow reminder: `gh-flow`, English conventional commits with the why, no co-authorship
  trailers, test first.

`docs/NEXT-SESSION.md` and `docs/quality-log.md` are committed through a PR (`gh-flow`), never
directly to `main`.

## 7. Final summary (to the user, in Spanish)

What was done, git and tracking state, the three quality-log answers, and how to resume.
