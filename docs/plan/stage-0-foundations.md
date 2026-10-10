# Stage 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An empty but complete project: anyone can clone it, run it, test it, and every merge to `main` deploys it to GitHub Pages.

**Architecture:** Vite + TypeScript app with the four layers of the master plan (`sim/`, `render/`, `ui/`, `app/`). The `sim/` barrier is enforced by a DOM-less `tsconfig`, oxlint rules and architecture tests. GitHub hosts the repo, the tracking (issues/milestones), CI and the deploy.

**Tech Stack:** Node 22, TypeScript 7, Vite 8, Phaser 4.2, Vitest 5, Playwright 1.64, oxlint 1.87, Prettier 3, husky + lint-staged, GitHub Actions, GitHub Pages.

**Spec:** [`00-master.md`](00-master.md) — §2.1–2.2 (stack, layers), §2.10 (security), §2.11 (license), §3 (quality), §4 (workflow), §5 (documentation map), §6 Stage 0.

## Global Constraints

- Everything that goes to GitHub is in **English**: code, docs, commits, issues, PRs, skills.
- Repository: `S-Tian86/openttd-web`, **public**, license **GPL-2.0-or-later**.
- Git identity is **local to the repo**: `Sebastian Riquelme <sebastian.elias.riquelme@gmail.com>`. Never the global one.
- Commits: conventional commits, subject in English, body explains **why**, `Refs #N` in the body. **No** `Co-Authored-By` or any co-authorship trailer.
- Only Task 1 commits directly to `main` (the repo is empty). Every later task: issue → branch → PR with `Closes #N` → merge.
- **TypeScript 7 with oxlint**, the same setup as the author's `covo` project. No ESLint: `typescript-eslint@8.71` requires `typescript <6.1.0`.
- Pinned majors: `phaser@^4.2.1`, `typescript@^7.0.2`, `vite@^8.3.4`, `vitest@^5.0.3`, `@playwright/test@^1.64.0`, `oxlint@^1.87.0`, `prettier@^3.9.9`.
- `reference/` (the OpenTTD clone) is **git-ignored** and nothing in the build or tests may depend on it.
- `src/sim/` imports nothing from Phaser, the DOM, `render/`, `ui/`, `app/` or `reference/`, and uses no `Math.random`, `Date`, timers or browser globals.
- Vite `base` is `'./'` so the same build works on GitHub Pages (`/openttd-web/`), itch.io or any sub-path.

## Review Focus

1. **Served from a sub-path** (GitHub Pages serves `/openttd-web/`): every asset must load; a 404 on a chunk means a black screen. Pinned by the e2e test in Task 5 (no responses ≥ 400 on the production build).
2. **CSP blocks Phaser in production** (WebGL, `data:`/`blob:` textures): the game would silently not render. Pinned by the e2e test in Task 5 (CSP meta present, zero console errors on the production build).
3. **Barrier rules silently not applying** (a wrong glob makes the lint rule a no-op): pinned by the architecture tests in Task 4, including a positive control outside `sim/`.
4. **Fresh clone without `reference/`**: `npm ci && npm test && npm run build` must pass. Pinned by CI in Task 6, which runs on a clean checkout where `reference/` does not exist.
5. **Small or resized window** (phone width, window resize): the canvas must follow the viewport. Pinned by the e2e test in Task 5 (375×667 viewport).

---

## File map

| Path                                                                                                               | Responsibility                                              | Task |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---- |
| `.gitignore`, `LICENSE`, `README.md`                                                                               | Repo basics                                                 | 1    |
| `docs/plan/00-master.md`, `docs/plan/TRACKING.md`, `docs/plan/stage-0-foundations.md`                              | Plan and tracking                                           | 1    |
| `CONTRIBUTING.md`, `CLAUDE.md`                                                                                     | Workflow and agent instructions                             | 2    |
| `.claude/skills/gh-flow/SKILL.md`, `.claude/skills/close-session/SKILL.md`                                         | Executable workflow                                         | 2    |
| `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/task.md`                                               | Templates                                                   | 2    |
| `docs/quality-log.md`                                                                                              | Append-only quality log                                     | 2    |
| `package.json`, `.nvmrc`, `tsconfig.json`, `tsconfig.sim.json`, `vite.config.ts`, `vitest.config.ts`, `index.html` | Toolchain                                                   | 3    |
| `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`, `.husky/pre-commit`                                       | Lint, format, hooks                                         | 4    |
| `tests/architecture/{boundary.test.ts, sim-imports.ts, sim-globals.ts, tsconfig.json}`                             | Proves the `sim/` barrier with deliberately broken fixtures | 4    |
| `src/app/main.ts`                                                                                                  | Bootstrap: creates the Phaser game                          | 3    |
| `src/render/BootScene.ts`                                                                                          | Placeholder scene, marks the page ready                     | 3    |
| `src/ui/styles.css`                                                                                                | Base page styles                                            | 3    |
| `src/sim/core/constants.ts` (+ test)                                                                               | First ported constants                                      | 3    |
| `playwright.config.ts`, `tests/e2e/boot.spec.ts`                                                                   | End-to-end smoke                                            | 5    |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `SECURITY.md`                | CI/CD and security                                          | 6    |
| `docs/reference/openttd/*.md`, `docs/game/README.md`, `docs/game/differences.md`                                   | Reference notes for Stage 1                                 | 7    |
| `docs/NEXT-SESSION.md`                                                                                             | Handoff                                                     | 8    |

---

### Task 1: Repository bootstrap

The only task committed directly to `main`: the repository does not exist yet.

**Files:**

- Create: `.gitignore`, `LICENSE`, `README.md`, `docs/plan/TRACKING.md`
- Already exist: `docs/plan/00-master.md`, `docs/plan/stage-0-foundations.md`

**Interfaces:**

- Produces: public repo `S-Tian86/openttd-web`, milestone `Stage 0 — Foundations`, labels `infra` and `docs`, issues for Tasks 2–8, each recorded in `TRACKING.md`.

- [ ] **Step 1: Init git with the local identity**

