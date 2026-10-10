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

| If you are about to touch… | Load first |
|---|---|
| `docs/NEXT-SESSION.md` or `docs/quality-log.md` | `close-session` |
| any `git push`, `gh pr create` or `gh pr merge` | `gh-flow` |

## Rules

- `src/sim/` is pure TypeScript: no Phaser, no DOM, no `render/`/`ui/`/`app/`, no `Math.random`,
  no `Date`, no timers. Tooling enforces it; never disable those rules.
- Game rules live only in `src/sim/`. `render/` and `ui/` issue commands and read state.
- Before porting a subsystem, read its source in `reference/OpenTTD/src` and its note in
  `docs/reference/openttd/`. Cite the ported file and function in a comment. If OpenTTD's
  behaviour is unclear, ask; do not invent it.
- Integer arithmetic in game rules, as in OpenTTD.
- Test first (Vitest). Visual checks with Playwright on headless Chromium.
- Never `cd` into `reference/`: it is another git repository and tools that resolve the
  project from the working directory (such as the Engram memory hook) pick the wrong one.
  Use absolute paths.
- Keep it simple: no abstraction or infrastructure the current stage does not need.
