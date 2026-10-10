---
name: gh-flow
description: GitHub workflow of openttd-web (issue → branch → commits → PR → green CI → merge that closes the issue) and upkeep of docs/plan/TRACKING.md. Use when starting a roadmap task, creating or managing issues, or preparing and merging a PR. Makes CONTRIBUTING.md actionable.
---

# openttd-web GitHub flow

Full conventions in `CONTRIBUTING.md`. Repo: `S-Tian86/openttd-web`, public. Everything on
GitHub is in English.

## 0. Path triggers

| If you are about to touch…                      | Load first               |
| ----------------------------------------------- | ------------------------ |
| `docs/NEXT-SESSION.md` or `docs/quality-log.md` | `close-session`          |
| any `git push`, `gh pr create`, `gh pr merge`   | `gh-flow` (you are here) |

## 1. Issue (just-in-time)

Only for the block in progress. When a block starts, open all of its issues at once.

```bash
gh issue create -R S-Tian86/openttd-web \
  --title "<verb + goal>" \
  --milestone "<Stage N — Name>" \
  --label <infra|docs|…> \
  --body-file -      # template: .github/ISSUE_TEMPLATE/task.md
```

Body: **Goal** (with the why), **Done when**, **References** (plan file and task).
In the same move, add or update its line in `docs/plan/TRACKING.md` with `#N`.
A new area label is created with the first issue that needs it
(`gh label create <name> --color <hex> --description "<when>"`) and documented in
`CONTRIBUTING.md`.

## 2. Branch

```bash
git checkout main && git pull --ff-only
git checkout -b <type>/<short-description>   # feat fix chore docs refactor test
```

Mark the line `[~]` in `TRACKING.md`.

## 3. Commits

- `git config user.email` must print `sebastian.elias.riquelme@gmail.com`.
- Conventional commit, English subject without final period; body explains why;
  `Refs #N`; body lines ≤ 72 chars; no co-authorship trailers.
- Test first, then code, then refactor. The test travels with its code.
- Run before committing: `npm run lint && npm run typecheck && npm test`
  (and `npm run test:e2e` if `render/`, `ui/`, `app/` or `index.html` changed).

## 4. Pull request

Before opening it, on the branch: mark the line `[x]` in `TRACKING.md`; record decisions
in the stage plan or amend `00-master.md` in place (`AMENDED in #N (PR #M)`).

```bash
git push -u origin <branch>
gh pr create --base main --title "<what it does>" --body-file -   # template, "Closes #N"
```

Over ~400 lines of code (excluding tests and lock files) → chained PRs:

```bash
git diff --numstat main...HEAD -- . ':!*.test.ts' ':!*.spec.ts' ':!package-lock.json' | awk '{s+=$1} END {print s}'
```

## 5. Merge (closes the issue)

```bash
gh pr checks <pr> --watch          # red → fix on the branch, never merge
gh pr merge <pr> --merge --delete-branch
git checkout main && git pull --ff-only
gh issue view <N> -R S-Tian86/openttd-web --json state   # expect CLOSED
```

## Reminders

- The agent creates, merges and closes issues and PRs itself through `gh` (account `S-Tian86`).
- `reference/` is git-ignored; never add it.