```bash
cd /home/synbshop/public_html/personal/openttd-web
git init -b main
git config user.name "Sebastian Riquelme"
git config user.email "sebastian.elias.riquelme@gmail.com"
git config user.email   # expected: sebastian.elias.riquelme@gmail.com
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
# Dependencies and builds
node_modules/
dist/
coverage/

# Test output
playwright-report/
test-results/

# Local OpenTTD clone used as reference (see docs/plan/00-master.md §1)
reference/

# Local tooling
.claude/settings.local.json
.claude/scheduled_tasks.lock
*.log
.DS_Store
```

- [ ] **Step 3: Add the license**

```bash
curl -sSfL https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt -o LICENSE
head -3 LICENSE   # expected: "GNU GENERAL PUBLIC LICENSE" / "Version 2, June 1991"
```

- [ ] **Step 4: Write `README.md`**

````markdown
# openttd-web

A faithful web implementation of [OpenTTD](https://www.openttd.org) — the open-source
transport simulation based on _Transport Tycoon Deluxe_ — reimagined with a colourful
top-down look and playable in the browser.

> **Status:** Stage 0 (foundations). Nothing playable yet. See the
> [roadmap](docs/plan/00-master.md#6-roadmap).

## What this is

- **Faithful gameplay.** The simulation is ported from OpenTTD's source code (version 15.3):
  same rules, formulas and defaults. Every intentional difference is listed in
  [`docs/game/differences.md`](docs/game/differences.md).
- **New look.** A top-down 3/4 view with original, cute and colourful art instead of the
  isometric pixel art.
- **Not a direct port.** Re-implemented in TypeScript, not compiled to WebAssembly.

## Run it

Requires Node 22.

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Command                              | What it does                                          |
| ------------------------------------ | ----------------------------------------------------- |
| `npm test`                           | Unit, fidelity and architecture tests (Vitest)        |
| `npm run test:e2e`                   | End-to-end tests on the production build (Playwright) |
| `npm run lint` / `npm run typecheck` | Static checks                                         |
| `npm run build`                      | Production build in `dist/`                           |

## Documentation

- [Master plan](docs/plan/00-master.md) — architecture, decisions, roadmap
- [Tracking](docs/plan/TRACKING.md) — every task and its issue
- [Contributing](CONTRIBUTING.md) — how we work
- [Security](SECURITY.md) — reporting vulnerabilities

## Credits and license

OpenTTD is developed by the [OpenTTD team](https://github.com/OpenTTD/OpenTTD) and is based
on _Transport Tycoon Deluxe_ by Chris Sawyer. This project is not affiliated with or
endorsed by either. No OpenTTD graphics, sounds or music are used.

Licensed under the [GNU General Public License v2.0 or later](LICENSE), like OpenTTD.
````

- [ ] **Step 5: Create the GitHub repo, milestone and labels**

```bash
gh repo create S-Tian86/openttd-web --public \
  --description "A faithful web implementation of OpenTTD with a colourful top-down look" \
  --source . --remote origin
gh api -X POST repos/S-Tian86/openttd-web/milestones \
  -f title="Stage 0 — Foundations" \
  -f description="Empty but complete project: clone, run, test, deploy. See docs/plan/stage-0-foundations.md"
gh label create infra --color 5319e7 --description "Tooling, CI/CD, repo configuration" -R S-Tian86/openttd-web
gh label create docs  --color 0075ca --description "Documentation only" -R S-Tian86/openttd-web
```

- [ ] **Step 6: Open the issues of Stage 0 (the whole block, as agreed)**

One `gh issue create` per task 2–8, with milestone `Stage 0 — Foundations`, using this body:

```markdown
## Goal

<one or two sentences: what and, above all, why>

## Done when

- [ ] <the task's deliverable, as stated in its section of the plan>

## References

- Plan: `docs/plan/stage-0-foundations.md` — Task N
```

| Task | Title                                                              | Label |
| ---- | ------------------------------------------------------------------ | ----- |
| 2    | Document the contribution workflow and add project skills          | docs  |
| 3    | Scaffold the Vite + TypeScript + Phaser app with layered structure | infra |
| 4    | Enforce lint, formatting and the sim/ architecture barrier         | infra |
| 5    | Add end-to-end smoke test on the production build                  | infra |
| 6    | Set up CI, GitHub Pages deploy and security baseline               | infra |
| 7    | Write OpenTTD reference notes for Stage 1 subsystems               | docs  |
| 8    | Close Stage 0                                                      | docs  |

- [ ] **Step 7: Write `docs/plan/TRACKING.md` with the real issue numbers**

```markdown
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
- [ ] 0.2 Contribution workflow and project skills — #<n>
- [ ] 0.3 App scaffold with layered structure — #<n>
- [ ] 0.4 Lint, formatting and sim/ barrier — #<n>
- [ ] 0.5 End-to-end smoke test — #<n>
- [ ] 0.6 CI, deploy and security baseline — #<n>
- [ ] 0.7 OpenTTD reference notes for Stage 1 — #<n>
- [ ] 0.8 Close Stage 0 — #<n>

## Stage 1 — First train

Planned in `stage-1-*.md` when Stage 0 closes.
```

Replace each `#<n>` with the number `gh issue create` returned in Step 6.

- [ ] **Step 8: Initial commit and push**

```bash
git add .gitignore LICENSE README.md docs/plan/
git status --short   # reference/ must NOT appear
git commit -m "chore: bootstrap repository with master plan and tracking" \
  -m "Start from the plan rather than from code: the master plan fixes the
architecture, fidelity policy and roadmap before any implementation, and
TRACKING.md links that roadmap to GitHub issues from day one."
git push -u origin main
```

Expected: `gh repo view S-Tian86/openttd-web --web` shows README, LICENSE (GPL-2.0) and `docs/plan/`.

---

### Task 2: Contribution workflow and project skills

**Files:**

- Create: `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/skills/gh-flow/SKILL.md`, `.claude/skills/close-session/SKILL.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/task.md`, `docs/quality-log.md`
- Modify: `docs/plan/TRACKING.md` (line 0.2)

**Interfaces:**

- Produces: the flow every later task follows (branch names, commit format, PR body, merge command).

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --ff-only
git checkout -b docs/contribution-workflow
```

Mark line 0.2 in `TRACKING.md` as `[~]`.

- [ ] **Step 2: Write `CONTRIBUTING.md`**

````markdown
# How we work

Architecture and roadmap: [`docs/plan/00-master.md`](docs/plan/00-master.md).
The `gh-flow` skill (`.claude/skills/gh-flow/`) executes this document step by step.

## Tracking

- **Milestones = stages** of the roadmap (`Stage 0 — Foundations`, `Stage 1 — First train`, …).
- **Issues = tasks**: something that can be done, reviewed and merged in hours to a couple of days.
- Issues are opened **just-in-time**: when a block starts, all of its issues are opened at once;
  later blocks wait. What we learn in one block changes the next.
- [`docs/plan/TRACKING.md`](docs/plan/TRACKING.md) lists every task in one line and maps it to its
  issue. Opening an issue and adding its line happen in the same move.

## Labels

| Label                | Use                                      |
| -------------------- | ---------------------------------------- |
| `infra`              | Tooling, CI/CD, repository configuration |
| `docs`               | Documentation only                       |
| `bug`, `enhancement` | GitHub defaults                          |

Area labels (`sim`, `render`, `ui`, `fidelity`, …) are created when the first issue needs them
and documented here.

## Branches

- `main` is always deployable and protected: a PR cannot merge with a red CI.
- One branch per issue: `<type>/<short-description>`, type ∈ `feat`, `fix`, `chore`, `docs`,
  `refactor`, `test`.
- Nothing new is committed directly to `main`.

## Commits

- [Conventional commits](https://www.conventionalcommits.org), in English.
- The subject says what; the **body says why** and how we got to this solution. The how is in the
  diff. Failed attempts are not narrated.
- Body lines up to 72 characters. `Refs #N` in the body.
- No co-authorship trailers.
- Test first: the test is written and seen failing before the code that makes it pass, and it
  travels in the same commit as that code.
- Before committing: `npm run lint`, `npm run typecheck`, `npm test` (the pre-commit hook runs
  lint, the type check and Prettier on staged files).

## Pull requests

- One PR per issue, body from the template, with `Closes #N`.
- Before opening it, on the same branch: mark the task `[x]` in `TRACKING.md`; record decisions in
  the stage plan (amend `00-master.md` in place when a master decision changes).
- If a PR exceeds ~400 lines of code (tests and lock files excluded), split it into chained PRs.
- Merge only with CI green: `gh pr checks <n> --watch`, then `gh pr merge <n> --merge --delete-branch`.

## Fidelity

- Every module in `src/sim/` cites the OpenTTD file and function it ports:
  `// Port of economy.cpp GetTransportedGoodsIncome()`.
- Read the source in `reference/OpenTTD` (OpenTTD 15.3, git-ignored; see below) and write or update
  the note in `docs/reference/openttd/` before porting a subsystem.
- Every intentional difference goes to [`docs/game/differences.md`](docs/game/differences.md).

```bash
git clone --depth 1 --branch 15.3 https://github.com/OpenTTD/OpenTTD.git reference/OpenTTD
```

## Sessions

- A session starts from [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md).
- A session ends with the `close-session` skill: clean git, tracking in sync with GitHub, a
  [`docs/quality-log.md`](docs/quality-log.md) entry and a fresh `NEXT-SESSION.md`.
````

- [ ] **Step 3: Write `CLAUDE.md`**

```markdown
# OpenTTD Web — Agent instructions

Faithful web implementation of OpenTTD (15.3) in TypeScript, with a new top-down 3/4 look.

- **Architecture, decisions, roadmap:** [`docs/plan/00-master.md`](docs/plan/00-master.md)
- **Workflow:** [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **Status:** [`docs/plan/TRACKING.md`](docs/plan/TRACKING.md) and GitHub issues
- **Resume work:** [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md)

## Language

Talk to the user in Spanish. Everything that goes to GitHub — code, comments, docs, commits,
issues, PRs, skills — is in English.

## Skill triggers by file

Bound to paths, not to recognising intent. Load the skill **before** the first edit or command.

| If you are about to touch…                      | Load first      |
| ----------------------------------------------- | --------------- |
| `docs/NEXT-SESSION.md` or `docs/quality-log.md` | `close-session` |
| any `git push`, `gh pr create` or `gh pr merge` | `gh-flow`       |

## Rules

- `src/sim/` is pure TypeScript: no Phaser, no DOM, no `render/`/`ui/`/`app/`, no `Math.random`,
  no `Date`, no timers. Tooling enforces it; never disable those rules.
- Game rules live only in `src/sim/`. `render/` and `ui/` issue commands and read state.
- Before porting a subsystem, read its source in `reference/OpenTTD/src` and its note in
  `docs/reference/openttd/`. Cite the ported file and function in a comment. If OpenTTD's
  behaviour is unclear, ask; do not invent it.
- Integer arithmetic in game rules, as in OpenTTD.
- Test first (Vitest). Visual checks with Playwright on headless Chromium.
- Keep it simple: no abstraction or infrastructure the current stage does not need.
```

- [ ] **Step 4: Write `.claude/skills/gh-flow/SKILL.md`**

````markdown
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
````

- [ ] **Step 5: Write `.claude/skills/close-session/SKILL.md`**

````markdown
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
````

- [ ] **Step 6: Write the templates and the quality log**

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## What and why

<!-- Focus on why; the how is in the diff -->

Closes #

## Checklist

- [ ] Follows `CONTRIBUTING.md` (one branch per issue, no co-authorship trailers)
- [ ] Tests written first and passing (`npm test`, `npm run test:e2e` if the UI changed)
- [ ] `TRACKING.md` updated; decisions recorded in the stage plan
- [ ] Ported code cites its OpenTTD source; differences listed in `docs/game/differences.md`
```

`.github/ISSUE_TEMPLATE/task.md`:

```markdown
---
name: Task
about: Implementation task from the roadmap
title: ''
labels: ''
assignees: ''
---

## Goal

<!-- What and, above all, why -->

## Done when

- [ ]

## References

- Plan: `docs/plan/` —
- Milestone:
```

`docs/quality-log.md`:

```markdown
# Quality log

Append-only. One entry per session, written by the `close-session` skill. Its value is the series:
a process change needs the same phase flagged in three entries, and changes one variable at a time.

Each entry answers:

1. Rework: in which phase did the error enter?
2. What did manual testing find that the pipeline did not?
3. Did a phase need information that should have come from the previous one?
```

- [ ] **Step 7: Commit, PR, merge**

```bash
git add CONTRIBUTING.md CLAUDE.md .claude/skills .github docs/quality-log.md docs/plan/TRACKING.md
git commit -m "docs: document contribution workflow and add project skills" \
  -m "Make the workflow executable from day one: CONTRIBUTING states the
rules, and the gh-flow and close-session skills turn them into steps,
so every task and session follows the same path to main.

Refs #<issue>"
```

Mark 0.2 `[x]` in `TRACKING.md` (amend into the commit), then push, PR with `Closes #<issue>`, merge (no CI yet: run nothing, docs only).

---

### Task 3: App scaffold with layered structure

**Files:**

- Create: `package.json`, `.nvmrc`, `tsconfig.json`, `tsconfig.sim.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/app/main.ts`, `src/render/BootScene.ts`, `src/ui/styles.css`, `src/sim/core/constants.ts`, `src/sim/core/constants.test.ts`

**Interfaces:**

- Produces: `npm run dev|build|preview|test|typecheck`; `src/sim/core/constants.ts` exporting `DAY_TICKS`, `MILLISECONDS_PER_TICK`, `TILE_SIZE`; `BootScene` sets `document.documentElement.dataset.gameReady = 'true'` in `create()` (Task 5 waits on it); `#game` is the canvas parent.

- [ ] **Step 1: Branch** — `git checkout -b feat/app-scaffold` from fresh `main`; line 0.3 → `[~]`.

- [ ] **Step 2: Write `package.json` and `.nvmrc`**

`.nvmrc`:

```
22
```

`package.json`:

```json
{
  "name": "openttd-web",
  "version": "0.0.0",
  "private": true,
  "description": "A faithful web implementation of OpenTTD with a colourful top-down look",
  "license": "GPL-2.0-or-later",
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.sim.json && tsc -p tests/tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

```bash
npm install phaser@^4.2.1
npm install -D typescript@^7.0.2 vite@^8.3.4 vitest@^5.0.3 @types/node@^24
```

- [ ] **Step 3: Write the TypeScript configs**

`tsconfig.json` (app code, browser):

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`tsconfig.sim.json` (the barrier: no DOM lib and no ambient types, so a browser or Node global does not compile):

```jsonc
{
  // src/sim: pure TypeScript that runs anywhere. tests/architecture/boundary.test.ts proves it.
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2023"],
    "types": [],
  },
  "include": ["src/sim"],
  "exclude": ["**/*.test.ts"],
}
```

`tests/tsconfig.json` (tests and tool configs run in Node):

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vite/client"]
  },
  "include": ["**/*.ts", "../vitest.config.ts", "../playwright.config.ts"],
  "exclude": ["architecture/sim-*.ts"]
}
```

If `tsc` rejects `import Phaser from 'phaser'` (Phaser's types use `export =`), switch both files in Step 7 to `import * as Phaser from 'phaser'`: the ESM build exposes the same names as named exports.

- [ ] **Step 4: Write the failing test for the first ported constants**

`src/sim/core/constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DAY_TICKS, MILLISECONDS_PER_TICK, TILE_SIZE } from './constants';

// Fidelity: values copied from OpenTTD 15.3. Changing them changes the game.
describe('core constants (OpenTTD 15.3)', () => {
  it('has 74 ticks per day', () => {
    expect(DAY_TICKS).toBe(74);
  });

  it('runs a tick every 27 ms at normal speed', () => {
    expect(MILLISECONDS_PER_TICK).toBe(27);
  });

  it('divides a tile edge into 16 world units', () => {
    expect(TILE_SIZE).toBe(16);
  });
});
```

Run: `npx vitest run src/sim/core/constants.test.ts`
Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 5: Implement the constants**

`src/sim/core/constants.ts`:

```ts
/** Ticks in one game day. Port of TimerGameTick::DAY_TICKS (timer/timer_game_tick.h). */
export const DAY_TICKS = 74;

/** Real milliseconds per tick at normal speed. Port of MILLISECONDS_PER_TICK (gfx_type.h). */
export const MILLISECONDS_PER_TICK = 27;

/** World units along one tile edge; vehicles move on this sub-grid. Port of TILE_SIZE (tile_type.h). */
export const TILE_SIZE = 16;
```

Run: `npx vitest run src/sim/core/constants.test.ts` — Expected: 3 passed.

- [ ] **Step 6: Write `vitest.config.ts` and `vite.config.ts`**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

`vite.config.ts` (CSP is injected only in production builds: the dev server needs inline scripts for hot reload):

```ts
import { defineConfig, type Plugin } from 'vite';

// Strict Content Security Policy (docs/plan/00-master.md §2.10).
// data:/blob: are needed by Phaser for generated textures.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // Relative base: the same build works on GitHub Pages (/openttd-web/), itch.io or any sub-path.
  base: './',
  plugins: [contentSecurityPolicy()],
  build: { target: 'es2022' },
});
```

- [ ] **Step 7: Write the page, styles, scene and bootstrap**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>openttd-web</title>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/app/main.ts"></script>
  </body>
</html>
```

`src/ui/styles.css`:

```css
:root {
  --color-background: #bfe6c8;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--color-background);
}

#game {
  width: 100%;
  height: 100%;
}
```

`src/render/BootScene.ts`:

```ts
import Phaser from 'phaser';

/** Placeholder scene until Stage 1 draws the map. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'openttd-web', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#2d4a3e',
      })
      .setOrigin(0.5);
    // Signals to end-to-end tests that the first frame is ready.
    document.documentElement.dataset.gameReady = 'true';
  }
}
```

`src/app/main.ts`:

```ts
import Phaser from 'phaser';
import { BootScene } from '../render/BootScene';
import '../ui/styles.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#bfe6c8',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [BootScene],
});
```

- [ ] **Step 8: Verify**

```bash
npm run typecheck   # expected: no errors from both configs
npm test            # expected: 3 passed
npm run build       # expected: dist/index.html with the CSP <meta> first in <head>
grep -c 'Content-Security-Policy' dist/index.html   # expected: 1
```

Visual check: `npm run preview -- --port 4173` and take a screenshot with headless Chromium (`npx playwright screenshot http://localhost:4173 /tmp/boot.png` once Task 5 installs it, or skip until Task 5). Expected: green background, centred "openttd-web".

- [ ] **Step 9: Commit, PR, merge**

```bash
git add package.json package-lock.json .nvmrc tsconfig.json tsconfig.sim.json tests/tsconfig.json vite.config.ts vitest.config.ts index.html src docs/plan/TRACKING.md
git commit -m "feat: scaffold Vite, TypeScript and Phaser app with layered structure" \
  -m "Lay out sim/, render/, ui/ and app/ from the start so the dependency
rule exists before any game code. sim/ gets its own tsconfig without DOM
types, and the first ported constants (ticks per day, tick duration,
tile size) seed the convention of citing the OpenTTD source.

The CSP is injected only in production builds because the dev server
relies on inline scripts for hot reload.

Refs #<issue>"
```

Line 0.3 → `[x]`, push, PR `Closes #<issue>`, merge (CI arrives in Task 6; run the checks locally).

---

### Task 4: Lint, formatting and the sim/ architecture barrier

Same pattern as `covo`: oxlint rules scoped to `src/sim/**`, plus deliberately broken fixture
files that the architecture test feeds to `tsc` and `oxlint`, expecting both to fail.

**Files:**

- Create: `.oxlintrc.json`, `.prettierrc.json`, `.prettierignore`, `.husky/pre-commit`, `tests/architecture/boundary.test.ts`, `tests/architecture/sim-imports.ts`, `tests/architecture/sim-globals.ts`, `tests/architecture/tsconfig.json`
- Modify: `package.json` (scripts, `lint-staged`)

**Interfaces:**

- Consumes: `npm test` (Vitest picks up `tests/**/*.test.ts`); `src/render/BootScene.ts` and `src/sim/core/constants.ts` from Task 3 (imported by the fixture).
- Produces: `npm run lint`, `npm run format`, `npm run format:check`; rules `no-restricted-imports`, `no-restricted-globals`, `no-restricted-properties` active on `src/sim/**`.

- [ ] **Step 1: Branch and install** — `feat/architecture-barrier`; line 0.4 → `[~]`.

```bash
npm install -D oxlint@^1.87.0 prettier@^3.9.9 husky@^9.1.7 lint-staged@^17.6.0
```

- [ ] **Step 2: Write the fixtures and the failing architecture test**

`tests/architecture/sim-imports.ts`:

```ts
// Deliberately breaks the sim/ barrier with imports; boundary.test.ts checks that the
// linter rejects them. The sim import is the control: sim may import sim.
import Phaser from 'phaser';
import { readFileSync } from 'node:fs';
import { BootScene } from '../../src/render/BootScene';
import { economy } from '../../reference/OpenTTD/src/economy';
import { DAY_TICKS } from '../../src/sim/core/constants';

export const leaks = [Phaser, readFileSync, BootScene, economy, DAY_TICKS];
```

`tests/architecture/sim-globals.ts`:

```ts
// Deliberately breaks the sim/ barrier with browser globals, the clock and randomness;
// boundary.test.ts checks that the sim typecheck and the linter reject them.
export const leaks = [window.innerWidth, localStorage, Date.now(), Math.random()];
```

`tests/architecture/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.sim.json",
  "include": ["sim-globals.ts"],
  "exclude": []
}
```

`tests/architecture/boundary.test.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// src/sim is pure, deterministic TypeScript (docs/plan/00-master.md §2.2–2.3). The tooling
// enforces it; these tests prove each barrier rejects the fixtures in tests/architecture/,
// so a wrong glob cannot silently switch a barrier off.

const run = (bin: string, args: string[]): { status: number | null; output: string } => {
  const result = spawnSync(`node_modules/.bin/${bin}`, args, { encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
};

describe('sim/ boundary', () => {
  it('sim typecheck rejects browser globals', () => {
    const { status, output } = run('tsc', ['-p', 'tests/architecture/tsconfig.json']);
    expect(status).not.toBe(0);
    expect(output).toContain("Cannot find name 'window'");
    expect(output).toContain("Cannot find name 'localStorage'");
  });

  it('linter rejects Phaser, Node, outer-layer and reference imports', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/sim-imports.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("'phaser' import is restricted");
    expect(output).toContain("'node:fs' import is restricted");
    expect(output).toContain("'../../src/render/BootScene' import is restricted");
    expect(output).toContain("'../../reference/OpenTTD/src/economy' import is restricted");
    expect(output).not.toContain("'../../src/sim/core/constants' import is restricted");
  });

  it('linter rejects browser globals, the clock and Math.random', () => {
    const { status, output } = run('oxlint', [
      '--deny-warnings',
      'tests/architecture/sim-globals.ts',
    ]);
    expect(status).not.toBe(0);
    expect(output).toContain("Unexpected use of 'window'");
    expect(output).toContain("Unexpected use of 'Date'");
    expect(output).toContain("'Math.random' is restricted");
  });
});
```

Run: `npx vitest run tests/architecture`
Expected: the typecheck test passes (the sim tsconfig from Task 3 already has no DOM); both linter tests FAIL (no `.oxlintrc.json` yet, so nothing is restricted).

- [ ] **Step 3: Write `.oxlintrc.json`**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc", "import", "vitest"],
  "categories": {
    "correctness": "error",
    "suspicious": "error"
  },
  "ignorePatterns": [
    "dist/**",
    "coverage/**",
    "reference/**",
    "playwright-report/**",
    "test-results/**"
  ],
  "rules": {
    "import/no-unassigned-import": ["error", { "allow": ["**/*.css"] }]
  },
  "overrides": [
    {
      "files": ["src/sim/**", "tests/architecture/sim-*.ts"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["phaser", "phaser/*"],
                "message": "src/sim must not depend on Phaser (master plan §2.2)."
              },
              {
                "group": ["node:*"],
                "message": "src/sim must not use Node APIs (master plan §2.2)."
              },
              {
                "group": ["**/render", "**/render/**", "**/ui", "**/ui/**", "**/app", "**/app/**"],
                "message": "src/sim must not import outer layers (master plan §2.2)."
              },
              {
                "group": ["**/reference/**"],
                "message": "reference/ is a local OpenTTD clone, not part of the build."
              }
            ]
          }
        ],
        "no-restricted-globals": [
          "error",
          "window",
          "document",
          "navigator",
          "location",
          "localStorage",
          "sessionStorage",
          "indexedDB",
          "fetch",
          "performance",
          "Date",
          "setTimeout",
          "setInterval",
          "requestAnimationFrame",
          "alert",
          "confirm"
        ],
        "no-restricted-properties": [
          "error",
          {
            "object": "Math",
            "property": "random",
            "message": "Use the seeded RNG in the game state (master plan §2.3)."
          }
        ]
      }
    }
  ]
}
```

Run: `npx vitest run tests/architecture` — Expected: 3 passed.
If an expected message differs (oxlint wording), print `output` once, adjust the **expected string only**, and keep the assertion.

- [ ] **Step 4: Prettier, scripts, pre-commit hook**

`.prettierrc.json`:

```json
{
  "singleQuote": true,
  "printWidth": 100
}
```

`.prettierignore`:

```
dist/
coverage/
reference/
playwright-report/
test-results/
package-lock.json
```

Add to `package.json` (the fixtures are ignored by the normal lint, as in covo):

```json
{
  "scripts": {
    "lint": "oxlint --deny-warnings --ignore-pattern 'tests/architecture/sim-*.ts'",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,js,md,json,css,html,yml,yaml}": "prettier --write"
  }
}
```

```bash
npx husky init
printf 'npm run lint\nnpm run typecheck\nnpx lint-staged\n' > .husky/pre-commit
npm run format
npm run format:check && npm run lint && npm run typecheck && npm test   # expected: all green
```

- [ ] **Step 5: Commit, PR, merge**

```bash
git add .oxlintrc.json .prettierrc.json .prettierignore .husky tests/architecture package.json package-lock.json docs/plan/TRACKING.md
git add -u   # files reformatted by Prettier
git commit -m "feat: enforce lint, formatting and the sim/ architecture barrier" \
  -m "The layer rule and determinism only hold if breaking them fails the
