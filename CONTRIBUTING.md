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

| Label   | Use                                      |
| ------- | ---------------------------------------- |
| `infra` | Tooling, CI/CD, repository configuration |
| `docs`  | Documentation only                       |

Other labels (`bug`, `sim`, `render`, `ui`, `fidelity`, …) are created when the first issue
needs them and documented here.

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
  lint, the type check and the format check).

## Pull requests

- One PR per issue, body from the template, with `Closes #N`.
- Before opening it, on the same branch: mark the task `[x]` in `TRACKING.md`; record decisions in
  the stage plan (amend `00-master.md` in place when a master decision changes).
- If a PR exceeds ~400 lines of code (tests and lock files excluded), split it into chained PRs.
- Merge only with CI green: `gh pr checks <n> --watch`, then `gh pr merge <n> --merge --delete-branch`.

## Block branches (from Stage 1)

Each block of a stage has a branch, `stage-N/block-N.M`, created from the previous block's
branch (the first block from `main`). Task PRs target the **block branch**. Branches matching
`stage-*/**` are protected by a ruleset: changes only through PRs with the `check` status green.
Creating a new block branch needs the ruleset disabled for the push; the steps are in the
`gh-flow` skill ("Creating a new block branch").

- Every push to a block branch deploys a preview to
  `https://s-tian86.github.io/openttd-web/preview/block-N-M/`.
- When a block is complete, the author gets the preview link and its playtest guide
  (`docs/game/block-N.M.md`), and work continues on the next block.
- Playtest fixes go to the tested block's branch; then a PR **merges** (never rebases) that
  branch into each later block branch.
- An approved block merges into `main` through a PR, in order.
- At most three completed blocks may wait for a playtest.

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