build. oxlint now rejects Phaser, Node, outer layers, the reference
clone, clocks and Math.random inside sim/, and the sim tsconfig has no
DOM. Deliberately broken fixtures prove each barrier fires, so a wrong
glob cannot silently switch one off.

Refs #<issue>"
```

Line 0.4 → `[x]`, push, PR, merge.

---

### Task 5: End-to-end smoke test on the production build

**Files:**

- Create: `playwright.config.ts`, `tests/e2e/boot.spec.ts`
- Modify: `package.json` (script `test:e2e`), `vitest.config.ts` only if Vitest picks up `tests/e2e` (it must not: e2e files end in `.spec.ts`)

**Interfaces:**

- Consumes: `data-game-ready` on `<html>` (Task 3), CSP meta (Task 3).
- Produces: `npm run test:e2e`, screenshot `test-results/boot.png`.

- [ ] **Step 1: Branch** — `test/e2e-smoke`; line 0.5 → `[~]`.

```bash
npm install -D @playwright/test@^1.64.0
npx playwright install chromium
```

Add script: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Always the production build: it is what GitHub Pages serves, CSP included.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Write the e2e test**

`tests/e2e/boot.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

/** Collects console errors, page errors and failed responses (CSP violations log as console errors). */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return problems;
}

test('boots the production build without errors under the CSP', async ({ page }) => {
  const problems = watchForProblems(page);

  await page.goto('./');

  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/boot.png' });
  expect(problems).toEqual([]);
});

test('the canvas follows a phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');

  const box = await page.locator('#game canvas').boundingBox();
  expect(box?.width).toBe(375);
  expect(box?.height).toBe(667);
});
```

- [ ] **Step 4: Run it**

Run: `npm run test:e2e`
Expected: 2 passed. Open `test-results/boot.png` and check visually: green background, centred title.
If the first test fails with a CSP message, fix the policy in `vite.config.ts` (add only the source the message names) and record why in the commit body.

- [ ] **Step 5: Commit, PR, merge**

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json docs/plan/TRACKING.md
git commit -m "test: add end-to-end smoke test on the production build" \
  -m "Unit tests cannot see a black screen. The e2e test runs the build that
GitHub Pages will serve, with its CSP and relative base, and fails on
any console error, page error or failed request, plus a phone-sized
viewport check so the canvas keeps following the window.

Refs #<issue>"
```

Line 0.5 → `[x]`, push, PR, merge.

---

### Task 6: CI, GitHub Pages deploy and security baseline

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `SECURITY.md`

**Interfaces:**

- Consumes: every npm script from Tasks 3–5.
- Produces: required status check **`check`** on `main`; site at `https://s-tian86.github.io/openttd-web/`.

- [ ] **Step 1: Branch** — `chore/ci-deploy-security`; line 0.6 → `[~]`.

- [ ] **Step 2: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm audit --audit-level=high
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
```

- [ ] **Step 3: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 4: Write `.github/dependabot.yml` and `SECURITY.md`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      dev-dependencies:
        dependency-type: development
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

`SECURITY.md`:

```markdown
# Security policy

openttd-web is a static site: the game runs entirely in your browser, with no backend and no
accounts. Its protections are a strict Content Security Policy, validation of every untrusted
input (such as imported save files) and automated dependency auditing.

## Reporting a vulnerability

Please report it privately through
[GitHub security advisories](https://github.com/S-Tian86/openttd-web/security/advisories/new),
not in a public issue. You will get an answer within a week.

## Supported versions

Only the latest version deployed from `main` is supported.
```

- [ ] **Step 5: Commit, push, open the PR and watch CI**

```bash
git add .github SECURITY.md docs/plan/TRACKING.md
git commit -m "chore: set up CI, GitHub Pages deploy and security baseline" \
  -m "Every PR now runs formatting, lint, types, unit, architecture and
e2e tests plus a dependency audit on a clean checkout, which also
proves the project builds without the local OpenTTD clone. Merges to
main deploy to GitHub Pages, so the latest version is always playable.

Refs #<issue>"
git push -u origin chore/ci-deploy-security
gh pr create --base main --title "Set up CI, GitHub Pages deploy and security baseline" --body-file -
gh pr checks <pr> --watch   # expected: check ✓
```

- [ ] **Step 6: Configure the repository (once CI has run, so the `check` context exists)**

```bash
# GitHub Pages built by Actions
gh api -X POST repos/S-Tian86/openttd-web/pages -f build_type=workflow

# Secret scanning push protection
gh api -X PATCH repos/S-Tian86/openttd-web --input - <<'JSON'
{ "security_and_analysis": { "secret_scanning": { "status": "enabled" },
  "secret_scanning_push_protection": { "status": "enabled" } } }
JSON

# Protect main: CI must pass and the branch must be up to date; admins included
gh api -X PUT repos/S-Tian86/openttd-web/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["check"] },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

Expected: `gh api repos/S-Tian86/openttd-web/branches/main/protection --jq .required_status_checks.contexts` → `["check"]`.

- [ ] **Step 7: Merge and verify the deploy**

```bash
gh pr merge <pr> --merge --delete-branch
git checkout main && git pull --ff-only
gh run watch $(gh run list --workflow Deploy --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: `https://s-tian86.github.io/openttd-web/` shows the boot scene. Check it with headless Chromium: `npx playwright screenshot https://s-tian86.github.io/openttd-web/ /tmp/pages.png` and look at the image. Line 0.6 → `[x]` goes in the next PR (Task 7), since `main` is now protected.

---

### Task 7: OpenTTD reference notes for Stage 1

Research task: read the OpenTTD 15.3 source and write what Stage 1 needs to port. The output feeds the Stage 1 plan; nothing is implemented.

**Files:**

- Create: `docs/reference/openttd/README.md`, `time.md`, `map.md`, `track.md`, `trains.md`, `orders.md`, `stations-cargo.md`, `economy.md`, `towns-industries.md`, `docs/game/README.md`, `docs/game/differences.md`

**Interfaces:**

- Produces: one note per subsystem with the fixed template below; Stage 1's plan cites these notes.

- [ ] **Step 1: Branch** — `docs/openttd-reference-notes`; line 0.6 → `[x]`, line 0.7 → `[~]`.

- [ ] **Step 2: Write `docs/reference/openttd/README.md` with the template**

```markdown
# OpenTTD reference notes

What each OpenTTD subsystem does, **as read from its source** (OpenTTD 15.3, `reference/OpenTTD/src`),
written before porting it. A note is the bridge between the C++ code and our TypeScript port.

Every note follows this template:

1. **Purpose** — what the subsystem does in the game, in two or three sentences.
2. **Source files** — paths and the key functions, with one line each.
3. **State** — the data it keeps (fields, types, units).
4. **Rules and formulas** — the behaviour, as pseudo-code with the original constants, citing
   `file:function` for each.
5. **Defaults** — the default settings of a new game that affect it.
6. **Stage 1 needs** — what must be ported now.
7. **Skipped** — what is left out and why (NewGRF callbacks, later stages).

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
```

- [ ] **Step 3: Write one note per subsystem, reading exactly these sources**

| Note                  | Read in `reference/OpenTTD/src`                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `time.md`             | `timer/timer_game_tick.h`, `timer/timer_game_calendar.{h,cpp}`, `timer/timer_game_economy.{h,cpp}`, `date_type.h`, `gfx_type.h` (`MILLISECONDS_PER_TICK`)                                                                      |
| `map.md`              | `map_type.h`, `map_func.h`, `map.cpp`, `tile_type.h`, `tile_map.h`, `landscape.cpp` (tile loop), `clear_map.h`, `tree_map.h`, `water_map.h`                                                                                    |
| `track.md`            | `track_type.h`, `track_func.h`, `rail_map.h`, `rail_cmd.cpp` (`CmdBuildSingleRail`, `CmdRemoveSingleRail`, `CmdBuildRailroadTrack`, `CmdBuildTrainDepot`), `table/track_data.h`, `table/railtypes.h`                           |
| `trains.md`           | `train.h`, `train_cmd.cpp` (`TrainController`, `UpdateSpeed`, `CmdBuildRailVehicle`), `ground_vehicle.hpp`, `ground_vehicle.cpp`, `vehicle_base.h`, `table/engines.h` (engines available in the default climate at game start) |
| `orders.md`           | `order_type.h`, `order_base.h`, `order_cmd.cpp` (`CmdInsertOrder`, `CmdModifyOrder`), `vehicle.cpp` (order processing)                                                                                                         |
| `stations-cargo.md`   | `station_base.h`, `station_cmd.cpp` (`CmdBuildRailStation`, catchment, `UpdateStationRating`), `cargopacket.{h,cpp}`, `economy.cpp` (`LoadUnloadStation`), `table/cargo_const.h`                                               |
| `economy.md`          | `economy.cpp` (`GetTransportedGoodsIncome`, `DeliverGoods`, `CompaniesGenStatistics`), `table/pricebase.h`, `misc_cmd.cpp` (`CmdIncreaseLoan`, `CmdDecreaseLoan`), `company_cmd.cpp`, `table/settings/difficulty_settings.ini` |
| `towns-industries.md` | `town_cmd.cpp` (`TileLoop_Town` passenger generation), `town_land.h`, `industry_cmd.cpp` (production callbacks, `ProduceIndustryGoods`), `table/build_industry.h` (coal mine, power station), acceptance in `station_cmd.cpp`  |

Each note follows the README template. Formulas are transcribed with their constants and the
`file:function` they come from. When the source is ambiguous, write the question in the note
under **Open questions** instead of guessing.

- [ ] **Step 4: Write `docs/game/README.md` and `docs/game/differences.md`**

`docs/game/README.md`:

```markdown
# The game

Player-facing documentation: how each mechanic works and what to try in each playtest.
It grows with every stage.

- [Differences from OpenTTD](differences.md)
```

`docs/game/differences.md`:

```markdown
# Differences from OpenTTD

Everything listed here differs from OpenTTD 15.3 on purpose. Anything not listed must behave
like OpenTTD; a mismatch is a bug.

| Area                   | OpenTTD           | openttd-web                | Why                                       |
| ---------------------- | ----------------- | -------------------------- | ----------------------------------------- |
| View                   | Isometric         | Top-down 3/4               | New look; game logic keeps OpenTTD's grid |
| Graphics, sound, music | Original sets     | Original art, no audio yet | Own art style; no third-party assets      |
| NewGRF                 | Supported         | Not supported              | Out of scope (master plan §2.8)           |
| AI and Game Scripts    | NoAI / GameScript | Not supported              | Out of scope (master plan §2.8)           |
| Scenario editor        | Yes               | No                         | Out of scope (master plan §2.8)           |
| Network play           | Yes               | Not yet                    | Needs a backend (master plan §2.9)        |
```

- [ ] **Step 5: Self-check each note**

For each note: every formula cites `file:function`; every constant has its value; **Stage 1 needs** and **Skipped** are filled; open questions are listed. Run `npm run format:check`.

- [ ] **Step 6: Commit, PR, merge**

```bash
git add docs/reference docs/game docs/plan/TRACKING.md
git commit -m "docs: write OpenTTD reference notes for Stage 1 subsystems" \
  -m "Read the source before porting it. Each note turns one OpenTTD
subsystem into formulas, constants and defaults with their file and
function, and states what Stage 1 needs and what it skips, so the
Stage 1 plan argues from the original code instead of from memory.

Refs #<issue>"
```

Line 0.7 → `[x]` (in this PR), push, PR, `gh pr checks --watch`, merge.

---

### Task 8: Close Stage 0

**Files:**

- Create: `docs/NEXT-SESSION.md`
- Modify: `docs/quality-log.md`, `docs/plan/TRACKING.md`, `README.md` (status line)

- [ ] **Step 1: Branch** — `docs/close-stage-0`; line 0.8 → `[~]`. Load the `close-session` skill.

- [ ] **Step 2: Playtest handoff to the user (in Spanish)**

Send the user the Pages URL and the screenshot. Stage 0 has nothing to play: the check is that
the site loads on their machine and phone.

- [ ] **Step 3: Run the `close-session` skill**

It appends the quality-log entry and writes `docs/NEXT-SESSION.md`, whose next task is
"brainstorm and plan Stage 1 — First train from `docs/reference/openttd/`".

- [ ] **Step 4: README status line**

Replace the status line with:

```markdown
> **Status:** Stage 0 (foundations) complete — [live build](https://s-tian86.github.io/openttd-web/).
> Next: Stage 1, the first playable train line. See the [roadmap](docs/plan/00-master.md#6-roadmap).
```

- [ ] **Step 5: Commit, PR, merge, close the milestone**

```bash
git add docs/NEXT-SESSION.md docs/quality-log.md docs/plan/TRACKING.md README.md
git commit -m "docs: close Stage 0" \
  -m "Foundations are in place: the app builds, tests and deploys on every
merge. The handoff points the next session at planning Stage 1 from
the reference notes.

Refs #<issue>"
```

Line 0.8 → `[x]`, push, PR, checks, merge. Then:

```bash
gh api -X PATCH repos/S-Tian86/openttd-web/milestones/1 -f state=closed
```

---

## Execution notes

Decisions taken while executing this plan. Where they differ from the tasks above, **these
notes and the code are the truth**.

| Task   | Decision                                                                                                                  | Why                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1      | `git init` + `git symbolic-ref HEAD refs/heads/main` instead of `git init -b main`                                        | The host has git 2.25, which lacks `-b`                         |
| 1      | No default `bug`/`enhancement` labels; every label is created on first use                                                | The new repository came without GitHub's default labels         |
| 3      | `chunkSizeWarningLimit: 1500` in `vite.config.ts`                                                                         | Phaser alone is ~1.3 MB minified; one game, one chunk           |
| 3–5    | Previews and e2e use port **4317**                                                                                        | Other projects on the host preview on Vite's default 4173       |
| 4      | **No lint-staged**: the pre-commit hook runs `lint`, `typecheck` and `format:check` on the whole repo                     | lint-staged 17 needs git ≥ 2.32; the full checks take seconds   |
| 4      | Phaser is imported by name (`import { Scene } from 'phaser'`)                                                             | oxlint `import/no-named-as-default-member`                      |
| 5      | Local e2e uses the installed Google Chrome (`channel: 'chrome'`); CI uses Playwright's Chromium                           | Playwright ships no Chromium for Ubuntu 20.04                   |
| 5      | `public/favicon.svg` added                                                                                                | The e2e test caught a real 404 on `/favicon.ico`                |
| 5      | `reuseExistingServer: false`; console errors include the failing URL                                                      | A stale preview once made the test run against an old build     |
| 6      | Private vulnerability reporting and Dependabot alerts/security updates enabled                                            | `SECURITY.md` links to private reporting                        |
| 7      | Notes researched by parallel agents, reviewed against the template; formulas spot-checked against the source              | Keeps ~50 C++ files out of one context                          |
| 7      | `/reference/` anchored to the repo root in `.gitignore` and `.prettierignore`                                             | Unanchored, it also hid `docs/reference/`                       |
| Review | Boundary test lints a temporary file inside `src/sim/` (and a control outside); e2e serves the build from `/openttd-web/` | The final review proved both guards could not fail before (#15) |
| 8      | `@types/node` pinned to `^22`; Dependabot ignores its major updates                                                       | Node types must follow the runtime in `.nvmrc`                  |

Deferred from the final review (minor): no e2e resize after load; `globalThis.Date` and
`globalThis.Math.random` bypass the sim barrier; `constants.ts` cites `TimerGameTick::DAY_TICKS`
where the source names it `Ticks::DAY_TICKS`.
